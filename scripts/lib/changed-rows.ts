// "What did this run actually change?" — reads books.updated_at /
// authors.updated_at to find the rows a batch run touched, so the caller can
// bust only those detail pages instead of the whole route.
//
// Both columns are maintained by a BEFORE UPDATE trigger (migration
// 20260515143605_books_authors_updated_at.sql), so this works regardless of
// which sub-script did the writing — enrich-all spawns ~20 of them and none
// report back what they touched. Deriving it from the DB afterwards keeps the
// sub-scripts untouched.
//
// Caveat worth knowing: the trigger fires on every UPDATE, including one that
// writes the same value. A run that re-stamps a checked_at column therefore
// shows up here. That is the safe direction to err — an extra bust costs one
// page regeneration, a missed one serves stale data for up to 7 days.
import { adminClient } from '../../src/lib/supabase'

const PAGE = 1000

async function slugsChangedSince(
  table: 'books' | 'authors',
  sinceIso: string,
): Promise<string[]> {
  const sb = adminClient()
  const out: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    // .order('id') keeps .range() pagination stable — without an explicit
    // ordering PostgREST repeats rows across pages past the 1000-row cap.
    const { data, error } = await sb
      .from(table)
      .select('slug')
      .gte('updated_at', sinceIso)
      .not('slug', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) {
      console.warn(`  ⚠ changed-rows ${table}: ${error.message}`)
      return out
    }
    const rows = (data ?? []) as { slug: string }[]
    for (const r of rows) out.push(r.slug)
    if (rows.length < PAGE) break
  }
  return out
}

export type ChangedRows = { bookSlugs: string[]; authorSlugs: string[] }

/**
 * Slugs of books and authors whose row was updated at or after `sinceIso`.
 * Returns empty lists (never throws) when the query fails — the caller is
 * fail-soft and the 7-day ISR window is the backstop.
 */
export async function changedSince(sinceIso: string): Promise<ChangedRows> {
  const [bookSlugs, authorSlugs] = await Promise.all([
    slugsChangedSince('books', sinceIso),
    slugsChangedSince('authors', sinceIso),
  ])
  return { bookSlugs, authorSlugs }
}
