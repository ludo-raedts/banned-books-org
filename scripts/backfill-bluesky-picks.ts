/**
 * Freeze the current Bluesky "banned book of the day" rotation into
 * `bluesky_daily_picks`, so future data edits stop shifting the upcoming queue.
 *
 * The pick used to be recomputed on every render from a deterministic index over
 * the *current* eligible pool — so filling a cover, gating a book, etc. resized
 * the pool and reshuffled every upcoming date. This script computes today's
 * rotation for the next N days and pins each date to its book. From then on the
 * picker reads the frozen row instead of recomputing (write-on-read keeps the
 * window extended automatically).
 *
 * `ignoreDuplicates` means it never overwrites a date that's already frozen, so
 * it's safe to re-run. Only present/future dates are frozen (we don't invent a
 * retroactive history).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-bluesky-picks.ts            # dry-run, default 90 days
 *   pnpm tsx --env-file=.env.local scripts/backfill-bluesky-picks.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/backfill-bluesky-picks.ts --apply --days=120
 */

import { adminClient } from '../src/lib/supabase'
import { computePickIds, freezePicks } from '../src/lib/bluesky-post'

const apply = process.argv.includes('--apply')
const daysArg = process.argv.find(a => a.startsWith('--days='))
const DAYS = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 90) : 90

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

async function main() {
  const todayMs = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  const dates = Array.from({ length: DAYS }, (_, i) => ymd(todayMs + i * 86_400_000))

  // Already-frozen dates we must not touch (the first writer always wins).
  const { data: existing } = await adminClient()
    .from('bluesky_daily_picks')
    .select('pick_date')
    .in('pick_date', dates)
  const frozen = new Set((existing ?? []).map(r => (r as { pick_date: string }).pick_date))

  const picks = await computePickIds(dates)
  if (picks.size === 0) {
    console.error('No eligible books found — aborting.')
    process.exit(1)
  }

  const toFreeze = dates
    .filter(d => !frozen.has(d))
    .map(d => ({ pick_date: d, book_id: picks.get(d)! }))
    .filter(r => r.book_id != null)

  // Show what the first week will pin, for a sanity check against /admin/bluesky.
  const { data: titles } = await adminClient()
    .from('books')
    .select('id, title')
    .in('id', [...new Set(toFreeze.slice(0, 7).map(r => r.book_id))])
  const titleById = new Map((titles ?? []).map(t => [Number((t as { id: number }).id), (t as { title: string }).title]))

  console.log(`Window: ${dates[0]} … ${dates[dates.length - 1]} (${DAYS} days)`)
  console.log(`Already frozen: ${frozen.size}   To freeze: ${toFreeze.length}`)
  console.log('First week:')
  for (const r of toFreeze.slice(0, 7)) console.log(`  ${r.pick_date}  #${r.book_id}  ${titleById.get(r.book_id) ?? '?'}`)

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to freeze these picks.')
    return
  }

  await freezePicks(toFreeze)
  const { count } = await adminClient()
    .from('bluesky_daily_picks')
    .select('pick_date', { count: 'exact', head: true })
  console.log(`\nApplied. bluesky_daily_picks now holds ${count ?? '?'} rows total.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
