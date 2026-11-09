#!/usr/bin/env tsx
// Merge same-WORK duplicate books around the Index Librorum Prohibitorum 1877
// import (2026-11-09). The Index lists many works under the title of the
// translation it condemned ("Essai philosophique concernant l'entendement
// humain"), while older VA rows hold the English/original title. The
// cross-language audit can't see a translated title, so these pairs come from a
// hand review of every author that has both an Index book and an older book.
//
// Per pair, in ONE transaction (doctrine of merge-cross-language-dupes.ts):
//   0. delete DROP bans listed in dropBans (misattributed by the Index cleanup)
//   1. bans: same country + same year as a KEEP ban → union source/reason links
//      onto KEEP's ban (DROP's goes with the cascade); otherwise MOVE to KEEP.
//      Keyed on year, not scope: a translation condemned in a later decree is
//      a separate event and must survive (Grotius De imperio: 1626 + 1753).
//   2. book_slug_aliases: re-point DROP's, add DROP.slug as legacy alias
//   3. KEEP's NULL language-neutral fields ← DROP; optional blanket flag
//   4. DELETE DROP (CASCADE)
// Idempotent: DROP already gone = no-op.
//
//   npx tsx --env-file=.env.local scripts/merge-index-1877-book-dupes.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/merge-index-1877-book-dupes.ts --apply
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

// sameEvent: the DROP ban is the KEEP ban recorded with a different year → union links
// onto KEEP's ban instead of moving it (the year conflict is reported, not resolved).
const PAIRS: { keep: number; drop: number; dropBans?: number[]; blanket?: boolean; sameEvent?: boolean; note: string }[] = [
  { keep: 6653, drop: 29337, note: 'Condorcet: Sketch ← Esquisse (same work, VA 1827)' },
  { keep: 6235, drop: 29841, note: "Locke: Essay ← Essai philosophique (French translation, decree 1734)" },
  { keep: 6647, drop: 31185, note: 'Montaigne: Essays ← Les essais (VA 1676)' },
  { keep: 6241, drop: 6658, note: 'Kant: Kritik der reinen Vernunft ← Critique of Pure Reason (older duplicate)' },
  { keep: 6241, drop: 30566, note: 'Kant: Kritik der reinen Vernunft ← Critica della ragione pura (VA 1827)' },
  { keep: 6573, drop: 30189, note: 'Grotius: De imperio ← Traité du pouvoir du magistrat (French translation, decree 1753)' },
  {
    keep: 6564, drop: 30190, dropBans: [51656], blanket: true,
    note: 'Grotius: All works of theology ← All works (Opera omnia theologica 1757); 1564 ban was "Neckerus Grono", not Grotius',
  },
  // Pairs that surfaced after fix-index-1877-author-attributions.ts put the books under the right author.
  { keep: 6636, drop: 30736, note: 'Leti: All works (1667) ← Opera omnia (decree 1700, imported as "Gregorius de Valentia")' },
  { keep: 816, drop: 32349, note: 'Stendhal: The Red and the Black ← Le rouge et le noir (decree 1864)' },
  {
    keep: 6664, drop: 29757, sameEvent: true,
    note: 'Eriugena: De divisione naturae (VA 1684) ← same title (decree 3 Apr 1685): one condemnation, year conflict reported',
  },
]

const CURATED_BOOK_TABLES = [
  'bbw_featured_selections', 'reading_club_classics', 'reading_club_currently_challenged',
  'reading_club_international', 'reading_club_theme_books', 'reading_club_young_readers',
]
const BOOK_ENRICH = ['first_published_year', 'isbn13', 'openlibrary_work_id', 'cover_url', 'archive_org_id', 'gutenberg_id'] as const

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} (${PAIRS.length} pairs)\n`)
  for (const p of PAIRS) {
    console.log(`──── ${p.note}`)
    const keep = (await pg.query('select * from books where id=$1', [p.keep])).rows[0]
    const drop = (await pg.query('select * from books where id=$1', [p.drop])).rows[0]
    if (!drop) { console.log(`  ∅ DROP #${p.drop} already gone\n`); continue }
    if (!keep) { console.log(`  ✗ KEEP #${p.keep} missing — skip\n`); continue }
    await pg.query(APPLY ? 'begin' : 'begin read only')
    try {
      for (const t of CURATED_BOOK_TABLES) {
        const hit = await pg.query(`select 1 from ${t} where book_id=$1 limit 1`, [p.drop]).catch(() => ({ rowCount: 0 }))
        if (hit.rowCount) throw new Error(`DROP #${p.drop} is curated in ${t} — abort pair`)
      }
      for (const id of p.dropBans ?? []) {
        console.log(`  delete misattributed ban ${id}`)
        if (APPLY) await pg.query('delete from bans where id=$1 and book_id=$2', [id, p.drop])
      }
      const bans = (q: number) => pg.query('select id, country_code, year_started, scope_id from bans where book_id=$1', [q]).then(r => r.rows)
      const keepBans = await bans(p.keep)
      for (const b of await bans(p.drop)) {
        if (!APPLY && p.dropBans?.includes(Number(b.id))) continue
        const match = keepBans.find(k => k.country_code === b.country_code && (p.sameEvent || k.year_started === b.year_started))
        if (match) {
          console.log(`  ban ${b.id} ${b.country_code} ${b.year_started}: same event as KEEP ban ${match.id} → union links`)
          if (APPLY) {
            await pg.query('insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing', [match.id, b.id])
            await pg.query('insert into ban_reason_links(ban_id,reason_id,basis) select $1,reason_id,basis from ban_reason_links where ban_id=$2 on conflict do nothing', [match.id, b.id])
          }
        } else {
          console.log(`  ban ${b.id} ${b.country_code} ${b.year_started}: MOVE → KEEP`)
          if (APPLY) await pg.query('update bans set book_id=$1 where id=$2', [p.keep, b.id])
          keepBans.push(b)
        }
      }
      if (APPLY) await pg.query('update book_slug_aliases set book_id=$1 where book_id=$2', [p.keep, p.drop])
      console.log(`  alias ${drop.slug} → #${p.keep}`)
      const enrich = BOOK_ENRICH.filter(f => keep[f] == null && drop[f] != null)
      if (enrich.length) console.log(`  enrich KEEP: ${enrich.join(', ')}`)
      if (p.blanket && !keep.is_blanket_works) console.log('  set KEEP is_blanket_works = true')
      console.log(`  DELETE book #${p.drop}`)
      if (APPLY) {
        await pg.query('delete from books where id=$1', [p.drop])
        for (const f of enrich) await pg.query(`update books set ${f}=$1 where id=$2`, [drop[f], p.keep])
        if (p.blanket) await pg.query('update books set is_blanket_works=true where id=$1', [p.keep])
        await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict do nothing`, [drop.slug, p.keep])
      }
      await pg.query(APPLY ? 'commit' : 'rollback')
    } catch (e) {
      await pg.query('rollback')
      console.log(`  ✗ ${e instanceof Error ? e.message : e}`)
    }
    console.log()
  }
  await pg.end()
  console.log(APPLY ? 'Applied.' : 'Dry-run — re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
