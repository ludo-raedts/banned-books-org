/**
 * Exact-key Open Library harvester — the FREE counterpart to enrich-gb-harvest.
 *
 * Why this exists: Google Books is hard-capped at ~1,000 queries/day, so the GB
 * harvest can only crawl the catalogue a few hundred rows at a time. Open
 * Library has no hard daily cap (just politeness delays), so for every book we
 * already hold a trustworthy OL key — an `openlibrary_work_id` or a validated
 * `isbn13` — we can pull cover / first-published-year / sibling-ISBN straight
 * from the record WITHOUT a fuzzy title search and WITHOUT spending GB budget.
 *
 * Disjoint from the GB harvest by construction:
 *   • this script   → books that ARE keyable (work_id OR isbn13 present)
 *   • gb-harvest     → orphans only (no isbn13 AND no work_id)
 * The two selections are exact complements, so they never touch the same row
 * and can run concurrently with zero write contention.
 *
 * Per book (exact key, NO fuzzy title search):
 *   • has openlibrary_work_id → GET /works/<id>.json
 *       - title-agreement guard: if the OL work title doesn't match our title
 *         the work_id is contaminated (see study-guide-cover / title-search
 *         contamination memos) → trust nothing from it.
 *       - cover     ← work.covers[0]            (first positive cover id)
 *       - year      ← work.first_publish_date    (the CORRECT first-published
 *                     semantic — NOT the GB edition-min, which is why GB only
 *                     ever logged years, never wrote them)
 *       - isbn13    ← /works/<id>/editions.json, an isbn_13 from an edition
 *                     whose language is acceptable for original_language
 *                     (editionLanguageAcceptable), dup-collision-checked
 *   • has isbn13, no work_id  → GET /isbn/<isbn>.json
 *       - title-agreement guard against the edition title
 *       - cover     ← edition.covers[0]
 *       - work_id   ← edition.works[0].key       (backfill so a later pass can
 *                     also fetch the work's first_publish_date)
 *
 * What it WRITES (only when the field is currently NULL — never overwrites):
 *   • cover_url          (host-allowlisted; cover_status guard respected)
 *   • first_published_year
 *   • isbn13             (dup-collision safe)
 *   • openlibrary_work_id (isbn-only path backfill)
 * What it logs to data/ol-harvest-proposals.jsonl for review (NOT written):
 *   • subjects (for the planned genres table), edition publisher/pages if seen
 *
 * Resume: a cursor (data/ol-harvest-cursor.json) records the last book id
 * processed; the next run resumes after it and wraps to a fresh pass at the end.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts                 # dry-run, sample 15
 *   npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts --apply         # write everything
 *   npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts --apply --limit=500
 *   npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts --reset-cursor  # start over from id 0
 */
import fs from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import {
  editionLanguageAcceptable,
  titleContainment,
  TITLE_MATCH_THRESHOLD,
} from '../src/lib/enrich/isbn'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'

const APPLY = process.argv.includes('--apply')
const RESET_CURSOR = process.argv.includes('--reset-cursor')
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : Number.POSITIVE_INFINITY
})()

const CURSOR_FILE = 'data/ol-harvest-cursor.json'
const OUT_FILE = 'data/ol-harvest-proposals.jsonl'
const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const OL_DELAY_MS = 300
const MIN_YEAR = 1400
const MAX_YEAR = new Date().getFullYear() + 1

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseYear(d: string | undefined | null): number | null {
  if (!d) return null
  const m = d.match(/\b(\d{4})\b/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: OL_HEADERS, redirect: 'follow' })
    if (!res.ok) return null
    return (await res.json().catch(() => null)) as T | null
  } catch {
    return null
  }
}

type Cursor = { lastId: number; pass: number }
function readCursor(): Cursor {
  if (RESET_CURSOR) return { lastId: 0, pass: 1 }
  try {
    return JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8')) as Cursor
  } catch {
    return { lastId: 0, pass: 1 }
  }
}
function writeCursor(c: Cursor) {
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(c, null, 2))
}

type BookRow = {
  id: number
  slug: string
  title: string
  original_language: string | null
  first_published_year: number | null
  cover_url: string | null
  cover_status: string | null
  isbn13: string | null
  openlibrary_work_id: string | null
}

type WorkJson = {
  title?: string
  first_publish_date?: string
  covers?: number[]
  subjects?: string[]
}
type EditionsJson = {
  entries?: Array<{
    isbn_13?: string[]
    languages?: Array<{ key: string }>
    covers?: number[]
  }>
}
type IsbnJson = {
  title?: string
  covers?: number[]
  works?: Array<{ key: string }>
}

function firstPositive(ids: number[] | undefined): number | null {
  return ids?.find((c) => typeof c === 'number' && c > 0) ?? null
}

function coverUrlFromId(id: number): string {
  return `https://covers.openlibrary.org/b/id/${id}-L.jpg`
}

async function main() {
  const sb = adminClient()
  const cursor = readCursor()
  console.log(
    `\n── enrich-ol-harvest (${APPLY ? 'APPLY' : 'DRY-RUN'}) cursor.lastId=${cursor.lastId} pass=${cursor.pass} ──\n`,
  )

  // Eligible: keyable (work_id OR isbn13) AND still missing a fillable field,
  // id beyond the cursor. The two .or() filters are ANDed by PostgREST.
  const PAGE = 1000
  const books: BookRow[] = []
  for (let from = cursor.lastId; ; ) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, original_language, first_published_year, cover_url, cover_status, isbn13, openlibrary_work_id')
      .eq('is_blanket_works', false)
      .gt('id', from)
      .or('openlibrary_work_id.not.is.null,isbn13.not.is.null')
      .or('cover_url.is.null,first_published_year.is.null,isbn13.is.null')
      .order('id')
      .limit(PAGE)
    if (error) throw new Error(`DB read: ${error.message}`)
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    from = data[data.length - 1].id
    if (data.length < PAGE) break
    if (books.length >= 20000) break // plenty buffered
  }

  if (!books.length) {
    console.log('No eligible keyable books past the cursor — full pass complete. Wrapping cursor to 0.')
    if (APPLY) writeCursor({ lastId: 0, pass: cursor.pass + 1 })
    return
  }

  const dryLimit = Number.isFinite(LIMIT) ? LIMIT : 15
  const limit = APPLY ? Math.min(books.length, LIMIT) : Math.min(dryLimit, books.length)
  console.log(`Eligible past cursor: ${books.length}+ ; processing ${limit}\n`)

  const out = fs.createWriteStream(OUT_FILE, { flags: 'a' })
  let coversFilled = 0,
    yearsFilled = 0,
    isbnsFilled = 0,
    isbnDup = 0,
    workIdsFilled = 0,
    contaminated = 0,
    noRecord = 0
  let lastProcessedId = cursor.lastId

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    const needCover =
      book.cover_url == null &&
      book.cover_status !== 'rejected_placeholder' &&
      book.cover_status !== 'manual_override'
    const needYear = book.first_published_year == null
    const needIsbn = book.isbn13 == null

    let coverId: number | null = null
    let firstYear: number | null = null
    let recoveredIsbn: string | null = null
    let backfillWorkId: string | null = null
    let subjects: string[] = []
    let titleOk = true
    const via = book.openlibrary_work_id ? 'work' : 'isbn'

    // Resolve a work_id. The isbn-only path discovers it from the edition
    // record (and backfills it once verified). OL covers + first_publish_date
    // live on the WORK, so we always fetch the work to fill cover/year.
    let workId = book.openlibrary_work_id
    let edCover: number | null = null

    if (!workId && book.isbn13) {
      const ed = await fetchJson<IsbnJson>(`https://openlibrary.org/isbn/${book.isbn13}.json`)
      await sleep(OL_DELAY_MS)
      if (!ed) {
        noRecord++
        lastProcessedId = book.id
        continue
      }
      // Edition-title pre-check: a validated ISBN can still belong to the wrong
      // book if an old title search mis-assigned it.
      if (ed.title && titleContainment(book.title, ed.title) < TITLE_MATCH_THRESHOLD) {
        titleOk = false
        contaminated++
      } else {
        workId = ed.works?.[0]?.key?.replace('/works/', '') ?? null
        edCover = firstPositive(ed.covers)
      }
    }

    if (titleOk && workId) {
      const work = await fetchJson<WorkJson>(`https://openlibrary.org/works/${workId}.json`)
      await sleep(OL_DELAY_MS)
      if (!work) {
        // Work fetch failed; the isbn path may still carry an edition cover.
        if (needCover && edCover != null) coverId = edCover
        else noRecord++
      } else if (work.title && titleContainment(book.title, work.title) < TITLE_MATCH_THRESHOLD) {
        // Contaminated key (study-guide work, wrong namesake from an old title
        // search) — trust nothing from it.
        titleOk = false
        contaminated++
      } else {
        coverId = needCover ? (firstPositive(work.covers) ?? edCover) : null
        firstYear = needYear ? parseYear(work.first_publish_date) : null
        subjects = work.subjects?.slice(0, 12) ?? []
        // Backfill the discovered work_id (isbn path only) now that it passed
        // both the edition- and work-title guards.
        if (!book.openlibrary_work_id) backfillWorkId = workId
        if (needIsbn) {
          const eds = await fetchJson<EditionsJson>(
            `https://openlibrary.org/works/${workId}/editions.json?limit=50`,
          )
          await sleep(OL_DELAY_MS)
          for (const e of eds?.entries ?? []) {
            const isbn = e.isbn_13?.find((s) => s.length === 13 && (s.startsWith('978') || s.startsWith('979')))
            if (!isbn) continue
            const edLang = e.languages?.[0]?.key?.split('/').pop() ?? null
            if (!editionLanguageAcceptable(edLang, book.original_language)) continue
            recoveredIsbn = isbn
            break
          }
        }
      }
    } else if (titleOk && !workId && needCover && edCover != null) {
      // isbn record had no work link but did carry an edition cover.
      coverId = edCover
    }

    let coverUrl = coverId != null ? coverUrlFromId(coverId) : null
    if (coverUrl && !isAllowedImageUrl(coverUrl)) coverUrl = null // structural gate

    out.write(
      JSON.stringify({
        id: book.id, slug: book.slug, title: book.title, via, title_ok: titleOk,
        cover: coverUrl ? 'found' : needCover ? 'none' : 'had',
        year: firstYear, recovered_isbn: recoveredIsbn, backfill_work_id: backfillWorkId,
        subjects,
      }) + '\n',
    )

    const parts: string[] = []
    if (coverUrl) parts.push('cover')
    if (firstYear) parts.push(`year=${firstYear}`)
    if (recoveredIsbn) parts.push(`isbn=${recoveredIsbn}`)
    if (backfillWorkId) parts.push(`work=${backfillWorkId}`)
    if (!titleOk) parts.push('SKIP(title-mismatch)')

    if (APPLY) {
      const now = new Date().toISOString()
      if (coverUrl) {
        const { error } = await sb
          .from('books')
          .update({ cover_url: coverUrl, cover_status: 'valid', cover_checked_at: now })
          .eq('id', book.id)
          .is('cover_url', null)
        if (!error) coversFilled++
      }
      if (firstYear) {
        const { error } = await sb
          .from('books')
          .update({ first_published_year: firstYear })
          .eq('id', book.id)
          .is('first_published_year', null)
        if (!error) yearsFilled++
      }
      if (recoveredIsbn) {
        const { data: clash } = await sb
          .from('books')
          .select('id')
          .eq('isbn13', recoveredIsbn)
          .neq('id', book.id)
          .maybeSingle()
        if (clash) {
          isbnDup++
          await sb.from('books').update({ isbn_status: 'dup_collision', isbn_checked_at: now }).eq('id', book.id).is('isbn13', null)
        } else {
          const { error } = await sb
            .from('books')
            .update({ isbn13: recoveredIsbn, isbn_status: 'valid', isbn_checked_at: now })
            .eq('id', book.id)
            .is('isbn13', null)
          if (!error) isbnsFilled++
        }
      }
      if (backfillWorkId) {
        const { error } = await sb
          .from('books')
          .update({ openlibrary_work_id: backfillWorkId })
          .eq('id', book.id)
          .is('openlibrary_work_id', null)
        if (!error) workIdsFilled++
      }
    } else {
      if (coverUrl) coversFilled++
      if (firstYear) yearsFilled++
      if (recoveredIsbn) isbnsFilled++
      if (backfillWorkId) workIdsFilled++
    }

    if (parts.length) console.log(`  [#${book.id}] ${book.title.slice(0, 44)} → ${parts.join(', ')} (${via})`)
    lastProcessedId = book.id
  }

  out.end()
  if (APPLY) writeCursor({ lastId: lastProcessedId, pass: cursor.pass })

  console.log(`
── Summary ──────────────────────────────
  Processed:                      ${limit}${APPLY ? '' : ' (dry-run)'}
  Covers ${APPLY ? 'written' : 'findable'}:           ${coversFilled}
  Years ${APPLY ? 'written' : 'fillable'}:            ${yearsFilled}
  ISBNs ${APPLY ? 'written' : 'recoverable'}:           ${isbnsFilled}${isbnDup ? ` (+${isbnDup} dup-collision)` : ''}
  work_id backfilled:             ${workIdsFilled}
  Skipped (title mismatch):       ${contaminated}
  No OL record:                   ${noRecord}
  Cursor now at id:               ${APPLY ? lastProcessedId : cursor.lastId + ' (dry-run, not advanced)'}
  Review worklist:                ${OUT_FILE}
  ${APPLY ? 'Written ✓ — re-run to continue from the cursor' : 'DRY-RUN — add --apply to write'}
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
