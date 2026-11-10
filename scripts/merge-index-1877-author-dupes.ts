#!/usr/bin/env tsx
// Merge duplicate AUTHORS surfaced by the Index Librorum Prohibitorum 1877
// import (2026-11-09). Found by two read-only signals over the import's
// authors: two rows enriched to the same Wikipedia page, and same birth+death
// years with a shared name token. Every pair below was checked by hand.
//
// Per pair, in ONE transaction (doctrine of merge-honorific-author-dupes.ts,
// plus the dropped-slug alias from the Naipaul merge):
//   1. book_authors DROP → KEEP (PK collision → delete DROP's row)
//   2. author_slug_aliases: re-point DROP's aliases, add DROP's own slug
//   3. KEEP's NULL scalar fields ← DROP (bio/years/photo/…), optional rename
//   4. DELETE DROP
// Idempotent: DROP already gone = no-op.
//
//   npx tsx --env-file=.env.local scripts/merge-index-1877-author-dupes.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/merge-index-1877-author-dupes.ts --apply
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const PAIRS: { keep: number; drop: number; rename?: string; note: string }[] = [
  { keep: 25248, drop: 23348, note: "marquis d'Argens (7 books) ← Jean-Baptiste Boyer d'Argens (1)" },
  { keep: 22872, drop: 4666, note: "Jean le Rond d'Alembert ← \"d'Alembert\" (older split of the Encyclopédie credit)" },
  { keep: 22872, drop: 4667, note: "Jean le Rond d'Alembert ← \"Jean le Rond\" (other half of that split)" },
  { keep: 4809, drop: 23805, rename: 'Nicolas de Condorcet', note: 'Condorcet: existing row (was "Nicholas") ← full-name Index row' },
  { keep: 659, drop: 23652, note: "Baron d'Holbach (System of Nature, bio) ← \"Paul-Henri Thiry, Baron d'Holbach\" (Index row, 1 book) — found 2026-11-10" },
]

const ENRICH_FIELDS = ['bio', 'bio_source_url', 'bio_source_type', 'birth_year', 'death_year', 'birth_country',
  'photo_url', 'wikidata_id', 'name_native', 'name_transliterated', 'name_english', 'original_language'] as const

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} (${PAIRS.length} pairs)\n`)
  for (const p of PAIRS) {
    console.log(`──── ${p.note}`)
    const keep = (await pg.query('select * from authors where id=$1', [p.keep])).rows[0]
    const drop = (await pg.query('select * from authors where id=$1', [p.drop])).rows[0]
    if (!drop) { console.log(`  ∅ DROP #${p.drop} already gone\n`); continue }
    if (!keep) { console.log(`  ✗ KEEP #${p.keep} missing — skip\n`); continue }
    await pg.query(APPLY ? 'begin' : 'begin read only')
    try {
      const links = (await pg.query(
        `select ba.book_id, exists(select 1 from book_authors k where k.author_id=$1 and k.book_id=ba.book_id) dup
           from book_authors ba where ba.author_id=$2`, [p.keep, p.drop])).rows
      for (const l of links) console.log(`  book ${l.book_id}: ${l.dup ? 'KEEP already linked → drop row' : 're-point → KEEP'}`)
      const enrich = ENRICH_FIELDS.filter(f => f in keep && keep[f] == null && drop[f] != null)
      if (enrich.length) console.log(`  enrich KEEP: ${enrich.join(', ')}`)
      if (p.rename) console.log(`  rename KEEP: "${keep.display_name}" → "${p.rename}"`)
      console.log(`  alias ${drop.slug} → #${p.keep}; DELETE #${p.drop}`)
      if (APPLY) {
        await pg.query(`delete from book_authors ba where ba.author_id=$2
                          and exists(select 1 from book_authors k where k.author_id=$1 and k.book_id=ba.book_id)`, [p.keep, p.drop])
        await pg.query('update book_authors set author_id=$1 where author_id=$2', [p.keep, p.drop])
        await pg.query('update author_slug_aliases set author_id=$1 where author_id=$2', [p.keep, p.drop])
        for (const f of enrich) await pg.query(`update authors set ${f}=$1 where id=$2`, [drop[f], p.keep])
        if (p.rename) await pg.query('update authors set display_name=$1 where id=$2', [p.rename, p.keep])
        await pg.query('delete from authors where id=$1', [p.drop])
        await pg.query(
          `insert into author_slug_aliases (slug, author_id, source) values ($1, $2, 'merge')
             on conflict (slug) do update set author_id=excluded.author_id`, [drop.slug, p.keep])
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
