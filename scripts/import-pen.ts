/**
 * Import PEN America 2024-25 school book bans — per-district granularity.
 *
 * Each CSV row becomes ONE `bans` row keyed on (book × state × district × year).
 * Books and authors are matched against existing entries via exact-slug, then
 * pg_trgm fuzzy match for the long tail of spelling variations. New books are
 * created with an OpenLibrary lookup for cover + publish year.
 *
 * Pre-existing 552 PEN-seeded books (commit 239342c, Apr 2026) have NULL
 * region/institution and a different natural key — they're left untouched by
 * this import. A separate `--cleanup-aggregates` pass can collapse them later
 * once the granular data has been editor-reviewed.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-pen.ts                 # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-pen.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/import-pen.ts --apply --limit=50
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || Infinity
const CSV_PATH = join(process.cwd(), 'data/pen-2024-25.csv')

const SOURCE_NAME = 'PEN America Index of School Book Bans 2024-2025'
const SOURCE_URL  = 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-2024-2025/'

const BOOK_FUZZY_THRESHOLD = 0.7    // pg_trgm similarity for title fallback
const AUTHOR_FUZZY_THRESHOLD = 0.75
const AUTO_ACCEPT_AUTHOR_SIM = 0.95 // auto-accept above this without manual review
const OL_DELAY_MS = 350

// PEN's "Professionally Weeded" is routine library curation, not an ideological ban.
const SKIP_BAN_STATUSES = new Set(['Banned - Professionally Weeded'])

const ACTION_TYPE_MAP: Record<string, 'banned' | 'restricted'> = {
  'Banned': 'banned',
  'Banned by Restriction': 'restricted',
  'Banned Pending Investigation': 'restricted',
}

// Editorial overrides for the 1 case the fuzzy matcher couldn't pick uniquely.
// Key: PEN's CSV Title (lowercased). Value: DB book_id.
const AMBIGUOUS_OVERRIDES: Map<string, number> = new Map([
  ['heartstopper 1', 1426],  // → "Heartstopper, Vol. 1" (not the series anchor "Heartstopper")
])

const BAN_INSERT_BATCH = 100

// ── CSV parsing (RFC 4180-style) ────────────────────────────────────────────

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

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r/g, '').split('\n')
  const headers = parseRow(lines[0].replace(/^﻿/, ''))
  const out: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseRow(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = (values[j] ?? '').trim() })
    out.push(row)
  }
  return out
}

// ── Field helpers ───────────────────────────────────────────────────────────

// Strip PEN's author-initial disambiguator: "Burned (EH)" → "Burned".
// Title-case parentheticals like "Melissa (George)" are alternate-title hints
// from PEN — we keep the parent title and ignore the parenthetical for matching.
function cleanTitle(title: string): string {
  return title.replace(/\s*\([A-Z]{2,4}\)\s*$/, '').replace(/\s+\([^)]*\)\s*$/, '').trim()
}

// "Picoult, Jodi" → "Jodi Picoult". Pass through anything without a comma.
function formatAuthor(raw: string): string {
  if (!raw) return ''
  const idx = raw.indexOf(',')
  if (idx === -1) return raw.trim()
  return `${raw.slice(idx + 1).trim()} ${raw.slice(0, idx).trim()}`
}

// Earliest 4-digit year in the date string. Handles month-year, AY-range, and "24-25".
function extractYear(s: string): number | null {
  if (/^\d{2}-\d{2}$/.test(s)) return 2000 + parseInt(s.split('-')[0])
  const m = s.match(/20\d{2}/g)
  return m && m.length ? Math.min(...m.map(Number)) : null
}

// Lightweight genre heuristic, mirrors the April seed.
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

// Supabase's PostgrestError isn't an instance of Error, so the usual
// `err instanceof Error ? err.message : String(err)` falls through to
// "[object Object]". This formatter pulls out the meaningful fields.
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

// ── DB state (loaded once at startup) ───────────────────────────────────────

const supabase = adminClient()

interface BookRow { id: number; slug: string; title: string }
interface AuthorRow { id: number; slug: string; display_name: string }

const bookBySlug   = new Map<string, BookRow>()
const bookById     = new Map<number, BookRow>()
const authorBySlug = new Map<string, AuthorRow>()
// book_authors join cache: book_id → set of author_ids
const bookAuthors  = new Map<number, Set<number>>()
// Existing US-school bans, keyed `${book_id}|${region}|${institution}|${year}`
const existingBans = new Set<string>()

async function loadDB() {
  // Books
  let offset = 0
  while (true) {
    const { data, error } = await supabase.from('books').select('id, slug, title').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as BookRow[]) { bookBySlug.set(b.slug, b); bookById.set(b.id, b) }
    if (data.length < 1000) break
    offset += 1000
  }

  // Authors
  offset = 0
  while (true) {
    const { data, error } = await supabase.from('authors').select('id, slug, display_name').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const a of data as AuthorRow[]) { authorBySlug.set(a.slug, a); authorById.set(a.id, a) }
    if (data.length < 1000) break
    offset += 1000
  }

  // book_authors
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

  // school scope id
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const schoolScopeId = scopes!.find(s => s.slug === 'school')!.id as number

  // Existing US-school bans, for dedup
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

// Index of authors by id for O(1) lookup during fuzzy author cross-check.
// Built once after loadDB() — avoids the [...authorBySlug.values()].find() scan
// that turned the matchBook loop O(N×M).
const authorById = new Map<number, AuthorRow>()

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

// PEN titles often carry a subtitle DB rows don't ("Fun Home: A Family Tragicomic"
// vs "Fun Home"), or vice versa. Strip on `:` / `;` for a second exact-slug attempt.
function stripSubtitle(title: string): string {
  return title.replace(/[:;].*$/, '').trim()
}

async function matchBook(title: string, author: string): Promise<BookMatch> {
  // Try 0: editorial override.
  const overrideId = AMBIGUOUS_OVERRIDES.get(title.toLowerCase())
  if (overrideId !== undefined) {
    const b = bookById.get(overrideId)
    if (b) return { kind: 'exact-slug', book_id: b.id, matched_title: b.title }
  }

  // Try 1: exact slug on the full title.
  const slug = slugify(title)
  const exact = bookBySlug.get(slug)
  if (exact) return { kind: 'exact-slug', book_id: exact.id, matched_title: exact.title }

  // Try 2: exact slug on subtitle-stripped title (with author cross-check).
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

  // Try 3: pg_trgm fuzzy via RPC on the full title.
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

  // Multiple passing — but if there's a clear title-score winner (top ≥ 0.95
  // AND runner-up < 0.85), it's not ambiguous. This catches the
  // "graphic-novel adaptation" pattern where the bare title scores 1.00 against
  // its exact DB row and 0.70 against the adaptation.
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

  // Fuzzy via RPC. Auto-accept high-confidence matches; otherwise create new.
  const { data: cands } = await supabase.rpc('find_author_candidates_by_name', {
    q: displayName,
    threshold: AUTHOR_FUZZY_THRESHOLD,
  })
  if (cands && cands.length > 0) {
    const best = cands[0] as { id: number; display_name: string; score: number }
    if (best.score >= AUTO_ACCEPT_AUTHOR_SIM) return best.id
  }

  if (!APPLY) return null  // dry-run: signal "would create"

  const { data: newAuthor, error } = await supabase.from('authors').insert({
    slug, display_name: displayName, is_placeholder: false,
  }).select('id, slug, display_name').single()
  if (error) {
    // Race: a concurrent run created the same author. Re-query.
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
}

function buildEvents(rows: Record<string, string>[]): { events: Event[]; skipped: number; unmappedStatuses: Map<string, number> } {
  const events: Event[] = []
  let skipped = 0
  const unmapped = new Map<string, number>()
  for (const r of rows) {
    const banStatus = r['Ban Status']
    if (SKIP_BAN_STATUSES.has(banStatus)) { skipped++; continue }
    const actionType = ACTION_TYPE_MAP[banStatus]
    if (!actionType) {
      unmapped.set(banStatus, (unmapped.get(banStatus) ?? 0) + 1)
      continue
    }
    const district = r['District'] && r['District'].trim() ? r['District'].trim() : null
    events.push({
      rawTitle: r['Title'],
      title: cleanTitle(r['Title']),
      author: formatAuthor(r['Author']),
      series: r['Series'] && r['Series'].trim() ? r['Series'].trim() : null,
      state: r['State'],
      district,
      year: extractYear(r['Date of Challenge/Removal']),
      banStatus,
      actionType,
    })
  }
  return { events, skipped, unmappedStatuses: unmapped }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── import-pen 2024-25 ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

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

  // Match each event to a book.
  console.log(`\nMatching events to books (fuzzy via pg_trgm where exact misses)...`)
  type MatchedEvent = { event: Event; book_id: number; kind: 'exact-slug' | 'fuzzy'; score?: number; author_score?: number; matched_title?: string }
  type AmbiguousEvent = { event: Event; candidates: Array<{ id: number; title: string; score: number; author_score: number }> }
  const matched: MatchedEvent[] = []
  const ambiguous: AmbiguousEvent[] = []
  const newBooksByKey = new Map<string, { sample: Event; events: Event[] }>()  // key = `${slug}|${author_slug}` so two books with same title-slug but different authors stay distinct

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

  // Dedup matched events against existing bans.
  const banInsertions: MatchedEvent[] = []
  const banSkips: MatchedEvent[] = []
  for (const m of matched) {
    const key = `${m.book_id}|${m.event.state}|${m.event.district ?? ''}|${m.event.year ?? ''}`
    if (existingBans.has(key)) banSkips.push(m)
    else banInsertions.push(m)
  }

  // ── Report ───────────────────────────────────────────────────────────────

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

  // Year-extraction sanity
  const unparsedYears = events.filter(e => e.year === null).length
  if (unparsedYears) console.log(`\n⚠ ${unparsedYears} events with unparseable year (will use NULL year_started).`)

  // 'Nation' rows
  const nationCount = events.filter(e => e.state === 'Nation').length
  if (nationCount) console.log(`ℹ ${nationCount} 'Nation' (statewide/federal) events — region='Nation', institution=NULL.`)

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply to insert. ──\n`)
    return
  }

  // ── APPLY MODE ───────────────────────────────────────────────────────────

  console.log(`\n── Applying writes ──`)

  // Source row (upsert) — one per import run, every new ban links here.
  const { data: source, error: srcErr } = await supabase
    .from('ban_sources')
    .upsert({ source_name: SOURCE_NAME, source_url: SOURCE_URL, source_type: 'web', verification_status: 'unverified' as const },
            { onConflict: 'source_url' })
    .select('id').single()
  if (srcErr) throw srcErr
  const sourceId = (source as { id: number }).id

  // 'other' reason fallback (matches April-seed convention).
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonOtherId = reasons!.find((r: { slug: string }) => r.slug === 'other')?.id as number | undefined

  let createdBooks = 0, createdAuthors = 0, createdBans = 0, bookErrors = 0, banErrors = 0

  // Phase A: Create new books sequentially (each needs an OL throttle).
  // We collect (book_id, events) tuples so Phase C can flatten them into bans.
  console.log(`\nPhase A: creating ${newBooksByKey.size} new books (with OpenLibrary lookup)...`)
  const newBookEvents: Array<{ book_id: number; events: Event[] }> = []
  for (const g of newSorted) {
    const ev = g.sample
    try {
      const slug = slugify(ev.title)
      let bookId = bookBySlug.get(slug)?.id  // race-safe re-check

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

  // Phase B: Assemble + dedup the final list of bans to insert.
  // Pull from both: matched-to-existing-book events AND new-book events.
  type BanPrep = { book_id: number; event: Event }
  const prep: BanPrep[] = []
  for (const m of banInsertions) prep.push({ book_id: m.book_id, event: m.event })
  for (const g of newBookEvents) for (const e of g.events) prep.push({ book_id: g.book_id, event: e })

  const final: BanPrep[] = []
  for (const p of prep) {
    const key = `${p.book_id}|${p.event.state}|${p.event.district ?? ''}|${p.event.year ?? ''}`
    if (existingBans.has(key)) continue  // already in DB OR already in this run
    existingBans.add(key)
    final.push(p)
  }

  const target = Math.min(final.length, LIMIT)
  console.log(`\nPhase B: ${final.length} unique bans to insert${LIMIT < Infinity ? ` (capping at ${target} due to --limit)` : ''}.`)

  // Phase C: Batch-insert bans, then their source_links and reason_links.
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
