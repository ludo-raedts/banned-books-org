// Core cover-image enrichment logic, callable from either the CLI script
// (scripts/enrich-covers-v2.ts) or the in-process API route
// (/api/admin/enrich/run). Strategies, tried in order per book:
//
//   1. Google Books title-only (no inauthor:) — highest hit rate
//   2. Open Library title-only
//   3. Open Library stripped-subtitle search
//   4. Wikipedia page thumbnail
//
// Google Books URLs are pHash-checked against the official placeholder; matches
// are rejected and the book gets cover_status='rejected_placeholder' so future
// runs skip it. Books with cover_status in (rejected_placeholder, manual_override)
// are skipped unless `force` is true.

import { adminClient } from '../supabase'
import { checkImageUrl, repairGbStrip } from './_placeholder'
import { titleLadder } from './_title-ladder'
import { titlesMatch } from './title-match'
import { isAllowedImageUrl } from '../allowed-image-hosts'

const OL_DELAY_MS   = 200
const GB_DELAY_MS   = 600
const WIKI_DELAY_MS = 200
const BOOK_DELAY_MS = 200

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const NEW_SOURCES = ['ol_title_only', 'ol_stripped', 'gb_title_only', 'wikipedia']

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

function transformGBUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '')
    .replace('edge=curl&', '')
    .replace('edge=curl', '')
}

async function gbSearch(query: string, expectedTitle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&fields=items(volumeInfo(title,imageLinks))`
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { title?: string; imageLinks?: { large?: string; medium?: string; thumbnail?: string } } }>
    }
    for (const item of json.items ?? []) {
      // Title-search returns the most-popular sibling for an obscure query;
      // require the volume's own title to contain every significant word of
      // ours before trusting its cover.
      if (!titlesMatch(expectedTitle, item.volumeInfo?.title ?? '')) continue
      const img = item.volumeInfo?.imageLinks?.large
        ?? item.volumeInfo?.imageLinks?.medium
        ?? item.volumeInfo?.imageLinks?.thumbnail
      if (img) return transformGBUrl(img)
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
        id, slug, title, openlibrary_work_id, cover_status,
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

  async function gbSearchVerified(q: string, expectedTitle: string, tracker: { sawPlaceholder: boolean }): Promise<string | null> {
    const url = await gbSearch(q, expectedTitle)
    if (!url) return null
    const check = await checkImageUrl(url)
    if (check.ok === false) {
      if (check.reason === 'placeholder') tracker.sawPlaceholder = true
      else return url // transient fetch failure — keep prior lenient behaviour
      return null
    }
    // Reject/repair degenerate horizontal strips (top sliver of the cover that
    // Google returns at zoom=3 for some books). Falls back to zoom=1 or null.
    return repairGbStrip(url, check.width, check.height)
  }

  let found = 0, stillFailed = 0, rejectedPlaceholder = 0, errCount = 0
  const foundBySource: Record<string, number> = {}
  const samples: EnrichCoversResult['samples'] = []

  for (let i = 0; i < limit; i++) {
    const book = toSearch[i]
    const author = book.author ?? ''
    const ladder = titleLadder(book)
    let coverUrl: string | null = null
    let source = ''
    const newSources: string[] = []
    const placeholderTracker = { sawPlaceholder: false }

    try {
      // Walk the title ladder; for each variant try GB → OL → OL-stripped →
      // Wikipedia in order. First hit (across all variants) wins. The
      // `newSources` list is annotated with the variant tag (e.g.
      // 'gb_title_only:english_meaningful') so cover_search_attempts records
      // which title variant we actually probed.
      for (const variant of ladder) {
        if (coverUrl) break
        const tag = variant.source === 'canonical' ? '' : `:${variant.source}`
        const stripped = stripSubtitle(variant.title)

        newSources.push(`gb_title_only${tag}`)
        coverUrl = await gbSearchVerified(`intitle:${variant.title}`, variant.title, placeholderTracker)
          ?? await gbSearchVerified(variant.title, variant.title, placeholderTracker)
        if (coverUrl) { source = `GB-title-only${tag}`; break }

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
