/**
 * Enrich books that are missing isbn13 by querying Open Library and Google Books.
 *
 * Strategy (tried in order per book):
 *   1. Open Library search by title+author  → isbn13 from search results
 *   2. Open Library search by title only    → catches author-name mismatches
 *   3. Google Books API                     → industryIdentifiers[type=ISBN_13]
 *
 * Eligibility is `isbn_checked_at IS NULL`: once a book is tried (hit OR miss)
 * it gets stamped and drops out of the pool. To give already-tried books a
 * fresh attempt, re-open them first with --retry / --retry-all (a write, so it
 * only takes effect together with --apply).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts
 *     → dry-run: shows counts and 10 sample results, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply
 *     → writes isbn13 to DB
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --limit=200
 *     → cap at 200 books per run (useful for staged rollouts)
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --retry
 *     → re-open every PREVIOUSLY-FAILED book (isbn13 still NULL) and try again
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --retry-all
 *     → re-open EVERY book, including ones that already have an isbn13
 *       (wasteful: existing isbn13s are never overwritten — writes are gated)
 *
 * Core logic lives in src/lib/enrich/isbn.ts so the /api/admin/enrich/run
 * route can call it in-process from the UI.
 */

import { enrichIsbn } from '../src/lib/enrich/isbn'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const RETRY = process.argv.includes('--retry')
const RETRY_ALL = process.argv.includes('--retry-all')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const MAX = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : undefined

// Re-open already-tried books by clearing isbn_checked_at so they re-enter the
// eligibility pool. --retry targets prior failures only (isbn13 still NULL);
// --retry-all clears every row. This is a write — guarded by --apply.
async function reopenTriedBooks(): Promise<void> {
  const db = adminClient()
  const scope = RETRY_ALL ? 'ALL books' : 'previously-failed books (isbn13 NULL)'
  if (!APPLY) {
    let q = db.from('books').select('*', { count: 'exact', head: true }).not('isbn_checked_at', 'is', null)
    if (!RETRY_ALL) q = q.is('isbn13', null)
    const { count } = await q
    console.log(`--${RETRY_ALL ? 'retry-all' : 'retry'} (DRY-RUN): would re-open ${count ?? 0} ${scope}. Add --apply to actually reset.\n`)
    return
  }
  // Paginate so the reset stays clear of row limits on large tables.
  let total = 0
  for (;;) {
    let sel = db.from('books').select('id').not('isbn_checked_at', 'is', null).order('id').limit(1000)
    if (!RETRY_ALL) sel = sel.is('isbn13', null)
    const { data, error } = await sel
    if (error) throw new Error(`reopen read: ${error.message}`)
    if (!data?.length) break
    const ids = data.map(r => r.id)
    const { error: upErr } = await db.from('books')
      .update({ isbn_checked_at: null, isbn_status: null })
      .in('id', ids)
    if (upErr) throw new Error(`reopen write: ${upErr.message}`)
    total += ids.length
    if (data.length < 1000) break
  }
  console.log(`Re-opened ${total} ${scope} (isbn_checked_at → NULL).\n`)
}

async function main() {
  console.log(`\n── enrich-isbn (${APPLY ? 'APPLY' : 'DRY-RUN'}${RETRY_ALL ? ' --retry-all' : RETRY ? ' --retry' : ''}) ──\n`)

  if (RETRY || RETRY_ALL) await reopenTriedBooks()

  const result = await enrichIsbn({
    apply: APPLY,
    limit: MAX,
    onProgress: msg => console.log(msg),
  })

  console.log(`
── Summary ──────────────────────────────
  Found via Open Library (w/ author):    ${result.foundOl}
  Found via Open Library (title only):   ${result.foundOlTitle}
  Found via Google Books:                ${result.foundGb}
  Total found:                           ${result.foundOl + result.foundOlTitle + result.foundGb}
  Not found:                             ${result.notFound}
  Skipped (prefilter, unsearchable):     ${result.skippedPrefilter}
  Rejected (low title similarity):       ${result.rejectedLowSimilarity}
  Rejected (edition title/language):     ${result.rejectedEditionMismatch}
  Skipped (ISBN already on another row): ${result.skippedDup}
  DB write errors:                       ${result.errors}
  ${APPLY ? 'Written to DB ✓' : 'DRY-RUN — re-run with --apply to write'}
`)
}

main().catch(e => { console.error(e); process.exit(1) })
