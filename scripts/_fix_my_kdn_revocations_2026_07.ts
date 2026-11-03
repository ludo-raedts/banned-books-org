#!/usr/bin/env tsx
/**
 * Mark five Malaysia KDN bans rescinded: the Minister revoked their prohibition
 * orders by federal gazette (Pembatalan No. 3, 5, 6, 8 of 2026; gazetted
 * 15–16 July 2026). Verified 2026-11-03 against the order texts on mylaw.my.
 *
 *   ban #26879/#26880 Akyol, Islam Without Extremes (MS + EN eds.) — P.U. (A) 282/2017 → Pembatalan No. 3 (P.U. (A) 261)
 *   ban #25632 Sigandi                                             — P.U. (A) 111/2026 → Pembatalan No. 5 (P.U. (A) 263)
 *   ban #26922 When I Was a Kid 3                                  — P.U. (A) 283/2023 → Pembatalan No. 6 (P.U. (A) 264)
 *   ban #26957 MAO ZEDONG: China Dalam Dunia Abad ke-20            — P.U. (A) 93/2026  → Pembatalan No. 8 (P.U. (A) 266)
 *
 * (Pembatalan No. 4 and 7 = Komrad ASI / Shamsiah Fakeh, already rescinded in
 * _fix_my_kdn_dupes_2026_11_01.ts; No. 2 revokes a Chinese title not in the DB.)
 *
 *   npx tsx --env-file=.env.local scripts/_fix_my_kdn_revocations_2026_07.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/_fix_my_kdn_revocations_2026_07.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const MYLAW = 'https://mylaw.my/legislation/perintah-mesin-cetak-dan-penerbitan-kawalan-hasil-penerbitan-tidak-diingini-pembatalan-no-'

const REVOCATIONS = [
  { ban: 26879, book: 13268, no: 3, pu: 261, orig: '282/2017', gazetted: '2026-07-15' },
  { ban: 26880, book: 13269, no: 3, pu: 261, orig: '282/2017', gazetted: '2026-07-15' },
  { ban: 25632, book: 13351, no: 5, pu: 263, orig: '111/2026', gazetted: '2026-07-15' },
  { ban: 26922, book: 13311, no: 6, pu: 264, orig: '283/2023', gazetted: '2026-07-15' },
  { ban: 26957, book: 13338, no: 8, pu: 266, orig: '93/2026', gazetted: '2026-07-16' },
]

async function main() {
  const pg = await newPgClient()
  await pg.connect?.()
  console.log(`── _fix_my_kdn_revocations_2026_07 ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)

  for (const r of REVOCATIONS) {
    const row = (await pg.query(`select book_id, country_code, status, description from bans where id=$1`, [r.ban])).rows[0]
    if (!row || Number(row.book_id) !== r.book || row.country_code !== 'MY')
      throw new Error(`ban #${r.ban} not the expected MY ban on book #${r.book}`)
    const compact = r.orig.replace('/', '').replace(/^(\d+)\d{4}$/, '$1')
    if (!String(row.description).replace(/\s/g, '').includes(`(A)${compact}`))
      throw new Error(`ban #${r.ban} description does not cite P.U. (A) ${r.orig}`)
  }

  if (APPLY) await pg.query('begin')
  try {
    for (const r of REVOCATIONS) {
      const url = `${MYLAW}${r.no}-2026`
      const name = `Federal Gazette — Printing Presses and Publications (Control of Undesirable Publications) (Revocation No. ${r.no}) Order 2026 [P.U. (A) ${r.pu}/2026]`
      let sourceId: number | null =
        (await pg.query(`select id from ban_sources where source_url=$1`, [url])).rows[0]?.id ?? null
      if (!sourceId && APPLY) {
        sourceId = (
          await pg.query(
            `insert into ban_sources(source_name, source_url, source_type, accessed_at) values ($1,$2,'government','2026-11-03') returning id`,
            [name, url],
          )
        ).rows[0].id
      }
      const row = (await pg.query(`select description from bans where id=$1`, [r.ban])).rows[0]
      const note = ` The prohibition order (P.U. (A) ${r.orig}) was revoked by P.U. (A) ${r.pu}/2026, gazetted ${r.gazetted}.`
      const description = String(row.description).includes(`P.U. (A) ${r.pu}/2026`) ? row.description : row.description.trimEnd() + note
      console.log(`ban #${r.ban}: active → rescinded, year_ended 2026, + Pembatalan No. ${r.no}`)
      if (!APPLY) continue
      await pg.query(`update bans set status='rescinded', year_ended=2026, description=$2 where id=$1`, [r.ban, description])
      await pg.query(`insert into ban_source_links(ban_id, source_id) values ($1,$2) on conflict do nothing`, [r.ban, sourceId])
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
