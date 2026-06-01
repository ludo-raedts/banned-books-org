#!/usr/bin/env tsx
/**
 * Build the events layer for the animated-world-map film PoC.
 *
 * Read-only export. Pulls ban events for the eleven PoC countries, joins in the
 * presentation centroids from scripts/lib/country-centroids.ts, and writes a flat
 * `data/film/film-data.json` — one map-dot per (book, country, year).
 *
 * This script NEVER writes to the database and makes NO schema changes.
 *
 * Run (dry-run, default — prints meta + sample, writes nothing):
 *   pnpm tsx --env-file=.env.local scripts/build-film-data.ts
 * Run (writes the file):
 *   pnpm tsx --env-file=.env.local scripts/build-film-data.ts --apply
 *
 * Idempotent: same DB state + same code ⇒ byte-identical events array (the only
 * varying field is `generated_at`). Event ordering is deterministic (sorted by
 * year, then country_code, then book_slug) so the evt_ numbering is stable.
 */

import { adminClient } from '../src/lib/supabase'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { POC_COUNTRY_CODES, getCentroid } from './lib/country-centroids'

const APPLY = process.argv.includes('--apply')

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'data', 'film')
const OUT_FILE = join(OUT_DIR, 'film-data.json')

// Earliest year we trust. Guards against the IT year-8 data error (a single ban
// row with year_started = 8); fixing that row is out of PoC scope.
const MIN_YEAR = 1450

// Liste-Otto exclusion. The dataset holds 909 FR events with year_started = 1940:
// the "Liste Otto", books banned by the GERMAN OCCUPIER in occupied France. They
// are Nazi victims, not French state censorship, so showing them as a French
// censorship spike would invert the history. For the PoC we drop ALL French events
// before 1945. (See scripts/lib/country-centroids.ts header for the same caveat.)
const FR_MIN_YEAR = 1945

// Representative-scope priority for dedup. A single map-dot stands for a
// (book, country, year) tuple regardless of scope, so when a tuple has several
// scopes we keep one: government first (the most consequential / national action),
// then school, then whatever remains (lowest scope_id as a stable tiebreaker).
const SCOPE_PRIORITY: Record<string, number> = { government: 0, school: 1 }
function scopeRank(slug: string | undefined): number {
  if (slug && slug in SCOPE_PRIORITY) return SCOPE_PRIORITY[slug]
  return 100 // "the rest" — ordered after government/school, tiebroken by scope_id
}

type BanRow = {
  id: number
  book_id: number
  country_code: string
  scope_id: number
  year_started: number | null
}

async function main() {
  const startedAt = Date.now()
  const supabase = adminClient()

  console.log(`▸ build-film-data (${APPLY ? 'APPLY' : 'DRY-RUN'})`)
  console.log(`  · PoC countries: ${POC_COUNTRY_CODES.join(', ')}`)

  // ── 1. Scopes lookup (small table, fetch all) ──────────────────────────────
  const { data: scopeRows, error: scopeErr } = await supabase
    .from('scopes')
    .select('id, slug, label_en')
  if (scopeErr) throw new Error(`scopes: ${scopeErr.message}`)
  const scopeById = new Map<number, { slug: string; label_en: string }>()
  for (const s of scopeRows ?? []) {
    scopeById.set(Number(s.id), { slug: String(s.slug), label_en: String(s.label_en) })
  }

  // ── 2. Filtered bans ───────────────────────────────────────────────────────
  // Server-side: PoC countries + year_started >= MIN_YEAR. The FR<1945 cut is
  // applied client-side below (a single conditional is clearer than an OR query).
  const bans = await fetchBans(supabase)
  console.log(`  · fetched ${bans.length} bans (PoC countries, year >= ${MIN_YEAR})`)

  const kept = bans.filter((b) => {
    if (b.year_started == null) return false
    if (b.country_code === 'FR' && b.year_started < FR_MIN_YEAR) return false // Liste Otto
    return true
  })
  const frDropped = bans.length - kept.length
  console.log(`  · dropped ${frDropped} FR pre-${FR_MIN_YEAR} (Liste Otto) + null-year rows`)

  // ── 3. Dedup on (book_id, country_code, year_started); pick representative scope
  const byTuple = new Map<string, BanRow>()
  for (const b of kept) {
    const key = `${b.book_id}|${b.country_code}|${b.year_started}`
    const cur = byTuple.get(key)
    if (!cur) {
      byTuple.set(key, b)
      continue
    }
    if (better(b, cur, scopeById)) byTuple.set(key, b)
  }
  const deduped = [...byTuple.values()]
  console.log(`  · ${deduped.length} distinct (book, country, year) tuples after dedup`)

  // ── 4. Resolve joins for the kept rows only ────────────────────────────────
  const bookIds = unique(deduped.map((b) => b.book_id))
  const banIds = unique(deduped.map((b) => b.id))

  const books = await fetchByIds(
    supabase, 'books', 'id, slug, title, warning_level', 'id', bookIds,
  )
  const bookById = new Map<number, Record<string, unknown>>()
  for (const b of books) bookById.set(Number(b.id), b)

  // First author per book = lowest author_id (deterministic; book_authors has no
  // explicit ordering column). Null-safe when a book has no author link.
  const bookAuthors = await fetchByIds(
    supabase, 'book_authors', 'book_id, author_id', 'book_id', bookIds,
  )
  const firstAuthorIdByBook = new Map<number, number>()
  for (const ba of bookAuthors) {
    const bid = Number(ba.book_id)
    const aid = Number(ba.author_id)
    const cur = firstAuthorIdByBook.get(bid)
    if (cur === undefined || aid < cur) firstAuthorIdByBook.set(bid, aid)
  }
  const authorIds = unique([...firstAuthorIdByBook.values()])
  const authors = await fetchByIds(
    supabase, 'authors', 'id, display_name', 'id', authorIds,
  )
  const authorNameById = new Map<number, string>()
  for (const a of authors) authorNameById.set(Number(a.id), String(a.display_name))

  // First reason per ban = lowest reason_id (deterministic). Null when none.
  const reasonLinks = await fetchByIds(
    supabase, 'ban_reason_links', 'ban_id, reason_id', 'ban_id', banIds,
  )
  const firstReasonIdByBan = new Map<number, number>()
  for (const l of reasonLinks) {
    const ban = Number(l.ban_id)
    const rid = Number(l.reason_id)
    const cur = firstReasonIdByBan.get(ban)
    if (cur === undefined || rid < cur) firstReasonIdByBan.set(ban, rid)
  }
  const reasonIds = unique([...firstReasonIdByBan.values()])
  const reasons = await fetchByIds(
    supabase, 'reasons', 'id, slug', 'id', reasonIds,
  )
  const reasonSlugById = new Map<number, string>()
  for (const r of reasons) reasonSlugById.set(Number(r.id), String(r.slug))

  // ── 5. Assemble events ─────────────────────────────────────────────────────
  type Event = {
    id: string
    book_slug: string | null
    title: string | null
    author: string | null
    country_code: string
    lng: number
    lat: number
    year: number
    reason_slug: string | null
    scope: string | null
    warning_level: string | null
  }

  const events: Event[] = []
  for (const b of deduped) {
    const centroid = getCentroid(b.country_code)
    if (!centroid) continue // defensive: should never happen, we filter on PoC codes
    const book = bookById.get(b.book_id)
    const authorId = firstAuthorIdByBook.get(b.book_id)
    const reasonId = firstReasonIdByBan.get(b.id)
    const scope = scopeById.get(b.scope_id)
    events.push({
      id: '', // assigned after sort
      book_slug: book ? (book.slug as string) : null,
      title: book ? (book.title as string) : null,
      author: authorId !== undefined ? (authorNameById.get(authorId) ?? null) : null,
      country_code: b.country_code,
      lng: centroid[0],
      lat: centroid[1],
      year: b.year_started as number,
      reason_slug: reasonId !== undefined ? (reasonSlugById.get(reasonId) ?? null) : null,
      scope: scope ? scope.slug : null,
      warning_level: book ? ((book.warning_level as string) ?? null) : null,
    })
  }

  // Deterministic ordering ⇒ stable evt_ numbering across runs.
  events.sort((a, b) =>
    a.year - b.year ||
    a.country_code.localeCompare(b.country_code) ||
    (a.book_slug ?? '').localeCompare(b.book_slug ?? ''),
  )
  const pad = String(events.length).length // zero-pad width sized to the total
  events.forEach((e, i) => {
    e.id = `evt_${String(i + 1).padStart(Math.max(5, pad), '0')}`
  })

  // ── 6. Meta + payload ──────────────────────────────────────────────────────
  const years = events.map((e) => e.year)
  const countriesCovered = new Set(events.map((e) => e.country_code))
  const payload = {
    generated_at: new Date().toISOString(),
    meta: {
      total_events: events.length,
      countries_covered: countriesCovered.size,
      year_range: [Math.min(...years), Math.max(...years)] as [number, number],
    },
    events,
  }

  // ── 7. Output ──────────────────────────────────────────────────────────────
  const perCountry = countByCountry(events)
  if (!APPLY) {
    console.log('\n── DRY-RUN — nothing written ──')
    console.log('meta:', JSON.stringify(payload.meta))
    console.log('\nfirst 5 events:')
    for (const e of events.slice(0, 5)) console.log('  ', JSON.stringify(e))
    console.log('\nevents per country_code:')
    for (const [code, n] of perCountry) console.log(`  ${code}: ${n}`)
    console.log('\nRe-run with --apply to write the file.')
  } else {
    await mkdir(OUT_DIR, { recursive: true })
    await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log('\nevents per country_code:')
    for (const [code, n] of perCountry) console.log(`  ${code}: ${n}`)
    console.log(`\n✓ Wrote ${OUT_FILE} — ${events.length} events`)
  }

  console.log(`(${((Date.now() - startedAt) / 1000).toFixed(1)}s)`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function better(
  a: BanRow,
  b: BanRow,
  scopeById: Map<number, { slug: string }>,
): boolean {
  const ra = scopeRank(scopeById.get(a.scope_id)?.slug)
  const rb = scopeRank(scopeById.get(b.scope_id)?.slug)
  if (ra !== rb) return ra < rb
  return a.scope_id < b.scope_id // stable tiebreak among "the rest"
}

async function fetchBans(supabase: ReturnType<typeof adminClient>): Promise<BanRow[]> {
  const PAGE = 1000
  const rows: BanRow[] = []
  for (let from = 0; ; from += PAGE) {
    // Stable .order() is required for paginated .range() reads (see memory:
    // supabase-pagination) — without it rows can repeat across pages.
    const { data, error } = await supabase
      .from('bans')
      .select('id, book_id, country_code, scope_id, year_started')
      .in('country_code', POC_COUNTRY_CODES as unknown as string[])
      .gte('year_started', MIN_YEAR)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`bans: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as BanRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

/** Fetch rows whose `keyCol` is in `ids`, chunked to stay under URL limits. */
async function fetchByIds(
  supabase: ReturnType<typeof adminClient>,
  table: string,
  columns: string,
  keyCol: string,
  ids: number[],
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const CHUNK = 500
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in(keyCol, slice)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as Record<string, unknown>[]))
  }
  return rows
}

function unique(nums: number[]): number[] {
  return [...new Set(nums)]
}

function countByCountry(events: { country_code: string }[]): [string, number][] {
  const m = new Map<string, number>()
  for (const e of events) m.set(e.country_code, (m.get(e.country_code) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
