/**
 * Enrich books with Project Gutenberg IDs via the Gutendex API.
 *
 * Only checks books where gutenberg_checked_at IS NULL — every book gets
 * exactly one lookup. A 'not_found' verdict is recorded permanently so the
 * book is skipped on subsequent runs.
 *
 * Rate-limited to 1 req/sec out of courtesy to the public API.
 *
 * Pagination
 * ──────────
 * Supabase/PostgREST caps a single response at 1000 rows. By default this
 * script paginates internally in 1000-row pages until the eligible set is
 * exhausted. Pass --offset=N (and optionally --limit=N) to carve out a
 * specific slice — useful for running two terminals in parallel:
 *
 *   terminal A: scripts/enrich-gutenberg.ts --apply --offset=0    --limit=1000
 *   terminal B: scripts/enrich-gutenberg.ts --apply --offset=1000 --limit=1000
 *
 * Start both around the same time so they fetch matching slices of the
 * same IS NULL snapshot. With --offset set the script does NOT auto-paginate.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts            # dry-run, full sweep
 *   npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts --apply    # write, full sweep
 *   npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts --apply --limit=200
 *   npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts --apply --offset=1000 --limit=1000
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const DELAY_MS = 1000
const PAGE_SIZE = 1000  // Supabase/PostgREST response cap
const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const a = process.argv.find(x => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : null
})()
const OFFSET = (() => {
  const a = process.argv.find(x => x.startsWith('--offset='))
  return a ? parseInt(a.split('=')[1], 10) : null
})()

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleMatches(dbTitle: string, gutenbergTitle: string): boolean {
  const a = normalise(dbTitle)
  const b = normalise(gutenbergTitle)
  // Accept if one contains the other (handles subtitles, articles, etc.)
  return a.includes(b) || b.includes(a)
}

async function findGutenbergId(title: string, author: string): Promise<{ id: number; matchedTitle: string } | null> {
  const query = [title, author].filter(Boolean).join(' ')
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()

    for (const book of data.results ?? []) {
      if (book.copyright !== false) continue
      if (!titleMatches(title, book.title)) continue
      return { id: book.id, matchedTitle: book.title }
    }
  } catch {
    // network error or timeout — skip
  }
  return null
}

async function fetchQueue(): Promise<Array<{ id: number; slug: string; title: string; book_authors: any }>> {
  // Explicit slice mode: caller carved out a specific window, no auto-pagination.
  if (OFFSET !== null) {
    const start = OFFSET
    const size = LIMIT ?? PAGE_SIZE
    const end = start + size - 1
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, book_authors(authors(display_name))')
      .is('gutenberg_checked_at', null)
      .order('title')
      .range(start, end)
    if (error) throw new Error(error.message)
    return (data ?? []) as any
  }

  // Default: paginate internally until either LIMIT is met or the pool is empty.
  const target = LIMIT ?? Infinity
  const out: any[] = []
  let from = 0
  while (out.length < target) {
    const pageSize = Math.min(PAGE_SIZE, target - out.length)
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, book_authors(authors(display_name))')
      .is('gutenberg_checked_at', null)
      .order('title')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    out.push(...page)
    if (page.length < pageSize) break  // exhausted
    from += pageSize
  }
  return out
}

async function main() {
  let queue: Awaited<ReturnType<typeof fetchQueue>>
  try {
    queue = await fetchQueue()
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  const sliceTag = OFFSET !== null ? ` (slice: offset=${OFFSET}${LIMIT != null ? `, limit=${LIMIT}` : ''})` : ''
  console.log(`${APPLY ? 'Checking' : '[dry-run] would check'} ${queue.length} books${sliceTag}\n`)

  let found = 0
  let notFound = 0
  let errored = 0

  for (const book of queue) {
    const author = (book.book_authors as any)?.[0]?.authors?.display_name ?? ''
    const match = await findGutenbergId(book.title, author)
    const now = new Date().toISOString()

    if (match) {
      if (APPLY) {
        const { error: updateError } = await supabase
          .from('books')
          .update({
            gutenberg_id: match.id,
            gutenberg_status: 'valid',
            gutenberg_checked_at: now,
          })
          .eq('id', book.id)

        if (updateError) {
          console.log(`  ✗ ${book.slug}: ${updateError.message}`)
          errored++
        } else {
          console.log(`  ✓ ${book.slug} → gutenberg.org/ebooks/${match.id}  («${match.matchedTitle}»)`)
          found++
        }
      } else {
        console.log(`  ✓ ${book.slug} → gutenberg.org/ebooks/${match.id}  («${match.matchedTitle}»)  [dry-run]`)
        found++
      }
    } else {
      if (APPLY) {
        const { error: updateError } = await supabase
          .from('books')
          .update({
            gutenberg_status: 'not_found',
            gutenberg_checked_at: now,
          })
          .eq('id', book.id)

        if (updateError) {
          console.log(`  ✗ ${book.slug}: ${updateError.message}`)
          errored++
        } else {
          console.log(`  – ${book.slug}`)
          notFound++
        }
      } else {
        console.log(`  – ${book.slug}  [dry-run]`)
        notFound++
      }
    }

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Found ${found}, not_found ${notFound}${errored ? `, errored ${errored}` : ''}.`)
  if (!APPLY) console.log('Re-run with --apply to persist.')
}

main().catch(console.error)
