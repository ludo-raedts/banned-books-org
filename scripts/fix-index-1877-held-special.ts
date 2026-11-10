#!/usr/bin/env tsx
// Hand fixes that go with the second pass over the held Index 1877 rows
// (patch-index-1877-held.ts, 2026-11-10). Run BEFORE the --only-seqs import, so
// the renamed authors are matched by slug instead of being created again.
//
//  1. Rename authors the LLM pass mis-identified in the first import (the printed
//     headword says otherwise). Wikipedia fields only exist on Rossetti, and that
//     bio is already Gabriele's — so his old slug gets an alias; the others named
//     nobody (no alias, as in fix-index-1877-author-attributions.ts).
//  2. Rows that are not a new book:
//     - "Système de la nature … par Mirabaud (ementitum nomen)", decree 9 Nov 1770
//       → the existing The System of Nature #924, whose VA ban had no year.
//     - "Gualdi abb. Vita di d. Olimpia Maldacchini", decree 21 Mar 1668
//       → existing #32742 (imported anonymous, decree 1791). "Abbate Gualdi" is
//       Gregorio Leti's pseudonym: author Leti #4784, plus the 1668 VA ban.
//
//   npx tsx --env-file=.env.local scripts/fix-index-1877-held-special.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/fix-index-1877-held-special.ts --apply
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const APPLY = isApply()
const INDEX_1877_SOURCE = 13482

const RENAMES: { id: number; from: string; to: string; alias: boolean; note: string }[] = [
  { id: 23314, from: 'Charles de Bonald', to: 'Jean-Baptiste Bordas-Demoulin', alias: false, note: 'headword "Bonpas-DEwovLIN"; Les pouvoirs constitutifs de l\'église' },
  { id: 26031, from: 'Louis Picardet de La Brûlerie', to: 'Pigault-Lebrun', alias: false, note: 'headword "PicauLr-LE-Brun"; El citador = Le Citateur' },
  { id: 25706, from: 'Maria de Moya', to: 'Mateo de Moya', alias: false, note: 'headword "Moya (de) Marra" = Matth.; Quaestiones selectae' },
  { id: 26452, from: 'Giuseppe Rossetti', to: 'Gabriele Rossetti', alias: true, note: 'headword "Rosserri Gabr."; bio already Gabriele Pasquale Giuseppe Rossetti' },
]

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)
  await pg.query(APPLY ? 'begin' : 'begin read only')
  try {
    for (const r of RENAMES) {
      const a = (await pg.query('select display_name, slug from authors where id=$1', [r.id])).rows[0]
      if (!a || a.display_name !== r.from) { console.log(`  = author #${r.id} is "${a?.display_name}" — skip`); continue }
      const slug = slugify(r.to)
      const clash = (await pg.query('select id from authors where slug=$1 union select author_id from author_slug_aliases where slug=$1', [slug])).rows[0]
      if (clash) throw new Error(`slug ${slug} taken by #${clash.id}`)
      console.log(`  author #${r.id}: "${r.from}" → "${r.to}" (${slug})${r.alias ? `, alias ${a.slug}` : ''}  ${r.note}`)
      if (APPLY) {
        await pg.query('update authors set display_name=$1, slug=$2 where id=$3', [r.to, slug, r.id])
        if (r.alias) await pg.query(`insert into author_slug_aliases(slug, author_id, source) values($1,$2,'manual') on conflict (slug) do nothing`, [a.slug, r.id])
      }
    }

    const sn = (await pg.query(`select id, year_started from bans where book_id=924 and country_code='VA'`)).rows
    if (sn.length === 1 && sn[0].year_started == null) {
      console.log(`  ban ${sn[0].id} (#924 The System of Nature): year NULL → 1770, + 1877 source`)
      if (APPLY) {
        await pg.query(`update bans set year_started=1770, description=coalesce(description, $2) where id=$1`,
          [sn[0].id, 'Prohibited by a decree of 1770 (published under the false name "Mirabaud"), as recorded in the Index Librorum Prohibitorum (Rome, 1877 edition).'])
        await pg.query('insert into ban_source_links(ban_id, source_id) values($1,$2) on conflict do nothing', [sn[0].id, INDEX_1877_SOURCE])
      }
    } else console.log(`  = #924 VA bans: ${JSON.stringify(sn)} — skip`)

    const ol = (await pg.query(`select ba.author_id from book_authors ba where ba.book_id=32742`)).rows.map(x => Number(x.author_id))
    if (ol.length === 1 && ol[0] === 33) {
      console.log('  book #32742 Vita di donna Olimpia: Anonymous → Gregorio Leti #4784; + VA ban 1668')
      if (APPLY) {
        await pg.query('update book_authors set author_id=4784 where book_id=32742 and author_id=33')
        const b = (await pg.query(
          `insert into bans(book_id, country_code, scope_id, action_type, status, year_started, description, confidence)
             select book_id, country_code, scope_id, action_type, status, 1668, $2, confidence from bans where id=$1 returning id`,
          [54210, 'Prohibited by a decree of 1668 (published under the name "abbate Gualdi"), as recorded in the Index Librorum Prohibitorum (Rome, 1877 edition).'])).rows[0]
        await pg.query('insert into ban_source_links(ban_id, source_id) values($1,$2)', [b.id, INDEX_1877_SOURCE])
        await pg.query('insert into ban_reason_links(ban_id, reason_id, basis) select $1, reason_id, basis from ban_reason_links where ban_id=54210', [b.id])
      }
    } else console.log(`  = #32742 authors ${ol} — skip`)

    await pg.query(APPLY ? 'commit' : 'rollback')
  } catch (e) {
    await pg.query('rollback')
    throw e
  }
  await pg.end()
  console.log(APPLY ? '\nApplied.' : '\nDry-run — re-run with --apply.')
}
main().catch(e => { console.error(e); process.exit(1) })
