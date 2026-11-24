#!/usr/bin/env tsx
// Fold the Index 1877 "— Tom. N. Partis M." sub-entries back into the one work they are volumes of.
// The 1877 importer gave only one volume row the head title; the others became bare "Tom. II. Partis II".
//   • Angelo da Montepiloso: Sacrae theologiae summa Joan. Duns Scoti, et commentaria (7 rows → #32775)
//   • Zimmermann: Opuscula theologici, historici, et philosophici argumenti (2 rows → #32881)
// bans_unique_per_scope allows ONE ban per (book, country, year, scope…), so decrees of the same year are
// merged into one ban whose description names every decree + volume; links are unioned. Slug changes keep the
// old slug as a book_slug_aliases row. Idempotent: DROP already gone = skip.
//   npx tsx --env-file=.env.local scripts/merge-index-1877-volume-rows.ts [--apply]
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
import { slugify } from '../src/lib/imports/slugify'
const APPLY = isApply()
const SUFFIX = 'as recorded in the Index Librorum Prohibitorum (Rome, 1877 edition).'
type Group = { keep: number; title: string; drops: number[]; banText: Record<number, string> }
const GROUPS: Group[] = [
  {
    keep: 32775, title: 'Sacrae theologiae summa Joan. Duns Scoti, et commentaria', drops: [32771, 32772, 32773, 32774, 32776, 32777],
    banText: {
      1714: `Prohibited by decrees of 15 Jan 1714 (Tom. I, Partis IV) and 15 Mar 1714 (Tom. II, Partis II), ${SUFFIX}`,
      1718: `Prohibited by a decree of 7 Feb 1718 (Tom. III, Partis I), ${SUFFIX}`,
      1721: `Prohibited until corrected (donec corrigatur) by a decree of 21 Jan 1721 (Tom. II, Partis I), ${SUFFIX}`,
      1725: `Prohibited until corrected (donec corrigatur) by a decree of 4 Dec 1725 (Tom. I, Partis I), ${SUFFIX}`,
      1727: `Prohibited by a decree of 2 Sep 1727 (Tom. III, Partis II), ${SUFFIX}`,
      1759: `Prohibited by a decree of 10 Jun 1759 (Tom. II, Partis IV), ${SUFFIX}`,
    },
  },
  {
    keep: 32881, title: 'Opuscula theologici, historici, et philosophici argumenti', drops: [32882],
    banText: { 1763: `Prohibited by decrees of 8 Jul 1763 (Tom. I, pars I et II) and 14 Dec 1763 (Tom. II, pars I et altera), ${SUFFIX}` },
  },
]
async function main() {
  const pg = newPgClient(); await pg.connect()
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  const tot = async () => (await pg.query('select (select count(*) from books)::int b,(select count(*) from bans)::int x')).rows[0]
  console.log('voor', await tot())
  for (const g of GROUPS) {
    const keep = (await pg.query('select id,slug,title from books where id=$1', [g.keep])).rows[0]
    if (!keep) { console.log(`✗ KEEP #${g.keep} missing`); continue }
    console.log(`──── #${g.keep} "${keep.title}" → "${g.title}"`)
    await pg.query(APPLY ? 'begin' : 'begin read only')
    try {
      for (const d of g.drops) {
        const drop = (await pg.query('select id,slug from books where id=$1', [d])).rows[0]
        if (!drop) { console.log(`  ∅ DROP #${d} already gone`); continue }
        for (const b of (await pg.query('select id,year_started from bans where book_id=$1', [d])).rows) {
          const k = (await pg.query('select id from bans where book_id=$1 and country_code=(select country_code from bans where id=$2) and year_started=$3', [g.keep, b.id, b.year_started])).rows[0]
          if (k) {
            console.log(`  ban ${b.id} ${b.year_started} → union into ${k.id}`)
            if (APPLY) {
              await pg.query('insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing', [k.id, b.id])
              await pg.query('insert into ban_reason_links(ban_id,reason_id,basis) select $1,reason_id,basis from ban_reason_links where ban_id=$2 on conflict do nothing', [k.id, b.id])
            }
          } else {
            console.log(`  ban ${b.id} ${b.year_started} → MOVE`)
            if (APPLY) await pg.query('update bans set book_id=$1 where id=$2', [g.keep, b.id])
          }
        }
        if (APPLY) {
          await pg.query('update book_slug_aliases set book_id=$1 where book_id=$2', [g.keep, d])
          await pg.query('delete from books where id=$1', [d])
          await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict do nothing`, [drop.slug, g.keep])
        }
        console.log(`  DELETE #${d}, alias ${drop.slug}`)
      }
      for (const [y, text] of Object.entries(g.banText)) {
        console.log(`  ban ${y} text set`)
        if (APPLY) await pg.query('update bans set description=$1 where book_id=$2 and year_started=$3', [text, g.keep, Number(y)])
      }
      const newSlug = slugify(g.title)
      const clash = (await pg.query('select id from books where slug=$1 and id<>$2', [newSlug, g.keep])).rows[0]
      if (clash) throw new Error(`slug ${newSlug} taken by #${clash.id}`)
      console.log(`  rename → ${g.title} (slug ${newSlug}; old ${keep.slug} stays as alias)`)
      if (APPLY) {
        await pg.query('update books set title=$1, slug=$2 where id=$3', [g.title, newSlug, g.keep])
        await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict do nothing`, [keep.slug, g.keep])
      }
      await pg.query(APPLY ? 'commit' : 'rollback')
    } catch (e) { await pg.query('rollback'); console.log(`  ✗ ${e instanceof Error ? e.message : e}`) }
  }
  console.log('na', await tot())
  await pg.end()
  console.log(APPLY ? 'Applied.' : 'Dry-run — re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
