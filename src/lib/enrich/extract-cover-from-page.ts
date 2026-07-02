// Given a Gemini-found book page URL, extract a usable cover image URL.
//
// Built because Gemini's grounding tool returns search-snippet-derived image
// URLs that are frequently wrong or hallucinated, while the underlying source
// pages (Douban, Books.com.tw, HKBookCity, Eslite, etc.) reliably expose the
// real cover via og:image / twitter:image / JSON-LD image, OR via a known
// deterministic URL pattern derived from a product ID on the page URL itself.
//
// Resolution order:
//   1. If the URL is a Vertex AI redirect (Gemini grounding wraps cited URLs),
//      follow it to the real destination.
//   2. Site-specific extractors that don't require fetching HTML — currently
//      books.com.tw, which has a deterministic im2 proxy pattern.
//   3. Fetch the HTML and try, in order: og:image, twitter:image, JSON-LD
//      "image" field, link rel=image_src. Reject obvious site logos (paths
//      that look like /logo.jpg, /default.png, etc).
//   4. If the plain fetch is bot-blocked and the caller opted in
//      (firecrawlFallback), retry once through Firecrawl browser rendering
//      and run the same meta-tag ladder on its HTML.
//
// Returns the resolved page URL too, so callers can use it as the Referer for
// the eventual image download.

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 10000

export type CoverExtraction =
  | { ok: true;  imageUrl: string; resolvedPageUrl: string; via: string }
  | { ok: false; reason: string }

export type ExtractOpts = {
  // When the plain fetch is bot-blocked (Cloudflare 403/challenge — the norm
  // on wook.pt, bertrand.pt, fnac.pt, goodreads), retry the page once through
  // Firecrawl's browser rendering. Costs Firecrawl credits, so opt-in.
  firecrawlFallback?: boolean
}

export async function extractCoverFromPage(pageUrl: string, opts: ExtractOpts = {}): Promise<CoverExtraction> {
  // 1. Vertex AI redirect → resolve.
  const resolved = await resolveRedirect(pageUrl)
  if (!resolved) return { ok: false, reason: `couldn't resolve URL ${pageUrl}` }

  // 2. Site-specific deterministic patterns.
  const direct = directPattern(resolved)
  if (direct) return { ok: true, imageUrl: direct, resolvedPageUrl: resolved, via: 'pattern' }

  // 3. Fetch HTML and look for cover meta tags.
  let html: string | null = null
  let finalUrl = resolved
  let blockReason = ''
  try {
    const res = await fetch(resolved, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh-HK;q=0.9,zh;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      blockReason = `page HTTP ${res.status}`
    } else if (res.url && res.url !== resolved && (new URL(res.url).pathname === '/' || new URL(res.url).pathname === '')) {
      // Some sites (Readmoo, books.com.tw) silently redirect 404s to a generic
      // landing page that returns 200. Treat redirects to a root-path URL as a
      // soft-404 — the book is gone, the cover won't be on this page. This is
      // a real miss, not a block: Firecrawl won't see anything different.
      return { ok: false, reason: `soft-404: redirected to root ${res.url}` }
    } else {
      if (res.url && res.url !== resolved) finalUrl = res.url
      html = await res.text()
    }
  } catch (e) {
    blockReason = `page fetch failed: ${e instanceof Error ? e.message : 'unknown'}`
  }

  if (html) {
    const found = extractFromHtml(html, finalUrl, '')
    if (found) return found
  }

  // 4. Bot-blocked (or fetched fine but the challenge page had no metadata —
  // Cloudflare "202 challenge" pages return 200-ish shells): one Firecrawl
  // retry when the caller opted in.
  if (opts.firecrawlFallback && (blockReason || !html)) {
    const { firecrawlFetchPage } = await import('./firecrawl-fetch')
    const fc = await firecrawlFetchPage(resolved)
    if (!fc.ok) {
      return { ok: false, reason: `${blockReason || 'no html'}; firecrawl: ${fc.reason}` }
    }
    if (fc.ogImage && !isObviouslyNotACover(fc.ogImage, fc.finalUrl)) {
      return { ok: true, imageUrl: fc.ogImage, resolvedPageUrl: fc.finalUrl, via: 'firecrawl:og:image' }
    }
    const found = extractFromHtml(fc.html, fc.finalUrl, 'firecrawl:')
    if (found) return found
    return { ok: false, reason: `no usable cover meta on ${new URL(fc.finalUrl).hostname} (via firecrawl)` }
  }

  if (blockReason) return { ok: false, reason: blockReason }
  return { ok: false, reason: `no usable cover meta on ${new URL(finalUrl).hostname}` }
}

// The meta-tag ladder shared by the plain-fetch and Firecrawl paths:
// og:image → twitter:image → JSON-LD image → link rel=image_src.
function extractFromHtml(html: string, finalUrl: string, viaPrefix: string): CoverExtraction | null {
  const og = extractOgImage(html)
  if (og && !isObviouslyNotACover(og, finalUrl)) {
    return { ok: true, imageUrl: og, resolvedPageUrl: finalUrl, via: `${viaPrefix}og:image` }
  }

  const tw = extractMeta(html, 'twitter:image')
  if (tw && !isObviouslyNotACover(tw, finalUrl)) {
    return { ok: true, imageUrl: tw, resolvedPageUrl: finalUrl, via: `${viaPrefix}twitter:image` }
  }

  const jsonLd = extractJsonLdImage(html)
  if (jsonLd && !isObviouslyNotACover(jsonLd, finalUrl)) {
    return { ok: true, imageUrl: jsonLd, resolvedPageUrl: finalUrl, via: `${viaPrefix}json-ld` }
  }

  const linkRel = extractLinkImageSrc(html)
  if (linkRel && !isObviouslyNotACover(linkRel, finalUrl)) {
    return { ok: true, imageUrl: linkRel, resolvedPageUrl: finalUrl, via: `${viaPrefix}link-rel` }
  }

  return null
}

// Vertex AI grounding redirect → underlying URL. The redirect returns HTML
// with a meta-refresh OR a 302; both work via fetch follow.
async function resolveRedirect(url: string): Promise<string | null> {
  if (!url.includes('vertexaisearch.cloud.google.com')) return url
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (res.url && !res.url.includes('vertexaisearch')) return res.url
    // Some grounding redirects come back as HTML with a meta refresh.
    const html = await res.text()
    const meta = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;]*;\s*url=([^"']+)["']/i)
    if (meta?.[1]) return meta[1]
    const link = html.match(/<a[^>]+href=["']([^"']+)["']/)
    if (link?.[1]) return link[1]
    return null
  } catch {
    return null
  }
}

// Site-specific URL constructors. Add to this map as we observe more sites.
function directPattern(pageUrl: string): string | null {
  let u: URL
  try { u = new URL(pageUrl) } catch { return null }

  // books.com.tw — product ID is in /products/<10-digit-id>.
  // CDN path is /img/AAA/BBB/CC/<id>.jpg where AAA/BBB/CC are the first
  // 3/next-3/next-2 chars of the 10-digit ID. The bare CDN URL 403s, so
  // wrap it in the im2.book.com.tw/image/getImage proxy which doesn't.
  if (u.hostname === 'www.books.com.tw' || u.hostname === 'books.com.tw') {
    const m = u.pathname.match(/\/products\/(\d{10})/)
    if (m) {
      const id = m[1]
      const path = `${id.slice(0, 3)}/${id.slice(3, 6)}/${id.slice(6, 8)}/${id}.jpg`
      return `https://im2.book.com.tw/image/getImage?i=https://www.books.com.tw/img/${path}`
    }
  }
  return null
}

function extractOgImage(html: string): string | null {
  // Both attribute orders are common. Match either property-first or
  // content-first. Accept single or double quotes.
  const re1 = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  const re2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null
}

function extractMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i')
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null
}

function extractJsonLdImage(html: string): string | null {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of scripts) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const found = findImageInJsonLd(parsed)
      if (found) return found
    } catch { /* malformed JSON-LD, try the next block */ }
  }
  return null
}

function findImageInJsonLd(node: unknown): string | null {
  if (!node) return null
  if (typeof node === 'string') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findImageInJsonLd(item); if (r) return r
    }
    return null
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if (typeof obj.image === 'string') return obj.image
    if (Array.isArray(obj.image) && typeof obj.image[0] === 'string') return obj.image[0]
    if (typeof obj.image === 'object' && obj.image && typeof (obj.image as Record<string, unknown>).url === 'string') {
      return (obj.image as Record<string, unknown>).url as string
    }
    for (const v of Object.values(obj)) {
      const r = findImageInJsonLd(v); if (r) return r
    }
  }
  return null
}

function extractLinkImageSrc(html: string): string | null {
  const re = /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  return html.match(re)?.[1] ?? null
}

// Reject obvious non-cover URLs that show up in og:image when a page has no
// real cover (site logos, default placeholder graphics, social-share images).
function isObviouslyNotACover(imageUrl: string, pageUrl: string): boolean {
  const lower = imageUrl.toLowerCase()
  if (/\b(logo|default|placeholder|nocover|no-cover|nopic|share|favicon)\b/.test(lower)) return true
  // og:image identical to the page favicon: rare but seen on small sites.
  try {
    const ipath = new URL(imageUrl).pathname.toLowerCase()
    const ppath = new URL(pageUrl).pathname.toLowerCase()
    if (ipath === '/' || ipath === ppath) return true
  } catch { /* malformed; pass through */ }
  return false
}
