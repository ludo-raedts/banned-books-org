/**
 * Bundled Google Books harvester — ONE GB call per book fills every field that
 * call can serve, so we never spend more than one of the ~1,000/day GB queries
 * on the same book.
 *
 * Why bundled: GB is hard-capped at ~1,000 queries/day for this project. Running
 * the per-field scripts separately costs one GB call PER FIELD (isbn, then
 * cover, then metadata) = ~3× the quota. A single volumes response already
 * carries industryIdentifiers (ISBN), imageLinks (cover), language,
 * publishedDate, categories, pageCount, publisher — so one call does it all.
 *
 * Free sources first: covers and ISBN have already been exhausted against
 * OpenLibrary/Wikipedia (which have no quota), so this pass is deliberately the
 * GB *residual* — it only touches books still missing a field after those.
 *
 * Per book (1 GB call):
 *   • has isbn13  → gbVolumesByIsbn (exact edition; cover needs no title guard)
 *   • no isbn13   → gbVolumesByTitleAuthor → may also recover an ISBN, applying
 *                   the SAME guards as enrich-isbn (titleContainment,
 *                   queryCoverage, authorAgrees, verifyEdition + dup-collision)
 *
 * What it WRITES (only when the field is currently NULL — never overwrites):
 *   • isbn13         (guarded; dup-collision safe)
 *   • cover_url      (placeholder-safe via resolveGbCover; host-allowlisted)
 *   • original_language (single agreed edition language; skipped for non-Latin
 *                        native originals where GB only has translations)
 * What it logs to data/gb-harvest-proposals.jsonl for review (NOT written):
 *   • first_published_year (edition≠original), categories, pages, publisher
 *
 * Quota & resume:
 *   • --budget=N (default 900) caps GB calls per run, leaving headroom under 1k.
 *   • A 429 mid-run throws GbQuotaError → we stop cleanly (the shared client
 *     latches, so nothing is mis-stamped).
 *   • A cursor (data/gb-harvest-cursor.json) records the last book id processed;
 *     the next run resumes after it. When it reaches the end it wraps to 0 and
 *     logs "full pass complete" so a second pass can pick up books that gained
 *     an ISBN from a cross-field fill.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts                 # dry-run, sample 15
 *   npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts --apply         # write, budget 900
 *   npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts --apply --budget=500
 *   npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts --reset-cursor  # start over from id 0
 */
import fs from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import {
  gbVolumesByIsbn,
  gbVolumesByTitleAuthor,
  resolveGbCover,
  gbIsbn13,
  GB_FIELDS_FULL,
  GbQuotaError,
  type GbVolume,
} from '../src/lib/enrich/google-books'
import { titlesMatch } from '../src/lib/enrich/title-match'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import {
  titleContainment,
  queryCoverage,
  authorAgrees,
  verifyEdition,
  isPlaceholderTitle,
  isPinyinOnlyZh,
  TITLE_MATCH_THRESHOLD,
  QUERY_COVERAGE_THRESHOLD,
} from '../src/lib/enrich/isbn'

const APPLY = process.argv.includes('--apply')
const RESET_CURSOR = process.argv.includes('--reset-cursor')
const BUDGET = (() => {
  const a = process.argv.find((x) => x.startsWith('--budget='))
  return a ? parseInt(a.split('=')[1], 10) : 900
})()

const CURSOR_FILE = 'data/gb-harvest-cursor.json'
const OUT_FILE = 'data/gb-harvest-proposals.jsonl'
const MIN_YEAR = 1400
const MAX_YEAR = new Date().getFullYear() + 1
const BOOK_DELAY_MS = 120

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function hasNonLatinScript(s: string | null): boolean {
  if (!s) return false
  return /[^ -ɏḀ-ỿ]/u.test(s.replace(/[\p{P}\p{N}\p{Zs}]/gu, ''))
}

function parseYear(d: string | undefined): number | null {
  if (!d) return null
  const m = d.match(/\b(\d{4})\b/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null
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
  title_native: string | null
  title_native_script: string | null
  title_english_meaningful: string | null
  original_language: string | null
  first_published_year: number | null
  cover_url: string | null
  cover_status: string | null
  isbn13: string | null
  book_authors: Array<{ authors: { display_name: string } | null }> | null
}

async function main() {
  const sb = adminClient()
  const cursor = readCursor()
  console.log(`\n── enrich-gb-harvest (${APPLY ? 'APPLY' : 'DRY-RUN'}) budget=${BUDGET} cursor.lastId=${cursor.lastId} pass=${cursor.pass} ──\n`)

  // Eligible: still missing a GB-fillable field, id beyond the cursor.
  const PAGE = 1000
  const books: BookRow[] = []
  for (let from = cursor.lastId; ; ) {
    const { data, error } = await sb
      .from('books')
      .select(
        'id, slug, title, title_native, title_native_script, title_english_meaningful, original_language, first_published_year, cover_url, cover_status, isbn13, book_authors(authors(display_name))',
      )
      .eq('is_blanket_works', false)
      .gt('id', from)
      .or('cover_url.is.null,isbn13.is.null,original_language.is.null,first_published_year.is.null')
      .order('id')
      .limit(PAGE)
    if (error) throw new Error(`DB read: ${error.message}`)
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    from = data[data.length - 1].id
    if (data.length < PAGE) break
    if (books.length >= BUDGET * 3) break // plenty buffered; we cap by budget anyway
  }

  if (!books.length) {
    console.log('No eligible books past the cursor — full pass complete. Wrapping cursor to 0.')
    writeCursor({ lastId: 0, pass: cursor.pass + 1 })
    return
  }

  const dryLimit = Math.min(15, books.length)
  console.log(`Eligible past cursor: ${books.length}+ ; will spend up to ${APPLY ? BUDGET : dryLimit} GB call(s)\n`)

  const out = fs.createWriteStream(OUT_FILE, { flags: 'a' })
  let gbUsed = 0
  let coversFilled = 0,
    coversPlaceholder = 0,
    isbnsFilled = 0,
    isbnDup = 0,
    langsFilled = 0,
    yearProposals = 0,
    noData = 0
  let lastProcessedId = cursor.lastId
  let stoppedReason = 'budget/end'

  for (const book of books) {
    if (gbUsed >= (APPLY ? BUDGET : dryLimit)) break

    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    const needIsbn = book.isbn13 == null
    const needCover = book.cover_url == null && book.cover_status !== 'rejected_placeholder' && book.cover_status !== 'manual_override'
    const placeholderUnsearchable = isPlaceholderTitle(book.title) || isPinyinOnlyZh(book)

    let volumes: GbVolume[] = []
    let viaIsbnDirect = false
    try {
      if (book.isbn13) {
        volumes = await gbVolumesByIsbn(book.isbn13, { maxResults: 5, fields: GB_FIELDS_FULL, delayMs: 500 })
        viaIsbnDirect = true
        gbUsed++
      } else if (!placeholderUnsearchable) {
        volumes = await gbVolumesByTitleAuthor(book.title, author, { maxResults: 5, fields: GB_FIELDS_FULL, delayMs: 500 })
        gbUsed++
      } else {
        // Structurally unsearchable by title and has no ISBN → skip without
        // spending a GB call. Still advance the cursor past it.
        lastProcessedId = book.id
        continue
      }
    } catch (e) {
      if (e instanceof GbQuotaError) {
        stoppedReason = 'quota (429)'
        break
      }
      throw e
    }

    if (!volumes.length) {
      noData++
      lastProcessedId = book.id
      await sleep(BOOK_DELAY_MS)
      continue
    }

    // ── ISBN (only when missing, only on the title-search path; ISBN-direct
    //    means we already have it) ──
    let recoveredIsbn: string | null = null
    if (needIsbn && !viaIsbnDirect && !placeholderUnsearchable) {
      for (const v of volumes) {
        const cand = gbIsbn13(v.volumeInfo)
        if (!cand) continue
        const mt = v.volumeInfo.title ?? ''
        if (titleContainment(book.title, mt) < TITLE_MATCH_THRESHOLD) continue
        if (queryCoverage(book.title, mt) < QUERY_COVERAGE_THRESHOLD) continue
        if (!authorAgrees(author, v.volumeInfo.authors ?? [])) continue
        const ed = await verifyEdition(cand, book.title, book.original_language)
        if (!ed.ok) continue
        recoveredIsbn = cand
        break
      }
    }

    // ── Cover (only when missing) ──
    let coverUrl: string | null = null
    let coverPlaceholder = false
    if (needCover) {
      const r = await resolveGbCover(volumes, book.title, { requireTitleMatch: !viaIsbnDirect })
      if (r.kind === 'cover') coverUrl = r.url
      else if (r.kind === 'placeholder') coverPlaceholder = true
      if (coverUrl && !isAllowedImageUrl(coverUrl)) coverUrl = null // structural gate
    }

    // ── Metadata from the same volumes ──
    const languages = [...new Set(volumes.map((v) => v.volumeInfo.language).filter(Boolean) as string[])]
    const years = volumes.map((v) => parseYear(v.volumeInfo.publishedDate)).filter((y): y is number => y != null)
    const earliestYear = years.length ? Math.min(...years) : null
    const categories = [...new Set(volumes.flatMap((v) => v.volumeInfo.categories ?? []))]
    const pages = volumes.map((v) => v.volumeInfo.pageCount).find((p) => p && p > 0) ?? null
    const publisher = volumes.map((v) => v.volumeInfo.publisher).find(Boolean) ?? null

    const nativeForeign = hasNonLatinScript(book.title_native_script) || hasNonLatinScript(book.title_native)
    const langProposal = languages.length === 1 ? languages[0] : null
    const langConfident = !!langProposal && book.original_language == null && !nativeForeign
    const yearProposal = book.first_published_year == null ? earliestYear : null

    out.write(
      JSON.stringify({
        id: book.id, slug: book.slug, title: book.title, via: viaIsbnDirect ? 'isbn' : 'title',
        recovered_isbn: recoveredIsbn, cover: coverUrl ? 'found' : coverPlaceholder ? 'placeholder' : needCover ? 'none' : 'had',
        languages, language_written: langConfident ? langProposal : null, native_foreign: nativeForeign,
        year_proposal_edition_min: yearProposal, categories, pages, publisher,
      }) + '\n',
    )

    const parts: string[] = []
    if (recoveredIsbn) parts.push(`isbn=${recoveredIsbn}`)
    if (coverUrl) parts.push('cover')
    else if (coverPlaceholder) parts.push('cover=placeholder')
    if (langConfident) parts.push(`lang=${langProposal}`)
    if (yearProposal) { parts.push(`year?≈${yearProposal}`); yearProposals++ }

    // ── Writes (APPLY only; NULL-guarded) ──
    if (APPLY) {
      const now = new Date().toISOString()
      if (recoveredIsbn) {
        const { data: clash } = await sb.from('books').select('id').eq('isbn13', recoveredIsbn).neq('id', book.id).maybeSingle()
        if (clash) {
          isbnDup++
          await sb.from('books').update({ isbn_status: 'dup_collision', isbn_checked_at: now }).eq('id', book.id).is('isbn13', null)
        } else {
          const { error } = await sb.from('books').update({ isbn13: recoveredIsbn, isbn_status: 'valid', isbn_checked_at: now }).eq('id', book.id).is('isbn13', null)
          if (!error) isbnsFilled++
        }
      }
      if (coverUrl) {
        const { error } = await sb.from('books').update({ cover_url: coverUrl, cover_status: 'valid', cover_checked_at: now }).eq('id', book.id).is('cover_url', null)
        if (!error) coversFilled++
      } else if (coverPlaceholder) {
        await sb.from('books').update({ cover_status: 'rejected_placeholder', cover_checked_at: now }).eq('id', book.id).is('cover_url', null)
        coversPlaceholder++
      }
      if (langConfident) {
        const { error } = await sb.from('books').update({ original_language: langProposal }).eq('id', book.id).is('original_language', null)
        if (!error) langsFilled++
      }
    } else {
      if (recoveredIsbn) isbnsFilled++
      if (coverUrl) coversFilled++
      if (coverPlaceholder) coversPlaceholder++
      if (langConfident) langsFilled++
    }

    if (parts.length) console.log(`  [#${book.id}] ${book.title.slice(0, 44)} → ${parts.join(', ')} (${viaIsbnDirect ? 'isbn' : 'title'})`)
    lastProcessedId = book.id
    await sleep(BOOK_DELAY_MS)
  }

  out.end()
  if (APPLY) writeCursor({ lastId: lastProcessedId, pass: cursor.pass })

  console.log(`
── Summary ──────────────────────────────
  GB calls spent:                 ${gbUsed}${APPLY ? '' : ' (dry-run)'} / budget ${APPLY ? BUDGET : dryLimit}
  ISBNs ${APPLY ? 'written' : 'recoverable'}:           ${isbnsFilled}${isbnDup ? ` (+${isbnDup} dup-collision)` : ''}
  Covers ${APPLY ? 'written' : 'findable'}:           ${coversFilled}${coversPlaceholder ? ` (+${coversPlaceholder} placeholder rejected)` : ''}
  Languages ${APPLY ? 'written' : 'fillable'}:        ${langsFilled}
  Year proposals (review only):   ${yearProposals}
  No GB data:                     ${noData}
  Stopped:                        ${stoppedReason}
  Cursor now at id:               ${APPLY ? lastProcessedId : cursor.lastId + ' (dry-run, not advanced)'}
  Review worklist:                ${OUT_FILE}
  ${APPLY ? 'Written ✓ — re-run tomorrow to continue from the cursor' : 'DRY-RUN — add --apply to write'}
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
