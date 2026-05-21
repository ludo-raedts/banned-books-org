/**
 * Probe Bookshop.org's affiliate deep-link path (/a/{aid}/{isbn13}) for
 * every book in our DB that has an isbn13 set, and store whether the
 * link resolves.
 *
 * Why: many of our isbn13s are foreign-edition ISBNs and 404 on Bookshop
 * (which only lists US-distributed editions). We want to send users to a
 * working page when possible (deep link) and fall back to the storefront
 * URL otherwise — both paths set the 48-hour affiliate cookie.
 *
 * Status values written to books.bookshop_status:
 *   valid       — HEAD returned 2xx (book has a Bookshop page)
 *   not_found   — HEAD returned 404 (isbn13 not in Bookshop's catalogue)
 *   (NULL)      — transient error or not yet checked; we'll try again later
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/probe-bookshop-isbn.ts
 *     → dry-run: probes 10 books, writes nothing
 *   npx tsx --env-file=.env.local scripts/probe-bookshop-isbn.ts --apply
 *     → probe everything still unchecked, write results
 *   npx tsx --env-file=.env.local scripts/probe-bookshop-isbn.ts --apply --limit=200
 *     → cap at 200 per run (useful for staged rollouts)
 *   npx tsx --env-file=.env.local scripts/probe-bookshop-isbn.ts --apply --reprobe
 *     → re-check every book regardless of existing bookshop_status
 *
 * Throttling: ~1 request/second. Bookshop has no published rate limit; this
 * is conservative. A full sweep of ~3000 books takes roughly an hour.
 */

import { adminClient } from '../src/lib/supabase'
import { BOOKSHOP_AFFILIATE_ID } from '../src/lib/bookshop'

const APPLY = process.argv.includes('--apply')
const REPROBE = process.argv.includes('--reprobe')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const MAX = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity

const REQUEST_DELAY_MS = 1000
const HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type ProbeResult = 'valid' | 'not_found' | 'error'

async function probe(isbn13: string): Promise<ProbeResult> {
  const url = `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn13}`
  try {
    // redirect:'manual' so we observe bookshop's own signal directly:
    //   404                  → the ISBN is not in their catalogue
    //   308 → /p/books/...   → the ISBN IS in their catalogue, redirecting
    //                          to the canonical product page (with affiliate
    //                          tag preserved). Following the redirect with
    //                          HEAD sometimes loops or returns 405 on the
    //                          target, so we treat any 3xx here as the
    //                          authoritative "exists" signal.
    let res = await fetch(url, { method: 'HEAD', headers: HEADERS, redirect: 'manual' })
    // Some hosts reject HEAD with 405; fall back to GET (body discarded).
    if (res.status === 405) {
      res = await fetch(url, { method: 'GET', headers: HEADERS, redirect: 'manual' })
    }
    if (res.status === 404) return 'not_found'
    if (res.status >= 200 && res.status < 400) return 'valid'
    return 'error'
  } catch {
    return 'error'
  }
}

async function main() {
  console.log(`\n── probe-bookshop-isbn (${APPLY ? 'APPLY' : 'DRY-RUN'}${REPROBE ? ', REPROBE' : ''}) ──\n`)

  const supabase = adminClient()

  type BookRow = { id: number; slug: string; title: string; isbn13: string }

  // Paginate to bypass the 1000-row default cap.
  const books: BookRow[] = []
  let offset = 0
  while (true) {
    let q = supabase
      .from('books')
      .select('id, slug, title, isbn13')
      .not('isbn13', 'is', null)
      .order('id')
      .range(offset, offset + 999)
    if (!REPROBE) q = q.is('bookshop_status', null)

    const { data, error } = await q
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    books.push(...(data as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`Books to probe: ${books.length}`)
  if (books.length === 0) { console.log('Nothing to do.'); return }

  const limit = APPLY ? Math.min(books.length, MAX) : Math.min(10, books.length)
  console.log(`${APPLY ? `Probing ${limit} of ${books.length}…` : `DRY-RUN — sampling ${limit} books:`}\n`)

  let valid = 0, notFound = 0, errors = 0, dbErrors = 0

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    process.stdout.write(`  [${i + 1}/${limit}] ${book.isbn13}  ${book.title.slice(0, 45).padEnd(45)} `)

    const result = await probe(book.isbn13)
    process.stdout.write(`→ ${result}\n`)

    if (result === 'valid') valid++
    else if (result === 'not_found') notFound++
    else errors++

    if (APPLY && (result === 'valid' || result === 'not_found')) {
      const { error } = await supabase
        .from('books')
        .update({
          bookshop_status: result,
          bookshop_checked_at: new Date().toISOString(),
        })
        .eq('id', book.id)
      if (error) {
        console.error(`    ✗ DB write failed: ${error.message}`)
        dbErrors++
      }
    }

    if (i < limit - 1) await sleep(REQUEST_DELAY_MS)
  }

  const total = valid + notFound + errors
  const pct = (n: number) => total === 0 ? '0.0%' : `${(n / total * 100).toFixed(1)}%`
  console.log(`
── Summary ──────────────────────────────
  valid     : ${valid}  (${pct(valid)})
  not_found : ${notFound}  (${pct(notFound)})
  errors    : ${errors}  (${pct(errors)}) — left as NULL, retry next run
  ${APPLY ? `\n  DB write errors: ${dbErrors}` : '\n  (dry-run — no rows written)'}
──────────────────────────────────────────`)
}

main().catch(e => { console.error(e); process.exit(1) })
