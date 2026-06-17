/**
 * Berlin verbannte Bücher (Nazi 1938 list) — importer.
 *
 * Route: standard new-source pipeline (scripts/README.md §1). Thin reader over
 * the Stap-0 seed → shared commit-lib (commitParsedRow / commitNewBanForBook),
 * with match-before-create via the canonical `matchExistingBook` (verifier.ts).
 * NOT the legacy LLM queue. One matcher, no bespoke dedup.
 *
 * Seed: data/berlin-verbannte-1938-*.json  (3,606 clean book rows; blanket +
 * authorless live in the excluded sidecar and are NOT imported here.)
 *
 * Per row: matchExistingBook({title, englishTitle}) →
 *   - hit  → commitNewBanForBook(hit.id, …)   (attach the DE/1938 ban; idempotent)
 *   - miss → commitParsedRow(…)               (create book + ban)
 *
 * HELD for manual review (needs_review — neither attached nor created):
 *   1. Intra-batch slug collisions: ≥2 seed rows share a title-slug (mostly
 *      same generic title by DIFFERENT authors — the slug matcher is
 *      author-blind, so auto-merge would be wrong; cf. PEN suffix-collapse).
 *   2. Ambiguous generic-title matches against an EXISTING non-Otto book
 *      (single word / person name — could be a different work). Hand-picked
 *      from the match dry-run.
 *
 * Idempotent / resumable: a re-run finds rows it created last run (exact slug
 * via matchExistingBook) and re-adds the idempotent ban instead of duplicating.
 *
 * Framing: censorship VICTIMS (Nazi-banned), like the FR Otto list — books get
 * warning_level via the table default; a post-import check verifies it is 'none'.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-berlin-verbannte.ts            # DRY-RUN (live-matches, no writes)
 *   pnpm tsx --env-file=.env.local scripts/import-berlin-verbannte.ts --apply    # WRITES
 *   pnpm tsx --env-file=.env.local scripts/import-berlin-verbannte.ts --limit=50 # cap rows (testing)
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

const BAN_YEAR = 1938
const COUNTRY = 'DE'
const SCOPE = 'government'
const REASON = 'political'
const SOURCE_TYPE = 'government'
const INCLUSION_RATIONALE =
  "Listed in the Nazi German \"Liste des schädlichen und unerwünschten Schrifttums\" " +
  '(Stand 31 December 1938); suppressed under National Socialism.'

// Ambiguous generic-title matches against an existing non-Otto book — hold for
// manual confirmation that it is the SAME work before attaching a Nazi ban.
const HOLD_GENERIC_MATCH = new Set([513, 839, 1321, 2313, 3053, 3151, 3420, 4877])

interface SeedRow {
  source_row_id: number
  title: string
  title_english_meaningful: string | null
  authors: string[]
  publication_year: number | null
  source_name: string
  source_url: string
}

function findSeed(): string {
  const files = readdirSync('data').filter(f => /^berlin-verbannte-1938-.*\.json$/.test(f)).sort()
  if (!files.length) throw new Error('no data/berlin-verbannte-1938-*.json seed — run build-berlin-verbannte-stage0.ts')
  return `data/${files[files.length - 1]}`
}

// All source_row_ids whose title-slug collides with another seed row.
function intraBatchCollisionIds(rows: SeedRow[]): Set<number> {
  const bySlug = new Map<string, number[]>()
  for (const r of rows) {
    const s = slugify(r.title)
    if (!s) continue
    if (!bySlug.has(s)) bySlug.set(s, [])
    bySlug.get(s)!.push(r.source_row_id)
  }
  const out = new Set<number>()
  for (const ids of bySlug.values()) if (ids.length > 1) for (const id of ids) out.add(id)
  return out
}

async function main() {
  const seedPath = findSeed()
  const all = (JSON.parse(readFileSync(seedPath, 'utf8')).rows as SeedRow[])
  const rows = Number.isFinite(LIMIT) ? all.slice(0, LIMIT) : all

  const collisions = intraBatchCollisionIds(all)
  const held = new Set<number>([...collisions, ...HOLD_GENERIC_MATCH])

  console.log(`\n── import-berlin-verbannte ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`)
  console.log(`  seed: ${seedPath} — ${all.length} rows${Number.isFinite(LIMIT) ? ` (capped to ${rows.length})` : ''}`)
  console.log(`  held for review: ${held.size} (${collisions.size} intra-batch slug-collision + ${HOLD_GENERIC_MATCH.size} generic-match)\n`)

  const pg: Client = newPgClient()
  await pg.connect()

  let created = 0, attached = 0, reused = 0, heldCount = 0, done = 0
  try {
    for (const r of rows) {
      done++
      if (held.has(r.source_row_id)) { heldCount++; continue }

      const hit = await matchExistingBook({
        title: r.title,
        englishTitle: r.title_english_meaningful ?? null,
      })

      if (!APPLY) {
        if (hit) attached++; else created++
        if (done % 250 === 0) console.log(`  …${done}/${rows.length} (would-attach ${attached}, would-create ${created}, held ${heldCount})`)
        continue
      }

      if (hit) {
        const add: AddBanInput = {
          book_id: hit.id,
          country_code: COUNTRY,
          scope_slug: SCOPE,
          action_type: 'banned',
          ban_status: 'historical',
          year: BAN_YEAR,
          reason_slug: REASON,
          description_ban: null,
          source_url: r.source_url,
          source_name: r.source_name,
          source_type: SOURCE_TYPE,
        }
        const res = await commitNewBanForBook(add, pg)
        if (res.created) attached++; else reused++
      } else {
        const input: CommitInput = {
          title: r.title,
          title_english_meaningful: r.title_english_meaningful ?? null,
          authors: r.authors,
          year: BAN_YEAR,
          first_published_year: r.publication_year ?? null,
          country_code: COUNTRY,
          scope_slug: SCOPE,
          action_type: 'banned',
          ban_status: 'historical',
          reason_slug: REASON,
          description_ban: null,
          inclusion_rationale: INCLUSION_RATIONALE,
          source_url: r.source_url,
          source_name: r.source_name,
          source_type: SOURCE_TYPE,
        }
        await commitParsedRow(input, pg)
        created++
      }
      if (done % 250 === 0) console.log(`  …${done}/${rows.length} (created ${created}, attached ${attached}, reused ${reused}, held ${heldCount})`)
    }
  } finally {
    await pg.end()
  }

  console.log(`\n  ── ${APPLY ? 'DONE' : 'DRY-RUN'} ──`)
  if (APPLY) {
    console.log(`  books created   : ${created}`)
    console.log(`  bans attached   : ${attached} (to existing books)`)
    console.log(`  bans reused     : ${reused} (idempotent no-op)`)
  } else {
    console.log(`  would-create    : ${created}`)
    console.log(`  would-attach    : ${attached}`)
  }
  console.log(`  held (review)   : ${heldCount}`)
  console.log(`  total processed : ${done}\n`)
  if (!APPLY) console.log(`  DRY-RUN — nothing written. Re-run with --apply to write.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
