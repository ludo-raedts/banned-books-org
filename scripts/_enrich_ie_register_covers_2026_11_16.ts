#!/usr/bin/env tsx
/**
 * Cover + identifier enrichment for the Irish-register rows #33477 / #33478
 * (follow-up to _enrich_ie_register_by_hand_2026_11_16.ts). Covers were viewed
 * by hand 2026-11-16: title/author on the jacket match the book.
 *  - #33477 Book of Love → NEL paperback "The Home Doctor Book of Sex and
 *    Marriage" (Delvin), OL cover 12668060, edition OL10266835M ISBN 9780450023200;
 *    OL work OL3910815W / earlier record gives first publication 1974.
 *  - #33478 The Love Diseases → Macmillan/Papermac 1979, OL cover 12656252,
 *    edition OL37738782M ISBN 9780333274910, work OL6090889W (1979).
 * No namesake risk: both jackets show the exact title + author.
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
const APPLY = isApply()
const ROWS = [
  { id: 33477, title: 'Book of Love', cover: 12668060, isbn: '9780450023200', work: 'OL3910815W', year: 1974 },
  { id: 33478, title: 'The Love Diseases', cover: 12656252, isbn: '9780333274910', work: 'OL6090889W', year: 1979 },
]
async function main() {
  console.log(`\n── ie-register covers ── ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  const pg = newPgClient(); await pg.connect()
  try {
    for (const r of ROWS) {
      const b = (await pg.query(`select title, cover_url, isbn13, openlibrary_work_id, first_published_year from books where id=$1`, [r.id])).rows[0]
      if (!b || b.title !== r.title) throw new Error(`#${r.id} drift`)
      const clash = (await pg.query(`select id from books where isbn13=$1 and id<>$2`, [r.isbn, r.id])).rows[0]
      if (clash) throw new Error(`isbn ${r.isbn} already on #${clash.id}`)
      console.log(`  SET #${r.id} ${r.title}: cover ${r.cover}, isbn ${r.isbn}, ol ${r.work}, year ${r.year} (was cover=${b.cover_url}, isbn=${b.isbn13}, year=${b.first_published_year})`)
      if (APPLY) await pg.query(
        `update books set cover_url=$2, cover_status='valid', cover_checked_at=now(), isbn13=$3, openlibrary_work_id=$4,
           first_published_year=$5, updated_at=now() where id=$1 and cover_url is null`,
        [r.id, `https://covers.openlibrary.org/b/id/${r.cover}-L.jpg`, r.isbn, r.work, r.year])
    }
  } finally { await pg.end() }
  if (!APPLY) console.log('\n  DRY-RUN — re-run with --apply\n')
}
main().catch(e => { console.error(e); process.exit(1) })
