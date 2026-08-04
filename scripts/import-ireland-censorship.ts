/**
 * Ireland — Censorship of Publications Board — importer.
 *
 * Route: standard new-source pipeline (scripts/README.md §1). Thin reader over
 * the Stap-0 seed (data/ireland-censorship-*.json, built by
 * build-ireland-censorship-stage0.ts) → shared commit-lib, with
 * match-before-create via the canonical matchExistingBook (verifier.ts).
 *
 * Per row: matchExistingBook({title}) →
 *   - hit WITH an existing IE ban → SKIP (don't add a second, possibly
 *     year-conflicting IE ban to a book we already document for Ireland).
 *   - hit WITHOUT an IE ban       → commitNewBanForBook (attach IE ban).
 *   - miss                        → commitParsedRow (create book + IE ban).
 *
 * HELD for review: intra-batch effective-slug collisions (two different books
 * sharing a title-slug and no slug_override) — auto-merge would be wrong.
 *
 * Idempotent/resumable: re-runs re-match created rows and the IE-ban guard
 * turns them into skips.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-ireland-censorship.ts            # DRY-RUN
 *   pnpm tsx --env-file=.env.local scripts/import-ireland-censorship.ts --apply    # WRITES
 *   pnpm tsx --env-file=.env.local scripts/import-ireland-censorship.ts --limit=10
 */
import { readFileSync, readdirSync } from 'node:fs'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { slugify } from '../src/lib/imports/slugify'
import {
  commitParsedRow,
  commitNewBanForBook,
  type CommitInput,
  type AddBanInput,
} from '../src/lib/imports/review-commit'
import { isApply, intFlag } from './lib/cli'

const APPLY = isApply()
const LIMIT = intFlag('limit', Number.POSITIVE_INFINITY)

interface SeedRow {
  source_row_id: number
  title: string
  title_english_meaningful: string | null
  authors: string[]
  publication_year: number | null
  year: number
  country_code: string
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  ban_status: 'active' | 'historical'
  reason_slug: string
  inclusion_rationale: string
  source_name: string
  source_url: string
  source_type: string
  slug_override?: string
}

function findSeed(): string {
  const files = readdirSync('data').filter(f => /^ireland-censorship-.*\.json$/.test(f)).sort()
  if (!files.length) throw new Error('no data/ireland-censorship-*.json seed — run build-ireland-censorship-stage0.ts')
  return `data/${files[files.length - 1]}`
}

const effSlug = (r: SeedRow) => r.slug_override || slugify(r.title)

function intraBatchCollisionIds(rows: SeedRow[]): Set<number> {
  const bySlug = new Map<string, number[]>()
  for (const r of rows) {
    const s = effSlug(r)
    if (!s) continue
    if (!bySlug.has(s)) bySlug.set(s, [])
    bySlug.get(s)!.push(r.source_row_id)
  }
  const out = new Set<number>()
  for (const ids of bySlug.values()) if (ids.length > 1) for (const id of ids) out.add(id)
  return out
}

async function hasIeBan(pg: Client, bookId: number): Promise<boolean> {
  const res = await pg.query(`select 1 from bans where book_id = $1 and country_code = 'IE' limit 1`, [bookId])
  return res.rows.length > 0
}

async function main() {
  const seedPath = findSeed()
  const all = (JSON.parse(readFileSync(seedPath, 'utf8')).rows as SeedRow[])
  const rows = Number.isFinite(LIMIT) ? all.slice(0, LIMIT) : all

  const held = intraBatchCollisionIds(all)

  console.log(`\n── import-ireland-censorship ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`)
  console.log(`  seed: ${seedPath} — ${all.length} rows${Number.isFinite(LIMIT) ? ` (capped to ${rows.length})` : ''}`)
  console.log(`  held (intra-batch slug collision): ${held.size}\n`)

  const pg: Client = newPgClient()
  await pg.connect()

  let created = 0, attached = 0, skipped = 0, heldCount = 0, done = 0
  try {
    for (const r of rows) {
      done++
      if (held.has(r.source_row_id)) { heldCount++; console.log(`  HELD   ${r.title} — ${r.authors.join(', ')}`); continue }

      const hit = await matchExistingBook({ title: r.title, englishTitle: r.title_english_meaningful ?? null })

      if (hit) {
        const existing = await hasIeBan(pg, hit.id)
        if (existing) {
          skipped++
          console.log(`  SKIP   ${r.title} (${r.authors.join(', ')}) → #${hit.id} "${(hit as any).title ?? ''}" already has an IE ban`)
          continue
        }
        console.log(`  ATTACH ${r.title} (${r.authors.join(', ')}) → existing #${hit.id} "${(hit as any).title ?? ''}"`)
        if (APPLY) {
          const add: AddBanInput = {
            book_id: hit.id,
            country_code: 'IE',
            scope_slug: r.scope_slug,
            action_type: r.action_type,
            ban_status: r.ban_status,
            year: r.year,
            reason_slug: r.reason_slug,
            description_ban: null,
            source_url: r.source_url,
            source_name: r.source_name,
            source_type: r.source_type,
          }
          await commitNewBanForBook(add, pg)
        }
        attached++
      } else {
        console.log(`  CREATE ${r.title} (${r.authors.join(', ')}) [${r.year}]`)
        if (APPLY) {
          const input: CommitInput = {
            title: r.title,
            title_english_meaningful: r.title_english_meaningful ?? null,
            slug_override: r.slug_override ?? null,
            authors: r.authors,
            year: r.year,
            first_published_year: r.publication_year ?? null,
            country_code: 'IE',
            scope_slug: r.scope_slug,
            action_type: r.action_type,
            ban_status: r.ban_status,
            reason_slug: r.reason_slug,
            description_ban: null,
            inclusion_rationale: r.inclusion_rationale,
            source_url: r.source_url,
            source_name: r.source_name,
            source_type: r.source_type,
          }
          await commitParsedRow(input, pg)
        }
        created++
      }
    }
  } finally {
    await pg.end()
  }

  console.log(`\n  ── ${APPLY ? 'DONE' : 'DRY-RUN'} ──`)
  console.log(`  ${APPLY ? 'created' : 'would-create'} : ${created}`)
  console.log(`  ${APPLY ? 'attached' : 'would-attach'}: ${attached}`)
  console.log(`  skipped (already IE ban): ${skipped}`)
  console.log(`  held (review): ${heldCount}`)
  console.log(`  total processed: ${done}\n`)
  if (!APPLY) console.log(`  DRY-RUN — nothing written. Re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
