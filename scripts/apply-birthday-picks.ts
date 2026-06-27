/**
 * Pin featured-author birthdays into bluesky_daily_picks (source='birthday'),
 * overriding the frozen auto rotation on those days. Run once after curating the
 * featured set (scripts/enrich-author-birthdays.ts --feature) to make the
 * birthday pushes live across the year, including the days already frozen by the
 * backfill. The daily Bluesky cron also calls planBirthdayPicks() so it stays
 * maintained, but this lets you apply it immediately and inspect the result.
 *
 * Respects manual overrides, clears stale birthday rows (un-featured authors).
 * Idempotent.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/apply-birthday-picks.ts            # default 400-day window
 *   pnpm tsx --env-file=.env.local scripts/apply-birthday-picks.ts --days=400
 */

import { adminClient } from '../src/lib/supabase'
import { planBirthdayPicks } from '../src/lib/bluesky-post'
import { intFlag } from './lib/cli'

const DAYS = intFlag('days', 400)

async function main() {
  const { pinned, cleared } = await planBirthdayPicks(DAYS)
  console.log(`Birthday pins applied: ${pinned} pinned, ${cleared} stale cleared (window ${DAYS} days).`)

  // Show the upcoming birthday overrides so they can be eyeballed.
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await adminClient()
    .from('bluesky_daily_picks')
    .select('pick_date, book_id, books(title, book_authors(authors(display_name)))')
    .eq('source', 'birthday')
    .gte('pick_date', today)
    .order('pick_date', { ascending: true })
    .limit(40)
  console.log('\nUpcoming birthday pushes:')
  for (const r of (data ?? []) as Array<{ pick_date: string; book_id: number; books: { title: string; book_authors: Array<{ authors: { display_name: string } | null }> | null } | null }>) {
    const author = r.books?.book_authors?.map(ba => ba.authors?.display_name).filter(Boolean).join(', ') ?? '?'
    console.log(`  ${r.pick_date}  ${r.books?.title ?? '?'} — ${author}  (#${r.book_id})`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
