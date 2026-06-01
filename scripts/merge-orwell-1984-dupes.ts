#!/usr/bin/env tsx
/**
 * Merge the two George Orwell "1984" duplicate book records into one canonical
 * row.
 *
 *   KEEP  = book #4   "1984"                (slug "1984")           — 21 bans
 *   DROP  = book #6359 "Nineteen Eighty-Four" (slug "nineteen-eighty-four-1949") — 2 bans (SU, VN)
 *
 * Both point at OpenLibrary work OL1168083W and author #5 (George Orwell).
 *
 * Plan (mirrors the merge-paren-suffix-dupes doctrine; see memory
 * "Merge order: DELETE dupe before enrich on unique fields"):
 *
 *   1. Migrate DROP's bans onto KEEP. Dedup key = (country_code, scope_id).
 *      NB: we deliberately dedup on (country, scope) and NOT the full unique
 *      key (which also includes year_started). DROP's SU ban is year 1949 and
 *      KEEP's SU ban is year 1950 — different rows under the strict unique key,
 *      but the *same* Soviet ban recorded with different start years. Honoring
 *      the year would wrongly leave two SU bans on the canonical record, so we
 *      treat SU as already-present:
 *        - SU (4882): KEEP already has an SU/scope-4 ban (585) → DROP this row,
 *          but first UNION its source/reason links onto KEEP's SU ban so the
 *          Soviet source citation (source #789) — which KEEP currently lacks —
 *          is preserved.
 *        - VN (5884): KEEP has no VN ban → re-point book_id 6359→4. Its source
 *          (#799) + reason links travel with it automatically.
 *
 *   2. Slug aliases:
 *        - Re-point DROP's existing alias "nineteen-eighty-four" → KEEP.
 *        - Add DROP's own slug "nineteen-eighty-four-1949" as a legacy_slug
 *          alias on KEEP so old URLs still resolve.
 *
 *   3. Enrich KEEP's NULL scalar fields from DROP (data beats NULL). Only
 *      `censorship_context` qualifies here (KEEP is null, DROP is set). KEEP's
 *      own isbn13/description/etc. are already populated and win.
 *
 *   4. DELETE book #6359. CASCADE removes its residual SU ban (4882) + that
 *      ban's links, its book_authors row (dupe of KEEP's), and any aliases
 *      still attached. book_authors is NOT moved — KEEP already has (4,5).
 *
 * Wrapped in a single transaction under --apply. Idempotent: if #6359 is
 * already gone the script is a no-op.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/merge-orwell-1984-dupes.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/merge-orwell-1984-dupes.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'

const APPLY = process.argv.includes('--apply')

const KEEP = 4
const DROP = 6359
const DROP_LEGACY_SLUG = 'nineteen-eighty-four-1949'

type Ban = {
  id: number
  book_id: number
  country_code: string
  scope_id: number | null
  year_started: number | null
  region: string | null
  institution: string | null
}

// Dedup key for THIS merge: country + scope (year intentionally excluded — see header).
function dedupKey(b: Ban): string {
  return `${b.country_code}|${b.scope_id ?? ''}`
}

async function getBans(pg: Client, bookId: number): Promise<Ban[]> {
  const { rows } = await pg.query<Ban>(
    `select id, book_id, country_code, scope_id, year_started, region, institution
       from bans where book_id = $1 order by country_code, year_started`,
    [bookId],
  )
  return rows
}

async function getLinks(pg: Client, banId: number) {
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

  console.log(`\n── merge-orwell-1984-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  try {
    const keepRow = await pg.query<{ id: number; slug: string; title: string; censorship_context: string | null }>(
      `select id, slug, title, censorship_context from books where id = $1`,
      [KEEP],
    )
    const dropRow = await pg.query<{ id: number; slug: string; title: string; censorship_context: string | null }>(
      `select id, slug, title, censorship_context from books where id = $1`,
      [DROP],
    )

    if (dropRow.rows.length === 0) {
      console.log(`DROP book #${DROP} already gone — nothing to do (idempotent no-op).`)
      return
    }
    if (keepRow.rows.length === 0) {
      throw new Error(`KEEP book #${KEEP} not found — aborting.`)
    }
    const keep = keepRow.rows[0]
    const drop = dropRow.rows[0]
    console.log(`KEEP #${keep.id} "${keep.title}" (slug "${keep.slug}")`)
    console.log(`DROP #${drop.id} "${drop.title}" (slug "${drop.slug}")\n`)

    const [keepBans, dropBans] = await Promise.all([getBans(pg, KEEP), getBans(pg, DROP)])
    const keepCountBefore = keepBans.length
    console.log(`Counts before: KEEP has ${keepCountBefore} bans, DROP has ${dropBans.length} bans.`)

    const keepByKey = new Map(keepBans.map((b) => [dedupKey(b), b]))

    if (APPLY) await pg.query('begin')

    // 1. Migrate DROP's bans
    for (const db of dropBans) {
      const links = await getLinks(pg, db.id)
      const match = keepByKey.get(dedupKey(db))
      if (match) {
        // Duplicate (same country+scope). Drop db (via final cascade) but
        // union its links onto KEEP's matching ban first.
        console.log(
          `  DUP   ${db.country_code}/scope=${db.scope_id}/y=${db.year_started} (ban ${db.id})` +
            ` → union ${links.sources.length} src + ${links.reasons.length} rsn onto KEEP ban ${match.id} (y=${match.year_started}); row dropped via cascade`,
        )
        if (APPLY) {
          for (const s of links.sources) {
            await pg.query(
              `insert into ban_source_links (ban_id, source_id, locator) values ($1, $2, $3)
                 on conflict do nothing`,
              [match.id, s.source_id, s.locator],
            )
          }
          for (const rid of links.reasons) {
            await pg.query(
              `insert into ban_reason_links (ban_id, reason_id) values ($1, $2)
                 on conflict do nothing`,
              [match.id, rid],
            )
          }
        }
      } else {
        // No match → move the ban to KEEP. Its links reference ban_id, which
        // is unchanged, so they travel automatically.
        console.log(
          `  MOVE  ${db.country_code}/scope=${db.scope_id}/y=${db.year_started} (ban ${db.id})` +
            ` → re-point book_id ${DROP}→${KEEP} (carries ${links.sources.length} src + ${links.reasons.length} rsn)`,
        )
        if (APPLY) {
          await pg.query(`update bans set book_id = $1 where id = $2`, [KEEP, db.id])
        }
        keepByKey.set(dedupKey(db), { ...db, book_id: KEEP })
      }
    }

    // 2. Slug aliases
    const aliases = await pg.query<{ slug: string; source: string | null }>(
      `select slug, source from book_slug_aliases where book_id = $1`,
      [DROP],
    )
    for (const a of aliases.rows) {
      console.log(`  ALIAS re-point "${a.slug}" (source=${a.source}) → KEEP #${KEEP}`)
      if (APPLY) {
        await pg.query(`update book_slug_aliases set book_id = $1 where slug = $2`, [KEEP, a.slug])
      }
    }
    if (drop.slug && drop.slug !== keep.slug) {
      console.log(`  ALIAS add legacy "${DROP_LEGACY_SLUG}" → KEEP #${KEEP}`)
      if (APPLY) {
        await pg.query(
          `insert into book_slug_aliases (slug, book_id, source) values ($1, $2, 'legacy_slug')
             on conflict do nothing`,
          [DROP_LEGACY_SLUG, KEEP],
        )
      }
    }

    // 3. Enrich KEEP's NULL scalars from DROP (only censorship_context qualifies)
    if (keep.censorship_context == null && drop.censorship_context != null) {
      console.log(`  ENRICH KEEP.censorship_context ← DROP (KEEP was null)`)
      if (APPLY) {
        await pg.query(`update books set censorship_context = $1 where id = $2`, [
          drop.censorship_context,
          KEEP,
        ])
      }
    }

    // 4. Delete DROP — cascade removes residual SU ban (+links), dupe
    //    book_authors row, and any remaining aliases.
    console.log(`  DELETE book #${DROP} (CASCADE)`)
    if (APPLY) {
      await pg.query(`delete from books where id = $1`, [DROP])
      await pg.query('commit')
    }

    // Verify
    if (APPLY) {
      const keepAfter = await getBans(pg, KEEP)
      const dropAfter = await pg.query(`select id from books where id = $1`, [DROP])
      const vn = keepAfter.find((b) => b.country_code === 'VN')
      const suRows = keepAfter.filter((b) => b.country_code === 'SU')
      const aliasAfter = await pg.query<{ slug: string }>(
        `select slug from book_slug_aliases where book_id = $1 order by slug`,
        [KEEP],
      )
      const suSrc = suRows[0]
        ? await pg.query(`select source_id from ban_source_links where ban_id = $1`, [suRows[0].id])
        : { rows: [] as { source_id: number }[] }
      console.log(`\nVerify after:`)
      console.log(`  KEEP bans: ${keepCountBefore} → ${keepAfter.length} (expected +1 = ${keepCountBefore + 1})`)
      console.log(`  VN ban present on KEEP: ${vn ? `yes (ban ${vn.id})` : 'NO ⚠'}`)
      console.log(`  SU bans on KEEP: ${suRows.length} (expected 1); source_links now: ${JSON.stringify(suSrc.rows)}`)
      console.log(`  KEEP slug aliases: ${aliasAfter.rows.map((r) => r.slug).join(', ')}`)
      console.log(`  DROP book #${DROP} exists: ${dropAfter.rows.length > 0 ? 'YES ⚠' : 'no (deleted)'}`)
      console.log(`\nDone.`)
    } else {
      console.log(`\nDry-run complete. Re-run with --apply to execute (single transaction).`)
    }
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
