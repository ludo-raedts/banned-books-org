#!/usr/bin/env tsx
/**
 * Delete vague PEN-aggregate roll-up bans that duplicate concrete district rows.
 *
 * Background (2026-06-11, found via /books/alice-austen-lived-here): an early
 * PEN-aggregate import (~2026-05-03) created one vague "banned / school" row per
 * book — institution NULL, region NULL, sourced only to the generic
 * https://pen.org/book-bans/ landing page. The later PEN index imports
 * (2023-2024, 2024-2025) added the real per-district rows WITHOUT cleaning up
 * the roll-up, so book pages show a contentless "PEN America" ban next to the
 * concrete districts (~3.400 of the ~34.8k bans).
 *
 * A vague roll-up is deleted ONLY when all of the following hold:
 *   - institution IS NULL and region IS NULL
 *   - its only source is the generic pen.org/book-bans/ page (rows with any
 *     extra source are FLAGGED for manual review, never deleted)
 *   - the same book+country has >= 1 concrete row (institution NOT NULL) whose
 *     year is within +/- 1 of the roll-up's year (any concrete row when the
 *     roll-up's year is NULL) — i.e. the aggregate signal is fully represented
 *     by district rows. Roll-ups without concrete coverage are KEPT: they are
 *     the only PEN record for that book.
 *
 * Deleted rows (incl. their reason/source link ids) are written to
 * data/vague-pen-rollups-backup-<date>.json before the delete. One transaction.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/cleanup-vague-pen-rollups.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-vague-pen-rollups.ts --apply
 */
import * as fs from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const GENERIC_URL = 'https://pen.org/book-bans/'

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    const { rows } = await pg.query(
      `with gen as (
         select id from ban_sources where source_url = $1
       ),
       vague as (
         select b.*
         from bans b
         join ban_source_links l on l.ban_id = b.id and l.source_id = (select id from gen)
         where b.institution is null and b.region is null
       )
       select v.id, v.book_id, v.country_code, v.year_started, v.action_type, v.scope_id,
         exists (
           select 1 from bans c
           where c.book_id = v.book_id and c.country_code = v.country_code
             and c.institution is not null
             and (v.year_started is null
                  or c.year_started between v.year_started - 1 and v.year_started + 1)
         ) as has_concrete,
         exists (
           select 1 from ban_source_links l2
           where l2.ban_id = v.id and l2.source_id <> (select id from gen)
         ) as has_extra_source
       from vague v
       order by v.id`,
      [GENERIC_URL],
    )

    const deletable = rows.filter((r) => r.has_concrete && !r.has_extra_source)
    const flagged = rows.filter((r) => r.has_concrete && r.has_extra_source)
    const keepers = rows.filter((r) => !r.has_concrete)

    console.log(`vague PEN roll-ups:            ${rows.length}`)
    console.log(`  deletable (concrete cover):  ${deletable.length}`)
    console.log(`  flagged (extra sources):     ${flagged.length}`)
    console.log(`  kept (only PEN record):      ${keepers.length}`)
    for (const f of flagged) {
      console.log(`    flag: ban ${f.id} book ${f.book_id} ${f.country_code} ${f.year_started ?? 'y?'}`)
    }
    if (!deletable.length) {
      console.log('nothing to delete.')
      return
    }
    if (!APPLY) {
      console.log('\ndry-run — pass --apply to delete. Sample:')
      for (const d of deletable.slice(0, 10)) {
        console.log(`  ban ${d.id} book ${d.book_id} ${d.country_code} ${d.year_started ?? 'y?'} ${d.action_type}`)
      }
      return
    }

    const ids = deletable.map((d) => d.id)
    const backupFile = `data/vague-pen-rollups-backup-${new Date().toISOString().slice(0, 10)}.json`
    const { rows: fullRows } = await pg.query(`select * from bans where id = any($1)`, [ids])
    const { rows: linkRows } = await pg.query(
      `select ban_id, source_id from ban_source_links where ban_id = any($1)`,
      [ids],
    )
    const { rows: reasonRows } = await pg.query(
      `select ban_id, reason_id from ban_reason_links where ban_id = any($1)`,
      [ids],
    )
    fs.writeFileSync(backupFile, JSON.stringify({ bans: fullRows, source_links: linkRows, reason_links: reasonRows }, null, 1))
    console.log(`\nbackup: ${backupFile} (${fullRows.length} bans)`)

    await pg.query('begin')
    await pg.query(`delete from ban_source_links where ban_id = any($1)`, [ids])
    await pg.query(`delete from ban_reason_links where ban_id = any($1)`, [ids])
    const del = await pg.query(`delete from bans where id = any($1)`, [ids])
    await pg.query('commit')
    console.log(`deleted ${del.rowCount} vague roll-ups.`)
    console.log('Run: pnpm tsx --env-file=.env.local scripts/refresh-mv.ts')
  } catch (e) {
    await pg.query('rollback').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

main()
