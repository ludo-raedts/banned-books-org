/**
 * Resolve the 64 rows held by import-berlin-verbannte.ts (committed 4c36c61).
 *
 * The main importer HOLDS (never imports) two row-classes; this script clears
 * them. It is the apply-side companion to _analyze_berlin_held.ts.
 *
 *   1. Intra-batch slug collisions (56 rows / 26 clusters). Mostly the SAME
 *      generic German title by DIFFERENT authors (e.g. 4× "Liebe und Ehe") =
 *      distinct works that the author-blind slug matcher would wrongly merge.
 *      → import ALL, each under an author-disambiguated slug (books.slug is
 *        UNIQUE; commitParsedRow's title-derived slug can't disambiguate, so we
 *        pass slug_override).
 *      Two clusters are genuine same-work duplicates within the source and are
 *      imported ONCE (the dropped twin carries an identical DE/1938 ban):
 *        - #2153 ≡ #4014  "Abrüstung … zum neuen Krieg" / Ernst Reinhard / 1927
 *        - #2397 ≡ #2711  "Unter der Peitsche" / Seidler·Margolis·Ritter trio
 *                          (1934/1935, "E."/"H." Ritter — one work, transcribed
 *                           twice with reordered authors)
 *
 *   2. Eight ambiguous generic-title matches against an EXISTING non-Otto book
 *      (HOLD_GENERIC_MATCH). Each existing book has a DIFFERENT author than the
 *      1938-list entry (Stalin/Just≠Wu Lan, Karl Marx/Wilbrandt≠Korsch, …) →
 *      all are DIFFERENT works → create new (the bare slug is taken by the
 *      existing book, so these also get an author-disambiguated slug).
 *
 * Slugs are derived ONLY from the seed (deterministic ⇒ idempotent/resumable):
 *   base = slugify(title); suffix = author surname (or r<row-id> fallback).
 * At apply time a planned slug already in DB ⇒ created by a prior run of THIS
 * script ⇒ attach the (idempotent) ban instead of re-creating.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/resolve-berlin-held.ts          # DRY-RUN
 *   pnpm tsx --env-file=.env.local scripts/resolve-berlin-held.ts --apply  # WRITES
 */
import { readFileSync, readdirSync } from 'node:fs'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'
import {
  commitParsedRow,
  commitNewBanForBook,
  type CommitInput,
  type AddBanInput,
} from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'

const APPLY = isApply()

const BAN_YEAR = 1938
const COUNTRY = 'DE'
const SCOPE = 'government'
const REASON = 'political'
const SOURCE_TYPE = 'government'
const INCLUSION_RATIONALE =
  "Listed in the Nazi German \"Liste des schädlichen und unerwünschten Schrifttums\" " +
  '(Stand 31 December 1938); suppressed under National Socialism.'

// Same-work duplicates within the source: keep one, drop the twin.
const SAME_WORK_KEEP = new Set([2153, 2397])
const SAME_WORK_DROP = new Set([4014, 2711])
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
  return `data/${files[files.length - 1]}`
}

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

// Surname for slug disambiguation. "Lastname, Firstname …" → before first
// comma; otherwise the last whitespace token. Returns a slug fragment.
function surnameSlug(authorStr: string): string {
  const raw = authorStr.includes(',')
    ? authorStr.split(',')[0]
    : (authorStr.trim().split(/\s+/).pop() ?? '')
  return slugify(raw)
}

type Plan = {
  row: SeedRow
  kind: 'collision-distinct' | 'collision-same-work' | 'generic'
  slug: string
}

async function main() {
  const seedPath = findSeed()
  const all = JSON.parse(readFileSync(seedPath, 'utf8')).rows as SeedRow[]
  const byId = new Map(all.map(r => [r.source_row_id, r]))

  const collisions = intraBatchCollisionIds(all)
  const held = new Set<number>([...collisions, ...HOLD_GENERIC_MATCH])

  // ---- build the deterministic create-plan ----
  const usedSlugs = new Set<string>()
  const plans: Plan[] = []
  for (const id of [...held].sort((a, b) => a - b)) {
    if (SAME_WORK_DROP.has(id)) continue            // dropped duplicate twin
    const r = byId.get(id)!
    const base = slugify(r.title)
    let slug: string
    let kind: Plan['kind']
    if (SAME_WORK_KEEP.has(id)) {
      slug = base                                    // single representative → bare slug
      kind = 'collision-same-work'
    } else {
      const sn = surnameSlug(r.authors[0] ?? '')
      slug = sn ? `${base}-${sn}` : `${base}-r${id}`
      kind = HOLD_GENERIC_MATCH.has(id) ? 'generic' : 'collision-distinct'
    }
    if (usedSlugs.has(slug)) slug = `${base}-r${id}` // within-run safety (distinct surnames expected)
    usedSlugs.add(slug)
    plans.push({ row: r, kind, slug })
  }

  console.log(`\n── resolve-berlin-held ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`)
  console.log(`  seed: ${seedPath}`)
  console.log(`  held: ${held.size} (${collisions.size} collision + ${HOLD_GENERIC_MATCH.size} generic)`)
  console.log(`  dropped same-work twins: ${[...SAME_WORK_DROP].join(', ')}`)
  console.log(`  books to create/attach: ${plans.length}\n`)

  const pg: Client = newPgClient()
  await pg.connect()

  let created = 0, attached = 0, reused = 0, preexistingFlags = 0
  try {
    for (const p of plans) {
      const { row: r, slug, kind } = p
      const found = await pg.query('select id, title from books where slug = $1', [slug])
      const exists = found.rows[0]

      if (!APPLY) {
        const tag = exists ? `⚠ slug EXISTS in DB → #${exists.id} "${exists.title}" (attach ban)` : 'create'
        if (exists) preexistingFlags++
        console.log(`  #${r.source_row_id} [${kind}] "${r.title}" — ${r.authors.join(', ') || '(none)'}`)
        console.log(`        → slug "${slug}"  ${tag}`)
        continue
      }

      if (exists) {
        const add: AddBanInput = {
          book_id: exists.id, country_code: COUNTRY, scope_slug: SCOPE,
          action_type: 'banned', ban_status: 'historical', year: BAN_YEAR,
          reason_slug: REASON, description_ban: null,
          source_url: r.source_url, source_name: r.source_name, source_type: SOURCE_TYPE,
        }
        const res = await commitNewBanForBook(add, pg)
        if (res.created) attached++; else reused++
      } else {
        const input: CommitInput = {
          title: r.title,
          title_english_meaningful: r.title_english_meaningful ?? null,
          slug_override: slug,
          authors: r.authors,
          year: BAN_YEAR,
          first_published_year: r.publication_year ?? null,
          country_code: COUNTRY, scope_slug: SCOPE, action_type: 'banned',
          ban_status: 'historical', reason_slug: REASON, description_ban: null,
          inclusion_rationale: INCLUSION_RATIONALE,
          source_url: r.source_url, source_name: r.source_name, source_type: SOURCE_TYPE,
        }
        await commitParsedRow(input, pg)
        created++
      }
    }
  } finally {
    await pg.end()
  }

  console.log(`\n  ── ${APPLY ? 'DONE' : 'DRY-RUN'} ──`)
  if (APPLY) {
    console.log(`  books created : ${created}`)
    console.log(`  bans attached : ${attached} (to a book a prior run created)`)
    console.log(`  bans reused   : ${reused} (idempotent no-op)`)
  } else {
    console.log(`  would-create  : ${plans.length - preexistingFlags}`)
    console.log(`  pre-existing slug flags (would-attach): ${preexistingFlags}`)
    console.log(`\n  DRY-RUN — nothing written. Re-run with --apply to write.`)
    console.log(`  (On a first apply, pre-existing flags should be 0 — any flag = inspect before applying.)`)
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
