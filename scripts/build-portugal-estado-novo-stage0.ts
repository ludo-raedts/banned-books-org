/**
 * Portugal / Estado Novo — "Livros Proibidos" — Stap 0 builder (READ-ONLY).
 *
 * Turns the José Brandão compilation "Livros Proibidos nos Anos da Ditadura de
 * 1933 a 1974" (~900 titles, the largest single compilation of Portuguese books
 * banned under the Estado Novo) into a normalized import-seed file, following the
 * standard new-source route in scripts/README.md §1, Stap 0.
 *
 * ⚠️  THIS SCRIPT NEVER TOUCHES SUPABASE. It does not import `src/lib/supabase`,
 *     requires NO production credentials, and writes ONLY local files under
 *     data/. It is source preparation + a dedup-safety enrichment, not an
 *     importer. No --apply, no DB writes. Run freely.
 *
 * Source chain (see data/source-research/source-import-readiness-berlin-nz-portugal.md §3):
 *   - Brandão PDF (seed, ~900 rows, text-based — no OCR):
 *       https://bibliblogue.wordpress.com/wp-content/uploads/2012/04/200412livrosproibidos33_74.pdf
 *     cached locally at data/source-research/portugal-brandao-livros-proibidos.pdf
 *   - Provenance: Comissão do Livro Negro sobre o Regime Fascista (1981) →
 *     Direcção dos Serviços de Censura / Direcção-Geral de Informação.
 *   - Per-title VERIFICATION anchor (NOT done here): PORBASE / BNP
 *       https://porbase.bnportugal.gov.pt/   +  Alvim (E-LIS) cross-check.
 *
 * What it does:
 *   1. Run `pdftotext -layout` on the cached PDF → a clean 4-column table
 *      (TÍTULO | AUTOR | EDITOR | DATA). A data row = exactly 4 whitespace-
 *      delimited fields whose last field is a 4-digit year (drops intro prose).
 *   2. Normalize each row to the Stap-0 schema:
 *        - title: strip the "(*)" special-prohibition flag (→ boolean) and
 *          un-invert the catalogue article ("Adolescente, O" → "O Adolescente",
 *          "Porta Fechada, À" → "À Porta Fechada").
 *        - authors: "Surname, First" → "First Surname"; split co-authors on "/";
 *          flag collective/anthology markers (Vários / Colectivo).
 *        - DATA: kept as `source_data_year` ONLY. It is edition-OR-ban year,
 *          not disambiguated, so publication_year stays null (year_unverified)
 *          pending PORBASE — per data-quality doctrine, never assert a year
 *          from DATA alone.
 *   3. (--enrich-english) Resolve each book's ENGLISH work title via Wikidata
 *      (mirror of enrich-native-titles.ts, Portuguese label bias) and store it
 *      in `title_english_meaningful` — the cross-language match signal that
 *      match-before-create (Stap 2) needs, because the source carries Portuguese
 *      titles only (Option A in the readiness report). Resumable per-row cache.
 *
 * Outputs (local files only):
 *   data/portugal-estado-novo-<date>.json                            (import seed)
 *   data/source-research/portugal-estado-novo-stage0-summary-<date>.md (counts + samples)
 *   data/source-research/portugal-brandao-raw.txt                    (pdftotext output)
 *   data/source-research/portugal-english-title-cache.json           (resumable Wikidata cache)
 *
 * Usage:
 *   pnpm tsx scripts/build-portugal-estado-novo-stage0.ts                              # base build, no Wikidata
 *   pnpm tsx scripts/build-portugal-estado-novo-stage0.ts --enrich-english --limit=40 # enrich a pilot
 *   pnpm tsx scripts/build-portugal-estado-novo-stage0.ts --enrich-english            # full sweep (slow; resumable)
 *
 * DO NOT IMPORT YET — this only produces a review-ready seed file.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const PDF_PATH = 'data/source-research/portugal-brandao-livros-proibidos.pdf'
const RAW_TXT = 'data/source-research/portugal-brandao-raw.txt'
const EN_CACHE = 'data/source-research/portugal-english-title-cache.json'

const SOURCE_NAME =
  'José Brandão, "Livros Proibidos nos Anos da Ditadura de 1933 a 1974" — ' +
  'compilação da censura do Estado Novo (Comissão do Livro Negro sobre o Regime Fascista)'
const SOURCE_URL =
  'https://bibliblogue.wordpress.com/wp-content/uploads/2012/04/200412livrosproibidos33_74.pdf'

const WD_API = 'https://www.wikidata.org/w/api.php'
const WD_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData'
const UA =
  'banned-books.org source research (https://www.banned-books.org; ludo.raedts@voys.nl)'

// ── flags ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const val = (f: string): string | null => {
  const hit = argv.find(a => a.startsWith(`--${f}=`))
  return hit ? hit.split('=').slice(1).join('=') : null
}
const intFlag = (f: string, d: number) => {
  const v = val(f)
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) ? n : d
}
const ENRICH = has('enrich-english')
const LIMIT = intFlag('limit', Number.POSITIVE_INFINITY)
const OFFSET = intFlag('offset', 0)

interface NormRow {
  source_row_n: number
  title: string // Portuguese, normalized (article un-inverted, flag stripped)
  title_pt_raw: string // exactly as printed in the table cell
  title_english_meaningful: string | null
  authors: string[]
  author_raw: string
  author_collective: boolean
  country_code: 'PT'
  scope_slug: 'government'
  action_type: 'banned'
  reason_slug: 'political' // batch default; per-title refinement deferred
  special_prohibition: boolean // Brandão "(*)" — varied Metrópole/Colónias or status change
  publisher: string | null
  publication_year: number | null // stays null until PORBASE-verified
  year_unverified: true
  source_data_year: number // raw DATA = edition-OR-ban year, NOT disambiguated
  source_name: string
  source_url: string
  wikidata_qid: string | null
}

const trim = (s: unknown) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function ensureDirs() {
  for (const d of ['data', 'data/source-research']) if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

// ── extract the table text ──────────────────────────────────────────────────
function loadRawText(): string {
  if (!existsSync(PDF_PATH)) {
    throw new Error(
      `cached PDF missing at ${PDF_PATH}. Download it first:\n` +
        `  curl -sL -A "Mozilla/5.0" "${SOURCE_URL}" -o "${PDF_PATH}"`,
    )
  }
  // -layout preserves the 4-column fixed-width table.
  execFileSync('pdftotext', ['-layout', PDF_PATH, RAW_TXT])
  return readFileSync(RAW_TXT, 'utf8')
}

// ── row parsing ──────────────────────────────────────────────────────────────
// A data row = exactly 4 fields when split on runs of 2+ spaces AND a 4-digit
// final field (the DATA year). This discriminator drops every intro/header line.
function parseRows(text: string): Array<{ title: string; author: string; publisher: string; year: number }> {
  const out: Array<{ title: string; author: string; publisher: string; year: number }> = []
  for (const line of text.split('\n')) {
    const t = line.replace(/^\s+/, '').replace(/\s+$/, '')
    if (!t) continue
    const fields = t.split(/ {2,}/)
    if (fields.length !== 4) continue
    const year = fields[3].trim()
    if (!/^\d{4}$/.test(year)) continue
    out.push({
      title: trim(fields[0]),
      author: trim(fields[1]),
      publisher: trim(fields[2]),
      year: parseInt(year, 10),
    })
  }
  return out
}

// ── title: strip "(*)" flag + un-invert the trailing catalogue article ──────
const ARTICLES = new Set(['O', 'A', 'Os', 'As', 'Um', 'Uma', 'À', 'Á'])
function normalizeTitle(raw: string): { title: string; special: boolean } {
  let t = raw
  let special = false
  if (/\(\*\)/.test(t)) {
    special = true
    t = t.replace(/\s*\(\*\)\s*/g, ' ')
  }
  t = trim(t)
  const m = t.match(/^(.*),\s*([^,\s]+)$/)
  if (m && ARTICLES.has(m[2])) {
    const art = m[2] === 'Á' ? 'À' : m[2] // Á is an OCR variant of the contraction À
    t = `${art} ${trim(m[1])}`
  }
  return { title: t, special }
}

// ── author: "Surname, First" → "First Surname"; split co-authors on "/" ─────
const COLLECTIVE_RE = /^(vários|varios|colectivo|coletivo|vária|v\.?\s?a\.?)$/i
function flipName(name: string): string {
  const ci = name.indexOf(',')
  if (ci === -1) return trim(name)
  const last = trim(name.slice(0, ci))
  const first = trim(name.slice(ci + 1))
  return [first, last].filter(Boolean).join(' ')
}
function parseAuthors(raw: string): { authors: string[]; collective: boolean } {
  const base = trim(raw)
  if (COLLECTIVE_RE.test(base.replace(/\.$/, ''))) return { authors: [], collective: true }
  const parts = base.split('/').map(p => trim(p)).filter(Boolean)
  // Strip a stray trailing period ("Moura." → "Moura") but PRESERVE initials
  // ("D. H." must stay intact) by only stripping when it follows a lowercase letter.
  const authors = parts.map(flipName).map(a => a.replace(/([a-zà-ÿ])\.$/, '$1'))
  return { authors, collective: false }
}

function normalize(
  row: { title: string; author: string; publisher: string; year: number },
  n: number,
): NormRow {
  const { title, special } = normalizeTitle(row.title)
  const { authors, collective } = parseAuthors(row.author)
  return {
    source_row_n: n,
    title,
    title_pt_raw: row.title,
    title_english_meaningful: null,
    authors,
    author_raw: row.author,
    author_collective: collective,
    country_code: 'PT',
    scope_slug: 'government',
    action_type: 'banned',
    reason_slug: 'political',
    special_prohibition: special,
    publisher: trim(row.publisher) || null,
    publication_year: null,
    year_unverified: true,
    source_data_year: row.year,
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    wikidata_qid: null,
  }
}

// ── Wikidata English-title resolution (mirror of enrich-native-titles gate) ──
const WRITTEN_WORK = new Set([
  'Q571', 'Q7725634', 'Q8261', 'Q47461344', 'Q49084', 'Q1279564', 'Q25379',
  'Q49085', 'Q5185279', 'Q386724', 'Q1004', 'Q1760610', 'Q838795', 'Q23622',
  'Q235557', 'Q1238720', 'Q57933693',
])
const EDITION = 'Q3331189'

interface WdEntity {
  id: string
  labels: Record<string, { value: string }>
  claims: Record<string, Array<{ mainsnak: { datavalue?: { value: unknown } } }>>
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function authorMatches(bookAuthor: string, wdLabels: string[]): boolean {
  const a = norm(bookAuthor)
  if (!a) return false
  const aLast = a.split(' ').filter(Boolean).pop() ?? a
  for (const raw of wdLabels) {
    const w = norm(raw)
    if (!w) continue
    if (w === a || w.includes(a) || a.includes(w)) return true
    const wLast = w.split(' ').filter(Boolean).pop() ?? w
    if (aLast.length >= 4 && aLast === wLast) return true
  }
  return false
}

function searchVariants(title: string): string[] {
  const t = title.trim()
  // strip a leading Portuguese article/contraction for the second query
  const stripped = t.replace(/^(o|a|os|as|um|uma|à)\s+/i, '').trim()
  const out = [t]
  if (stripped && stripped.toLowerCase() !== t.toLowerCase()) out.push(stripped)
  return out
}

async function wdSearchOne(query: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=pt&uselang=pt&type=item&limit=7&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const json = (await res.json()) as { search?: Array<{ id: string }> }
  return (json.search ?? []).map(s => s.id)
}

async function wdSearch(title: string): Promise<string[]> {
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of searchVariants(title)) {
    for (const id of await wdSearchOne(q)) if (!seen.has(id)) { seen.add(id); out.push(id) }
    await delay(120)
  }
  return out
}

async function wdEntity(qid: string): Promise<WdEntity | null> {
  const res = await fetch(`${WD_ENTITY}/${qid}.json`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const json = (await res.json()) as { entities: Record<string, WdEntity> }
  return json.entities[qid] ?? null
}

function claimQids(e: WdEntity, prop: string): string[] {
  return (e.claims[prop] ?? [])
    .map(c => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((x): x is string => !!x)
}

function p1476Titles(e: WdEntity): Array<{ language: string; text: string }> {
  return (e.claims['P1476'] ?? [])
    .map(c => c.mainsnak?.datavalue?.value as { language?: string; text?: string } | undefined)
    .filter((v): v is { language: string; text: string } => !!v?.language && !!v?.text)
}

interface EnResult { english: string | null; qid: string | null; status: string }

async function resolveEnglish(title: string, author: string): Promise<EnResult> {
  let qids: string[] = []
  try { qids = await wdSearch(title) } catch { return { english: null, qid: null, status: 'search-error' } }
  if (qids.length === 0) return { english: null, qid: null, status: 'no-search-hit' }

  for (const qid of qids) {
    await delay(120)
    const e = await wdEntity(qid)
    if (!e) continue
    const p31 = claimQids(e, 'P31')
    if (p31.includes(EDITION)) continue
    if (!p31.some(t => WRITTEN_WORK.has(t))) continue

    if (author) {
      const authorQids = claimQids(e, 'P50')
      if (authorQids.length === 0) continue
      await delay(120)
      const labels: string[] = []
      try {
        const r = await fetch(
          `${WD_API}?action=wbgetentities&ids=${authorQids.slice(0, 5).join('|')}&props=labels|aliases&format=json`,
          { headers: { 'User-Agent': UA } },
        )
        if (r.ok) {
          const j = (await r.json()) as {
            entities?: Record<string, { labels?: Record<string, { value: string }>; aliases?: Record<string, Array<{ value: string }>> }>
          }
          for (const ent of Object.values(j.entities ?? {})) {
            for (const l of Object.values(ent.labels ?? {})) labels.push(l.value)
            for (const arr of Object.values(ent.aliases ?? {})) for (const a of arr) labels.push(a.value)
          }
        }
      } catch { /* fall through */ }
      if (!authorMatches(author, labels)) continue
    }

    let en: string | null = null
    for (const t of p1476Titles(e)) if (t.language.toLowerCase().startsWith('en')) { en = t.text.trim(); break }
    if (!en && e.labels['en']?.value) en = e.labels['en'].value.trim()
    if (!en) continue
    if (norm(en) === norm(title)) return { english: null, qid, status: 'english-equals-portuguese' }
    return { english: en, qid, status: 'matched' }
  }
  return { english: null, qid: null, status: 'no-confirmed-work-match' }
}

function loadEnCache(): Record<string, EnResult> {
  if (existsSync(EN_CACHE)) { try { return JSON.parse(readFileSync(EN_CACHE, 'utf8')) } catch { /* */ } }
  return {}
}

async function main() {
  ensureDirs()
  console.log(`\n── Portugal Estado Novo (Brandão) — Stap 0 builder ── ${ENRICH ? '(with Wikidata English-title enrichment)' : '(base build)'}`)

  const text = loadRawText()
  const rows = parseRows(text)
  console.log(`  parsed ${rows.length} table rows`)

  const books = rows.map((r, i) => normalize(r, i + 1))
  const flagged = books.filter(b => b.special_prohibition).length
  const collective = books.filter(b => b.author_collective).length
  console.log(`  special-prohibition "(*)" rows: ${flagged}; collective/anthology authors: ${collective}`)

  // ── optional Wikidata enrichment ──────────────────────────────────────────
  const cache = loadEnCache()
  if (ENRICH) {
    const end = OFFSET === 0 && !Number.isFinite(LIMIT) ? books.length : OFFSET + LIMIT
    const targets = books.slice(OFFSET, end)
    console.log(`  enriching English titles for ${targets.length} rows (offset ${OFFSET}); ${Object.keys(cache).length} already cached`)
    let done = 0, matched = 0
    for (const b of targets) {
      const key = String(b.source_row_n)
      // collective/anthology authors have no usable author gate → skip Wikidata
      if (b.author_collective || b.authors.length === 0) { cache[key] = { english: null, qid: null, status: 'no-author-gate' } }
      if (!cache[key]) {
        cache[key] = await resolveEnglish(b.title, b.authors[0] ?? '')
        writeFileSync(EN_CACHE, JSON.stringify(cache, null, 2)) // checkpoint every row → resumable
        await delay(120)
      }
      done++
      if (cache[key].status === 'matched') matched++
      if (done % 25 === 0) console.log(`    …${done}/${targets.length} (matched so far: ${matched})`)
    }
    console.log(`  enrichment pass done: ${matched} English titles found in this slice`)
  }

  // Fold cache into the normalized rows (whatever is cached, base build included).
  let filled = 0
  for (const b of books) {
    const c = cache[String(b.source_row_n)]
    if (c && c.status === 'matched' && c.english) { b.title_english_meaningful = c.english; b.wikidata_qid = c.qid; filled++ }
  }

  // ── write outputs ───────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10)
  const seedPath = `data/portugal-estado-novo-${date}.json`
  const summaryPath = `data/source-research/portugal-estado-novo-stage0-summary-${date}.md`

  writeFileSync(seedPath, JSON.stringify({
    generated_at: date,
    note: 'Stap-0 import seed. DO NOT IMPORT YET. source_data_year is the Brandão DATA column = edition-OR-ban year, NOT disambiguated — publication_year is left null (year_unverified) and MUST be cross-checked against PORBASE/BNP before any year is asserted. reason_slug=political is a batch default. special_prohibition = Brandão "(*)" (varied Metrópole/Colónias or status change).',
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    verification_anchor: 'PORBASE/BNP (https://porbase.bnportugal.gov.pt/) + Alvim bibliography (E-LIS http://eprints.rclis.org/9342/)',
    count: books.length,
    special_prohibition_count: flagged,
    collective_author_count: collective,
    english_titles_filled: filled,
    rows: books,
  }, null, 2))

  const sample = books.slice(0, 10)
  const md = [
    `# Portugal Estado Novo (Brandão) — Stap 0 summary (${date})`,
    ``,
    `> **DO NOT IMPORT YET.** Read-only Stap-0 seed produced by`,
    `> \`scripts/build-portugal-estado-novo-stage0.ts\` (no DB writes).`,
    ``,
    `Source: ${SOURCE_NAME}`,
    `URL: ${SOURCE_URL}`,
    `Verification anchor (per-title, NOT done here): PORBASE/BNP + Alvim (E-LIS).`,
    ``,
    `## Counts`,
    `| Metric | Value |`,
    `|---|---|`,
    `| parsed rows | ${books.length} |`,
    `| special-prohibition "(*)" | ${flagged} |`,
    `| collective/anthology authors (Vários/Colectivo) | ${collective} |`,
    `| English work title resolved (Wikidata) | ${filled}${ENRICH ? '' : ' (run with `--enrich-english`)'} |`,
    ``,
    `## Year ambiguity (THE load-bearing data-quality risk)`,
    `The Brandão \`DATA\` column is "data da edição ou da proibição" — **edition OR`,
    `ban year, not disambiguated per row**. It is captured as \`source_data_year\``,
    `only; \`publication_year\` is left \`null\` with \`year_unverified: true\`. Per`,
    `data-quality doctrine, no year may be asserted in production until it is`,
    `cross-checked per title against PORBASE/BNP (and/or Alvim's ISBD records).`,
    ``,
    `## Cross-language match signal (Option A)`,
    `English work title resolved via Wikidata (cross-language match signal for`,
    `match-before-create / Stap 2): **${filled} / ${books.length}** filled. The`,
    `source carries Portuguese titles only, so without this a Portuguese-titled`,
    `duplicate of a book already in the catalogue under its English title would be`,
    `minted. A null English title = likely a net-new Portuguese-edition work (low`,
    `dedup risk); a filled one = a work that may already exist (e.g. Sartre`,
    `*À Porta Fechada* → "No Exit", Lawrence *O Amante de Lady Chatterley*).`,
    ``,
    `## Normalized schema (per row)`,
    `\`\`\`json`,
    JSON.stringify(sample[0] ?? {}, null, 2),
    `\`\`\``,
    ``,
    `## Sample rows`,
    `| # | PT title (normalized) | English (Wikidata) | author | (*) | DATA |`,
    `|---|---|---|---|---|---|`,
    ...sample.map(b => `| ${b.source_row_n} | ${b.title} | ${b.title_english_meaningful ?? '—'} | ${b.authors[0] || (b.author_collective ? '⟨collective⟩' : '—')} | ${b.special_prohibition ? '✱' : ''} | ${b.source_data_year} |`),
    ``,
    `## Next (not done here)`,
    `1. Run/finish \`--enrich-english\` (full sweep, resumable).`,
    `2. Per-title PORBASE/BNP year verification (mandatory before asserting any year).`,
    `3. Decide handling of the ${collective} collective/anthology rows (placeholder author).`,
    `4. THEN write a thin importer that feeds these rows through match-before-create`,
    `   → \`commitParsedRow\`/\`commitNewBanForBook\`, with the mandatory dupe sweep after.`,
    ``,
  ].join('\n')
  writeFileSync(summaryPath, md)

  console.log(`\n  wrote:`)
  console.log(`    seed     → ${seedPath}  (${books.length} rows, ${filled} English titles)`)
  console.log(`    summary  → ${summaryPath}`)
  console.log(`\n  DO NOT IMPORT YET — this is a review-ready seed only.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
