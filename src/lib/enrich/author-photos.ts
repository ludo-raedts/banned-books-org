// Core author-photo enrichment logic (second-pass), callable from either the
// CLI script (scripts/enrich-author-photos-v2.ts) or the in-process API route
// (/api/admin/enrich/run). Two sources, in order:
//
//   1. Wikidata — wbsearchentities → must be human (P31=Q5) AND have a
//      writer-ish occupation (P106), then take the image (P18) and resolve
//      it to a Commons thumbnail.
//   2. OpenLibrary — /search/authors fallback, HEAD-checked photo URL.
//
// The CLI version writes a CSV log; the library version returns samples in
// the result instead. The script remains the source of truth for CSV logging.

import { adminClient } from '../supabase'

const DELAY_MS = 200
const UA = 'banned-books.org/1.0 (contact@banned-books.org)'

const WRITER_TERMS = [
  'writer', 'author', 'poet', 'novelist', 'journalist',
  'playwright', 'dramatist', 'essayist', 'screenwriter', 'columnist',
  'biographer', 'memoirist', 'translator', 'editor',
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson<T = unknown>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    return await res.json() as T
  } catch { return null }
}

interface WdSearchHit { id: string; label?: string; description?: string }
interface WdSearchResp { search?: WdSearchHit[] }
interface WdClaim { mainsnak?: { datavalue?: { value?: unknown } } }
interface WdEntity { claims?: Record<string, WdClaim[]> }
interface WdEntityResp { entities?: Record<string, WdEntity> }
interface WdLabelEntity { labels?: { en?: { value: string } } }
interface WdLabelResp { entities?: Record<string, WdLabelEntity> }
interface CommonsImageInfo { thumburl?: string }
interface CommonsPage { imageinfo?: CommonsImageInfo[] }
interface CommonsResp { query?: { pages?: Record<string, CommonsPage> } }

function claimIds(claims: Record<string, WdClaim[]> | undefined, prop: string): string[] {
  return (claims?.[prop] ?? [])
    .map(c => {
      const v = c.mainsnak?.datavalue?.value
      if (typeof v === 'object' && v !== null && 'id' in v) return (v as { id: string }).id
      return null
    })
    .filter((x): x is string => Boolean(x))
}

function claimString(claims: Record<string, WdClaim[]> | undefined, prop: string): string | null {
  const v = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value
  return typeof v === 'string' ? v : null
}

async function resolveCommonsImageUrl(filename: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + filename)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
  const data = await fetchJson<CommonsResp>(url)
  const pages = Object.values(data?.query?.pages ?? {})
  return pages[0]?.imageinfo?.[0]?.thumburl ?? null
}

interface PhotoResult {
  source: 'wikidata' | 'openlibrary' | null
  url: string | null
  meta: string
}

async function tryWikidata(name: string): Promise<PhotoResult> {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=5&format=json&origin=*`
  const search = await fetchJson<WdSearchResp>(searchUrl)
  const candidates = search?.search ?? []
  if (candidates.length === 0) return { source: null, url: null, meta: 'no wikidata match' }

  for (const cand of candidates) {
    await sleep(DELAY_MS)
    const ent = await fetchJson<WdEntityResp>(`https://www.wikidata.org/wiki/Special:EntityData/${cand.id}.json`)
    const claims = ent?.entities?.[cand.id]?.claims
    if (!claims) continue
    if (!claimIds(claims, 'P31').includes('Q5')) continue

    const occIds = claimIds(claims, 'P106')
    if (occIds.length === 0) continue

    await sleep(DELAY_MS)
    const labelsResp = await fetchJson<WdLabelResp>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${occIds.join('|')}&props=labels&languages=en&format=json&origin=*`
    )
    const occLabels = Object.values(labelsResp?.entities ?? {})
      .map(e => e?.labels?.en?.value)
      .filter((s): s is string => Boolean(s))
      .map(s => s.toLowerCase())
    const isWriter = occLabels.some(lbl => WRITER_TERMS.some(t => lbl.includes(t)))
    if (!isWriter) continue

    const imageFile = claimString(claims, 'P18')
    if (!imageFile) continue

    await sleep(DELAY_MS)
    const url = await resolveCommonsImageUrl(imageFile)
    if (!url) continue

    return { source: 'wikidata', url, meta: `qid=${cand.id} occ=${occLabels.slice(0, 2).join('/')}` }
  }
  return { source: null, url: null, meta: 'wikidata: no human writer with P18 found' }
}

interface OlAuthorDoc { key?: string; name?: string; work_count?: number; birth_date?: string }
interface OlAuthorResp { docs?: OlAuthorDoc[] }

async function tryOpenLibrary(name: string): Promise<PhotoResult> {
  const searchUrl = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=3`
  const data = await fetchJson<OlAuthorResp>(searchUrl)
  const docs = data?.docs ?? []
  if (docs.length === 0) return { source: null, url: null, meta: 'no openlibrary match' }

  for (const doc of docs) {
    if (!doc.key) continue
    if ((doc.work_count ?? 0) < 1) continue
    const photoUrl = `https://covers.openlibrary.org/a/olid/${doc.key}-L.jpg?default=false`
    await sleep(DELAY_MS)
    let head: Response
    try {
      head = await fetch(photoUrl, { method: 'HEAD', headers: { 'User-Agent': UA } })
    } catch { continue }
    if (head.ok) {
      return { source: 'openlibrary', url: photoUrl, meta: `olid=${doc.key} works=${doc.work_count ?? 0}` }
    }
  }
  return { source: null, url: null, meta: 'openlibrary: no match with photo' }
}

export type EnrichAuthorPhotosOpts = {
  apply: boolean
  limit?: number
  onProgress?: (msg: string) => void
}

export type EnrichAuthorPhotosResult = {
  totalCandidates: number
  processed: number
  accepted: number
  skipped: number
  bySource: { wikidata: number; openlibrary: number }
  errors: number
  // All per-author results — used by the CLI to write a comprehensive CSV.
  // The API route truncates this to <=10 before returning to the browser.
  results: Array<{ name: string; source: string | null; url: string | null; meta: string }>
}

export async function enrichAuthorPhotos(opts: EnrichAuthorPhotosOpts): Promise<EnrichAuthorPhotosResult> {
  const log = opts.onProgress ?? (() => {})
  const supabase = adminClient()
  const limit = opts.limit ?? 50

  const { data, error } = await supabase
    .from('authors')
    .select('id, display_name, slug')
    .is('photo_url', null)
    .not('slug', 'is', null)
    .order('display_name')
    .limit(limit)

  if (error) throw new Error(`DB read: ${error.message}`)

  type AuthorRow = { id: string; display_name: string; slug: string }
  const authors = (data ?? []) as AuthorRow[]
  log(`Authors without photo: ${authors.length}`)
  if (authors.length === 0) {
    return { totalCandidates: 0, processed: 0, accepted: 0, skipped: 0, bySource: { wikidata: 0, openlibrary: 0 }, errors: 0, results: [] }
  }

  let accepted = 0, skipped = 0, errCount = 0
  const bySource = { wikidata: 0, openlibrary: 0 }
  const results: EnrichAuthorPhotosResult['results'] = []

  for (let i = 0; i < authors.length; i++) {
    const author = authors[i]
    const wdResult = await tryWikidata(author.display_name)
    let result = wdResult
    if (!result.url) {
      await sleep(DELAY_MS)
      const olResult = await tryOpenLibrary(author.display_name)
      result = olResult.url
        ? olResult
        : { source: null, url: null, meta: `wd: ${wdResult.meta} | ol: ${olResult.meta}` }
    }

    const symbol = result.url ? '✓' : '✗'
    const sourceLabel = result.source ?? '—'
    log(`  [${i + 1}/${authors.length}] ${symbol} ${author.display_name} (${sourceLabel}) ${result.meta}`)
    results.push({ name: author.display_name, source: result.source, url: result.url, meta: result.meta })

    if (result.url) {
      if (result.source === 'wikidata') bySource.wikidata++
      if (result.source === 'openlibrary') bySource.openlibrary++
      if (opts.apply) {
        const { error: ue } = await supabase
          .from('authors')
          .update({ photo_url: result.url })
          .eq('id', author.id)
        if (ue) { log(`    ✗ DB write failed: ${ue.message}`); errCount++; skipped++; continue }
      }
      accepted++
    } else {
      skipped++
    }
    await sleep(DELAY_MS)
  }

  return {
    totalCandidates: authors.length,
    processed: authors.length,
    accepted,
    skipped,
    bySource,
    errors: errCount,
    results,
  }
}
