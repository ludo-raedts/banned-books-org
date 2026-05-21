/**
 * For books whose canonical isbn13 didn't resolve on Bookshop (status =
 * 'not_found'), look up the same work on Open Library, gather all known
 * isbn13 editions, and HEAD-probe them against Bookshop. The first one
 * that returns 200 gets stored in books.bookshop_isbn13 and the status
 * is upgraded to 'valid'.
 *
 * The canonical books.isbn13 is left untouched (it's still used for
 * covers, OG metadata, etc.). getBookshopUrl picks bookshop_isbn13 over
 * isbn13 when set.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cross-reference-bookshop-isbn.ts
 *     → dry-run: process 10 books, write nothing
 *   npx tsx --env-file=.env.local scripts/cross-reference-bookshop-isbn.ts --apply
 *     → process every not_found book without an alt yet, write back to DB
 *   npx tsx --env-file=.env.local scripts/cross-reference-bookshop-isbn.ts \
 *     --report=data/_bookshop-isbn-fixes.md
 *     → full read-only run; writes a markdown report listing each book's
 *       current ISBN and a suggested working alt-ISBN (when found).
 *       Report is flushed every 25 rows so long runs are inspectable
 *       mid-flight.
 *   --limit=200 → caps any of the above at 200 books.
 *
 * Per book worst case: 1 OL works lookup + 1 OL editions lookup + N
 * Bookshop HEADs (capped at MAX_CANDIDATES). Candidate ranking favors
 * US trade imprints (Harper, Penguin, Vintage, …) and skips clear
 * dead-ends (CreateSpace, FollettBound, Turtleback, …). Pacing is
 * conservative to stay below informal rate limits on either side.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { BOOKSHOP_AFFILIATE_ID } from '../src/lib/bookshop'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const MAX = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity
const REPORT_ARG = process.argv.find(a => a.startsWith('--report='))
const REPORT_PATH = REPORT_ARG ? REPORT_ARG.split('=')[1] : null

const OL_DELAY_MS = 400
const BSO_DELAY_MS = 1000
const MAX_CANDIDATES = 20       // bumped from 8 — OL editions ranking is
                                // unreliable for classics (publish_country
                                // often empty), so we probe deeper.
const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const BSO_HEADERS = OL_HEADERS

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function isIsbn13(s: unknown): s is string {
  return typeof s === 'string' && /^97[89]\d{10}$/.test(s.replace(/-/g, ''))
}

// Publisher-name heuristics — applied to OL editions to skip clear
// dead ends and to prioritize imprints that Bookshop actually stocks.
//
// SKIP_PUBLISHERS: print-on-demand, library-binding rebinders, and
// niche reprints that almost never get a /a/{aid}/{isbn} match on
// Bookshop. Filtering them out is a meaningful hit-rate boost — for
// a single classic title, OL editions endpoint typically returns 5–10
// such ISBNs that would otherwise burn through our probe budget.
//
// US_TRADE_IMPRINTS: lowercase substrings of major US trade imprints
// that Bookshop reliably carries. Candidates whose `publishers[0]`
// matches one of these float to the front of the probe queue.
const SKIP_PUBLISHERS = [
  'createspace', 'independently published', 'independent publishing',
  'lulu', 'booksurge', 'authorhouse', 'iuniverse', 'xlibris',
  'library binding', 'followbound', 'follettbound', 'turtleback',
  'demco media', 'perfection learning', 'bound to stay bound',
  'neal-schuman', 'spotlight', 'paw prints',
]

const US_TRADE_IMPRINTS = [
  // Penguin Random House
  'harper', 'william morrow', 'penguin', 'signet', 'plume', 'putnam',
  'vintage', 'anchor', 'knopf', 'pantheon', 'doubleday', 'crown',
  'ballantine', 'bantam', 'dell', 'random house', 'modern library',
  // Simon & Schuster
  'simon & schuster', 'simon and schuster', 'pocket book', 'atria',
  'scribner', 'touchstone', 'gallery',
  // Macmillan
  'farrar', 'henry holt', 'picador', "st. martin", 'st martin', 'tor',
  'macmillan', 'flatiron',
  // Hachette
  'little, brown', 'little brown', 'grand central', 'hyperion',
  'mulholland', 'orbit',
  // Other big US trade
  'norton', 'liveright', 'houghton mifflin', 'mariner', 'clarion',
  'scholastic', 'bloomsbury usa', 'algonquin', 'graywolf', 'tin house',
  'milkweed', 'soft skull', 'europa editions',
]

function publisherScore(publisher: string | undefined, publishCountry: string | undefined): number {
  const pub = (publisher ?? '').toLowerCase()
  const country = (publishCountry ?? '').toLowerCase()
  if (SKIP_PUBLISHERS.some(s => pub.includes(s))) return -1   // skip entirely
  if (US_TRADE_IMPRINTS.some(s => pub.includes(s))) return 3  // probe first
  if (country.includes('us') || country === 'nyu') return 2   // OL says US
  if (!pub && !country) return 1                              // unknown — give it a shot
  return 0                                                     // probably foreign / academic
}

// Look up the Open Library works key for an isbn13. Books that aren't in
// OL return null — we have no way to find alt editions for those.
async function olWorksKeyForIsbn(isbn13: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn13}.json`, {
      headers: OL_HEADERS, redirect: 'follow',
    })
    if (!res.ok) return null
    const json = await res.json() as { works?: { key: string }[] }
    return json.works?.[0]?.key ?? null
  } catch { return null }
}

type ScoredCandidate = { isbn: string; publisher: string; score: number }

// Fetch up to 100 editions of an OL work and rank them for the Bookshop
// probe queue. Higher score = try first. SKIP entries are dropped.
async function olEditionsForWork(worksKey: string): Promise<ScoredCandidate[]> {
  try {
    const res = await fetch(`https://openlibrary.org${worksKey}/editions.json?limit=100`, {
      headers: OL_HEADERS, redirect: 'follow',
    })
    if (!res.ok) return []
    const json = await res.json() as {
      entries?: Array<{ isbn_13?: string[]; publish_country?: string; publishers?: string[] }>
    }
    const seen = new Set<string>()
    const cands: ScoredCandidate[] = []
    for (const e of json.entries ?? []) {
      const publisher = (e.publishers ?? [])[0] ?? ''
      const score = publisherScore(publisher, e.publish_country)
      if (score < 0) continue
      for (const raw of e.isbn_13 ?? []) {
        const isbn = raw.replace(/-/g, '')
        if (!isIsbn13(isbn) || seen.has(isbn)) continue
        seen.add(isbn)
        cands.push({ isbn, publisher, score })
      }
    }
    cands.sort((a, b) => b.score - a.score)
    return cands
  } catch { return [] }
}

async function probeBookshop(isbn13: string): Promise<'valid' | 'not_found' | 'error'> {
  // Mirrors the probe in scripts/probe-bookshop-isbn.ts — see comment there
  // for why we use redirect:'manual' and treat 3xx as the "exists" signal.
  const url = `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn13}`
  try {
    let res = await fetch(url, { method: 'HEAD', headers: BSO_HEADERS, redirect: 'manual' })
    if (res.status === 405) {
      res = await fetch(url, { method: 'GET', headers: BSO_HEADERS, redirect: 'manual' })
    }
    if (res.status === 404) return 'not_found'
    if (res.status >= 200 && res.status < 400) return 'valid'
    return 'error'
  } catch { return 'error' }
}

type ReportRow = {
  bookId: number
  slug: string
  title: string
  authors: string
  currentIsbn: string
  foundIsbn: string | null
  foundPublisher: string | null
  outcome: 'found' | 'no-work' | 'no-alts' | 'no-match'
}

async function main() {
  console.log(`\n── cross-reference-bookshop-isbn (${APPLY ? 'APPLY' : REPORT_PATH ? 'REPORT' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  type BookRow = {
    id: number
    slug: string
    title: string
    isbn13: string
    book_authors: { authors: { display_name: string } | null }[] | null
  }

  const books: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, isbn13, book_authors(authors(display_name))')
      .eq('bookshop_status', 'not_found')
      .is('bookshop_isbn13', null)
      .not('isbn13', 'is', null)
      .order('id')
      .range(offset, offset + 999)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`Books in 'not_found' state without alt-ISBN: ${books.length}`)
  if (books.length === 0) { console.log('Nothing to do.'); return }

  // limit logic:
  //   --apply or --report : full set (capped by --limit if given)
  //   bare dry-run        : sample 10
  const isFullRun = APPLY || REPORT_PATH != null
  const limit = isFullRun ? Math.min(books.length, MAX) : Math.min(10, books.length)
  console.log(
    `${isFullRun
      ? `Processing ${limit} of ${books.length}${REPORT_PATH ? ` → report: ${REPORT_PATH}` : ''}…`
      : `DRY-RUN — sampling ${limit} books:`}\n`,
  )

  let upgraded = 0, stillNotFound = 0, noWork = 0, dbErrors = 0
  let candidatesProbed = 0
  const reportRows: ReportRow[] = []

  function authorOf(b: BookRow): string {
    return (b.book_authors ?? [])
      .map(ba => ba.authors?.display_name)
      .filter((s): s is string => !!s)
      .join(', ')
  }

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    process.stdout.write(`  [${i + 1}/${limit}] ${book.title.slice(0, 45).padEnd(45)} `)

    const worksKey = await olWorksKeyForIsbn(book.isbn13)
    await sleep(OL_DELAY_MS)
    if (!worksKey) {
      process.stdout.write(`→ no OL work\n`)
      noWork++
      reportRows.push({
        bookId: book.id, slug: book.slug, title: book.title, authors: authorOf(book),
        currentIsbn: book.isbn13, foundIsbn: null, foundPublisher: null, outcome: 'no-work',
      })
      continue
    }

    const candidatesAll = await olEditionsForWork(worksKey)
    await sleep(OL_DELAY_MS)
    const candidates = candidatesAll.filter(c => c.isbn !== book.isbn13).slice(0, MAX_CANDIDATES)
    if (candidates.length === 0) {
      process.stdout.write(`→ no alt editions (work ${worksKey})\n`)
      stillNotFound++
      reportRows.push({
        bookId: book.id, slug: book.slug, title: book.title, authors: authorOf(book),
        currentIsbn: book.isbn13, foundIsbn: null, foundPublisher: null, outcome: 'no-alts',
      })
      continue
    }

    let found: ScoredCandidate | null = null
    for (const cand of candidates) {
      candidatesProbed++
      const result = await probeBookshop(cand.isbn)
      await sleep(BSO_DELAY_MS)
      if (result === 'valid') { found = cand; break }
    }

    if (found) {
      process.stdout.write(`→ valid via ${found.isbn} (${found.publisher || '?'}; ${candidates.length} cands)\n`)
      upgraded++
      reportRows.push({
        bookId: book.id, slug: book.slug, title: book.title, authors: authorOf(book),
        currentIsbn: book.isbn13, foundIsbn: found.isbn, foundPublisher: found.publisher, outcome: 'found',
      })
      if (APPLY) {
        const { error } = await supabase
          .from('books')
          .update({
            bookshop_isbn13: found.isbn,
            bookshop_status: 'valid',
            bookshop_checked_at: new Date().toISOString(),
          })
          .eq('id', book.id)
        if (error) {
          console.error(`    ✗ DB write failed: ${error.message}`)
          dbErrors++
        }
      }
    } else {
      process.stdout.write(`→ none of ${candidates.length} alts resolved\n`)
      stillNotFound++
      reportRows.push({
        bookId: book.id, slug: book.slug, title: book.title, authors: authorOf(book),
        currentIsbn: book.isbn13, foundIsbn: null, foundPublisher: null, outcome: 'no-match',
      })
    }

    // Incremental report flush every 25 rows — keeps useful output even
    // if the script is interrupted partway through a multi-hour run.
    if (REPORT_PATH && (i + 1) % 25 === 0) {
      writeReport(REPORT_PATH, reportRows, { partial: true, processed: i + 1, total: limit })
    }
  }

  if (REPORT_PATH) {
    writeReport(REPORT_PATH, reportRows, { partial: false, processed: limit, total: limit })
    console.log(`\nReport written to ${REPORT_PATH}`)
  }

  console.log(`
── Summary ──────────────────────────────
  upgraded to valid : ${upgraded}
  still not_found   : ${stillNotFound}
  no OL work found  : ${noWork}
  candidates probed : ${candidatesProbed} total
  ${APPLY ? `\n  DB write errors: ${dbErrors}` : (REPORT_PATH ? '\n  (report-only — no rows written)' : '\n  (dry-run — no rows written)')}
──────────────────────────────────────────`)
}

function writeReport(path: string, rows: ReportRow[], meta: { partial: boolean; processed: number; total: number }) {
  mkdirSync(dirname(path), { recursive: true })
  const found = rows.filter(r => r.outcome === 'found')
  const noMatch = rows.filter(r => r.outcome === 'no-match')
  const noAlts = rows.filter(r => r.outcome === 'no-alts')
  const noWork = rows.filter(r => r.outcome === 'no-work')

  const lines: string[] = []
  lines.push(`# Bookshop ISBN cross-reference report`)
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Progress: ${meta.processed} of ${meta.total} books${meta.partial ? ' _(partial, run still in progress)_' : ''}`)
  lines.push('')
  lines.push(`- **${found.length}** books got a working Bookshop alt-ISBN — \`books.bookshop_isbn13\` could be set to the suggested value (or pasted into the bookshop affiliate list).`)
  lines.push(`- **${noMatch.length}** books had alt editions but none resolved on Bookshop.`)
  lines.push(`- **${noAlts.length}** books had no alt editions from Open Library.`)
  lines.push(`- **${noWork.length}** books were not findable in Open Library at all.`)
  lines.push('')

  if (found.length > 0) {
    lines.push(`## Books with a suggested working ISBN (${found.length})`)
    lines.push('')
    lines.push(`Replace \`current\` with \`suggested\` to make Bookshop resolve the per-ISBN deeplink.`)
    lines.push('')
    lines.push(`| # | Title | Author(s) | Current ISBN | Suggested ISBN | US imprint |`)
    lines.push(`|---|---|---|---|---|---|`)
    found.forEach((r, i) => {
      const title = `[${r.title}](https://banned-books.org/books/${r.slug})`
      lines.push(`| ${i + 1} | ${title} | ${r.authors || '—'} | \`${r.currentIsbn}\` | \`${r.foundIsbn}\` | ${r.foundPublisher || '—'} |`)
    })
    lines.push('')
  }

  if (noMatch.length > 0) {
    lines.push(`## Books with alt editions but no Bookshop hit (${noMatch.length})`)
    lines.push('')
    lines.push(`Bookshop genuinely doesn't stock a probed edition of these. May need manual lookup or a different US imprint Bookshop carries.`)
    lines.push('')
    lines.push(`| # | Title | Author(s) | Current ISBN |`)
    lines.push(`|---|---|---|---|`)
    noMatch.forEach((r, i) => {
      const title = `[${r.title}](https://banned-books.org/books/${r.slug})`
      lines.push(`| ${i + 1} | ${title} | ${r.authors || '—'} | \`${r.currentIsbn}\` |`)
    })
    lines.push('')
  }

  if (noAlts.length > 0) {
    lines.push(`## Books with no alternative editions in Open Library (${noAlts.length})`)
    lines.push('')
    lines.push(`Single-edition works in OL — nothing to swap to.`)
    lines.push('')
    lines.push(`| # | Title | Author(s) | Current ISBN |`)
    lines.push(`|---|---|---|---|`)
    noAlts.forEach((r, i) => {
      const title = `[${r.title}](https://banned-books.org/books/${r.slug})`
      lines.push(`| ${i + 1} | ${title} | ${r.authors || '—'} | \`${r.currentIsbn}\` |`)
    })
    lines.push('')
  }

  if (noWork.length > 0) {
    lines.push(`## Books not findable in Open Library (${noWork.length})`)
    lines.push('')
    lines.push(`OL doesn't recognise our canonical ISBN. Possible causes: very obscure edition, very recent publication, or ISBN data quality issue.`)
    lines.push('')
    lines.push(`| # | Title | Author(s) | Current ISBN |`)
    lines.push(`|---|---|---|---|`)
    noWork.forEach((r, i) => {
      const title = `[${r.title}](https://banned-books.org/books/${r.slug})`
      lines.push(`| ${i + 1} | ${title} | ${r.authors || '—'} | \`${r.currentIsbn}\` |`)
    })
    lines.push('')
  }

  writeFileSync(path, lines.join('\n'))
}

main().catch(e => { console.error(e); process.exit(1) })
