// Anti-hallucination check for Gemini-grounded cover URLs.
//
// Gemini sometimes returns a plausible-looking image URL that isn't actually
// on the source page it cited — either a fabricated CDN path, or the cover of
// a different edition, or just a paste from training data that 404s today.
// We mitigate by:
//   1. Fetching the source_page_url HTML
//   2. Checking the candidate image_url appears in the HTML (as src=, href=,
//      og:image, link rel=image_src, twitter:image, or background-image URL)
//   3. Also accepting "stem matches" — same filename basename across CDN
//      hosts, or same path under a different CDN subdomain, since publishers
//      rotate image hosts but keep stable basenames
//
// If the page can't be fetched (geo-block, 403, timeout) we fall back to an
// HTTP HEAD on the image URL alone and trust that — better than refusing
// every Chinese-site result.

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 8000

export type CoverVerification =
  | { ok: true;  via: 'page' | 'head-only'; finalUrl: string }
  | { ok: false; reason: string }

function basenameOf(url: string): string | null {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (!last) return null
    return last.split('?')[0].split('#')[0]
  } catch { return null }
}

export async function verifyCoverOnPage(imageUrl: string, sourcePageUrl: string | null): Promise<CoverVerification> {
  // No source page → HEAD-only check.
  if (!sourcePageUrl) return headOnly(imageUrl, 'no source_page_url')

  let pageRes: Response
  try {
    pageRes = await fetch(sourcePageUrl, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (e) {
    return headOnly(imageUrl, `source page fetch failed: ${e instanceof Error ? e.message : 'unknown'}`)
  }
  if (!pageRes.ok) return headOnly(imageUrl, `source page HTTP ${pageRes.status}`)

  const html = await pageRes.text()
  const candidateBasename = basenameOf(imageUrl)

  // Exact substring match — covers src=, href=, og:image content="…", etc.
  if (html.includes(imageUrl)) {
    return { ok: true, via: 'page', finalUrl: imageUrl }
  }

  // URL-encoded variant (some publishers encode the URL in JSON-LD).
  if (html.includes(encodeURI(imageUrl))) {
    return { ok: true, via: 'page', finalUrl: imageUrl }
  }

  // Basename match — accept if the same filename appears anywhere in the
  // HTML, even on a different CDN host. Used by Douban + books.com.tw where
  // the image is served from cdn-XYZ.douban.com but the page references it
  // with a different subdomain.
  if (candidateBasename && candidateBasename.length >= 8 && html.includes(candidateBasename)) {
    return { ok: true, via: 'page', finalUrl: imageUrl }
  }

  return { ok: false, reason: `image not referenced on source page (basename=${candidateBasename ?? '?'})` }
}

async function headOnly(imageUrl: string, fallbackReason: string): Promise<CoverVerification> {
  try {
    const res = await fetch(imageUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, reason: `${fallbackReason}; HEAD ${res.status}` }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.startsWith('image/')) return { ok: false, reason: `${fallbackReason}; HEAD content-type=${ct}` }
    return { ok: true, via: 'head-only', finalUrl: imageUrl }
  } catch (e) {
    return { ok: false, reason: `${fallbackReason}; HEAD failed: ${e instanceof Error ? e.message : 'unknown'}` }
  }
}
