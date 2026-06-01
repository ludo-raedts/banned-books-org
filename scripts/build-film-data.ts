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
import { getStateCentroid, stateCodeFromRegion } from './lib/us-state-centroids'

const APPLY = process.argv.includes('--apply')

// US per-state spreading (Option B): events whose `region` resolves to a state are
// placed on that state's centroid and deduped per (book, country, state, year).
// `region = "Nation"` collapses to one national dot on the US country centroid.
// US events with no resolvable state (older Wikipedia/ALA/old-PEN aggregates) are
// DROPPED from the film layer — they have no place on a per-state map. Non-US
// countries are untouched (still deduped at country level).
const US_NATION_REGION = 'Nation'

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
  region: string | null
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

  // ── 3. Place each ban geographically, then dedup ────────────────────────────
  // Non-US → country centroid, key (book, country, year).
  // US + resolvable state → state centroid, key (book, US, state, year).
  // US + "Nation" → US country centroid, key (book, US, NATION, year), state null.
  // US + no state → dropped.
  type Placed = { ban: BanRow; key: string; lng: number; lat: number; state: string | null }
  const placedList: Placed[] = []
  let droppedUS = 0
  for (const b of kept) {
    if (b.country_code !== 'US') {
      const c = getCentroid(b.country_code)
      if (!c) continue // defensive: filtered to PoC codes already
      placedList.push({ ban: b, key: `${b.book_id}|${b.country_code}|${b.year_started}`, lng: c[0], lat: c[1], state: null })
      continue
    }
    // US
    const region = (b.region ?? '').trim()
    if (region === US_NATION_REGION) {
      const c = getCentroid('US')!
      placedList.push({ ban: b, key: `${b.book_id}|US|NATION|${b.year_started}`, lng: c[0], lat: c[1], state: null })
      continue
    }
    const code = stateCodeFromRegion(region)
    const c = code ? getStateCentroid(code) : null
    if (!code || !c) {
      droppedUS++ // older aggregates (no/unresolvable state) — not on a per-state map
      continue
    }
    placedList.push({ ban: b, key: `${b.book_id}|US|${code}|${b.year_started}`, lng: c[0], lat: c[1], state: code })
  }

  // Dedup per geo key; pick the representative scope (government > school > rest).
  const byKey = new Map<string, Placed>()
  for (const p of placedList) {
    const cur = byKey.get(p.key)
    if (!cur || better(p.ban, cur.ban, scopeById)) byKey.set(p.key, p)
  }
  const placed = [...byKey.values()]
  console.log(`  · dropped ${droppedUS} US events with no resolvable state (older aggregates)`)
  console.log(`  · ${placed.length} dots after geo-aware dedup (US per state, rest per country)`)

  // ── 4. Resolve joins for the kept rows only ────────────────────────────────
  const bookIds = unique(placed.map((p) => p.ban.book_id))
  const banIds = unique(placed.map((p) => p.ban.id))

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
    state: string | null // US: 2-letter state code; null = national US dot or non-US
    lng: number
    lat: number
    year: number
    reason_slug: string | null
    scope: string | null
    warning_level: string | null
  }

  const events: Event[] = []
  for (const p of placed) {
    const b = p.ban
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
      state: p.state,
      lng: p.lng,
      lat: p.lat,
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
    (a.state ?? '').localeCompare(b.state ?? '') ||
    (a.book_slug ?? '').localeCompare(b.book_slug ?? ''),
  )
  const pad = String(events.length).length // zero-pad width sized to the total
  events.forEach((e, i) => {
    e.id = `evt_${String(i + 1).padStart(Math.max(5, pad), '0')}`
  })

  // ── 6. Meta + payload ──────────────────────────────────────────────────────
  const years = events.map((e) => e.year)
  const countriesCovered = new Set(events.map((e) => e.country_code))
  const usStateDots = events.filter((e) => e.country_code === 'US' && e.state !== null)
  const usNationalDots = events.filter((e) => e.country_code === 'US' && e.state === null).length
  const statesCovered = new Set(usStateDots.map((e) => e.state)).size
  const payload = {
    generated_at: new Date().toISOString(),
    meta: {
      total_events: events.length,
      countries_covered: countriesCovered.size,
      year_range: [Math.min(...years), Math.max(...years)] as [number, number],
      us_state_dots: usStateDots.length,
      us_states_covered: statesCovered,
      us_national_dots: usNationalDots,
      us_dropped_no_state: droppedUS,
    },
    events,
  }

  // ── 7. Output ──────────────────────────────────────────────────────────────
  const perCountry = countByCountry(events)
  const perState = countByState(usStateDots)
  const report = () => {
    console.log('\nevents per country_code:')
    for (const [code, n] of perCountry) console.log(`  ${code}: ${n}`)
    console.log(`\nUS breakdown: ${usStateDots.length} state dots across ${statesCovered} states,` +
      ` ${usNationalDots} national dots, ${droppedUS} dropped (no resolvable state)`)
    console.log('top 10 US states (dots after dedup):')
    for (const [code, n] of perState.slice(0, 10)) console.log(`  ${code}: ${n}`)
  }
  if (!APPLY) {
    console.log('\n── DRY-RUN — nothing written ──')
    console.log('meta:', JSON.stringify(payload.meta))
    console.log('\nfirst 5 events:')
    for (const e of events.slice(0, 5)) console.log('  ', JSON.stringify(e))
    report()
    console.log('\nRe-run with --apply to write the file.')
  } else {
    await mkdir(OUT_DIR, { recursive: true })
    await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    report()
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
      .select('id, book_id, country_code, scope_id, year_started, region')
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

function countByState(events: { state: string | null }[]): [string, number][] {
  const m = new Map<string, number>()
  for (const e of events) if (e.state) m.set(e.state, (m.get(e.state) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
