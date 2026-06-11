#!/usr/bin/env tsx
/**
 * Merge the two near-duplicate "A Day in the Life of Marlon Bundo" bans
 * (book_id=7339, US / Florida / 2022 / scope_id=1) into one canonical row.
 *
 *   KEEP = ban #30378  institution "Broward County Public Schools"  (older, bare;
 *          description=null; source 4054; reasons 1,11,2,3)
 *   DROP = ban #36040  institution "Broward County Schools"         (inserted
 *          2026-06-10 by apply-wiki-enrichment.ts; description set; source 4057
 *          = Wikipedia URL; no reasons)
 *
 * Same ban event. The wiki-enrichment dedup guard (country + scope + year±1 +
 * institution) missed it because the institution strings differ only by
 * "Public Schools" vs "Schools", so it inserted a fresh row instead of
 * promoting the bare one. The book page now shows both, reading as a dupe.
 *
 * Plan (mirrors the merge doctrine in scripts/README.md §3; see memory
 * "Merge order: DELETE dupe before enrich on unique fields"):
 *
 *   KEEP wins on institution (the fuller "Broward County Public Schools").
 *   That field is part of the UNIQUE key (bans_unique_per_scope =
 *   book_id, country_code, year_started, scope_id, region, institution), but
 *   we are NOT changing KEEP's institution, so KEEP's key never moves — no
 *   UNIQUE conflict regardless of order. Description is not part of the key.
 *
 *   1. Union DROP's source + reason links onto KEEP (on conflict do nothing).
 *      DROP carries source 4057 (the Wikipedia citation) which KEEP lacks; KEEP
 *      keeps its own source 4054. DROP has no reason links.
 *   2. Enrich KEEP.description ← DROP.description (KEEP is null, data beats NULL).
 *   3. DELETE ban #36040 — CASCADE removes its now-redundant source link.
 *      Idempotent: if #36040 is already gone the script is a no-op.
 *
 * Wrapped in a single transaction under --apply.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/merge-marlon-bundo-broward-dupe.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/merge-marlon-bundo-broward-dupe.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'

const APPLY = process.argv.includes('--apply')

const KEEP = 30378
const DROP = 36040

type Ban = {
  id: number
  book_id: number
  country_code: string
  scope_id: number | null
  year_started: number | null
  region: string | null
  institution: string | null
  description: string | null
}

async function getBan(pg: import('pg').Client, id: number): Promise<Ban | null> {
  const { rows } = await pg.query<Ban>(
    `select id, book_id, country_code, scope_id, year_started, region, institution, description
       from bans where id = $1`,
    [id],
  )
  return rows[0] ?? null
}

async function getLinks(pg: import('pg').Client, banId: number) {
  const src = await pg.query<{ source_id: number; locator: string | null }>(
    `select source_id, locator from ban_source_links where ban_id = $1 order by source_id`,
    [banId],
  )
  const rsn = await pg.query<{ reason_id: number }>(
    `select reason_id from ban_reason_links where ban_id = $1 order by reason_id`,
    [banId],
  )
  return { sources: src.rows, reasons: rsn.rows.map((r) => r.reason_id) }
}

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()

  console.log(`\n── merge-marlon-bundo-broward-dupe ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  try {
    const keep = await getBan(pg, KEEP)
    const drop = await getBan(pg, DROP)

    if (drop == null) {
      console.log(`DROP ban #${DROP} already gone — nothing to do (idempotent no-op).`)
      return
    }
    if (keep == null) {
      throw new Error(`KEEP ban #${KEEP} not found — aborting.`)
    }
    if (keep.book_id !== drop.book_id) {
      throw new Error(`Bans are on different books (${keep.book_id} vs ${drop.book_id}) — aborting.`)
    }

    const keepLinks = await getLinks(pg, KEEP)
    const dropLinks = await getLinks(pg, DROP)

    console.log(`KEEP ban #${keep.id}  book ${keep.book_id}  "${keep.institution}"`)
    console.log(`  desc: ${keep.description == null ? '(null)' : `"${keep.description.slice(0, 60)}…"`}`)
    console.log(`  sources: ${JSON.stringify(keepLinks.sources)}  reasons: ${JSON.stringify(keepLinks.reasons)}`)
    console.log(`DROP ban #${drop.id}  book ${drop.book_id}  "${drop.institution}"`)
    console.log(`  desc: ${drop.description == null ? '(null)' : `"${drop.description.slice(0, 60)}…"`}`)
    console.log(`  sources: ${JSON.stringify(dropLinks.sources)}  reasons: ${JSON.stringify(dropLinks.reasons)}\n`)

    if (APPLY) await pg.query('begin')

    // 1. Union DROP's source + reason links onto KEEP.
    for (const s of dropLinks.sources) {
      console.log(`  LINK  source ${s.source_id} → KEEP ban ${KEEP} (on conflict do nothing)`)
      if (APPLY) {
        await pg.query(
          `insert into ban_source_links (ban_id, source_id, locator) values ($1, $2, $3)
             on conflict do nothing`,
          [KEEP, s.source_id, s.locator],
        )
      }
    }
    for (const rid of dropLinks.reasons) {
      console.log(`  LINK  reason ${rid} → KEEP ban ${KEEP} (on conflict do nothing)`)
      if (APPLY) {
        await pg.query(
          `insert into ban_reason_links (ban_id, reason_id) values ($1, $2)
             on conflict do nothing`,
          [KEEP, rid],
        )
      }
    }

    // 2. Enrich KEEP.description from DROP (KEEP is null, data beats NULL).
    if (keep.description == null && drop.description != null) {
      console.log(`  ENRICH KEEP.description ← DROP (KEEP was null)`)
      if (APPLY) {
        await pg.query(`update bans set description = $1 where id = $2`, [drop.description, KEEP])
      }
    } else {
      console.log(`  SKIP enrich description (KEEP already set or DROP null)`)
    }

    // 3. Delete DROP — cascade removes its redundant source link.
    console.log(`  DELETE ban #${DROP} (CASCADE clears its source/reason links)`)
    if (APPLY) {
      await pg.query(`delete from bans where id = $1`, [DROP])
      await pg.query('commit')
    }

    // Verify
    if (APPLY) {
      const keepAfter = await getBan(pg, KEEP)
      const dropAfter = await getBan(pg, DROP)
      const linksAfter = await getLinks(pg, KEEP)
      const broward = await pg.query<{ id: number; institution: string | null }>(
        `select id, institution from bans where book_id = $1 and country_code = 'US'
           and region = 'Florida' and institution ilike 'Broward%' order by id`,
        [keep.book_id],
      )
      console.log(`\nVerify after:`)
      console.log(`  KEEP #${KEEP} institution: "${keepAfter?.institution}"`)
      console.log(`  KEEP #${KEEP} description set: ${keepAfter?.description != null ? 'yes' : 'NO ⚠'}`)
      console.log(`  KEEP #${KEEP} sources: ${JSON.stringify(linksAfter.sources)}  reasons: ${JSON.stringify(linksAfter.reasons)}`)
      console.log(`  DROP #${DROP} exists: ${dropAfter ? 'YES ⚠' : 'no (deleted)'}`)
      console.log(`  Broward bans on book ${keep.book_id}: ${broward.rows.length} (expected 1) → ${JSON.stringify(broward.rows)}`)
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
