#!/usr/bin/env tsx
// One-off (2026-10-11), surfaced by the Magnusson import's needs_review pass.
//
// 1. "Libba Gray" #402 is a typo twin of Libba Bray #400 (only book: Going
//    Bovine #542) → merge into #400, slug alias libba-gray → #400.
// 2. "Andrea Robertson" #854 is Andrea Cremer's later pen name (Loresmith series,
//    2020+), but every book linked to it (Nightshade, Inventor's Secret,
//    Invisibility) was published as Andrea Cremer → merge into Andrea Cremer
//    #12684 (already owns Rift), alias andrea-robertson → #12684. #854's
//    photo_url (a Panoz Esperante car, Wikimedia) is NOT carried over.
// 3. Book fixes, each checked against an Open Library edition record:
//    - Going Bovine #542: year 2000 → 2009
//    - Wolfsbane #1359: ISBN was "Wolfsbane and Mistletoe" (Ace) → 9780399254833
//      (Philomel); year 2025 → 2011
//    - Rise #1321: ISBN was the Esperanza Rising audiobook → 9780399159602
//      (Philomel); year 2025 → 2013; the Esperanza Rising description is cleared
//    - Snakeroot #8045 2023 → 2013, Invisibility #8850 2023 → 2013,
//      The Inventor's Secret #8852 2023 → 2014, The Conjurer's Riddle #8851 2023 → 2015
//    - Invisibility #8850: add co-author David Levithan #267
//
// Usage: npx tsx --env-file=.env.local scripts/_fix_cremer_bray_authors.ts [--apply]
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const MERGES = [
  { keep: 400, drop: 402 },     // Libba Bray ← Libba Gray
  { keep: 12684, drop: 854 },   // Andrea Cremer ← Andrea Robertson
]
const BOOK_FIXES: { id: number; set: Record<string, unknown> }[] = [
  { id: 542, set: { first_published_year: 2009 } },
  { id: 1359, set: { isbn13: '9780399254833', first_published_year: 2011 } },
  { id: 1321, set: { isbn13: '9780399159602', first_published_year: 2013, description_book: null, description_source_url: null, description_source_type: null } },
  { id: 8045, set: { first_published_year: 2013 } },
  { id: 8850, set: { first_published_year: 2013 } },
  { id: 8852, set: { first_published_year: 2014 } },
  { id: 8851, set: { first_published_year: 2015 } },
]

async function main() {
  const pg = newPgClient(); await pg.connect()
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  await pg.query('BEGIN')
  try {
    for (const { keep, drop } of MERGES) {
      const d = (await pg.query('select id, slug, display_name from authors where id=$1', [drop])).rows[0]
      const k = (await pg.query('select id, slug, display_name from authors where id=$1', [keep])).rows[0]
      if (!d) { console.log(`∅ #${drop} already gone`); continue }
      const moved = await pg.query(
        `update book_authors set author_id=$1 where author_id=$2
           and book_id not in (select book_id from book_authors where author_id=$1) returning book_id`, [keep, drop])
      await pg.query(`delete from book_authors where author_id=$1`, [drop])
      await pg.query(`insert into author_slug_aliases (slug, author_id, source) values ($1,$2,'merge') on conflict (slug) do nothing`, [d.slug, keep])
      await pg.query(`delete from authors where id=$1`, [drop])
      console.log(`merge #${drop} "${d.display_name}" → #${keep} "${k.display_name}": ${moved.rowCount} book link(s) moved, alias ${d.slug}`)
    }
    for (const { id, set } of BOOK_FIXES) {
      const cols = Object.keys(set)
      const before = (await pg.query(`select title, ${cols.join(', ')} from books where id=$1`, [id])).rows[0]
      await pg.query(`update books set ${cols.map((c, i) => `${c}=$${i + 2}`).join(', ')} where id=$1`, [id, ...Object.values(set)])
      console.log(`book #${id} ${before.title}: ${cols.map(c => `${c} ${JSON.stringify(before[c])?.slice(0, 40)} → ${JSON.stringify(set[c])}`).join('; ')}`)
    }
    const lev = await pg.query(`insert into book_authors (book_id, author_id) values (8850, 267) on conflict do nothing`)
    console.log(`book #8850 Invisibility: co-author David Levithan #267 ${lev.rowCount ? 'linked' : 'already linked'}`)
    await pg.query(APPLY ? 'COMMIT' : 'ROLLBACK')
    console.log(APPLY ? 'Committed.' : 'Rolled back (dry-run) — re-run with --apply.')
  } catch (e) { await pg.query('ROLLBACK'); throw e } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
