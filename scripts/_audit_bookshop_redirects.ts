/**
 * READ-ONLY audit: does every Bookshop.org affiliate deep link actually
 * redirect to OUR book?
 *
 * Background (found by the 2026-07-03 description-websearch pilot,
 * data/desc-websearch-altisbn-rejects-v2.md): a slice of bookshop_isbn13
 * cross-references point at a completely different WORK — buyers land on
 * "Living Loving and Learning" (Buscaglia) instead of "To Live" (Yu Hua),
 * on "The Secret Agent" instead of "The Tale of Steven", on "Freakonomics"
 * instead of "The Winning Side". probe-bookshop-isbn.ts only checks that
 * the link resolves (HTTP-level) and audit-bookshop-editions.ts checks
 * format/language via OL — neither verifies WHICH work Bookshop serves.
 *
 * Method (cheapest verified signal): a HEAD request to
 * /a/{aid}/{bookshop_isbn13 ?? isbn13} returns a 308 whose Location is the
 * canonical product page, and its slug embeds title + author:
 *   .../p/books/living-loving-and-learning-leo-f-buscaglia/9780449901687...
 * We compare that slug text against our title with titlesMatch (strict,
 * src/lib/enrich/title-match.ts) and the loose head-variant from
 * enrich-descriptions-websearch.ts (subtitle allowance). GET is 403'd by
 * Bookshop; HEAD works. ~2 req/s.
 *
 * Buckets:
 *   match         — every significant token of our title is in the slug
 *   match_no_auth — title matches but NO author token in the slug: possible
 *                   adaptation/companion (e.g. The Grapes of Wrath → the
 *                   Frank Galati stage-play edition). Review subsection.
 *   head_only     — only the pre-':'/'(' head of our title matches (our
 *                   subtitle missing from slug) — usually fine, spot-check
 *   mismatch      — neither matches: deep link likely points at another work
 *   gone          — 404 now (status drift since the last probe sweep)
 *   no_slug       — 2xx/3xx without a parseable /p/books/ slug (informational)
 *   unverifiable  — our title has no Latin tokens to compare (non-Latin title)
 *   error         — network/5xx; NOT checkpointed as done, retried next run
 *
 * Output (nothing is written to the DB):
 *   data/bookshop-redirect-audit-checkpoint.jsonl — per-book results; the
 *     script resumes from it, so an interrupted sweep continues where it
 *     stopped (full sweep of ~5.4k links ≈ 50 min at 2/s)
 *   data/bookshop-redirect-audit-{date}.md   — review list (three buckets)
 *   data/bookshop-redirect-audit-{date}.json — mismatches in the audit
 *     format remediate-bookshop-editions.ts consumes ({findings: [...]}),
 *     flag 'redirect_mismatch'. After review: remediate-bookshop-editions.ts
 *     --audit=<this file> --book-ids=<confirmed ids> --apply re-derives a
 *     correct English print edition from the OL work, or demotes to the
 *     storefront fallback (NULL xref + bookshop_status='not_found') — which
 *     is exactly the wrong-link fix.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_bookshop_redirects.ts
 *     → full sweep (resumes from checkpoint), then writes the report
 *   npx tsx --env-file=.env.local scripts/_audit_bookshop_redirects.ts --limit=50
 *     → probe at most 50 new rows this run (still writes a report)
 *   npx tsx --env-file=.env.local scripts/_audit_bookshop_redirects.ts --report-only
 *     → no probing; regenerate the MD/JSON from the checkpoint
 *   npx tsx --env-file=.env.local scripts/_audit_bookshop_redirects.ts --fresh
 *     → ignore the existing checkpoint and start over
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { BOOKSHOP_AFFILIATE_ID } from '../src/lib/bookshop'
import { titlesMatch, titleTokens } from '../src/lib/enrich/title-match'
import { hasFlag, intFlag } from './lib/cli'

const LIMIT = intFlag('limit', Infinity)
const REPORT_ONLY = hasFlag('report-only')
const FRESH = hasFlag('fresh')

const REQUEST_DELAY_MS = 500 // ~2/s
const HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

const today = new Date().toISOString().slice(0, 10)
const CHECKPOINT = join(process.cwd(), 'data', 'bookshop-redirect-audit-checkpoint.jsonl')
const OUT_MD = join(process.cwd(), 'data', `bookshop-redirect-audit-${today}.md`)
const OUT_JSON = join(process.cwd(), 'data', `bookshop-redirect-audit-${today}.json`)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── title/author matching ──────────────────────────────────────────────

// Same subtitle allowance as enrich-descriptions-websearch.ts: retail slugs
// often carry only the head of a subtitled title.
function titleHeadOf(t: string): string {
  return t.replace(/\s*\([^)]*\)\s*$/g, '').split(/[:;]/)[0].trim()
}
function titlesMatchLoose(ourTitle: string, candidateTitle: string): boolean {
  if (titlesMatch(ourTitle, candidateTitle)) return true
  const head = titleHeadOf(ourTitle)
  return head.length >= 4 && head !== ourTitle && titlesMatch(head, candidateTitle)
}

// Bookshop's slugger collapses apostrophes ("Angela's" → "angelas") and drops
// non-ASCII letters outright ("Tángere" → "t-ngere", "Señor" → "se-or"),
// where our tokenizer transliterates. Mimic that on our side and accept
// either variant, so those slug artifacts don't land in the mismatch bucket.
function bookshopMimic(title: string): string {
  return title.toLowerCase().replace(/['’]/g, '').replace(/[^\x00-\x7f]/g, ' ')
}
type MatchGrade = 'strict' | 'loose' | 'none'
function titleMatchesSlug(ourTitle: string, slugText: string): MatchGrade {
  if (titlesMatch(ourTitle, slugText) || titlesMatch(bookshopMimic(ourTitle), slugText)) return 'strict'
  if (titlesMatchLoose(ourTitle, slugText) || titlesMatchLoose(bookshopMimic(ourTitle), slugText)) return 'loose'
  return 'none'
}
function bucketForSlug(title: string, slugText: string, authorHit: boolean): Bucket {
  if (titleTokens(title).size === 0 && titleTokens(bookshopMimic(title)).size === 0) return 'unverifiable'
  const grade = titleMatchesSlug(title, slugText)
  if (grade === 'strict') return authorHit ? 'match' : 'match_no_auth'
  if (grade === 'loose') return 'head_only'
  return 'mismatch'
}

// Raw token set (no stopword filtering — author names may collide with title
// stopwords like "no"/"to", but single-char initials are dropped).
function rawTokens(s: string): Set<string> {
  return new Set(
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
      .filter(t => t.length > 1),
  )
}
function authorInSlug(authors: string[], slugText: string): boolean {
  if (authors.length === 0) return false
  const slug = rawTokens(slugText)
  return authors.some(a => [...rawTokens(a)].some(t => slug.has(t)))
}

// ── probing ────────────────────────────────────────────────────────────

type Probe =
  | { kind: 'redirect'; productSlug: string; location: string }
  | { kind: 'gone' }
  | { kind: 'no_slug'; location: string | null; http: number }
  | { kind: 'error'; http: number | null }

async function probeRedirect(isbn: string): Promise<Probe> {
  const url = `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn}`
  try {
    const res = await fetch(url, { method: 'HEAD', headers: HEADERS, redirect: 'manual' })
    if (res.status === 404) return { kind: 'gone' }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      const m = loc?.match(/\/p\/books\/([^/?#]+)/)
      if (m) return { kind: 'redirect', productSlug: m[1], location: loc! }
      return { kind: 'no_slug', location: loc, http: res.status }
    }
    if (res.status >= 200 && res.status < 300) {
      return { kind: 'no_slug', location: null, http: res.status }
    }
    return { kind: 'error', http: res.status }
  } catch {
    return { kind: 'error', http: null }
  }
}

// ── data types ─────────────────────────────────────────────────────────

type BookRow = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  bookshop_isbn13: string | null
  bookshop_checked_at: string | null
  book_authors: { authors: { display_name: string } | null }[] | null
}

// Rows (re)written after this moment were page-verified or deliberately
// demoted by the 2026-07-02 availability/edition fix round in the affiliate
// session — a mismatch on those is lower-priority (possibly already known).
const VERIFIED_CUTOFF = '2026-07-02T12:00:00Z'

type Bucket = 'match' | 'match_no_auth' | 'head_only' | 'mismatch'
  | 'gone' | 'no_slug' | 'unverifiable' | 'error'

type Entry = {
  id: number
  slug: string
  title: string
  authors: string[]
  linkIsbn: string
  isXref: boolean
  bucket: Bucket
  productSlug: string | null
  slugText: string | null
  authorHit: boolean
  http: number | null
  checkedAt: string
}

function classify(book: BookRow, authors: string[], probe: Probe): Omit<Entry, 'id' | 'slug' | 'title' | 'authors' | 'linkIsbn' | 'isXref' | 'checkedAt'> {
  if (probe.kind === 'gone') return { bucket: 'gone', productSlug: null, slugText: null, authorHit: false, http: 404 }
  if (probe.kind === 'no_slug') return { bucket: 'no_slug', productSlug: probe.location, slugText: null, authorHit: false, http: probe.http }
  if (probe.kind === 'error') return { bucket: 'error', productSlug: null, slugText: null, authorHit: false, http: probe.http }

  const slugText = decodeURIComponent(probe.productSlug).replace(/-/g, ' ')
  const authorHit = authorInSlug(authors, slugText)
  const bucket = bucketForSlug(book.title, slugText, authorHit)
  return { bucket, productSlug: probe.productSlug, slugText, authorHit, http: 308 }
}

// ── DB fetch ───────────────────────────────────────────────────────────

async function fetchBooks(): Promise<BookRow[]> {
  const supabase = adminClient()
  const rows: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, isbn13, bookshop_isbn13, bookshop_checked_at, book_authors(authors(display_name))')
      .eq('bookshop_status', 'valid')
      .order('id')
      .range(offset, offset + 999)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    rows.push(...(data as unknown as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

// ── checkpoint ─────────────────────────────────────────────────────────

function loadCheckpoint(): Map<number, Entry> {
  const map = new Map<number, Entry>()
  if (FRESH || !existsSync(CHECKPOINT)) return map
  for (const line of readFileSync(CHECKPOINT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line) as Entry
      // Re-derive the bucket from the stored slug so matcher improvements
      // apply to already-probed rows without re-probing (--report-only).
      if (e.slugText) {
        e.authorHit = authorInSlug(e.authors, e.slugText)
        e.bucket = bucketForSlug(e.title, e.slugText, e.authorHit)
      }
      map.set(e.id, e) // later lines win (retries overwrite)
    } catch { /* torn last line after an interrupt — reprobed next run */ }
  }
  // errors are transient: drop them so they get retried
  for (const [id, e] of map) if (e.bucket === 'error') map.delete(id)
  return map
}

// ── report ─────────────────────────────────────────────────────────────

const BOOKSHOP_P = 'https://bookshop.org/p/books'

function bookCell(e: Entry): string {
  return `[${e.title.slice(0, 70).replace(/\|/g, '\\|')}](https://banned-books.org/books/${e.slug})`
}
function slugCell(e: Entry): string {
  if (!e.productSlug) return '—'
  return `[${e.productSlug.slice(0, 70)}](${BOOKSHOP_P}/${e.productSlug}/${e.linkIsbn}?ean=${e.linkIsbn})`
}
function isbnCell(e: Entry): string {
  return `${e.linkIsbn}${e.isXref ? ' (xref)' : ''}`
}
function proposal(e: Entry): string {
  return e.isXref
    ? 'remediate: OL-editie herleiden, anders xref NULLen + not_found'
    : "bookshop_status='not_found' (canonieke isbn13 wijst naar ander werk — isbn13 zelf checken)"
}

function writeReport(entries: Entry[], totalValid: number, checkedAtById: Map<number, string | null>) {
  const recentlyVerified = (e: Entry) => {
    const at = checkedAtById.get(e.id)
    return Boolean(at && at >= VERIFIED_CUTOFF)
  }
  const verifiedCell = (e: Entry) => recentlyVerified(e) ? '✓' : '—'
  // Unverified rows first: those are the ones nobody has looked at yet.
  const byPriority = (a: Entry, z: Entry) => Number(recentlyVerified(a)) - Number(recentlyVerified(z))

  const by = (b: Bucket) => entries.filter(e => e.bucket === b)
  const mismatch = by('mismatch')
  // Review-priority split: no author token in the slug = likely a completely
  // different WORK (the Buscaglia/Freakonomics class); author present = likely
  // a translated edition or another work by the same author (still wrong as a
  // deep link, but a different failure class).
  const mismatchHard = mismatch.filter(e => !e.authorHit)
  const mismatchSoft = mismatch.filter(e => e.authorHit)
  const headOnly = by('head_only')
  const match = by('match')
  const matchNoAuth = by('match_no_auth')
  const gone = by('gone')
  const noSlug = by('no_slug')
  const unverifiable = by('unverifiable')
  const errors = by('error')

  const lines: string[] = []
  lines.push(`# Bookshop redirect-target audit — ${today}`)
  lines.push('')
  lines.push(`Read-only. HEAD \`/a/${BOOKSHOP_AFFILIATE_ID}/{bookshop_isbn13 ?? isbn13}\` → 308 Location product-slug, vergeleken met onze titel via titlesMatch (strict) / head-variant (loose). Aanleiding: desc-websearch-pilot 2026-07-03 vond deep links naar compleet andere werken.`)
  lines.push('')
  lines.push(`Gecheckt: **${entries.length}** van ${totalValid} bookshop_status='valid' links (checkpoint: \`data/bookshop-redirect-audit-checkpoint.jsonl\`).`)
  lines.push('')
  lines.push('| bucket | n | betekenis |')
  lines.push('|---|---|---|')
  lines.push(`| match | ${match.length} | titel + auteur in slug — OK |`)
  lines.push(`| match, auteur niet in slug | ${matchNoAuth.length} | zelfde titel, andere naam — mogelijk bewerking/companion, steekproef |`)
  lines.push(`| head-only match | ${headOnly.length} | alleen titel-kop matcht (subtitel ontbreekt op Bookshop) — meestal OK |`)
  lines.push(`| **mismatch, auteur niet in slug** | **${mismatchHard.length}** | **waarschijnlijk compleet ander werk (Buscaglia-klasse)** |`)
  lines.push(`| mismatch, auteur wél in slug | ${mismatchSoft.length} | waarschijnlijk vertaalde editie of ander werk van dezelfde auteur |`)
  lines.push(`| gone (404) | ${gone.length} | status-drift sinds laatste probe-sweep |`)
  lines.push(`| no_slug | ${noSlug.length} | redirect zonder parseerbare product-slug |`)
  lines.push(`| unverifiable | ${unverifiable.length} | geen Latijnse titel-tokens om te vergelijken |`)
  lines.push(`| error | ${errors.length} | transient; volgende run opnieuw geprobeerd |`)
  lines.push('')

  lines.push(`## Mismatch (${mismatch.length}) — reviewen, daarna remediëren`)
  lines.push('')
  lines.push(`Fix-pad na review: \`npx tsx --env-file=.env.local scripts/remediate-bookshop-editions.ts --audit=data/bookshop-redirect-audit-${today}.json --book-ids=<bevestigde ids> --apply\` — herleidt een correcte Engelse papieren editie via het OL-werk, of demoteert naar de storefront-fallback (xref NULL + \`bookshop_status='not_found'\`). Niets applyen zonder deze review.`)
  lines.push('')
  lines.push(`De kolom "geverifieerd ≥02-07" markeert rijen waarvan bookshop_checked_at ná ${VERIFIED_CUTOFF} ligt: die zijn in de affiliate-sessie al page-verified of bewust gedemoveerd — lagere prioriteit. Ongeverifieerde rijen staan bovenaan.`)
  lines.push('')
  lines.push(`### Auteur NIET in slug (${mismatchHard.length}) — waarschijnlijk ander werk, hoogste prioriteit`)
  lines.push('')
  lines.push('| id | book | auteur | link-ISBN | redirect-slug | geverifieerd ≥02-07 | voorstel |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const e of [...mismatchHard].sort(byPriority)) {
    lines.push(`| ${e.id} | ${bookCell(e)} | ${e.authors.join('; ').slice(0, 40)} | ${isbnCell(e)} | ${slugCell(e)} | ${verifiedCell(e)} | ${proposal(e)} |`)
  }
  lines.push('')
  lines.push(`### Auteur wél in slug (${mismatchSoft.length}) — vertaalde editie / ander werk zelfde auteur`)
  lines.push('')
  lines.push('| id | book | auteur | link-ISBN | redirect-slug | geverifieerd ≥02-07 | voorstel |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const e of [...mismatchSoft].sort(byPriority)) {
    lines.push(`| ${e.id} | ${bookCell(e)} | ${e.authors.join('; ').slice(0, 40)} | ${isbnCell(e)} | ${slugCell(e)} | ${verifiedCell(e)} | ${proposal(e)} |`)
  }
  lines.push('')

  lines.push(`## Head-only match (${headOnly.length}) — subtitel wijkt af, steekproef volstaat`)
  lines.push('')
  lines.push('| id | book | auteur in slug? | link-ISBN | redirect-slug |')
  lines.push('|---|---|---|---|---|')
  for (const e of headOnly) {
    lines.push(`| ${e.id} | ${bookCell(e)} | ${e.authorHit ? '✓' : '✗'} | ${isbnCell(e)} | ${slugCell(e)} |`)
  }
  lines.push('')

  lines.push(`## Match (${match.length + matchNoAuth.length})`)
  lines.push('')
  lines.push(`${match.length} met auteur-bevestiging in de slug — niet gelist (volledige lijst in het checkpoint-JSONL).`)
  lines.push('')
  if (matchNoAuth.length) {
    lines.push(`### Match zonder auteur in slug (${matchNoAuth.length}) — bewerkingen/companions?`)
    lines.push('')
    lines.push('Zelfde titel maar géén auteurstoken in de slug — vangt o.a. toneelbewerkingen (The Grapes of Wrath → Frank Galati) en study guides.')
    lines.push('')
    lines.push('| id | book | auteur | link-ISBN | redirect-slug |')
    lines.push('|---|---|---|---|---|')
    for (const e of matchNoAuth) {
      lines.push(`| ${e.id} | ${bookCell(e)} | ${e.authors.join('; ').slice(0, 40)} | ${isbnCell(e)} | ${slugCell(e)} |`)
    }
    lines.push('')
  }

  if (gone.length) {
    lines.push(`## Gone (${gone.length}) — nu 404, status-drift`)
    lines.push('')
    lines.push('Fix-pad: `probe-bookshop-isbn.ts --apply --stale-before=<vandaag>` zet deze netjes op not_found.')
    lines.push('')
    for (const e of gone) lines.push(`- ${e.id} ${bookCell(e)} — ${isbnCell(e)}`)
    lines.push('')
  }
  if (noSlug.length) {
    lines.push(`## No slug (${noSlug.length}) — informatief`)
    lines.push('')
    for (const e of noSlug) lines.push(`- ${e.id} ${bookCell(e)} — ${isbnCell(e)} → HTTP ${e.http}, location: ${e.productSlug ?? '—'}`)
    lines.push('')
  }
  if (unverifiable.length) {
    lines.push(`## Unverifiable (${unverifiable.length}) — niet-Latijnse titel`)
    lines.push('')
    for (const e of unverifiable) lines.push(`- ${e.id} ${bookCell(e)} — slug: ${e.productSlug ?? '—'}`)
    lines.push('')
  }

  writeFileSync(OUT_MD, lines.join('\n'))

  // remediate-bookshop-editions.ts-compatible findings (mismatches only)
  writeFileSync(OUT_JSON, JSON.stringify({
    generated: new Date().toISOString(),
    findings: mismatch.map(e => ({
      id: e.id, slug: e.slug, title: e.title,
      linkIsbn: e.linkIsbn, isXref: e.isXref,
      flags: [
        'redirect_mismatch',
        e.authorHit ? 'author_in_slug' : 'author_missing',
        ...(recentlyVerified(e) ? ['verified_after_2026-07-02'] : []),
      ],
      redirectSlug: e.productSlug,
    })),
  }, null, 2))
}

// ── main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── _audit_bookshop_redirects (READ-ONLY${REPORT_ONLY ? ', REPORT-ONLY' : ''}${FRESH ? ', FRESH' : ''}) ──\n`)

  const books = await fetchBooks()
  console.log(`bookshop_status='valid' books: ${books.length}`)

  const done = loadCheckpoint()
  console.log(`checkpoint entries reusable: ${done.size}`)

  if (!REPORT_ONLY) {
    const todo = books.filter(b => !done.has(b.id) && (b.bookshop_isbn13 ?? b.isbn13)).slice(0, LIMIT)
    console.log(`to probe this run: ${todo.length}\n`)

    for (let i = 0; i < todo.length; i++) {
      const book = todo[i]
      const authors = (book.book_authors ?? []).map(a => a.authors?.display_name).filter((x): x is string => !!x)
      const linkIsbn = (book.bookshop_isbn13 ?? book.isbn13)!
      const probe = await probeRedirect(linkIsbn)
      const entry: Entry = {
        id: book.id, slug: book.slug, title: book.title, authors,
        linkIsbn, isXref: Boolean(book.bookshop_isbn13),
        ...classify(book, authors, probe),
        checkedAt: new Date().toISOString(),
      }
      appendFileSync(CHECKPOINT, JSON.stringify(entry) + '\n')
      done.set(book.id, entry)
      console.log(`  [${i + 1}/${todo.length}] ${linkIsbn}${entry.isXref ? ' (xref)' : ''}  ${book.title.slice(0, 45).padEnd(45)} → ${entry.bucket}`)
      if (i < todo.length - 1) await sleep(REQUEST_DELAY_MS)
    }
  }

  // Report over everything checkpointed for books that are still 'valid'.
  const validIds = new Set(books.map(b => b.id))
  const checkedAtById = new Map(books.map(b => [b.id, b.bookshop_checked_at]))
  const entries = [...done.values()].filter(e => validIds.has(e.id) && e.bucket !== 'error')
  const errCount = [...done.values()].filter(e => e.bucket === 'error').length
  writeReport(entries, books.length, checkedAtById)

  const counts = new Map<Bucket, number>()
  for (const e of entries) counts.set(e.bucket, (counts.get(e.bucket) ?? 0) + 1)
  console.log(`\n── Summary ──────────────────────────────`)
  for (const [b, n] of [...counts.entries()].sort((a, z) => z[1] - a[1])) console.log(`  ${b.padEnd(14)}: ${n}`)
  if (errCount) console.log(`  ${'error'.padEnd(14)}: ${errCount} (retry volgende run)`)
  console.log(`\n  report : ${OUT_MD}`)
  console.log(`  json   : ${OUT_JSON} (input voor remediate-bookshop-editions.ts)`)
  console.log(`  checkpoint: ${CHECKPOINT}`)
  console.log(`  remaining unprobed: ${books.filter(b => !done.has(b.id)).length}`)
  console.log('──────────────────────────────────────────')
}

main().catch(e => { console.error(e); process.exit(1) })
