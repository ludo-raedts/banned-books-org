// Core cover-image enrichment logic, callable from either the CLI script
// (scripts/enrich-covers-v2.ts) or the in-process API route
// (/api/admin/enrich/run). Strategies, tried in order per book:
//
//   1. Google Books ISBN-direct (exact edition)
//   2. Open Library work-edition cover (stored work_id → its editions' covers,
//      title-guarded)
//   3. Google Books title-only (no inauthor:)
//   4. Open Library title-only
//   5. Open Library stripped-subtitle search
//   6. Wikipedia page thumbnail
//
// Step 2 walks the work's editions rather than only its primary cover_i, which
// is what the title-search steps (4–5) already pin — that closes the gap that
// left books like DK Eyewitness "Insect" (work OL1924736W) falsely marked
// rejected_placeholder despite a real cover on a sibling edition. Google Books
// URLs are pHash-checked against the official placeholder; matches are rejected
// and the book gets cover_status='rejected_placeholder' so future runs skip it.
// Books with cover_status in (rejected_placeholder, manual_override) are skipped
// unless `force` is true.

import { adminClient } from '../supabase'
import { titleLadder } from './_title-ladder'
import { titlesMatch } from './title-match'
import { isAllowedImageUrl } from '../allowed-image-hosts'
import { gbVolumesByTitle, gbVolumesByIsbn, resolveGbCover, GB_FIELDS_COVER, GbQuotaError } from './google-books'

const OL_DELAY_MS   = 200
const GB_DELAY_MS   = 600
const WIKI_DELAY_MS = 200
const BOOK_DELAY_MS = 200

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const OL_COVERS_BASE = 'https://covers.openlibrary.org'
const NEW_SOURCES = ['gb_isbn', 'ol_edition', 'ol_title_only', 'ol_stripped', 'gb_title_only', 'wikipedia']

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function stripSubtitle(title: string): string {
  const colon = title.indexOf(':')
  const dash  = title.indexOf(' — ')
  if (colon > 0 && dash > 0) return title.slice(0, Math.min(colon, dash)).trim()
  if (colon > 0) return title.slice(0, colon).trim()
  if (dash  > 0) return title.slice(0, dash).trim()
  return title
}

// OpenLibrary's `title=` search is phrase/prefix-anchored: a query of
// "The Witch Doctor of Umm Suqeim" returns 0 results when the catalogued
// record drops the leading article ("Witch Doctor Of Umm Suqeim"). Strip a
// leading English article so we can retry; returns null when there is none.
function stripLeadingArticle(title: string): string | null {
  const m = title.match(/^(the|a|an)\s+(.+)/i)
  return m ? m[2].trim() : null
}

// Exported for unit tests (see __tests__/ol-search.test.ts) which verify
// that author is forwarded to the OL search API — the bug fixed in
// 2026-05-16 was a caller passing '' for author, which made title-only
// matches return the most-popular hit (a 19th-century classic) and
// poison subsequent enrichment fields.
async function olSearchOnce(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const params = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      limit: '5',
      fields: 'key,cover_i,title',
    })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { headers: OL_HEADERS })
    await sleep(OL_DELAY_MS)
    if (!res.ok) return { coverUrl: null, workId: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; title?: string }> }
    // Only trust docs whose title actually matches ours — the search endpoint
    // returns the most-popular namesake/sibling for an obscure query, which
    // would otherwise pin a wrong cover (and poison openlibrary_work_id).
    const matches = (json.docs ?? []).filter((doc) => titlesMatch(title, doc.title ?? ''))
    for (const doc of matches) {
      if (doc.cover_i) {
        return {
          coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
          workId: doc.key?.replace('/works/', '') ?? null,
        }
      }
    }
    const workId = matches[0]?.key?.replace('/works/', '') ?? null
    return { coverUrl: null, workId }
  } catch { return { coverUrl: null, workId: null } }
}

export async function olSearch(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  const first = await olSearchOnce(title, author)
  if (first.coverUrl) return first
  // OL anchors its title= search on the catalogued title, which often omits a
  // leading article. Retry once without it (e.g. "The Witch Doctor of Umm
  // Suqeim" → "Witch Doctor of Umm Suqeim"); titlesMatch still guards the hit.
  const stripped = stripLeadingArticle(title)
  if (!stripped) return first
  const retry = await olSearchOnce(stripped, author)
  // Prefer a real cover from the retry; otherwise keep the original workId
  // (if any) so we don't lose a weaker-but-valid match.
  if (retry.coverUrl) return retry
  return first.workId ? first : retry
}

// An OL cover URL resolves to a real image (not the blank default). Probe with
// ?default=false so a missing cover is a clean 404; the redirect chain to the
// archive.org image is followed and confirmed to be image/* content.
async function olImageExists(probeUrl: string): Promise<boolean> {
  try {
    const r = await fetch(probeUrl, { method: 'HEAD' })
    return r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')
  } catch { return false }
}

// A work_id's editions' covers — the exact-edition path the title-search
// strategies miss when the work's primary cover_i is blank/absent but a sibling
// edition carries a real cover (the DK Eyewitness "Insect" gap, work
// OL1924736W). A stored work_id can occasionally be a contaminated/namesake
// link (e.g. "The Thing" → "The Things They Carried"), so the work's canonical
// title must match one of our title variants — the same titlesMatch guard the
// title-search path uses, widened to the title ladder so a legit foreign-
// language work title still matches via title_native. (The raw isbn13 is NOT
// trusted as a standalone source here: OL's broad ISBN coverage surfaces
// mis-stored ISBNs as confidently-wrong covers, and unlike gb_isbn there is no
// vision check downstream. ISBN-only backfill stays with the vision-gated
// recover-nulled-covers.ts.) Returns the first cover that HEAD-resolves to a
// real image, or null.
export async function olEditionCover(workId: string, ladderTitles: string[]): Promise<string | null> {
  try {
    const wr = await fetch(`https://openlibrary.org/works/${workId}.json`, { headers: OL_HEADERS })
    await sleep(OL_DELAY_MS)
    const work = wr.ok ? (await wr.json() as { title?: string }) : null
    if (!work?.title || !ladderTitles.some(t => titlesMatch(t, work.title!))) return null
    const er = await fetch(`https://openlibrary.org/works/${workId}/editions.json?limit=50`, { headers: OL_HEADERS })
    await sleep(OL_DELAY_MS)
    if (!er.ok) return null
    const ed = await er.json() as { entries?: Array<{ covers?: number[] }> }
    const ids: number[] = []
    for (const e of ed.entries ?? []) for (const c of (e.covers ?? [])) if (c && c > 0) ids.push(c)
    for (const id of [...new Set(ids)].slice(0, 8)) {
      const url = `${OL_COVERS_BASE}/b/id/${id}-L.jpg`
      if (await olImageExists(`${url}?default=false`)) return url
    }
    return null
  } catch { return null }
}

async function wikipediaCover(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${title} ${author} book`.trim())
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=3&srprop=`
    )
    await sleep(WIKI_DELAY_MS)
    if (!searchRes.ok) return null
    const searchJson = await searchRes.json() as {
      query?: { search?: Array<{ title: string }> }
    }
    for (const hit of searchJson.query?.search ?? []) {
      if (!hit.title.toLowerCase().includes(title.toLowerCase().slice(0, 12))) continue
      const pageSlug = encodeURIComponent(hit.title.replace(/ /g, '_'))
      const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${pageSlug}`)
      await sleep(WIKI_DELAY_MS)
      if (!summaryRes.ok) continue
      const summary = await summaryRes.json() as {
        originalimage?: { source?: string }
        thumbnail?: { source?: string }
      }
      const img = summary.originalimage?.source ?? summary.thumbnail?.source
      if (img) return img
    }
    return null
  } catch { return null }
}

type BookRow = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  openlibrary_work_id: string | null
  isbn13: string | null
  author: string | null
  prevSources: string[]
}

export type EnrichCoversOpts = {
  apply: boolean
  limit?: number
  reset?: boolean
  force?: boolean
  bookIds?: number[]
  onProgress?: (msg: string) => void
}

export type EnrichCoversResult = {
  totalCandidates: number
  alreadyTried: number
  processed: number
  found: number
  rejectedPlaceholder: number
  stillFailed: number
  foundBySource: Record<string, number>
  errors: number
  samples: Array<{ title: string; coverUrl: string | null; source: string; reason?: string }>
}

export async function enrichCovers(opts: EnrichCoversOpts): Promise<EnrichCoversResult> {
  const log = opts.onProgress ?? (() => {})
  const supabase = adminClient()

  type RawRow = {
    id: number; slug: string; title: string
    title_native: string | null
    title_transliterated: string | null
    title_english_meaningful: string | null
    original_language: string | null
    openlibrary_work_id: string | null
    isbn13: string | null
    cover_status: string | null
    // PostgREST returns this embed as a single object (1-to-1: cover_search_attempts.book_id
    // is unique), not an array. Tolerate either shape for safety.
    cover_search_attempts: { sources_tried: string[] } | Array<{ sources_tried: string[] }> | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }

  const PAGE = 1000
  const all: RawRow[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('books')
      .select(`
        id, slug, title, openlibrary_work_id, isbn13, cover_status,
        title_native, title_transliterated, title_english_meaningful, original_language,
        cover_search_attempts!left(sources_tried),
        book_authors!left(authors!left(display_name))
      `)
      .is('cover_url', null)
      // Blanket-works pseudo-books ("Toutes ses œuvres …") are not real
      // titles — no cover will ever resolve, so never enrich them.
      .eq('is_blanket_works', false)
      .order('id')
      .range(from, from + PAGE - 1)

    if (!opts.force) {
      q = q.or('cover_status.is.null,cover_status.eq.valid')
    }

    if (opts.bookIds && opts.bookIds.length > 0) {
      q = q.in('id', opts.bookIds)
    }

    const { data, error } = await q
    if (error) throw new Error(`DB read: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    all.push(...page)
    if (page.length < PAGE) break
  }

  const toSearch: BookRow[] = []
  let alreadyDoneCount = 0
  for (const row of all) {
    const ca = Array.isArray(row.cover_search_attempts)
      ? row.cover_search_attempts[0]
      : row.cover_search_attempts
    const prevSources = ca?.sources_tried ?? []
    const hasNewSources = NEW_SOURCES.some(s => prevSources.includes(s))
    if (!opts.reset && hasNewSources) { alreadyDoneCount++; continue }
    toSearch.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      title_native: row.title_native,
      title_transliterated: row.title_transliterated,
      title_english_meaningful: row.title_english_meaningful,
      original_language: row.original_language,
      openlibrary_work_id: row.openlibrary_work_id,
      isbn13: row.isbn13,
      author: row.book_authors?.[0]?.authors?.display_name ?? null,
      prevSources,
    })
  }

  const limit = opts.apply
    ? Math.min(toSearch.length, opts.limit ?? Number.POSITIVE_INFINITY)
    : Math.min(10, toSearch.length)

  log(`Total in skip list: ${all.length}`)
  log(`Already tried v2:   ${alreadyDoneCount}`)
  log(`Eligible:           ${toSearch.length}`)
  log(`${opts.apply ? `Processing ${limit}…` : `DRY-RUN — sampling ${limit}`}`)

  async function gbSearchVerified(q: string, expectedTitle: string, tracker: { sawPlaceholder: boolean }, expectedAuthor?: string): Promise<string | null> {
    const volumes = await gbVolumesByTitle(q, { maxResults: 3, fields: GB_FIELDS_COVER, delayMs: GB_DELAY_MS })
    // resolveGbCover applies the title-match guard, the author-agreement guard,
    // the pHash placeholder check, and the strip repair in one place.
    const result = await resolveGbCover(volumes, expectedTitle, { expectedAuthor })
    if (result.kind === 'placeholder') { tracker.sawPlaceholder = true; return null }
    return result.kind === 'cover' ? result.url : null
  }

  let found = 0, stillFailed = 0, rejectedPlaceholder = 0, errCount = 0
  const foundBySource: Record<string, number> = {}
  const samples: EnrichCoversResult['samples'] = []

  // Once Google Books returns its daily-quota error, every further GB call
  // would throw the same. Instead of halting the whole run we flip this flag
  // and skip the GB steps for the rest of the run, continuing with the free
  // sources (OL / OL-stripped / Wikipedia). Reset only by a new process.
  let gbExhausted = false

  for (let i = 0; i < limit; i++) {
    const book = toSearch[i]
    const author = book.author ?? ''
    const ladder = titleLadder(book)
    let coverUrl: string | null = null
    let source = ''
    const newSources: string[] = []
    const placeholderTracker = { sawPlaceholder: false }

    try {
      // ISBN-direct first: when the book has a (validated) ISBN-13, ask Google
      // Books for that exact edition. The ISBN binds the edition, so this is the
      // highest-precision source and needs no title guard — but the placeholder
      // and strip checks in resolveGbCover still run. This bypasses the
      // title-search "most-popular sibling" failure mode entirely.
      if (book.isbn13 && !gbExhausted) {
        newSources.push('gb_isbn')
        try {
          const isbnVolumes = await gbVolumesByIsbn(book.isbn13, { fields: GB_FIELDS_COVER, delayMs: GB_DELAY_MS })
          const isbnResult = await resolveGbCover(isbnVolumes, book.title, { requireTitleMatch: false })
          if (isbnResult.kind === 'placeholder') placeholderTracker.sawPlaceholder = true
          else if (isbnResult.kind === 'cover') { coverUrl = isbnResult.url; source = 'GB-isbn' }
        } catch (e) {
          if (!(e instanceof GbQuotaError)) throw e
          if (!gbExhausted) log(`  ⚠ Google Books daily quota exhausted at ${i}/${limit} — continuing with OL/Wikipedia only for the rest of this run.`)
          gbExhausted = true
        }
      }

      // OL work-edition cover: when the book has a (title-matched) work_id, the
      // title-search strategies below still miss the cover if the work's
      // primary cover_i is blank but a sibling edition has a real image — the
      // gap that left DK Eyewitness "Insect" (work OL1924736W) falsely rejected.
      // Free of GB, so it runs even after the GB quota wall.
      if (!coverUrl && book.openlibrary_work_id) {
        newSources.push('ol_edition')
        const edCover = await olEditionCover(book.openlibrary_work_id, ladder.map(v => v.title))
        if (edCover) { coverUrl = edCover; source = 'OL-edition' }
      }

      // Walk the title ladder; for each variant try GB → OL → OL-stripped →
      // Wikipedia in order. First hit (across all variants) wins. The
      // `newSources` list is annotated with the variant tag (e.g.
      // 'gb_title_only:english_meaningful') so cover_search_attempts records
      // which title variant we actually probed.
      for (const variant of ladder) {
        if (coverUrl) break
        const tag = variant.source === 'canonical' ? '' : `:${variant.source}`
        const stripped = stripSubtitle(variant.title)

        if (!gbExhausted) {
          newSources.push(`gb_title_only${tag}`)
          try {
            coverUrl = await gbSearchVerified(`intitle:${variant.title}`, variant.title, placeholderTracker, author)
              ?? await gbSearchVerified(variant.title, variant.title, placeholderTracker, author)
            if (coverUrl) { source = `GB-title-only${tag}`; break }
          } catch (e) {
            if (!(e instanceof GbQuotaError)) throw e
            if (!gbExhausted) log(`  ⚠ Google Books daily quota exhausted at ${i}/${limit} — continuing with OL/Wikipedia only for the rest of this run.`)
            gbExhausted = true
          }
        }

        newSources.push(`ol_title_only${tag}`)
        // Pass the author into the title-only branch too. Previously this
        // line passed '' for author, which made Open Library fall back to
        // the most popular title match and dropped a 19th-century classic
        // workId onto modern titles ("Ask the Passengers" → Huckleberry
        // Finn's OL work; "Dime" → Twain). The stored workId then
        // poisoned subsequent description and first_published_year
        // enrichment via descriptions.ts. Three confirmed records were
        // wiped to NULL on 2026-05-16; this prevents the next round of
        // imports from re-creating the same collisions.
        const { coverUrl: olUrl, workId } = await olSearch(variant.title, author)
        if (olUrl) { coverUrl = olUrl; source = `OL-title-only${tag}` }
        if (workId && !book.openlibrary_work_id && opts.apply) {
          await supabase.from('books')
            .update({ openlibrary_work_id: workId })
            .eq('id', book.id)
            .is('openlibrary_work_id', null)
        }
        if (coverUrl) break

        if (stripped !== variant.title) {
          newSources.push(`ol_stripped${tag}`)
          const { coverUrl: strippedUrl } = await olSearch(stripped, author)
          if (strippedUrl) { coverUrl = strippedUrl; source = `OL-stripped${tag}`; break }
        }

        newSources.push(`wikipedia${tag}`)
        const wikiUrl = await wikipediaCover(variant.title, author)
        if (wikiUrl) { coverUrl = wikiUrl; source = `Wikipedia${tag}`; break }
      }
    } catch (err) {
      if (err instanceof GbQuotaError) {
        // Quota wall: stop cleanly. covers.ts never stamps a verdict in this
        // catch, so nothing is corrupted — just stop burning the loop.
        log(`  ⚠ Google Books daily quota exhausted — stopping at ${i}/${limit}. Resume after the quota resets / is raised.`)
        break
      }
      const msg = err instanceof Error ? err.message : String(err)
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → ERROR: ${msg}`)
      errCount++
      await sleep(BOOK_DELAY_MS)
      continue
    }

    const nowIso = new Date().toISOString()

    // Final host-allowlist gate before DB write. All three sources (OL,
    // Google Books, Wikipedia) emit allowlisted hosts, so this should never
    // reject in practice — but it's the structural guarantee that bad URLs
    // can't leak into cover_url even if a source upstream changes its CDN.
    if (coverUrl && !isAllowedImageUrl(coverUrl)) {
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → REJECTED non-allowlisted host: ${coverUrl}`)
      coverUrl = null
    }

    if (coverUrl) {
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → ${source}`)
      found++
      foundBySource[source] = (foundBySource[source] ?? 0) + 1
      if (samples.length < 10) samples.push({ title: book.title, coverUrl, source })
      if (opts.apply) {
        const { error: ue } = await supabase
          .from('books')
          .update({ cover_url: coverUrl, cover_status: 'valid', cover_checked_at: nowIso })
          .eq('id', book.id)
          .is('cover_url', null)
        if (ue) { log(`    ✗ DB write failed: ${ue.message}`); errCount++ }
        else await supabase.from('cover_search_attempts').delete().eq('book_id', book.id)
      }
    } else if (placeholderTracker.sawPlaceholder) {
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → placeholder → rejected`)
      rejectedPlaceholder++
      if (samples.length < 10) samples.push({ title: book.title, coverUrl: null, source: '', reason: 'placeholder' })
      if (opts.apply) {
        const { error: ue } = await supabase
          .from('books')
          .update({ cover_status: 'rejected_placeholder', cover_checked_at: nowIso })
          .eq('id', book.id)
          .is('cover_url', null)
        if (ue) { log(`    ✗ DB write failed: ${ue.message}`); errCount++ }
        else {
          const allSources = [...new Set([...book.prevSources, ...newSources])]
          await supabase.from('cover_search_attempts').upsert(
            { book_id: book.id, last_searched_at: nowIso, sources_tried: allSources },
            { onConflict: 'book_id' },
          )
        }
      }
    } else {
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → not found`)
      stillFailed++
      if (samples.length < 10) samples.push({ title: book.title, coverUrl: null, source: '', reason: 'not_found' })
      if (opts.apply) {
        const allSources = [...new Set([...book.prevSources, ...newSources])]
        await supabase.from('cover_search_attempts').upsert(
          { book_id: book.id, last_searched_at: nowIso, sources_tried: allSources },
          { onConflict: 'book_id' },
        )
      }
    }

    await sleep(BOOK_DELAY_MS)
  }

  return {
    totalCandidates: toSearch.length,
    alreadyTried: alreadyDoneCount,
    processed: limit,
    found,
    rejectedPlaceholder,
    stillFailed,
    foundBySource,
    errors: errCount,
    samples,
  }
}
