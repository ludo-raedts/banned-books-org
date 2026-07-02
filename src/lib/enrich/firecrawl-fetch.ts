// Firecrawl-backed page fetch, used ONLY as a fallback when a plain fetch is
// bot-blocked (Cloudflare 403/202 challenges on wook.pt, bertrand.pt, fnac.pt,
// goodreads, …). Firecrawl renders the page in a real browser and returns the
// raw HTML plus parsed metadata (og:image included), which is exactly what
// extract-cover-from-page needs.
//
// Every call costs Firecrawl credits, so callers must treat this as a scarce
// resource: try the free path first, call this at most once per page, and
// report the tally (getFirecrawlCallCount) at the end of a run.

export type FirecrawlPageResult =
  | { ok: true; html: string; ogImage: string | null; finalUrl: string }
  | { ok: false; reason: string }

let callCount = 0
export function getFirecrawlCallCount(): number { return callCount }

export async function firecrawlFetchPage(url: string): Promise<FirecrawlPageResult> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return { ok: false, reason: 'FIRECRAWL_API_KEY not set' }
  callCount++
  let res: Response
  try {
    res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false, timeout: 30000 }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (e) {
    return { ok: false, reason: `firecrawl fetch failed: ${e instanceof Error ? e.message : 'unknown'}` }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, reason: `firecrawl HTTP ${res.status}: ${body.slice(0, 160)}` }
  }
  const json = await res.json().catch(() => null) as {
    success?: boolean
    data?: { rawHtml?: string; metadata?: Record<string, unknown> }
    error?: string
  } | null
  if (!json?.success || !json.data) {
    return { ok: false, reason: `firecrawl error: ${json?.error ?? 'malformed response'}` }
  }
  const md = json.data.metadata ?? {}
  const ogRaw = md['ogImage'] ?? md['og:image']
  const ogImage = typeof ogRaw === 'string' && ogRaw.startsWith('http') ? ogRaw
    : Array.isArray(ogRaw) && typeof ogRaw[0] === 'string' ? ogRaw[0] : null
  const finalUrl = typeof md['sourceURL'] === 'string' ? md['sourceURL'] as string : url
  return { ok: true, html: json.data.rawHtml ?? '', ogImage, finalUrl }
}
