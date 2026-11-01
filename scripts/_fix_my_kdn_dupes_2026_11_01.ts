#!/usr/bin/env tsx
/**
 * Post-merge fixes for the two Malaysia 2026 KDN duplicate pairs merged via
 *   merge-paren-suffix-dupes.ts --file=data/my-kdn-dupes-2026-11-01.json
 * (#13335 → #1071 Memoir Shamsiah Fakeh, #13337 → #1072 Komrad ASI (Rejimen 10)).
 *
 * 1. #1072 author: Anonymous placeholder → Aziz Suriani (#8736), as named in the
 *    KDN e-PQ gazette row (P.U. (A) 79) and by says.com.
 * 2. Both MY bans (#1280, #1281): the prohibition was revoked by federal gazette
 *    in July 2026 ("The Home Ministry has reversed the ban on two memoirs last
 *    month", says.com, 11 Aug 2026) → status='rescinded', year_ended=2026,
 *    gazette-precise description, + the says.com source link.
 *
 * Run AFTER the merge (asserts the DROP rows are gone).
 *   npx tsx --env-file=.env.local scripts/_fix_my_kdn_dupes_2026_11_01.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/_fix_my_kdn_dupes_2026_11_01.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const KOMRAD = 1072
const ANONYMOUS = 33
const AZIZ_SURIANI = 8736

const LIFT_SOURCE = {
  source_name: 'SAYS — Home Ministry lifts ban on 2 books (11 Aug 2026)',
  source_url: 'https://says.com/my/news/home-ministry-lifts-ban-2-books',
  source_type: 'news',
}

const BANS = [
  {
    id: 1280,
    book_id: 1071,
    description:
      'Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act 1984, citing communist ideology. Gazetted 2026-02-11 (P.U. (A) 69); the prohibition was revoked by federal gazette in July 2026.',
  },
  {
    id: 1281,
    book_id: KOMRAD,
    description:
      'Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act 1984, citing communist ideology. Gazetted 2026-02-12 (P.U. (A) 79); the prohibition was revoked by federal gazette in July 2026.',
  },
]

async function main() {
  const pg = await newPgClient()
  await pg.connect?.()
  console.log(`── _fix_my_kdn_dupes_2026_11_01 ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)

  const drops = (await pg.query(`select id from books where id in (13335, 13337)`)).rows
  if (drops.length) throw new Error(`DROP rows still present (${drops.map(r => r.id)}) — run the merge first`)

  for (const b of BANS) {
    const row = (await pg.query(`select book_id, country_code, status, year_ended from bans where id=$1`, [b.id])).rows[0]
    if (!row || Number(row.book_id) !== b.book_id || row.country_code !== 'MY')
      throw new Error(`ban #${b.id} not the expected MY ban on book #${b.book_id}`)
  }

  if (APPLY) await pg.query('begin')
  try {
    // 1. Komrad ASI author
    const authors = (await pg.query(`select author_id from book_authors where book_id=$1`, [KOMRAD])).rows.map(r => Number(r.author_id))
    console.log(`#${KOMRAD} authors now: ${authors.join(',')} → ${AZIZ_SURIANI}`)
    if (APPLY) {
      await pg.query(`delete from book_authors where book_id=$1 and author_id=$2`, [KOMRAD, ANONYMOUS])
      await pg.query(
        `insert into book_authors(book_id, author_id, role) values ($1,$2,'author') on conflict do nothing`,
        [KOMRAD, AZIZ_SURIANI],
      )
    }

    // 2. Rescind both bans + attach the lifting source
    let sourceId: number | null =
      (await pg.query(`select id from ban_sources where source_url=$1`, [LIFT_SOURCE.source_url])).rows[0]?.id ?? null
    if (!sourceId && APPLY) {
      sourceId = (
        await pg.query(
          `insert into ban_sources(source_name, source_url, source_type, accessed_at) values ($1,$2,$3,'2026-11-01') returning id`,
          [LIFT_SOURCE.source_name, LIFT_SOURCE.source_url, LIFT_SOURCE.source_type],
        )
      ).rows[0].id
    }
    for (const b of BANS) {
      console.log(`ban #${b.id}: status → rescinded, year_ended → 2026, + says.com source`)
      if (!APPLY) continue
      await pg.query(`update bans set status='rescinded', year_ended=2026, description=$2 where id=$1`, [b.id, b.description])
      await pg.query(`insert into ban_source_links(ban_id, source_id) values ($1,$2) on conflict do nothing`, [b.id, sourceId])
    }
    if (APPLY) await pg.query('commit')
  } catch (e) {
    if (APPLY) await pg.query('rollback')
    throw e
  }
  await pg.end()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
