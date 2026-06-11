#!/usr/bin/env tsx
/**
 * Collapse 7 "continuous ban recorded across multiple PEN annual indices"
 * duplicates into one event each. These are the year-span>1 clusters that
 * scripts/merge-institution-variant-dupes.ts deliberately FLAGGED rather than
 * merged (its safety rail only auto-merges within a ±1 year window).
 *
 * Each cluster is the SAME district banning the SAME book, appearing in two
 * different PEN annual indexes with the district spelled two ways:
 *   early row = "<X> County School District"  (PEN 2021-2022, source #4055)
 *   later row = "<X> County Schools"           (PEN 2023-24 / 2024-25)
 *
 * PEN's index re-lists bans still in effect each school year, so a book in both
 * a 2021-22 and a 2024-25 index for the same district is ONE continuous ban,
 * not two events. Recording both over-reports the ban count. Decision
 * (user, 2026-06-11): record as a single event.
 *
 * Per pair (mirrors scripts/README.md §3 doctrine; KEEP's UNIQUE key is never
 * mutated → no conflict regardless of order):
 *   KEEP = the EARLIEST-year row, which already carries the canonical
 *          "… School District" spelling and the true start year.
 *   1. Union DROP's source + reason links onto KEEP (on conflict do nothing) —
 *      so the later PEN index citation AND any reasons unique to the later year
 *      are preserved (the reason sets differ per index year).
 *   2. DELETE DROP — CASCADE clears its links.
 *   year_started stays the earliest; year_ended stays null (ban is ongoing as
 *   of the latest index — we have no evidence it was lifted).
 *
 * All 7 in one transaction under --apply. Idempotent: a missing DROP is a no-op.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/merge-multiyear-pen-dupes.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/merge-multiyear-pen-dupes.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'

const APPLY = process.argv.includes('--apply')

// KEEP = earliest-year "School District" row; DROP = later "Schools" row.
const PAIRS: { keep: number; drop: number; book: number; label: string }[] = [
  { keep: 34556, drop: 10966, book: 5, label: 'The Bluest Eye / Wilson County' },
  { keep: 34796, drop: 10741, book: 126, label: 'Eleanor & Park / Wilson County' },
  { keep: 34120, drop: 10722, book: 133, label: 'Crank / Wilson County' },
  { keep: 34458, drop: 10655, book: 200, label: 'A Court of Mist and Fury / Wilson County' },
  { keep: 34199, drop: 10849, book: 215, label: "Monday's Not Coming / Wilson County" },
  { keep: 33773, drop: 14616, book: 1099, label: 'Untamed / Indian River County' },
  { keep: 33763, drop: 14615, book: 1103, label: 'Betrayed / Indian River County' },
]

type Ban = {
  id: number
  book_id: number
  year_started: number | null
  institution: string | null
}

async function getBan(pg: import('pg').Client, id: number): Promise<Ban | null> {
  const { rows } = await pg.query<Ban>(
    `select id, book_id, year_started, institution from bans where id = $1`,
    [id],
  )
  return rows[0] ?? null
}

async function getLinks(pg: import('pg').Client, banId: number) {
  const src = await pg.query<{ source_id: number; locator: string | null }>(
    `select source_id, locator from ban_source_links where ban_id = $1`,
    [banId],
  )
  const rsn = await pg.query<{ reason_id: number }>(
    `select reason_id from ban_reason_links where ban_id = $1`,
    [banId],
  )
  return { sources: src.rows, reasons: rsn.rows.map((r) => r.reason_id) }
}

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()

  console.log(`\n── merge-multiyear-pen-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  let merged = 0
  try {
    if (APPLY) await pg.query('begin')

    for (const p of PAIRS) {
      const keep = await getBan(pg, p.keep)
      const drop = await getBan(pg, p.drop)

      if (drop == null) {
        console.log(`• ${p.label}: DROP #${p.drop} already gone — no-op.`)
        continue
      }
      if (keep == null) throw new Error(`KEEP #${p.keep} not found (${p.label}) — aborting.`)
      if (String(keep.book_id) !== String(drop.book_id) || String(keep.book_id) !== String(p.book)) {
        throw new Error(`book_id mismatch on ${p.label} — aborting (safety).`)
      }

      const dropLinks = await getLinks(pg, p.drop)
      console.log(`• ${p.label}`)
      console.log(`    KEEP #${keep.id} "${keep.institution}" y=${keep.year_started}`)
      console.log(
        `    DROP #${drop.id} "${drop.institution}" y=${drop.year_started}` +
          ` → union ${dropLinks.sources.length} src + ${dropLinks.reasons.length} rsn, then delete`,
      )

      if (APPLY) {
        for (const s of dropLinks.sources) {
          await pg.query(
            `insert into ban_source_links (ban_id, source_id, locator) values ($1, $2, $3) on conflict do nothing`,
            [p.keep, s.source_id, s.locator],
          )
        }
        for (const rid of dropLinks.reasons) {
          await pg.query(
            `insert into ban_reason_links (ban_id, reason_id) values ($1, $2) on conflict do nothing`,
            [p.keep, rid],
          )
        }
        await pg.query(`delete from bans where id = $1`, [p.drop])
      }
      merged++
    }

    if (APPLY) await pg.query('commit')

    // Verify
    if (APPLY) {
      console.log(`\nVerify after:`)
      for (const p of PAIRS) {
        const drop = await getBan(pg, p.drop)
        const links = await getLinks(pg, p.keep)
        console.log(
          `  ${p.label}: DROP #${p.drop} ${drop ? 'EXISTS ⚠' : 'deleted'}; ` +
            `KEEP #${p.keep} now ${links.sources.length} src + ${links.reasons.length} rsn`,
        )
      }
    }
    console.log(`\n${APPLY ? 'Merged' : 'Would merge'} ${merged} pair(s).`)
    if (!APPLY) console.log(`Dry-run — re-run with --apply to execute (single transaction).`)
  } catch (err) {
    if (APPLY) {
      try {
        await pg.query('rollback')
        console.error('Rolled back transaction.')
      } catch {
        /* ignore */
      }
    }
    throw err
  } finally {
    await pg.end()
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
