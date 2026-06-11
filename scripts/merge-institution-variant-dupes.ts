#!/usr/bin/env tsx
/**
 * Data-driven cleanup of near-duplicate bans that differ ONLY by an
 * institution-string variant — the class the pre-fix wiki-enrichment dedup
 * guard let through (see scripts/apply-wiki-enrichment.ts normalizeInstitution
 * and the Marlon Bundo / Broward fix, 2026-06-10).
 *
 * Same class, real examples found in the live DB (PEN imports, two passes with
 * spelling + ±1 year drift):
 *   "Santa Rosa County Schools"  vs  "Santa Rosa County District Schools"
 *   "Madison County Public Schools" vs "Madison County Schools"
 *   "Canby School District" vs "Canby Public School District"
 *
 * Detection (same as the hardened guard): group bans by
 * (book_id, country_code, scope_id) then by the normalized institution CORE
 * (lowercase, strip punctuation, drop filler tokens public/unified/
 * school(s)/district/isd). A core-group with ≥2 distinct rows is a dupe cluster.
 *
 * Safety rail: only auto-merge a cluster whose year span (max - min over
 * non-null years) is ≤ 1 — that is the same "year ±1 = same event" window the
 * guard uses. A cluster spanning more than 1 year is FLAGGED, not merged, so we
 * never collapse genuinely distinct multi-year events. Empty core (all-filler
 * institutions like "Public Schools") is skipped entirely.
 *
 * Per cluster (mirrors scripts/README.md §3 doctrine; KEEP's UNIQUE key
 * — book_id, country, year, scope, region, institution — is never mutated, so
 * no conflict regardless of order):
 *   KEEP = longest institution string (most specific); tie-break = lowest id.
 *   1. Union every DROP's source + reason links onto KEEP (on conflict do nothing).
 *   2. Fill KEEP's NULL description / region from a DROP (data beats NULL;
 *      first non-null DROP wins; KEEP's own non-null values are never overwritten).
 *   3. DELETE each DROP — CASCADE clears its links.
 * Whole run is one transaction under --apply. Idempotent: re-running after a
 * successful merge finds no clusters.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/merge-institution-variant-dupes.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/merge-institution-variant-dupes.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'

const APPLY = process.argv.includes('--apply')

const FILLER = new Set(['public', 'unified', 'school', 'schools', 'district', 'isd'])
function normalizeInstitution(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !FILLER.has(t))
    .join(' ')
    .trim()
}

type Ban = {
  id: number
  book_id: number
  country_code: string
  scope_id: number | null
  year_started: number | null
  region: string | null
  institution: string
  description: string | null
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

  console.log(`\n── merge-institution-variant-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  try {
    const { rows } = await pg.query<Ban>(
      `select id, book_id, country_code, scope_id, year_started, region, institution, description
         from bans where institution is not null order by book_id, id`,
    )

    // Group by (book_id, country_code, scope_id) then by normalized core.
    const groups = new Map<string, Ban[]>()
    for (const b of rows) {
      const core = normalizeInstitution(b.institution)
      if (core === '') continue // all-filler → no usable core, skip
      const key = `${b.book_id}|${b.country_code}|${b.scope_id ?? ''}|${core}`
      const arr = groups.get(key) ?? []
      arr.push(b)
      groups.set(key, arr)
    }

    let clusters = 0
    let flagged = 0
    let dropsTotal = 0
    if (APPLY) await pg.query('begin')

    for (const [key, members] of groups) {
      if (members.length < 2) continue
      const distinctInst = new Set(members.map((m) => m.institution.toLowerCase()))
      if (distinctInst.size < 2) continue // identical strings — not this class

      const years = members.map((m) => m.year_started).filter((y): y is number => y != null)
      const span = years.length ? Math.max(...years) - Math.min(...years) : 0
      if (span > 1) {
        flagged++
        console.log(`FLAG (year span ${span} > 1, NOT merged) — ${key}`)
        for (const m of members) console.log(`     #${m.id} "${m.institution}" y=${m.year_started}`)
        continue
      }

      // KEEP = longest institution string; tie-break lowest id.
      const sorted = [...members].sort(
        (a, b) => b.institution.length - a.institution.length || a.id - b.id,
      )
      const keep = sorted[0]
      const drops = sorted.slice(1)
      clusters++
      dropsTotal += drops.length

      console.log(
        `book ${keep.book_id} ${keep.country_code}/scope=${keep.scope_id} core="${normalizeInstitution(keep.institution)}"`,
      )
      console.log(`  KEEP #${keep.id} "${keep.institution}" y=${keep.year_started} desc=${keep.description != null}`)

      let fillDesc = keep.description == null
      let fillRegion = keep.region == null
      for (const d of drops) {
        const links = await getLinks(pg, d.id)
        console.log(
          `  DROP #${d.id} "${d.institution}" y=${d.year_started} desc=${d.description != null}` +
            ` → union ${links.sources.length} src + ${links.reasons.length} rsn, then delete`,
        )
        if (APPLY) {
          for (const s of links.sources) {
            await pg.query(
              `insert into ban_source_links (ban_id, source_id, locator) values ($1, $2, $3) on conflict do nothing`,
              [keep.id, s.source_id, s.locator],
            )
          }
          for (const rid of links.reasons) {
            await pg.query(
              `insert into ban_reason_links (ban_id, reason_id) values ($1, $2) on conflict do nothing`,
              [keep.id, rid],
            )
          }
        }
        if (fillDesc && d.description != null) {
          console.log(`    ENRICH KEEP.description ← #${d.id} (KEEP was null)`)
          if (APPLY) await pg.query(`update bans set description = $1 where id = $2`, [d.description, keep.id])
          fillDesc = false
        }
        if (fillRegion && d.region != null) {
          console.log(`    ENRICH KEEP.region ← #${d.id} (KEEP was null)`)
          if (APPLY) await pg.query(`update bans set region = $1 where id = $2`, [d.region, keep.id])
          fillRegion = false
        }
        if (APPLY) await pg.query(`delete from bans where id = $1`, [d.id])
      }
    }

    if (APPLY) await pg.query('commit')

    console.log(
      `\n${APPLY ? 'Merged' : 'Would merge'} ${clusters} cluster(s) (${dropsTotal} dup row(s) deleted)` +
        `${flagged ? `; ${flagged} cluster(s) FLAGGED (year span >1, left untouched)` : ''}.`,
    )
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
