/**
 * Backfills ban_reason_links.basis = 'inferred' (migration 20261026090000).
 *
 * The PEN America and Magnusson importers link every ban to the placeholder
 * reason 'other' — neither source records why a book was removed. Any other
 * reason on such a ban was therefore added later by scripts/enrich-reasons.ts,
 * which (outside --grounded-only) classifies from the BOOK's themes. When the
 * ban row has no note of its own, there is nothing else it can have come from:
 * those links are 'inferred'.
 *
 * Bans WITH a note are left NULL — enrich-reasons used the note as its primary
 * signal and --grounded-only runs wrote only what the note states.
 * Other sources (KDN, Berlin 1938, Liste Otto, Russia FSEM, …) carry reasons set
 * by their importer from the source record → left NULL.
 *
 * Idempotent. Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-reason-basis.ts           # dry-run counts
 *   npx tsx --env-file=.env.local scripts/backfill-reason-basis.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const TARGET_SQL = `
  from ban_reason_links l
  join reasons r on r.id = l.reason_id
  join bans b on b.id = l.ban_id
  where r.slug <> 'other'
    and l.basis is null
    and nullif(trim(b.description), '') is null
    and exists (
      select 1 from ban_source_links sl join ban_sources s on s.id = sl.source_id
      where sl.ban_id = b.id
        and (s.source_name ilike 'PEN America%' or s.source_name ilike '%Magnusson%')
    )`

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    const before = (await pg.query(
      `select count(*)::int links, count(distinct l.ban_id)::int bans, count(distinct b.book_id)::int books ${TARGET_SQL}`,
    )).rows[0]
    console.log(`\n── backfill-reason-basis (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
    console.log(`  to mark inferred: ${before.links} links on ${before.bans} bans (${before.books} books)`)
    if (!APPLY) { console.log('DRY-RUN — add --apply to write.'); return }

    const res = await pg.query(
      `update ban_reason_links t set basis = 'inferred'
       where (t.ban_id, t.reason_id) in (select l.ban_id, l.reason_id ${TARGET_SQL})`,
    )
    console.log(`  updated ${res.rowCount} links`)
    const after = (await pg.query(
      `select coalesce(basis,'(null)') basis, count(*)::int from ban_reason_links group by 1 order by 1`,
    )).rows
    console.table(after)
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
