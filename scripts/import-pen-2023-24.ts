/**
 * Import PEN America 2023-24 school book bans — per-district granularity.
 *
 * Forked from scripts/import-pen.ts (the 2024-25 importer). Differences:
 *   - CSV path → data/pen-2023-24.csv (10,048 rows, from PEN's Google Sheet)
 *   - Two-line preamble in the CSV before the real header → parseCSV skips it
 *   - Extra `Initiating Action` column → mapped to `bans.actor`
 *   - Source name/URL updated to 2023-2024
 *
 * Dedup against the May-20 2024-25 per-district bans and the May-3 aggregate
 * wave on source 190 is automatic via existingBans (loadDB pulls every
 * US-school ban regardless of source). The aggregate-level source-190 rows
 * for AY 2023-24 (1,149 of them) have `region=NULL` so they won't collide
 * with the new per-district rows — they'll be "shadowed" and can be
 * collapsed by a later --cleanup-aggregates pass.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-pen-2023-24.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-pen-2023-24.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/import-pen-2023-24.ts --apply --limit=50
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || Infinity
const CSV_PATH = join(process.cwd(), 'data/pen-2023-24.csv')

const SOURCE_NAME = 'PEN America Index of School Book Bans 2023-2024'
const SOURCE_URL  = 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/'

const BOOK_FUZZY_THRESHOLD = 0.7
const AUTHOR_FUZZY_THRESHOLD = 0.75
const AUTO_ACCEPT_AUTHOR_SIM = 0.95
const OL_DELAY_MS = 350

// Ban-status normalization: PEN's capitalisation drifts between years.
// 2024-25: "Banned", "Banned by Restriction", "Banned Pending Investigation",
//          "Banned - Professionally Weeded"
// 2023-24: "Banned", "Banned by restriction", "Banned pending investigation"
//          (no Professionally Weeded category)
// Normalise to lowercase before matching.
const SKIP_BAN_STATUSES_LC = new Set([
  'banned - professionally weeded',
])

const ACTION_TYPE_MAP_LC: Record<string, 'banned' | 'restricted'> = {
  'banned': 'banned',
  'banned by restriction': 'restricted',
  'banned pending investigation': 'restricted',
}

// Editorial overrides — start empty for 2023-24, populate after dry-run if needed.
const AMBIGUOUS_OVERRIDES: Map<string, number> = new Map([
  ['heartstopper 1', 1426],
])

const BAN_INSERT_BATCH = 100

// ── CSV parsing (RFC 4180-style, with preamble skip) ────────────────────────

function parseRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(current); current = '' }
      else current += ch
    }
  }
  fields.push(current)
  return fields
}

// 2023-24 Google-Sheets export has two decorative rows before the real header.
// Detect the header by looking for "Title" in column 0.
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r/g, '').split('\n')
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = parseRow(lines[i].replace(/^﻿/, ''))
    if (cells[0]?.trim() === 'Title') { headerIdx = i; break }
  }
  if (headerIdx === -1) throw new Error('parseCSV: could not locate header row (looking for "Title" in column 0)')
  const headers = parseRow(lines[headerIdx].replace(/^﻿/, ''))
  const out: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseRow(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = (values[j] ?? '').trim() })
    out.push(row)
  }
  return out
}

// ── Field helpers ───────────────────────────────────────────────────────────

function cleanTitle(title: string): string {
  return title.replace(/\s*\([A-Z]{2,4}\)\s*$/, '').replace(/\s+\([^)]*\)\s*$/, '').trim()
}

function formatAuthor(raw: string): string {
  if (!raw) return ''
  const idx = raw.indexOf(',')
  if (idx === -1) return raw.trim()
  return `${raw.slice(idx + 1).trim()} ${raw.slice(0, idx).trim()}`
}

function extractYear(s: string): number | null {
  if (/^\d{2}-\d{2}$/.test(s)) return 2000 + parseInt(s.split('-')[0])
  const m = s.match(/20\d{2}/g)
  return m && m.length ? Math.min(...m.map(Number)) : null
}

function guessGenres(title: string, author: string): string[] {
  const t = title.toLowerCase(); const a = author.toLowerCase()
  if (/memoir|diary|autobiography|my life|i am|boy|girl who/.test(t)) return ['memoir']
  if (/graphic novel|illustrated/.test(t)) return ['graphic-novel']
  if (/queer|transgender|gay|lesbian|bisexual|pride|lgbtq/.test(t)) return ['young-adult']
  if (/dragon|throne|court|kingdom|realm|crown|magic|fae|blood and/.test(t)) return ['fantasy']
  if (/dystopia|hunger|divergent|maze/.test(t)) return ['dystopian', 'young-adult']
  if (/murder|kill|dark|horror|dead|blood/.test(t)) return ['thriller']
  if (/history|war|slavery|civil rights|jim crow/.test(t)) return ['historical-fiction']
  if (/poems?|poetry|verse/.test(t)) return ['literary-fiction']
  if (/green|anderson|blume|hinton|crutcher|paulsen|lowry|pilkey|dahl|alexie/.test(a)) return ['young-adult']
  return ['literary-fiction']
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

interface OLResult { coverUrl: string | null; workId: string | null; publishYear: number | null }
async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!res.ok) return { coverUrl: null, workId: null, publishYear: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i           ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

// ── DB state ────────────────────────────────────────────────────────────────

const supabase = adminClient()

interface BookRow { id: number; slug: string; title: string }
interface AuthorRow { id: number; slug: string; display_name: string }

const bookBySlug   = new Map<string, BookRow>()
const bookById     = new Map<number, BookRow>()
const authorBySlug = new Map<string, AuthorRow>()
const authorById   = new Map<number, AuthorRow>()
const bookAuthors  = new Map<number, Set<number>>()
const existingBans = new Set<string>()

async function loadDB() {
  let offset = 0
  while (true) {
    const { data, error } = await supabase.from('books').select('id, slug, title').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as BookRow[]) { bookBySlug.set(b.slug, b); bookById.set(b.id, b) }
    if (data.length < 1000) break
    offset += 1000
  }

  offset = 0
  while (true) {
    const { data, error } = await supabase.from('authors').select('id, slug, display_name').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const a of data as AuthorRow[]) { authorBySlug.set(a.slug, a); authorById.set(a.id, a) }
    if (data.length < 1000) break
    offset += 1000
  }

  offset = 0
  while (true) {
    const { data, error } = await supabase.from('book_authors').select('book_id, author_id').order('book_id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const ba of data as { book_id: number; author_id: number }[]) {
      if (!bookAuthors.has(ba.book_id)) bookAuthors.set(ba.book_id, new Set())
      bookAuthors.get(ba.book_id)!.add(ba.author_id)
    }
    if (data.length < 1000) break
    offset += 1000
  }

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const schoolScopeId = scopes!.find(s => s.slug === 'school')!.id as number

  offset = 0
  while (true) {
    const { data, error } = await supabase.from('bans')
      .select('id, book_id, region, institution, year_started')
      .eq('country_code', 'US').eq('scope_id', schoolScopeId)
      .order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as { book_id: number; region: string | null; institution: string | null; year_started: number | null }[]) {
      existingBans.add(`${b.book_id}|${b.region ?? ''}|${b.institution ?? ''}|${b.year_started ?? ''}`)
    }
    if (data.length < 1000) break
    offset += 1000
  }

  return schoolScopeId
}

// ── Matching ────────────────────────────────────────────────────────────────

type BookMatch =
  | { kind: 'exact-slug'; book_id: number; matched_title: string }
  | { kind: 'fuzzy';      book_id: number; matched_title: string; score: number; author_score: number }
  | { kind: 'ambiguous';  candidates: Array<{ id: number; title: string; score: number; author_score: number }> }
  | { kind: 'new' }

function authorMatches(linkedAuthorIds: Set<number>, target: string): number {
  const targetSlug = slugify(target)
  const targetLower = target.toLowerCase()
  let best = 0
  for (const aid of linkedAuthorIds) {
    const a = authorById.get(aid)
    if (!a) continue
    if (a.slug === targetSlug) return 1.0
    const aLower = a.display_name.toLowerCase()
    if (aLower.includes(targetLower) || targetLower.includes(aLower)) best = Math.max(best, 0.9)
  }
  return best
}

function stripSubtitle(title: string): string {
  return title.replace(/[:;].*$/, '').trim()
}

async function matchBook(title: string, author: string): Promise<BookMatch> {
  const overrideId = AMBIGUOUS_OVERRIDES.get(title.toLowerCase())
  if (overrideId !== undefined) {
    const b = bookById.get(overrideId)
    if (b) return { kind: 'exact-slug', book_id: b.id, matched_title: b.title }
  }

  const slug = slugify(title)
  const exact = bookBySlug.get(slug)
  if (exact) return { kind: 'exact-slug', book_id: exact.id, matched_title: exact.title }

  const stripped = stripSubtitle(title)
  if (stripped !== title) {
    const sExact = bookBySlug.get(slugify(stripped))
    if (sExact) {
      const linked = bookAuthors.get(sExact.id) ?? new Set<number>()
      if (authorMatches(linked, author) >= AUTHOR_FUZZY_THRESHOLD) {
        return { kind: 'exact-slug', book_id: sExact.id, matched_title: sExact.title }
      }
    }
  }

  const { data: candidates, error } = await supabase.rpc('find_book_candidates_by_title', {
    q: title,
    threshold: BOOK_FUZZY_THRESHOLD,
  })
  if (error) throw error
  if (!candidates || candidates.length === 0) return { kind: 'new' }

  type Scored = { id: number; title: string; score: number; author_score: number }
  const passing: Scored[] = []
  for (const c of candidates as Array<{ id: number; title: string; score: number }>) {
    const linkedAuthorIds = bookAuthors.get(c.id) ?? new Set<number>()
    const authorScore = authorMatches(linkedAuthorIds, author)
    if (authorScore >= AUTHOR_FUZZY_THRESHOLD) {
      passing.push({ id: c.id, title: c.title, score: c.score, author_score: authorScore })
    }
  }

  if (passing.length === 0) return { kind: 'new' }
  if (passing.length === 1) {
    const p = passing[0]
    return { kind: 'fuzzy', book_id: p.id, matched_title: p.title, score: p.score, author_score: p.author_score }
  }

  passing.sort((a, b) => b.score - a.score)
  if (passing[0].score >= 0.95 && passing[1].score < 0.85) {
    const p = passing[0]
    return { kind: 'fuzzy', book_id: p.id, matched_title: p.title, score: p.score, author_score: p.author_score }
  }
  return { kind: 'ambiguous', candidates: passing }
}

async function findOrCreateAuthor(displayName: string): Promise<number | null> {
  if (!displayName) return null
  const slug = slugify(displayName)
  const exact = authorBySlug.get(slug)
  if (exact) return exact.id

  const { data: cands } = await supabase.rpc('find_author_candidates_by_name', {
    q: displayName,
    threshold: AUTHOR_FUZZY_THRESHOLD,
  })
  if (cands && cands.length > 0) {
    const best = cands[0] as { id: number; display_name: string; score: number }
    if (best.score >= AUTO_ACCEPT_AUTHOR_SIM) return best.id
  }

  if (!APPLY) return null

  const { data: newAuthor, error } = await supabase.from('authors').insert({
    slug, display_name: displayName, is_placeholder: false,
  }).select('id, slug, display_name').single()
  if (error) {
    const { data: ex } = await supabase.from('authors').select('id, slug, display_name').eq('slug', slug).single()
    if (ex) { authorBySlug.set(ex.slug, ex as AuthorRow); return (ex as AuthorRow).id }
    return null
  }
  authorBySlug.set(slug, newAuthor as AuthorRow)
  authorById.set((newAuthor as AuthorRow).id, newAuthor as AuthorRow)
  return (newAuthor as AuthorRow).id
}

// ── Event model ─────────────────────────────────────────────────────────────

interface Event {
  rawTitle: string
  title: string
  author: string
  series: string | null
  state: string
  district: string | null
  year: number | null
  banStatus: string
  actionType: 'banned' | 'restricted'
  actor: string | null   // 2023-24's "Initiating Action" column
}

function buildEvents(rows: Record<string, string>[]): { events: Event[]; skipped: number; unmappedStatuses: Map<string, number> } {
  const events: Event[] = []
  let skipped = 0
  const unmapped = new Map<string, number>()
  for (const r of rows) {
    const banStatus = r['Ban Status']
    const banStatusLc = banStatus.toLowerCase().trim()
    if (SKIP_BAN_STATUSES_LC.has(banStatusLc)) { skipped++; continue }
    const actionType = ACTION_TYPE_MAP_LC[banStatusLc]
    if (!actionType) {
      unmapped.set(banStatus, (unmapped.get(banStatus) ?? 0) + 1)
      continue
    }
    const district = r['District'] && r['District'].trim() ? r['District'].trim() : null
    const actor = r['Initiating Action'] && r['Initiating Action'].trim() ? r['Initiating Action'].trim() : null
    // 2023-24 uses "Series Name" header (cf 2024-25's "Series"); accept both.
    const seriesRaw = r['Series Name'] || r['Series'] || ''
    events.push({
      rawTitle: r['Title'],
      title: cleanTitle(r['Title']),
      author: formatAuthor(r['Author']),
      series: seriesRaw.trim() ? seriesRaw.trim() : null,
      state: r['State'],
      district,
      year: extractYear(r['Date of Challenge/Removal']),
      banStatus,
      actionType,
      actor,
    })
  }
  return { events, skipped, unmappedStatuses: unmapped }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── import-pen 2023-24 ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const raw = parseCSV(readFileSync(CSV_PATH, 'utf-8'))
  console.log(`CSV rows:                  ${raw.length}`)

  const { events, skipped, unmappedStatuses } = buildEvents(raw)
  console.log(`After skip-weeded:         ${events.length}  (${skipped} 'Professionally Weeded' skipped)`)
  if (unmappedStatuses.size) {
    console.log('  Unmapped ban statuses (rows skipped):')
    for (const [s, n] of unmappedStatuses) console.log(`    "${s}": ${n}`)
  }

  console.log(`\nLoading DB state...`)
  const schoolScopeId = await loadDB()
  console.log(`  books in DB:             ${bookBySlug.size}`)
  console.log(`  authors in DB:           ${authorBySlug.size}`)
  console.log(`  US-school bans already:  ${existingBans.size}`)

  console.log(`\nMatching events to books (fuzzy via pg_trgm where exact misses)...`)
  type MatchedEvent = { event: Event; book_id: number; kind: 'exact-slug' | 'fuzzy'; score?: number; author_score?: number; matched_title?: string }
  type AmbiguousEvent = { event: Event; candidates: Array<{ id: number; title: string; score: number; author_score: number }> }
  const matched: MatchedEvent[] = []
  const ambiguous: AmbiguousEvent[] = []
  const newBooksByKey = new Map<string, { sample: Event; events: Event[] }>()

  let progress = 0
  for (const ev of events) {
    progress++
    if (progress % 500 === 0) console.log(`  ...${progress}/${events.length}`)
    const res = await matchBook(ev.title, ev.author)
    if (res.kind === 'exact-slug' || res.kind === 'fuzzy') {
      matched.push({
        event: ev, book_id: res.book_id, kind: res.kind,
        matched_title: res.matched_title,
        score: res.kind === 'fuzzy' ? res.score : undefined,
        author_score: res.kind === 'fuzzy' ? res.author_score : undefined,
      })
    } else if (res.kind === 'ambiguous') {
      ambiguous.push({ event: ev, candidates: res.candidates })
    } else {
      const key = `${slugify(ev.title)}|${slugify(ev.author)}`
      if (!newBooksByKey.has(key)) newBooksByKey.set(key, { sample: ev, events: [] })
      newBooksByKey.get(key)!.events.push(ev)
    }
  }

  const banInsertions: MatchedEvent[] = []
  const banSkips: MatchedEvent[] = []
  for (const m of matched) {
    const key = `${m.book_id}|${m.event.state}|${m.event.district ?? ''}|${m.event.year ?? ''}`
    if (existingBans.has(key)) banSkips.push(m)
    else banInsertions.push(m)
  }

  const exactCount = matched.filter(m => m.kind === 'exact-slug').length
  const fuzzyCount = matched.filter(m => m.kind === 'fuzzy').length
  const newEventsTotal = [...newBooksByKey.values()].reduce((n, g) => n + g.events.length, 0)

  console.log(`\n── Book-matching summary ─────`)
  console.log(`  exact-slug matched:      ${exactCount}`)
  console.log(`  fuzzy matched:           ${fuzzyCount}`)
  console.log(`  ambiguous (need review): ${ambiguous.length}`)
  console.log(`  new books:               ${newBooksByKey.size}  (across ${newEventsTotal} events)`)

  console.log(`\n── Ban-event summary ─────────`)
  console.log(`  to insert (new ban):     ${banInsertions.length}`)
  console.log(`  skip (ban already in DB):${banSkips.length}`)
  console.log(`  to insert (new books):   ${newEventsTotal}`)
  console.log(`  TOTAL new bans:          ${banInsertions.length + newEventsTotal}`)

  // Initiating-Action distribution
  const actorCounts = new Map<string, number>()
  for (const ev of events) {
    const k = ev.actor ?? '(none)'
    actorCounts.set(k, (actorCounts.get(k) ?? 0) + 1)
  }
  console.log(`\n── Initiating Action distribution ─`)
  for (const [k, n] of [...actorCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${k}`)
  }

  console.log(`\n── Sample fuzzy matches (first 20) ─`)
  for (const m of matched.filter(m => m.kind === 'fuzzy').slice(0, 20)) {
    console.log(`  ${(m.score ?? 0).toFixed(2)}  "${m.event.title}" by "${m.event.author}"`)
    console.log(`        → matched: "${m.matched_title}"  [book_id=${m.book_id}, author_sim=${(m.author_score ?? 0).toFixed(2)}]`)
  }

  if (ambiguous.length) {
    console.log(`\n── Ambiguous (first 20) — needs human review ─`)
    for (const a of ambiguous.slice(0, 20)) {
      console.log(`  "${a.event.title}" by "${a.event.author}":`)
      for (const c of a.candidates) console.log(`    title=${c.score.toFixed(2)} author=${c.author_score.toFixed(2)}  "${c.title}"  (book_id=${c.id})`)
    }
  }

  console.log(`\n── Sample new books (first 20, sorted by event-count desc) ─`)
  const newSorted = [...newBooksByKey.values()].sort((a, b) => b.events.length - a.events.length)
  for (const g of newSorted.slice(0, 20)) {
    console.log(`  [${g.events.length}x events]  "${g.sample.title}" by "${g.sample.author}"`)
  }

  const unparsedYears = events.filter(e => e.year === null).length
  if (unparsedYears) console.log(`\n⚠ ${unparsedYears} events with unparseable year (will use NULL year_started).`)

  const nationCount = events.filter(e => e.state === 'Nation').length
  if (nationCount) console.log(`ℹ ${nationCount} 'Nation' (statewide/federal) events — region='Nation', institution=NULL.`)

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply to insert. ──\n`)
    return
  }

  // ── APPLY MODE ───────────────────────────────────────────────────────────

  console.log(`\n── Applying writes ──`)

  const { data: source, error: srcErr } = await supabase
    .from('ban_sources')
    .upsert({ source_name: SOURCE_NAME, source_url: SOURCE_URL, source_type: 'web', verification_status: 'unverified' as const },
            { onConflict: 'source_url' })
    .select('id').single()
  if (srcErr) throw srcErr
  const sourceId = (source as { id: number }).id

  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonOtherId = reasons!.find((r: { slug: string }) => r.slug === 'other')?.id as number | undefined

  let createdBooks = 0, createdAuthors = 0, createdBans = 0, bookErrors = 0, banErrors = 0

  console.log(`\nPhase A: creating ${newBooksByKey.size} new books (with OpenLibrary lookup)...`)
  const newBookEvents: Array<{ book_id: number; events: Event[] }> = []
  for (const g of newSorted) {
    const ev = g.sample
    try {
      const slug = slugify(ev.title)
      let bookId = bookBySlug.get(slug)?.id

      if (!bookId) {
        const ol = await fetchOL(ev.title, ev.author)
        await sleep(OL_DELAY_MS)
        const authorSlugBefore = slugify(ev.author)
        const hadAuthor = authorBySlug.has(authorSlugBefore)
        const authorId = await findOrCreateAuthor(ev.author)
        if (authorId && !hadAuthor) createdAuthors++

        const { data: newBook, error: be } = await supabase.from('books').insert({
          title: ev.title,
          slug,
          original_language: 'en',
          first_published_year: ol.publishYear ?? ev.year ?? null,
          ai_drafted: false,
          genres: guessGenres(ev.title, ev.author),
          cover_url: ol.coverUrl,
          openlibrary_work_id: ol.workId,
        }).select('id, slug, title').single()
        if (be) throw be
        bookId = (newBook as BookRow).id
        bookBySlug.set(slug, newBook as BookRow)
        bookById.set(bookId, newBook as BookRow)
        createdBooks++
        process.stdout.write(`  + book ${bookId}: "${ev.title}" by "${ev.author}" (${g.events.length}x events)\n`)

        if (authorId) {
          await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
          const set = bookAuthors.get(bookId) ?? new Set<number>()
          set.add(authorId); bookAuthors.set(bookId, set)
        }
      }

      newBookEvents.push({ book_id: bookId, events: g.events })
    } catch (err) {
      bookErrors++
      console.error(`  ! book "${ev.title}": ${fmtErr(err)}`)
    }
  }

  type BanPrep = { book_id: number; event: Event }
  const prep: BanPrep[] = []
  for (const m of banInsertions) prep.push({ book_id: m.book_id, event: m.event })
  for (const g of newBookEvents) for (const e of g.events) prep.push({ book_id: g.book_id, event: e })

  const final: BanPrep[] = []
  for (const p of prep) {
    const key = `${p.book_id}|${p.event.state}|${p.event.district ?? ''}|${p.event.year ?? ''}`
    if (existingBans.has(key)) continue
    existingBans.add(key)
    final.push(p)
  }

  const target = Math.min(final.length, LIMIT)
  console.log(`\nPhase B: ${final.length} unique bans to insert${LIMIT < Infinity ? ` (capping at ${target} due to --limit)` : ''}.`)

  console.log(`\nPhase C: batching at ${BAN_INSERT_BATCH} per request.`)
  for (let i = 0; i < target; i += BAN_INSERT_BATCH) {
    const chunk = final.slice(i, Math.min(i + BAN_INSERT_BATCH, target))
    const banRows = chunk.map(p => ({
      book_id: p.book_id,
      country_code: 'US',
      scope_id: schoolScopeId,
      action_type: p.event.actionType,
      status: 'active',
      region: p.event.state,
      institution: p.event.district,
      year_started: p.event.year,
      actor: p.event.actor,
      confidence: 'reported' as const,
    }))
    try {
      const { data: inserted, error } = await supabase.from('bans').insert(banRows).select('id')
      if (error) throw error
      const ids = (inserted as Array<{ id: number }>).map(r => r.id)

      const linkRows = ids.map(id => ({ ban_id: id, source_id: sourceId }))
      const { error: linkErr } = await supabase.from('ban_source_links').insert(linkRows)
      if (linkErr) throw linkErr

      if (reasonOtherId !== undefined) {
        const reasonRows = ids.map(id => ({ ban_id: id, reason_id: reasonOtherId }))
        const { error: reasonErr } = await supabase.from('ban_reason_links').insert(reasonRows)
        if (reasonErr) throw reasonErr
      }

      createdBans += ids.length
      process.stdout.write(`  bans ${i + ids.length}/${target}\r`)
    } catch (err) {
      banErrors += chunk.length
      console.error(`\n  ! batch ${i}-${i + chunk.length}: ${fmtErr(err)}`)
    }
  }
  process.stdout.write('\n')

  console.log(`\n── Done ──`)
  console.log(`  books created:    ${createdBooks}  (errors: ${bookErrors})`)
  console.log(`  authors created:  ${createdAuthors}`)
  console.log(`  bans created:     ${createdBans}  (errors: ${banErrors})`)
}

main().catch(err => { console.error(err); process.exit(1) })
