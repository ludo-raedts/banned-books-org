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
 *     → process every not_found book without an alt yet
 *   npx tsx --env-file=.env.local scripts/cross-reference-bookshop-isbn.ts --apply --limit=200
 *     → cap at 200 per run
 *
 * Per book worst case: 1 OL works lookup + 1 OL editions lookup + N
 * Bookshop HEADs (capped at MAX_CANDIDATES). Pacing is conservative to
 * stay below any informal rate limits on either side.
 */

import { adminClient } from '../src/lib/supabase'
import { BOOKSHOP_AFFILIATE_ID } from '../src/lib/bookshop'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const MAX = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity

const OL_DELAY_MS = 400
const BSO_DELAY_MS = 1000
const MAX_CANDIDATES = 8        // never probe more than 8 alt-ISBNs per book
const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const BSO_HEADERS = OL_HEADERS

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function isIsbn13(s: unknown): s is string {
  return typeof s === 'string' && /^97[89]\d{10}$/.test(s.replace(/-/g, ''))
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

// Fetch up to `limit` editions of an OL work. Returns deduped isbn13s,
// US editions first (loose ranking — anything with publish_country
// containing "us" floats up).
async function olEditionsForWork(worksKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://openlibrary.org${worksKey}/editions.json?limit=100`, {
      headers: OL_HEADERS, redirect: 'follow',
    })
    if (!res.ok) return []
    const json = await res.json() as {
      entries?: Array<{ isbn_13?: string[]; publish_country?: string; publishers?: string[] }>
    }
    type Cand = { isbn: string; us: boolean }
    const cands: Cand[] = []
    const seen = new Set<string>()
    for (const e of json.entries ?? []) {
      const us = (e.publish_country ?? '').toLowerCase().includes('us')
        || (e.publish_country ?? '').toLowerCase() === 'nyu'
      for (const raw of e.isbn_13 ?? []) {
        const isbn = raw.replace(/-/g, '')
        if (!isIsbn13(isbn) || seen.has(isbn)) continue
        seen.add(isbn)
        cands.push({ isbn, us })
      }
    }
    cands.sort((a, b) => Number(b.us) - Number(a.us))
    return cands.map(c => c.isbn)
  } catch { return [] }
}

async function probeBookshop(isbn13: string): Promise<'valid' | 'not_found' | 'error'> {
  const url = `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn13}`
  try {
    let res = await fetch(url, { method: 'HEAD', headers: BSO_HEADERS, redirect: 'follow' })
    if (res.status === 405) {
      res = await fetch(url, { method: 'GET', headers: BSO_HEADERS, redirect: 'follow' })
    }
    if (res.status === 404) return 'not_found'
    if (res.status >= 200 && res.status < 300) return 'valid'
    return 'error'
  } catch { return 'error' }
}

async function main() {
  console.log(`\n── cross-reference-bookshop-isbn (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  type BookRow = { id: number; slug: string; title: string; isbn13: string }

  const books: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, isbn13')
      .eq('bookshop_status', 'not_found')
      .is('bookshop_isbn13', null)
      .not('isbn13', 'is', null)
      .order('id')
      .range(offset, offset + 999)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    books.push(...(data as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`Books in 'not_found' state without alt-ISBN: ${books.length}`)
  if (books.length === 0) { console.log('Nothing to do.'); return }

  const limit = APPLY ? Math.min(books.length, MAX) : Math.min(10, books.length)
  console.log(`${APPLY ? `Cross-referencing ${limit} of ${books.length}…` : `DRY-RUN — sampling ${limit} books:`}\n`)

  let upgraded = 0, stillNotFound = 0, noWork = 0, dbErrors = 0
  let candidatesProbed = 0

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    process.stdout.write(`  [${i + 1}/${limit}] ${book.title.slice(0, 45).padEnd(45)} `)

    const worksKey = await olWorksKeyForIsbn(book.isbn13)
    await sleep(OL_DELAY_MS)
    if (!worksKey) {
      process.stdout.write(`→ no OL work\n`)
      noWork++
      continue
    }

    const editions = await olEditionsForWork(worksKey)
    await sleep(OL_DELAY_MS)
    const candidates = editions.filter(c => c !== book.isbn13).slice(0, MAX_CANDIDATES)
    if (candidates.length === 0) {
      process.stdout.write(`→ no alt editions (work ${worksKey})\n`)
      stillNotFound++
      continue
    }

    let foundIsbn: string | null = null
    for (const cand of candidates) {
      candidatesProbed++
      const result = await probeBookshop(cand)
      await sleep(BSO_DELAY_MS)
      if (result === 'valid') { foundIsbn = cand; break }
    }

    if (foundIsbn) {
      process.stdout.write(`→ valid via alt ${foundIsbn} (tried ${candidates.length})\n`)
      upgraded++
      if (APPLY) {
        const { error } = await supabase
          .from('books')
          .update({
            bookshop_isbn13: foundIsbn,
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
    }
  }

  console.log(`
── Summary ──────────────────────────────
  upgraded to valid : ${upgraded}
  still not_found   : ${stillNotFound}
  no OL work found  : ${noWork}
  candidates probed : ${candidatesProbed} total
  ${APPLY ? `\n  DB write errors: ${dbErrors}` : '\n  (dry-run — no rows written)'}
──────────────────────────────────────────`)
}

main().catch(e => { console.error(e); process.exit(1) })
