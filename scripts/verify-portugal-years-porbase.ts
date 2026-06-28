/**
 * Portugal Estado Novo — per-title publication-year verification against PORBASE
 * (Base Nacional de Dados Bibliográficos, Biblioteca Nacional de Portugal).
 *
 * WHY: the import seeded each PT ban's year from José Brandão's DATA column,
 * which is "data da edição ou da proibição" (edition OR ban year, ambiguous).
 * books.first_published_year was left NULL pending verification. PORBASE is the
 * authoritative catalogue for exactly these Portuguese editions. This script
 * resolves the EARLIEST catalogued edition per title → a defensible
 * first_published_year, and confirms the work/author (catching parse errors).
 *
 * ACCESS: PORBASE has no open API/SRU (403 to bots) and is a JS-rendered iPAC
 * OPAC. We reach it through the Firecrawl API (real browser, passes the WAF):
 *   https://porbase.bnportugal.gov.pt/ipac20/ipac.jsp?profile=porbase&index=.GW&term=<title>+<surname>
 * Records come back server-rendered in ISBD form, e.g.:
 *   "Gaibéus / Alves Redol. 4a ed. [Mem-Martins] : Europa-América, 1975."
 *
 * MATCH SAFETY (namesake / same-title-other-work guard):
 *   A catalogue record counts ONLY when
 *     (a) the title before " / " matches our title (article-insensitive), AND
 *     (b) the author surname appears in the statement of responsibility AFTER
 *         " / " (so "…dos 'Gaibéus' de Alves Redol / António Salvado" — a book
 *         ABOUT the work — is correctly rejected: surname not in "António Salvado").
 *   first_published_year = earliest plausible year among matched records.
 *   No match / no plausible year → REVIEW (never written).
 *
 * Resumable: raw PORBASE markdown cached per book → re-runs/bulk don't re-scrape.
 *
 * READ-ONLY — writes NOTHING to the DB. Produces a per-title review report.
 *
 * Decision (2026-06-28): we do NOT auto-write first_published_year from PORBASE.
 * The sample showed it gives the Portuguese EDITION year, which for ~half the
 * batch (translations of foreign works — Dos Passos, Mao, Moravia…) is not the
 * work's original first-publication year, and reprint-noisy edition lists make a
 * single derived year unreliable. So first_published_year stays NULL (NULL >
 * wrong year) and this script is a confirmation/review aid only: does the book
 * exist in PORBASE, which editions, does the Brandão DATA match an edition year.
 * The "earliest" column is a CANDIDATE for human review, never written.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/verify-portugal-years-porbase.ts                 # sample 20
 *   pnpm tsx --env-file=.env.local scripts/verify-portugal-years-porbase.ts --limit=873     # full report
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const val = (f: string): string | null => {
  const hit = argv.find(a => a.startsWith(`--${f}=`))
  return hit ? hit.split('=').slice(1).join('=') : null
}
const LIMIT = val('limit') ? parseInt(val('limit')!, 10) : 20
const OFFSET = val('offset') ? parseInt(val('offset')!, 10) : 0

const CACHE = 'data/source-research/porbase-cache.json'
const FC_KEY = process.env.FIRECRAWL_API_KEY
const YEAR_FLOOR = 1850 // sane lower bound for these works (drop OCR/typo noise below)
const YEAR_CEIL = 2010

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const stripArticle = (s: string) => norm(s).replace(/^(o|a|os|as|um|uma|the|le|la|les|el)\s+/, '')

type Book = { id: number; slug: string; title: string; authors: string[]; brandao_year: number; fpy: number | null }
type Rec = { title: string; resp: string; years: number[]; publisher: string | null; line: string }

function ensureDirs() {
  if (!existsSync('data/source-research')) mkdirSync('data/source-research', { recursive: true })
}
function loadCache(): Record<string, string> {
  if (existsSync(CACHE)) { try { return JSON.parse(readFileSync(CACHE, 'utf8')) } catch { /* */ } }
  return {}
}

async function porbaseMarkdown(term: string): Promise<string> {
  const url = `https://porbase.bnportugal.gov.pt/ipac20/ipac.jsp?profile=porbase&index=.GW&term=${encodeURIComponent(term)}`
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor: 4000 }),
  })
  if (!res.ok) throw new Error(`firecrawl HTTP ${res.status}`)
  const j = (await res.json()) as { data?: { markdown?: string } }
  return j.data?.markdown ?? ''
}

// Parse ISBD-ish records out of the iPAC result markdown.
function parseRecords(md: string): Rec[] {
  const recs: Rec[] = []
  for (const raw of md.split('\n')) {
    // a result line: contains " / " (title/responsibility) and a 4-digit year
    const line = raw.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line.includes(' / ')) continue
    if (/jump to content|listas bibliogr|ordenar por|registos para/i.test(line)) continue
    const slash = line.indexOf(' / ')
    const title = line.slice(0, slash).trim()
    const resp = line.slice(slash + 3).trim()
    // Years come ONLY from the responsibility/publication area (after " / "), never
    // from the title — titles like "1919" or "08/15" must not be read as years.
    const years = [...resp.matchAll(/\b(1[5-9]\d{2}|20[0-2]\d)\b/g)].map(m => parseInt(m[1], 10))
    if (years.length === 0) continue
    // publisher: text after the last " : " and before the year
    let publisher: string | null = null
    const pm = resp.match(/:\s*([^:,]+?),?\s*\b(?:1[5-9]\d{2}|20[0-2]\d)\b/)
    if (pm) publisher = pm[1].trim()
    recs.push({ title, resp, years, publisher, line })
  }
  return recs
}

function matchRecords(book: Book, recs: Rec[]): Rec[] {
  const wantTitle = stripArticle(book.title)
  const surnames = book.authors.map(a => norm(a).split(' ').filter(Boolean).pop() ?? '').filter(s => s.length >= 4)
  return recs.filter(r => {
    const rt = stripArticle(r.title)
    const titleOk = rt.length >= 3 && (rt.includes(wantTitle) || wantTitle.includes(rt))
    if (!titleOk) return false
    const respN = norm(r.resp)
    // author surname must appear in the statement of responsibility (after " / ")
    return surnames.length === 0 ? false : surnames.some(s => respN.includes(s))
  })
}

type Outcome = {
  book: Book
  status: 'confirmed' | 'no-match' | 'ambiguous'
  fpy: number | null
  matched: Array<{ year: number; publisher: string | null; title: string }>
  note: string
}

function decide(book: Book, md: string): Outcome {
  const recs = parseRecords(md)
  const matched = matchRecords(book, recs)
  if (matched.length === 0) {
    return { book, status: 'no-match', fpy: null, matched: [], note: recs.length ? `${recs.length} records, none author+title matched` : 'no records' }
  }
  let years = matched.flatMap(r => r.years).filter(y => y >= YEAR_FLOOR && y <= YEAR_CEIL).sort((a, b) => a - b)
  if (years.length === 0) {
    return { book, status: 'ambiguous', fpy: null, matched: matched.map(r => ({ year: r.years[0], publisher: r.publisher, title: r.title })), note: 'matched but no plausible year' }
  }
  // Drop an isolated low outlier (a lone record >15y below the rest is usually a
  // mis-catalogued or different entry, e.g. a stray "1920" under a 1941 work).
  while (years.length >= 2 && years[1] - years[0] > 15) years = years.slice(1)
  const fpy = years[0]
  const flat = matched.map(r => ({ year: Math.min(...r.years.filter(y => y >= YEAR_FLOOR && y <= YEAR_CEIL).concat(r.years)), publisher: r.publisher, title: r.title }))
  return { book, status: 'confirmed', fpy, matched: flat, note: `${matched.length} matched edition(s); earliest ${fpy}` }
}

async function main() {
  if (!FC_KEY) { console.error('FIRECRAWL_API_KEY not set'); process.exit(1) }
  ensureDirs()
  const pg = newPgClient(); await pg.connect()

  const books: Book[] = (await pg.query(`
    select b.id, b.slug, b.title, b.first_published_year as fpy,
           min(ba.year_started) as brandao_year,
           array_agg(distinct a.display_name) as authors
    from books b
    join bans ba on ba.book_id = b.id and ba.country_code = 'PT'
    join ban_source_links l on l.ban_id = ba.id
    join ban_sources s on s.id = l.source_id and s.source_url ilike '%bibliblogue%'
    join book_authors bk on bk.book_id = b.id
    join authors a on a.id = bk.author_id
    where b.created_at >= '2026-06-28'
    group by b.id, b.slug, b.title, b.first_published_year
    order by b.id
    offset ${OFFSET} limit ${LIMIT}
  `)).rows.map((r: any) => ({
    id: r.id, slug: r.slug, title: r.title, fpy: r.fpy,
    brandao_year: r.brandao_year, authors: (r.authors || []).filter((x: string) => x && x !== 'Various'),
  }))

  console.log(`\n── PORBASE year verification (READ-ONLY review) — ${books.length} books (offset ${OFFSET})`)
  const cache = loadCache()
  const outcomes: Outcome[] = []
  let scraped = 0

  for (const b of books) {
    const term = `${stripArticle(b.title).split(' ').slice(0, 6).join(' ')} ${(b.authors[0] ?? '').split(' ').pop() ?? ''}`.trim()
    const key = `${b.id}`
    if (!cache[key]) {
      try { cache[key] = await porbaseMarkdown(term) } catch (e) { cache[key] = ''; console.error(`  #${b.id} scrape failed: ${(e as Error).message}`) }
      writeFileSync(CACHE, JSON.stringify(cache)) // checkpoint per book → resumable
      scraped++
      await delay(400)
    }
    const o = decide(b, cache[key] ?? '')
    outcomes.push(o)
    const tag = o.status === 'confirmed' ? `✓ ${o.fpy}` : o.status === 'no-match' ? '· no-match' : '? ambiguous'
    console.log(`  #${b.id} ${tag.padEnd(12)} ${b.title}  (Brandão ${b.brandao_year}; ${b.authors[0] ?? '⟨coll⟩'})`)
  }

  const confirmed = outcomes.filter(o => o.status === 'confirmed')
  const noMatch = outcomes.filter(o => o.status === 'no-match')
  const ambiguous = outcomes.filter(o => o.status === 'ambiguous')

  // ── write report ──────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10)
  const reportPath = `data/source-research/porbase-verify-${date}.md`
  const md = [
    `# PORBASE year verification — ${date} (READ-ONLY review; nothing written)`,
    ``,
    `Books checked: **${books.length}** (offset ${OFFSET}, ${scraped} newly scraped, rest cached).`,
    `In PORBASE: **${confirmed.length}** · no-match: **${noMatch.length}** · ambiguous: **${ambiguous.length}**.`,
    ``,
    `> **first_published_year is deliberately left NULL** (decision 2026-06-28). The`,
    `> "earliest" below is a REVIEW CANDIDATE, not written: for translations PORBASE`,
    `> gives the Portuguese edition year, not the work's original first publication,`,
    `> and edition lists are reprint-noisy. Use this to confirm the book/editions and`,
    `> to see whether the Brandão DATA matches an edition year.`,
    ``,
    `## In PORBASE (editions found — earliest = review candidate, NOT written)`,
    `| id | title | author | Brandão | earliest? | editions (yr·publisher) |`,
    `|---|---|---|---:|---:|---|`,
    ...confirmed.map(o => `| ${o.book.id} | ${o.book.title} | ${o.book.authors[0] ?? ''} | ${o.book.brandao_year} | ${o.fpy} | ${o.matched.slice(0, 5).map(m => `${m.year}·${m.publisher ?? '?'}`).join('; ')} |`),
    ``,
    `## No match (review — left NULL)`,
    ...noMatch.map(o => `- #${o.book.id} **${o.book.title}** / ${o.book.authors[0] ?? '⟨coll⟩'} (Brandão ${o.book.brandao_year}) — ${o.note}`),
    ``,
    `## Ambiguous (review — left NULL)`,
    ...ambiguous.map(o => `- #${o.book.id} **${o.book.title}** / ${o.book.authors[0] ?? '⟨coll⟩'} — ${o.note}`),
    ``,
  ].join('\n')
  writeFileSync(reportPath, md)

  console.log(`\n  in-porbase ${confirmed.length} · no-match ${noMatch.length} · ambiguous ${ambiguous.length}`)
  console.log(`  report → ${reportPath}`)
  console.log(`  READ-ONLY — nothing written (first_published_year stays NULL by decision)`)
  await pg.end()
}

main().catch(e => { console.error(e); process.exit(1) })
