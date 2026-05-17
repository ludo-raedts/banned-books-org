// Core author-photo enrichment logic (second-pass), callable from either the
// CLI script (scripts/enrich-author-photos-v2.ts) or the in-process API route
// (/api/admin/enrich/run). Three sources, in order:
//
//   1. Wikidata — wbsearchentities → must be human (P31=Q5) AND have a
//      writer-ish occupation (P106), then take the image (P18) and resolve
//      it to a Commons thumbnail.
//   2. OpenLibrary — /search/authors fallback, HEAD-checked photo URL.
//   3. Site — Wikipedia title → QID → Wikidata P856 (official website) →
//      fetch site with a browser UA → JSON-LD Person.image only. We
//      considered also accepting og:image/twitter:image but they were 4/4
//      false positives in a sample run (logos, banners, ISBN-named book
//      covers) because templated author sites use them for site branding.
//      JSON-LD Person.image is semantically a portrait and has near-zero
//      false-positive rate, at the cost of much lower recall — most
//      author sites don't expose Person markup at all.
//
// The CLI version writes a CSV log; the library version returns samples in
// the result instead. The script remains the source of truth for CSV logging.

import { adminClient } from '../supabase'
import { authorLadder } from './_author-ladder'

const DELAY_MS = 200
const UA = 'banned-books.org/1.0 (contact@banned-books.org)'
// Author personal sites (Squarespace, Wix, Blogger, custom) often block bare
// `node` / `fetch` UAs. Use a desktop Chrome string for HTML-page fetches.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Sites we won't bother fetching — heavy bot protection that returns 403 for
// scripted GETs and almost never has a useful Person.image anyway.
const SITE_HOSTNAME_DENYLIST = new Set([
  'twitter.com', 'x.com', 'www.twitter.com', 'www.x.com',
  'facebook.com', 'www.facebook.com', 'instagram.com', 'www.instagram.com',
  'tiktok.com', 'www.tiktok.com', 'youtube.com', 'www.youtube.com',
])

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
  source: 'wikidata' | 'openlibrary' | 'site' | null
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

// ─── Site source ─────────────────────────────────────────────────────────────
//
// Wikipedia title → QID → validate human + writer → discover candidate sites
// (Wikidata P856 + Wikipedia External Links section) → fetch each → extract
// the most-likely-portrait image. We score images using two strong precision
// signals — JSON-LD `Person.image` markup and the author's name appearing in
// the image alt-text or filename. Together they reduce the false-positive
// rate that pure og:image suffered from (logos / banners / book covers on
// template-generated personal sites).

interface WikiSearchHit { title: string }
interface WikiSearchResp { query?: { search?: WikiSearchHit[] } }
interface WikiPagesResp { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } }
interface WikiExtlinksResp {
  query?: { pages?: Record<string, { extlinks?: Array<{ '*': string }> }> }
}

async function getWikiTitle(name: string): Promise<string | null> {
  const sUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json&origin=*`
  const s = await fetchJson<WikiSearchResp>(sUrl)
  return s?.query?.search?.[0]?.title ?? null
}

async function getQidFromTitle(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageprops&format=json&origin=*`
  const p = await fetchJson<WikiPagesResp>(url)
  const page = Object.values(p?.query?.pages ?? {})[0]
  return page?.pageprops?.wikibase_item ?? null
}

async function getWikipediaExtlinks(title: string): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extlinks&ellimit=50&format=json&origin=*`
  const data = await fetchJson<WikiExtlinksResp>(url)
  const page = Object.values(data?.query?.pages ?? {})[0]
  return (page?.extlinks ?? []).map(e => e['*']).filter(Boolean)
}

// Hostname-substring denylist of sites that aren't the author's own homepage
// even if they happen to be linked from Wikipedia. These are aggregators,
// social profiles, and retailer pages — none of them yield reliable
// author-portrait extraction (social = bot blocks, retailers = book covers).
const EXTLINK_HOSTNAME_DENY = [
  'wikipedia.org', 'wikimedia.org', 'wikidata.org', 'wikisource.org',
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com',
  'youtube.com', 'youtu.be', 'linkedin.com', 'tumblr.com', 'reddit.com',
  'amazon.com', 'amazon.co.uk', 'goodreads.com', 'imdb.com',
  'penguinrandomhouse.com', 'harpercollins.com', 'simonandschuster.com',
  'us.macmillan.com', 'panmacmillan.com', 'hachettebookgroup.com',
  'nytimes.com', 'theguardian.com', 'washingtonpost.com', 'npr.org',
  'bbc.co.uk', 'bbc.com', 'cnn.com', 'newyorker.com', 'theatlantic.com',
  'jstor.org', 'doi.org', 'academia.edu', 'researchgate.net', 'archive.org',
  'spotify.com', 'soundcloud.com', 'vimeo.com', 'patreon.com',
  'substack.com', 'medium.com', 'twitch.tv', 'flickr.com',
  'viaf.org', 'isni.org', 'd-nb.info', 'bnf.fr', 'loc.gov',
]

function isPlausibleAuthorHomepage(url: string, nameTokens: string[]): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (!/^https?:$/.test(parsed.protocol)) return false
  const host = parsed.hostname.toLowerCase()
  if (EXTLINK_HOSTNAME_DENY.some(d => host === d || host.endsWith('.' + d))) return false
  // Strong signal: hostname contains one of the author's name tokens. This
  // is the typical pattern for personal author sites (mindymcginnis.com,
  // shaundavidhutchinson.com, www.aaronstarmer.com).
  return nameTokens.some(t => host.includes(t))
}

async function discoverAuthorSites(qid: string, title: string, nameTokens: string[]): Promise<string[]> {
  const sites: string[] = []
  const seen = new Set<string>()
  const add = (url: string) => {
    try {
      const u = new URL(url)
      // Strip fragment; normalise.
      const norm = `${u.protocol}//${u.host}${u.pathname}`
      if (!seen.has(norm)) { seen.add(norm); sites.push(url) }
    } catch { /* skip invalid */ }
  }

  const ent = await fetchJson<WdEntityResp>(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
  const p856 = claimString(ent?.entities?.[qid]?.claims, 'P856')
  if (p856) add(p856)

  await sleep(DELAY_MS)
  const ext = await getWikipediaExtlinks(title)
  for (const url of ext) {
    if (isPlausibleAuthorHomepage(url, nameTokens)) add(url)
  }
  return sites
}

// Returns the author's name broken into search-tokens of length >= 3,
// lowercased, accent-stripped. Used to score images by alt-text / filename
// matches and to filter Wikipedia extlinks by hostname.
function nameTokens(name: string): string[] {
  return name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3)
}

// Defence-in-depth filename filter. Rejects obvious non-portrait images even
// if they're served from a JSON-LD Person.image tag or matched by name in
// alt text. False negatives are cheap (we just don't pick that image);
// false positives pollute the photo column permanently. We use a generous
// non-alphanumeric separator class (`[^a-z0-9]`) instead of `[-_/.]` because
// Squarespace + WordPress CDNs encode spaces as `+` / `%2B`, which the
// stricter class missed (e.g. `blacktabby+logo-white.png`).
const NON_PORTRAIT_KEYWORDS = [
  'logo', 'banner', 'header', 'favicon', 'placeholder', 'sprite',
  'background', 'hero', 'wallpaper', 'lettering', 'typography',
  'instagram', 'facebook', 'twitter', 'youtube', 'tiktok',
  'icon', 'social',
]
function isObviouslyNotAPortrait(url: string): boolean {
  const lower = decodeURIComponent(url).toLowerCase()
  if (/\b97[89]\d{10}\b/.test(lower)) return true // ISBN-13 used as filename
  if (/(^|[^a-z0-9])cover[^a-z0-9]/.test(lower)) return true   // book cover patterns
  for (const kw of NON_PORTRAIT_KEYWORDS) {
    const re = new RegExp(`(^|[^a-z0-9])${kw}(?=[^a-z0-9]|$)`)
    if (re.test(lower)) return true
  }
  // Tiny standalone icons (ig.png, fb.svg, x.png on their own as filenames)
  if (/\/(ig|fb|tw|yt|tt|li)\.(png|svg|gif|jpg|jpeg|webp)$/i.test(lower)) return true
  return false
}

const PORTRAIT_HINTS = ['headshot', 'portrait', 'author photo', 'photo of', 'author-photo', 'author_photo', 'profile']

type ImageCandidate = { url: string; score: number; reason: string }

function extractBestAuthorImage(
  html: string,
  baseUrl: string,
  tokens: string[],
): ImageCandidate | null {
  const resolve = (raw: string): string | null => {
    if (!raw) return null
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('data:')) return null
    try { return new URL(trimmed, baseUrl).toString() } catch { return null }
  }

  const candidates: ImageCandidate[] = []

  // 1. JSON-LD Person.image (semantic, highest priority).
  const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of ldMatches) {
    try {
      const json = JSON.parse(m[1].trim())
      const blocks = Array.isArray(json) ? json : [json]
      for (const blk of blocks) {
        const items = blk['@graph'] && Array.isArray(blk['@graph']) ? blk['@graph'] : [blk]
        for (const it of items) {
          if (it?.['@type'] === 'Person' && it.image) {
            const raw: unknown = typeof it.image === 'string' ? it.image : it.image?.url ?? it.image?.['@id']
            const resolved = typeof raw === 'string' ? resolve(raw) : null
            if (resolved && !isObviouslyNotAPortrait(resolved)) {
              candidates.push({ url: resolved, score: 100, reason: 'ld+json Person.image' })
            }
          }
        }
      }
    } catch { /* malformed JSON-LD — try next block */ }
  }

  // 2. Walk <img> tags; score by alt/path containing author tokens and
  //    portrait hints. We score against the URL's *path* only (not its
  //    hostname), because candidate sites are pre-selected to have the
  //    author's name in the hostname — so a hostname token match carries
  //    zero information. The path (folder + filename) is the real signal.
  const imgTags = html.matchAll(/<img\b([^>]+)>/gi)
  for (const m of imgTags) {
    const attrs = m[1]
    const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1]
      ?? attrs.match(/\bdata-src=["']([^"']+)["']/i)?.[1]
      ?? attrs.match(/\bdata-lazy-src=["']([^"']+)["']/i)?.[1]
    if (!src) continue
    const resolved = resolve(src)
    if (!resolved) continue
    if (isObviouslyNotAPortrait(resolved)) continue
    const alt = (attrs.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '').toLowerCase()
    let pathLower: string
    try { pathLower = decodeURIComponent(new URL(resolved).pathname).toLowerCase() }
    catch { pathLower = resolved.toLowerCase() }

    let score = 0
    const reasons: string[] = []
    const tokensInAlt = tokens.filter(t => alt.includes(t)).length
    const tokensInPath = tokens.filter(t => pathLower.includes(t)).length
    if (tokens.length > 0 && tokensInAlt === tokens.length) { score += 40; reasons.push('alt=full name') }
    else if (tokensInAlt > 0) { score += 15 * tokensInAlt; reasons.push(`alt=${tokensInAlt}/${tokens.length} tokens`) }
    if (tokens.length > 0 && tokensInPath === tokens.length) { score += 30; reasons.push('path=full name') }
    else if (tokensInPath > 0) { score += 10 * tokensInPath; reasons.push(`path=${tokensInPath}/${tokens.length} tokens`) }
    if (PORTRAIT_HINTS.some(h => alt.includes(h))) { score += 15; reasons.push('alt has portrait hint') }
    if (PORTRAIT_HINTS.some(h => pathLower.includes(h.replace(/\s/g, '')))) { score += 10; reasons.push('path has portrait hint') }

    // Require some real name signal in the path or alt-text. Pure portrait
    // hints aren't enough — the word "photo" / "profile" appears on many
    // theme assets and template stock images.
    if (tokensInAlt + tokensInPath === 0) continue
    if (score >= 25) candidates.push({ url: resolved, score, reason: reasons.join(', ') })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

async function trySite(name: string): Promise<PhotoResult> {
  const wikiTitle = await getWikiTitle(name)
  if (!wikiTitle) return { source: null, url: null, meta: 'site: no Wikipedia match' }
  await sleep(DELAY_MS)

  const qid = await getQidFromTitle(wikiTitle)
  if (!qid) return { source: null, url: null, meta: `site: ${wikiTitle} no QID` }
  await sleep(DELAY_MS)

  // Verify the QID is a human writer before trusting anything from it.
  // Wikipedia's search endpoint is fuzzy — for editorial-committee names and
  // foreign-script titles it cheerfully returns a tangentially-related page,
  // and we don't want the wrong entity's site wired up as someone's portrait.
  const ent = await fetchJson<WdEntityResp>(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
  const claims = ent?.entities?.[qid]?.claims
  if (!claims) return { source: null, url: null, meta: `site: ${qid} no claims` }
  if (!claimIds(claims, 'P31').includes('Q5')) {
    return { source: null, url: null, meta: `site: ${qid} not a human (P31)` }
  }
  const occIds = claimIds(claims, 'P106')
  if (occIds.length === 0) return { source: null, url: null, meta: `site: ${qid} no P106` }
  await sleep(DELAY_MS)
  const labelsResp = await fetchJson<WdLabelResp>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${occIds.join('|')}&props=labels&languages=en&format=json&origin=*`
  )
  const occLabels = Object.values(labelsResp?.entities ?? {})
    .map(e => e?.labels?.en?.value)
    .filter((s): s is string => Boolean(s))
    .map(s => s.toLowerCase())
  if (!occLabels.some(lbl => WRITER_TERMS.some(t => lbl.includes(t)))) {
    return { source: null, url: null, meta: `site: ${qid} not a writer (P106=${occLabels.slice(0, 2).join('/')})` }
  }

  const tokens = nameTokens(name)
  const sites = await discoverAuthorSites(qid, wikiTitle, tokens)
  if (sites.length === 0) return { source: null, url: null, meta: `site: ${qid} no candidate sites (no P856, no name-matched extlinks)` }

  const tried: string[] = []
  for (const url of sites.slice(0, 3)) {
    let host: string
    try { host = new URL(url).hostname.toLowerCase() }
    catch { continue }
    if (SITE_HOSTNAME_DENYLIST.has(host)) continue

    await sleep(DELAY_MS)
    let res: Response
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      })
    } catch {
      tried.push(`${host}=fetch-err`)
      continue
    }
    if (!res.ok) { tried.push(`${host}=${res.status}`); continue }
    const html = await res.text()
    const img = extractBestAuthorImage(html, res.url, tokens)
    if (img) {
      return { source: 'site', url: img.url, meta: `${qid} ${host} score=${img.score} (${img.reason})` }
    }
    tried.push(`${host}=no-match`)
  }
  return { source: null, url: null, meta: `site: ${qid} tried [${tried.join(', ')}]` }
}

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
  bySource: { wikidata: number; openlibrary: number; site: number }
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
    .select('id, display_name, slug, name_native, name_transliterated, name_english, original_language')
    .is('photo_url', null)
    .not('slug', 'is', null)
    .order('display_name')
    .limit(limit)

  if (error) throw new Error(`DB read: ${error.message}`)

  type AuthorRow = {
    id: string
    display_name: string
    slug: string
    name_native: string | null
    name_transliterated: string | null
    name_english: string | null
    original_language: string | null
  }
  const authors = (data ?? []) as AuthorRow[]
  log(`Authors without photo: ${authors.length}`)
  if (authors.length === 0) {
    return { totalCandidates: 0, processed: 0, accepted: 0, skipped: 0, bySource: { wikidata: 0, openlibrary: 0, site: 0 }, errors: 0, results: [] }
  }

  let accepted = 0, skipped = 0, errCount = 0
  const bySource = { wikidata: 0, openlibrary: 0, site: 0 }
  const results: EnrichAuthorPhotosResult['results'] = []

  for (let i = 0; i < authors.length; i++) {
    const author = authors[i]
    // Walk the name ladder: for non-English authors the English pen name
    // (if known) or canonical anglicised display_name is tried first
    // against Wikidata + Open Library — Anglo-indexed photo sources have
    // far higher hit rates on Latin names. Transliterations and native
    // script are last-resort fallbacks. First successful URL wins.
    const ladder = authorLadder(author)
    let result: PhotoResult = { source: null, url: null, meta: 'no variants to try' }
    const metaParts: string[] = []
    for (const variant of ladder) {
      const wdResult = await tryWikidata(variant.name)
      if (wdResult.url) {
        result = { ...wdResult, meta: `${wdResult.meta} [via ${variant.source}]` }
        break
      }
      metaParts.push(`wd[${variant.source}]: ${wdResult.meta}`)
      await sleep(DELAY_MS)
      const olResult = await tryOpenLibrary(variant.name)
      if (olResult.url) {
        result = { ...olResult, meta: `${olResult.meta} [via ${variant.source}]` }
        break
      }
      metaParts.push(`ol[${variant.source}]: ${olResult.meta}`)
      await sleep(DELAY_MS)
      const siteResult = await trySite(variant.name)
      if (siteResult.url) {
        result = { ...siteResult, meta: `${siteResult.meta} [via ${variant.source}]` }
        break
      }
      metaParts.push(`site[${variant.source}]: ${siteResult.meta}`)
      await sleep(DELAY_MS)
    }
    if (!result.url) {
      result = { source: null, url: null, meta: metaParts.slice(0, 3).join(' | ') }
    }

    const symbol = result.url ? '✓' : '✗'
    const sourceLabel = result.source ?? '—'
    log(`  [${i + 1}/${authors.length}] ${symbol} ${author.display_name} (${sourceLabel}) ${result.meta}`)
    results.push({ name: author.display_name, source: result.source, url: result.url, meta: result.meta })

    if (result.url) {
      if (result.source === 'wikidata') bySource.wikidata++
      if (result.source === 'openlibrary') bySource.openlibrary++
      if (result.source === 'site') bySource.site++
      if (opts.apply) {
        const { error: ue } = await supabase
          .from('authors')
          .update({ photo_url: result.url })
          .eq('id', author.id)
          .is('photo_url', null)
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
