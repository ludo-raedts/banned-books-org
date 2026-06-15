#!/usr/bin/env tsx
/**
 * Correct three wrong `first_published_year` values on award-winning books,
 * surfaced by a press-review of /award-winning-banned-books (the year printed
 * under the author was a reprint/edition year or a title-collision artifact,
 * not the work's first publication). The render was correct; the DB data was
 * wrong — and it was wrong on the book pages too, not just the hub.
 *
 * A heuristic sweep (publication year should sit within prize_year-3..prize_year
 * for a Pulitzer winner) flagged exactly these three out of 27 award books; the
 * other 24 already had pub = prize_year-1. Correct values verified against
 * Wikidata P577:
 *   - Gone with the Wind        1992 → 1936  (Q2870, "1936 novel by Margaret Mitchell")
 *   - The Underground Railroad  2000 → 2016  (Q27957817, "2016 novel by Colson Whitehead";
 *                                             the bad 2000 was a collision with another
 *                                             "Underground Railroad" work)
 *   - Maus                      1986 → 1991  (the complete two-volume work that received
 *                                             the 1992 Pulitzer Special Citation; Vol II,
 *                                             1991 — 1986 was only Vol I)
 *
 * Idempotent: only writes when the stored value differs from the target.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-award-book-pub-years.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-award-book-pub-years.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const FIXES: { slug: string; year: number; note: string }[] = [
  { slug: 'gone-with-the-wind', year: 1936, note: 'Q2870 — 1936 novel by Margaret Mitchell' },
  { slug: 'the-underground-railroad', year: 2016, note: 'Q27957817 — 2016 novel by Colson Whitehead' },
  { slug: 'maus', year: 1991, note: 'complete work (Vol II, 1991); 1992 Pulitzer Special Citation' },
]

async function main() {
  const apply = isApply()
  const db = adminClient()

  for (const f of FIXES) {
    const { data, error } = await db
      .from('books')
      .select('id, slug, first_published_year')
      .eq('slug', f.slug)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      console.error(`✗ not found: ${f.slug}`)
      continue
    }
    const cur = (data as { first_published_year: number | null }).first_published_year
    if (cur === f.year) {
      console.error(`✓ already ${f.year}: ${f.slug}`)
      continue
    }
    console.error(`${apply ? 'FIX' : 'would fix'} ${f.slug}: ${cur} → ${f.year}  (${f.note})`)
    if (apply) {
      const { error: uErr } = await db.from('books').update({ first_published_year: f.year }).eq('slug', f.slug)
      if (uErr) throw uErr
    }
  }
  if (!apply) console.error('\nDRY RUN — re-run with --apply to write.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
