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
 *   - the same book+country has >= 1 concrete row (institution NOT NULL) — i.e.
 *     the aggregate signal is already represented by district rows. Roll-ups
 *     without any concrete coverage are KEPT: they are the only PEN record for
 *     that book.
 *
 * The roll-up's own year_started is NOT part of the coverage test, and that is
 * the whole point (revised 2026-09-01). The first pass required a concrete row
 * within +/- 1 year of the roll-up's year, which silently assumed that year was
 * sourced. It is not: the generic landing page carries no year at all, the seed
 * importer filled year_started with first_published_year + 1, and PEN's index
 * only starts 2021-2022 — so a roll-up dated 2002 or 2010 documents nothing.
 * Measured on the 307 rows the first pass kept: 272 carry a year equal to
 * first_published_year or +1, and a further slice carries an outright impossible
 * year (ban 221 "Forever" dated 1958 for a 1975 book; a cluster of literal
 * "2001"s on 2012-2018 titles). Comparing district years against a fabricated
 * year is what kept them. Since a vague roll-up contains no region, no
 * institution and no description, an unsourced year is the only thing it adds
 * over the concrete rows, and dropping it loses no citable fact.
 *
 * Found via /books/i-was-here in the 2026-09-01 /botd-week pre-flight, where
 * the pattern showed up as a "US 2002" ban on a book published in 2015.
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
         bk.first_published_year as pub_year,
         exists (
           select 1 from bans c
           where c.book_id = v.book_id and c.country_code = v.country_code
             and c.institution is not null
         ) as has_concrete,
         -- what the pre-2026-09-01 rule saw: concrete coverage inside +/- 1 of
         -- the roll-up's (unsourced) own year. Reported only, so a run makes the
         -- widening visible instead of silently deleting more than before.
         exists (
           select 1 from bans c
           where c.book_id = v.book_id and c.country_code = v.country_code
             and c.institution is not null
             and (v.year_started is null
                  or c.year_started between v.year_started - 1 and v.year_started + 1)
         ) as has_concrete_in_window,
         exists (
           select 1 from ban_source_links l2
           where l2.ban_id = v.id and l2.source_id <> (select id from gen)
         ) as has_extra_source
       from vague v
       join books bk on bk.id = v.book_id
       order by v.id`,
      [GENERIC_URL],
    )

    const deletable = rows.filter((r) => r.has_concrete && !r.has_extra_source)
    const flagged = rows.filter((r) => r.has_concrete && r.has_extra_source)
    const keepers = rows.filter((r) => !r.has_concrete)

    // Rows the old +/-1-year rule would have missed: concrete coverage exists,
    // but not near the roll-up's fabricated year.
    const newlyCaught = deletable.filter((r) => !r.has_concrete_in_window)
    const synthetic = newlyCaught.filter(
      (r) => r.pub_year != null && r.year_started != null &&
        (r.year_started === r.pub_year || r.year_started === r.pub_year + 1),
    )

    console.log(`vague PEN roll-ups:            ${rows.length}`)
    console.log(`  deletable (concrete cover):  ${deletable.length}`)
    console.log(`    of which the +/-1y rule missed: ${newlyCaught.length}` +
      ` (${synthetic.length} dated first_published_year or +1, ${newlyCaught.length - synthetic.length} otherwise unsourced)`)
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
        console.log(`  ban ${d.id} book ${d.book_id} ${d.country_code} ${d.year_started ?? 'y?'} ${d.action_type}` +
          ` (pub ${d.pub_year ?? '?'}${d.has_concrete_in_window ? '' : ', outside the old +/-1y window'})`)
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
