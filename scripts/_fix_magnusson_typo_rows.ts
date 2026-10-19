#!/usr/bin/env tsx
// One-off (2026-10-20): typos in OUR existing rows, surfaced while matching the
// Magnusson imports (her spelling was right, ours wrong).
//
// Titles (slug re-derived; the old slug becomes a book_slug_aliases row so old URLs redirect):
//   #2012 "…A Young Reader's Compansion" → Companion
//   #3052 "…The Century-Long Struggle LGBT Rights…" → "Struggle for LGBT Rights"
//   #3266 "The Day Changes Everything" → "This Day Changes Everything" (Edward Underhill, 2023)
//   #3401 "Locke and Key Vol. 1: Welcomeome To Lovecraft" → "Locke & Key, Vol. 1: Welcome to Lovecraft"
//   #4725 "The Accidential Bad Girl" → "The Accidental Bad Girl"
//   #9682 "…Interpretating the Constitution" → "Interpreting the Constitution"
// Authors:
//   #2099 "lloh. Candice" → merged into Candice Iloh #3785 (alias lloh-candice)
//   Jacob's Room to Choose #1067: placeholder "Anonymous" #33 → Sarah Hoffman #1140 + Ian Hoffman #3587
//
// Usage: npx tsx --env-file=.env.local scripts/_fix_magnusson_typo_rows.ts [--apply]
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const APPLY = isApply()
const TITLES: [number, string][] = [
  [2012, "Greek and Roman Mythology A to Z: A Young Reader's Companion"],
  [3052, 'Gay and Lesbian History for Kids: The Century-Long Struggle for LGBT Rights, with 21 Activities'],
  [3266, 'This Day Changes Everything'],
  [3401, 'Locke & Key, Vol. 1: Welcome to Lovecraft'],
  [4725, 'The Accidental Bad Girl'],
  [9682, 'Marriage Rights and Gay Rights: Interpreting the Constitution'],
]

async function main() {
  const pg = newPgClient(); await pg.connect()
  await pg.query('BEGIN')
  try {
    for (const [id, title] of TITLES) {
      const cur = (await pg.query('select slug, title from books where id=$1', [id])).rows[0]
      const slug = slugify(title)
      const clash = (await pg.query('select id from books where slug=$1 and id<>$2', [slug, id])).rows[0]
      if (clash) { console.log(`✗ #${id}: slug ${slug} owned by #${clash.id}, title fixed but slug kept`) }
      await pg.query('update books set title=$2, slug=$3 where id=$1', [id, title, clash ? cur.slug : slug])
      if (!clash && cur.slug !== slug)
        await pg.query(`insert into book_slug_aliases (slug, book_id, source) values ($1,$2,'legacy_slug') on conflict (slug) do nothing`, [cur.slug, id])
      console.log(`#${id} "${cur.title}" → "${title}"${!clash && cur.slug !== slug ? ` (${cur.slug} → ${slug})` : ''}`)
    }
    // lloh. Candice → Candice Iloh
    const moved = await pg.query(`update book_authors set author_id=3785 where author_id=2099
      and book_id not in (select book_id from book_authors where author_id=3785) returning book_id`)
    await pg.query('delete from book_authors where author_id=2099')
    await pg.query(`insert into author_slug_aliases (slug, author_id, source) values ('lloh-candice',3785,'merge') on conflict (slug) do nothing`)
    await pg.query('delete from authors where id=2099')
    console.log(`merge #2099 "lloh. Candice" → #3785 Candice Iloh: ${moved.rowCount} book link(s) moved`)
    // Jacob's Room to Choose: real authors
    await pg.query('delete from book_authors where book_id=1067 and author_id=33')
    await pg.query('insert into book_authors (book_id, author_id) values (1067,1140),(1067,3587) on conflict do nothing')
    console.log('#1067 Jacob\'s Room to Choose: Anonymous → Sarah Hoffman, Ian Hoffman')
    await pg.query(APPLY ? 'COMMIT' : 'ROLLBACK')
    console.log(APPLY ? 'Committed.' : 'Dry-run — re-run with --apply.')
  } catch (e) { await pg.query('ROLLBACK'); throw e } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
