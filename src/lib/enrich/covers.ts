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
import { checkImageUrl } from './_placeholder'

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

async function olSearch(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
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
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    for (const doc of json.docs ?? []) {
      if (doc.cover_i) {
        return {
          coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
          workId: doc.key?.replace('/works/', '') ?? null,
        }
      }
    }
    const workId = json.docs?.[0]?.key?.replace('/works/', '') ?? null
    return { coverUrl: null, workId }
  } catch { return { coverUrl: null, workId: null } }
}

function transformGBUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '')
    .replace('edge=curl&', '')
    .replace('edge=curl', '')
}

async function gbSearch(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&fields=items(volumeInfo(title,imageLinks))`
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { imageLinks?: { large?: string; medium?: string; thumbnail?: string } } }>
    }
    for (const item of json.items ?? []) {
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
  openlibrary_work_id: string | null
  author: string | null
  prevSources: string[]
}

export type EnrichCoversOpts = {
  apply: boolean
  limit?: number
  reset?: boolean
  force?: boolean
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

  let query = supabase
    .from('books')
    .select(`
      id, slug, title, openlibrary_work_id, cover_status,
      cover_search_attempts!inner(sources_tried),
      book_authors!left(authors!left(display_name))
    `)
    .is('cover_url', null)
    .order('title')

  if (!opts.force) {
    query = query.or('cover_status.is.null,cover_status.eq.valid')
  }

  const { data: eligible, error } = await query
  if (error) throw new Error(`DB read: ${error.message}`)

  type RawRow = {
    id: number; slug: string; title: string
    openlibrary_work_id: string | null
    cover_status: string | null
    cover_search_attempts: Array<{ sources_tried: string[] }>
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }
  const all = (eligible ?? []) as unknown as RawRow[]

  const toSearch: BookRow[] = []
  let alreadyDoneCount = 0
  for (const row of all) {
    const prevSources = row.cover_search_attempts?.[0]?.sources_tried ?? []
    const hasNewSources = NEW_SOURCES.some(s => prevSources.includes(s))
    if (!opts.reset && hasNewSources) { alreadyDoneCount++; continue }
    toSearch.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
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

  async function gbSearchVerified(q: string, tracker: { sawPlaceholder: boolean }): Promise<string | null> {
    const url = await gbSearch(q)
    if (!url) return null
    const check = await checkImageUrl(url)
    if (check.ok === false && check.reason === 'placeholder') {
      tracker.sawPlaceholder = true
      return null
    }
    return url
  }

  let found = 0, stillFailed = 0, rejectedPlaceholder = 0, errCount = 0
  const foundBySource: Record<string, number> = {}
  const samples: EnrichCoversResult['samples'] = []

  for (let i = 0; i < limit; i++) {
    const book = toSearch[i]
    const author = book.author ?? ''
    const stripped = stripSubtitle(book.title)
    let coverUrl: string | null = null
    let source = ''
    const newSources: string[] = []
    const placeholderTracker = { sawPlaceholder: false }

    try {
      if (!coverUrl) {
        newSources.push('gb_title_only')
        coverUrl = await gbSearchVerified(`intitle:${book.title}`, placeholderTracker)
          ?? await gbSearchVerified(book.title, placeholderTracker)
        if (coverUrl) source = 'GB-title-only'
      }
      if (!coverUrl) {
        newSources.push('ol_title_only')
        const { coverUrl: url, workId } = await olSearch(book.title, '')
        if (url) { coverUrl = url; source = 'OL-title-only' }
        if (workId && !book.openlibrary_work_id && opts.apply) {
          await supabase.from('books').update({ openlibrary_work_id: workId }).eq('id', book.id)
        }
      }
      if (!coverUrl && stripped !== book.title) {
        newSources.push('ol_stripped')
        const { coverUrl: url } = await olSearch(stripped, author)
        if (url) { coverUrl = url; source = 'OL-stripped' }
      }
      if (!coverUrl) {
        newSources.push('wikipedia')
        const url = await wikipediaCover(book.title, author)
        if (url) { coverUrl = url; source = 'Wikipedia' }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → ERROR: ${msg}`)
      errCount++
      await sleep(BOOK_DELAY_MS)
      continue
    }

    const nowIso = new Date().toISOString()

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
