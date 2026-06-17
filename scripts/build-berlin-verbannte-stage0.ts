/**
 * Berlin.de "Liste der verbannten Bücher" — Stap 0 builder (READ-ONLY).
 *
 * Turns the public CC-BY dataset (Liste des schädlichen und unerwünschten
 * Schrifttums, Stand 31.12.1938) into a normalized import-seed file, following
 * the standard new-source route in scripts/README.md §1, Stap 0.
 *
 * ⚠️  THIS SCRIPT NEVER TOUCHES SUPABASE. It does not import `src/lib/supabase`,
 *     requires NO production credentials, and writes ONLY local files under
 *     data/. It is source preparation + a dedup-safety enrichment, not an
 *     importer. No --apply, no DB writes. Run freely.
 *
 * What it does:
 *   1. Fetch (and cache) the CC-BY JSON: 4,764 rows.
 *      https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.json?q=
 *   2. Partition rows:
 *        - book      = clean book-level ban (importable seed)
 *        - blanket   = "Sämtliche Schriften/Ausgaben…" → author-wide, EXCLUDE
 *                      (model as author-level later; cf. is_blanket_works)
 *        - authorless= no author at all → HOLD for manual review
 *   3. Normalize the `book` rows to the Stap-0 schema (one row per
 *      book × jurisdiction × ban-event).
 *   4. (--enrich-english) Resolve each book's ENGLISH work title via Wikidata
 *      and store it in `title_english_meaningful` — the cross-language match
 *      signal that match-before-create (Stap 2) needs, because the source
 *      carries German titles only (Option A in the readiness report). Resumable
 *      cache so the long sweep can be interrupted/continued.
 *
 * Outputs (local files only):
 *   data/berlin-verbannte-1938-<date>.json                         (import seed)
 *   data/source-research/berlin-verbannte-excluded-<date>.json     (blanket+authorless review sidecar)
 *   data/source-research/berlin-verbannte-stage0-summary-<date>.md (counts + samples)
 *   data/source-research/berlin-verbannte-raw.json                 (cached raw dataset)
 *   data/source-research/berlin-english-title-cache.json           (resumable Wikidata cache)
 *
 * Usage:
 *   pnpm tsx scripts/build-berlin-verbannte-stage0.ts                          # base build, no Wikidata
 *   pnpm tsx scripts/build-berlin-verbannte-stage0.ts --enrich-english --limit=40   # enrich a pilot
 *   pnpm tsx scripts/build-berlin-verbannte-stage0.ts --enrich-english             # full sweep (slow; resumable)
 *   pnpm tsx scripts/build-berlin-verbannte-stage0.ts --refetch                    # force re-download
 *
 * DO NOT IMPORT YET — this only produces a review-ready seed file.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'

const RAW_URL = 'https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.json?q='
const SOURCE_URL = 'https://www.berlin.de/verbannte-buecher/suche/'
const SOURCE_NAME =
  'Liste der verbannten Bücher (Berlin.de / BerlinOnline GmbH, CC-BY) — ' +
  'Liste des schädlichen und unerwünschten Schrifttums, Stand 31.12.1938'

const RAW_CACHE = 'data/source-research/berlin-verbannte-raw.json'
const EN_CACHE = 'data/source-research/berlin-english-title-cache.json'

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
const REFETCH = has('refetch')
const LIMIT = intFlag('limit', Number.POSITIVE_INFINITY)
const OFFSET = intFlag('offset', 0)

// ── raw row shape (verified live) ───────────────────────────────────────────
interface RawRow {
  id: number
  pagenumberinocrdocument: number
  authorfirstname: string
  authorlastname: string
  title: string
  firsteditionpublisher: string
  firsteditionpublicationplace: string
  firsteditionpublicationyear: string
  additionalinfos: string
  ocrresult: string
}

interface NormRow {
  source_row_id: number
  list_page: number
  title: string
  title_english_meaningful: string | null
  authors: string[]
  country_code: 'DE'
  year: number // ban year — see note
  scope_slug: 'government'
  action_type: 'banned'
  reason_slug: 'political' // batch default; per-title refinement deferred
  warning_level: 'none' // censorship victim, not an endorsed ban
  publisher: string | null
  publication_place: string | null
  publication_year: number | null
  source_name: string
  source_url: string
  ocr_line: string
  wikidata_qid: string | null
}

const trim = (s: unknown) => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function ensureDirs() {
  for (const d of ['data', 'data/source-research']) if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

async function loadRaw(): Promise<RawRow[]> {
  if (!REFETCH && existsSync(RAW_CACHE)) {
    const j = JSON.parse(readFileSync(RAW_CACHE, 'utf8'))
    return j.index as RawRow[]
  }
  console.log('  fetching CC-BY dataset…')
  const res = await fetch(RAW_URL, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`)
  const json = (await res.json()) as { index: RawRow[] }
  writeFileSync(RAW_CACHE, JSON.stringify(json))
  return json.index
}

const BLANKET_RE = /Sämtliche|Sämtl\./i
function classify(r: RawRow): 'book' | 'blanket' | 'authorless' {
  if (BLANKET_RE.test(trim(r.title)) || BLANKET_RE.test(trim(r.additionalinfos))) return 'blanket'
  if (!trim(r.authorfirstname) && !trim(r.authorlastname)) return 'authorless'
  if (!trim(r.title)) return 'authorless' // 0 in practice, but safe
  return 'book'
}

function authorDisplay(r: RawRow): string {
  const first = trim(r.authorfirstname)
  const last = trim(r.authorlastname)
  return [first, last].filter(Boolean).join(' ')
}

function parseYear(s: unknown): number | null {
  const m = trim(s).match(/\b(1[5-9]\d{2}|20\d{2})\b/)
  return m ? parseInt(m[1], 10) : null
}

function normalize(r: RawRow): NormRow {
  return {
    source_row_id: r.id,
    list_page: r.pagenumberinocrdocument,
    title: trim(r.title),
    title_english_meaningful: null,
    authors: [authorDisplay(r)],
    country_code: 'DE',
    year: 1938, // ban year = the 31.12.1938 list edition (see summary note)
    scope_slug: 'government',
    action_type: 'banned',
    reason_slug: 'political',
    warning_level: 'none',
    publisher: trim(r.firsteditionpublisher) || null,
    publication_place: trim(r.firsteditionpublicationplace) || null,
    publication_year: parseYear(r.firsteditionpublicationyear),
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    ocr_line: trim(r.ocrresult),
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
  const stripped = t.replace(/^(der|die|das|ein|eine|the|a|an)\s+/i, '').trim()
  const out = [t]
  if (stripped && stripped.toLowerCase() !== t.toLowerCase()) out.push(stripped)
  return out
}

async function wdSearchOne(query: string): Promise<string[]> {
  // language=de: the source titles are German; bias the label index to German.
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=de&uselang=de&type=item&limit=7&format=json`
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

    // English work title: prefer P1476@en, else English label.
    let en: string | null = null
    for (const t of p1476Titles(e)) if (t.language.toLowerCase().startsWith('en')) { en = t.text.trim(); break }
    if (!en && e.labels['en']?.value) en = e.labels['en'].value.trim()
    if (!en) continue
    // Useful only if it differs from the German title (else no match signal gained).
    if (norm(en) === norm(title)) return { english: null, qid, status: 'english-equals-german' }
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
  console.log(`\n── Berlin verbannte Bücher — Stap 0 builder ── ${ENRICH ? '(with Wikidata English-title enrichment)' : '(base build)'}`)

  const raw = await loadRaw()
  const buckets = { book: [] as RawRow[], blanket: [] as RawRow[], authorless: [] as RawRow[] }
  for (const r of raw) buckets[classify(r)].push(r)
  console.log(`  rows: ${raw.length} total → book ${buckets.book.length}, blanket ${buckets.blanket.length}, authorless ${buckets.authorless.length}`)

  const books = buckets.book.map(normalize)

  // ── optional Wikidata enrichment ──────────────────────────────────────────
  const cache = loadEnCache()
  if (ENRICH) {
    const targets = books.slice(OFFSET, OFFSET === 0 && !Number.isFinite(LIMIT) ? books.length : OFFSET + LIMIT)
    console.log(`  enriching English titles for ${targets.length} rows (offset ${OFFSET}); ${Object.keys(cache).length} already cached`)
    let done = 0, matched = 0
    for (const b of targets) {
      const key = String(b.source_row_id)
      if (!cache[key]) {
        cache[key] = await resolveEnglish(b.title, b.authors[0] ?? '')
        writeFileSync(EN_CACHE, JSON.stringify(cache, null, 2)) // checkpoint every row → resumable
        await delay(120)
      }
      done++
      if (done % 25 === 0) console.log(`    …${done}/${targets.length} (matched so far: ${matched})`)
      if (cache[key].status === 'matched') matched++
    }
    console.log(`  enrichment pass done: ${matched} English titles found in this slice`)
  }

  // Fold cache into the normalized rows (whatever is cached, base build included).
  let filled = 0
  for (const b of books) {
    const c = cache[String(b.source_row_id)]
    if (c && c.status === 'matched' && c.english) { b.title_english_meaningful = c.english; b.wikidata_qid = c.qid; filled++ }
  }

  // ── write outputs ───────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10)
  const seedPath = `data/berlin-verbannte-1938-${date}.json`
  const excludedPath = `data/source-research/berlin-verbannte-excluded-${date}.json`
  const summaryPath = `data/source-research/berlin-verbannte-stage0-summary-${date}.md`

  writeFileSync(seedPath, JSON.stringify({
    generated_at: date,
    note: 'Stap-0 import seed. DO NOT IMPORT YET. year=1938 is the list-edition date (appeared on the 31.12.1938 list), NOT necessarily the original prohibition date. reason_slug=political is a batch default — per-title refinement (racial/religious/etc.) is a later step.',
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    license: 'CC-BY (Berlin Open Data / BerlinOnline GmbH)',
    count: books.length,
    english_titles_filled: filled,
    rows: books,
  }, null, 2))

  writeFileSync(excludedPath, JSON.stringify({
    generated_at: date,
    note: 'EXCLUDED from the book-level seed. blanket = author-wide ("Sämtliche…") → model as author-level later. authorless = anonymous/aggregate → manual review before any import.',
    blanket: buckets.blanket.map(r => ({ id: r.id, ocr: trim(r.ocrresult), additionalinfos: trim(r.additionalinfos) })),
    authorless: buckets.authorless.map(r => ({ id: r.id, title: trim(r.title), ocr: trim(r.ocrresult) })),
  }, null, 2))

  const sample = books.slice(0, 8)
  const md = [
    `# Berlin verbannte Bücher — Stap 0 summary (${date})`,
    ``,
    `> **DO NOT IMPORT YET.** Read-only Stap-0 seed produced by`,
    `> \`scripts/build-berlin-verbannte-stage0.ts\` (no DB writes).`,
    ``,
    `Source: ${SOURCE_NAME}`,
    `URL: ${SOURCE_URL} · License: CC-BY (Berlin Open Data / BerlinOnline GmbH)`,
    ``,
    `## Partition`,
    `| Bucket | Rows | Disposition |`,
    `|---|---|---|`,
    `| total | ${raw.length} | — |`,
    `| **book** (clean book-level) | **${buckets.book.length}** | import seed → \`${seedPath}\` |`,
    `| blanket ("Sämtliche…") | ${buckets.blanket.length} | EXCLUDE → model as author-level |`,
    `| authorless (anon/aggregate) | ${buckets.authorless.length} | HOLD for manual review |`,
    ``,
    `Book rows with a publication year: ${books.filter(b => b.publication_year != null).length} / ${books.length}.`,
    ``,
    `## Cross-language match signal (Option A)`,
    `English work title resolved via Wikidata (cross-language match signal for`,
    `Stap 2): **${filled} / ${books.length}** filled${ENRICH ? '' : ' (run with `--enrich-english` to populate)'}.`,
    `A null English title = likely a net-new German work (low dedup risk); a filled`,
    `one = a work that may already be in the catalogue under its English title.`,
    ``,
    `## Normalized schema (per row)`,
    `\`\`\`json`,
    JSON.stringify(sample[0] ?? {}, null, 2),
    `\`\`\``,
    ``,
    `## Sample book rows`,
    `| # | German title | English (Wikidata) | author | pub.year |`,
    `|---|---|---|---|---|`,
    ...sample.map(b => `| ${b.source_row_id} | ${b.title} | ${b.title_english_meaningful ?? '—'} | ${b.authors[0] || '—'} | ${b.publication_year ?? '—'} |`),
    ``,
    `## Ban-year note`,
    `\`year = 1938\` for every row = the date of the list edition the dataset`,
    `encodes ("Stand vom 31. Dezember 1938"). Many of these books were suppressed`,
    `earlier (e.g. the 1933 burnings); 1938 is the verifiable list-appearance year,`,
    `not a claim about the first prohibition date.`,
    ``,
    `## Next (not done here)`,
    `1. Run/finish \`--enrich-english\` (full sweep, resumable).`,
    `2. Review the ${buckets.authorless.length} authorless rows + decide blanket modeling.`,
    `3. THEN write a thin importer that feeds these rows through match-before-create`,
    `   → \`commitParsedRow\`/\`commitNewBanForBook\`, with the mandatory dupe sweep after.`,
    ``,
  ].join('\n')
  writeFileSync(summaryPath, md)

  console.log(`\n  wrote:`)
  console.log(`    seed      → ${seedPath}  (${books.length} rows, ${filled} English titles)`)
  console.log(`    excluded  → ${excludedPath}  (${buckets.blanket.length} blanket + ${buckets.authorless.length} authorless)`)
  console.log(`    summary   → ${summaryPath}`)
  console.log(`\n  DO NOT IMPORT YET — this is a review-ready seed only.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
