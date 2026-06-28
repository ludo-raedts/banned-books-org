// _fix_ban156_shanghai_year.ts — one-off data correction.
//
// Invariant flagged by audit-integrity.ts (ban-before-publication drift):
//   ban #156 (book 148, "Life and Death in Shanghai" by Nien Cheng, CN)
//   had year_started=1986, which is < the book's first_published_year=1987.
//
// A China ban cannot predate the book's existence. Authoritative sources put
// first publication in 1987 (Wikipedia "May 1987"; the majority of OpenLibrary
// editions: Grove Press / Grafton / Penguin 1987), and the book's own
// description_ban + inclusion_rationale both already state "Banned in China in
// 1987". So first_published_year=1987 is correct and the ban year was an
// off-by-one typo. Fix: year_started 1986 -> 1987.
//
// Idempotent: only touches the row while it still reads 1986.
//   pnpm tsx --env-file=.env.local scripts/archive/_fix_ban156_shanghai_year.ts          (dry-run)
//   pnpm tsx --env-file=.env.local scripts/archive/_fix_ban156_shanghai_year.ts --apply  (write)

import { adminClient } from '../../src/lib/supabase'
import { isApply } from '../lib/cli'

async function main() {
  const db = adminClient()

  const { data: before, error } = await db
    .from('bans')
    .select('id, book_id, country_code, year_started')
    .eq('id', 156)
    .single()
  if (error) throw error
  console.log('before:', JSON.stringify(before))

  if (before.year_started !== 1986) {
    console.log('already corrected (year_started != 1986) — nothing to do.')
    return
  }

  if (!isApply()) {
    console.log('dry-run: would set bans#156.year_started = 1987. Pass --apply to write.')
    return
  }

  const { data: after, error: updErr } = await db
    .from('bans')
    .update({ year_started: 1987 })
    .eq('id', 156)
    .eq('year_started', 1986)
    .select('id, year_started')
  if (updErr) throw updErr
  console.log('updated:', JSON.stringify(after))
}

main()
