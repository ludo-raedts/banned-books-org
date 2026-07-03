// Given a book's page on a retailer/catalogue site, extract the publisher
// synopsis plus enough page metadata (page title, JSON-LD name/author) for the
// caller to verify it's the right book before trusting the text.
//
// Sister module to extract-cover-from-page.ts — same fetch strategy (plain
// browser-UA fetch first, ONE opt-in Firecrawl retry when bot-blocked), same
// regex-over-HTML approach. Candidate sources, best-first:
//   1. JSON-LD Book/Product "description" (structured, usually the full blurb)
//   2. og:description / twitter:description
//   3. meta[name=description]
//
// The extracted text is NEVER stored literally: callers feed it to a grounded
// LLM groom (same-book judge + 2-4 sentence English synthesis) and store the
// result as description_source_type='llm_grounded_single' with the page as
// the cited source. See scripts/enrich-descriptions-websearch.ts.

import { firecrawlFetchPage } from './firecrawl-fetch'

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

export type DescriptionCandidate = {
  text: string
  via: 'jsonld' | 'og' | 'meta'
}

export type PageDescription =
  | {
      ok: true
      finalUrl: string
      candidates: DescriptionCandidate[]  // longest-first within source priority
      pageName: string | null            // JSON-LD name > og:title > <title>
      pageAuthors: string[]              // JSON-LD author names, if any
    }
  | { ok: false; reason: string }

export type ExtractDescriptionOpts = {
  firecrawlFallback?: boolean
  minChars?: number
}

export async function extractDescriptionFromPage(
  pageUrl: string,
  opts: ExtractDescriptionOpts = {},
): Promise<PageDescription> {
  const minChars = opts.minChars ?? 80

  let html: string | null = null
  let finalUrl = pageUrl
  let blockReason = ''
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en;q=0.9,*;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (res.ok) {
      html = await res.text()
      finalUrl = res.url || pageUrl
    } else {
      blockReason = `HTTP ${res.status}`
    }
  } catch (e) {
    blockReason = e instanceof Error ? e.message : 'fetch failed'
  }

  // Cloudflare challenge pages return 200 with a challenge shell — treat a
  // suspiciously tiny/challenge-marked body as blocked too.
  if (html && (html.length < 2000 || /cf-challenge|Just a moment/i.test(html.slice(0, 4000)))) {
    blockReason = blockReason || 'challenge page'
    html = null
  }

  if (!html && opts.firecrawlFallback) {
    const fc = await firecrawlFetchPage(pageUrl)
    if (fc.ok) {
      html = fc.html
      finalUrl = fc.finalUrl
    } else {
      return { ok: false, reason: `blocked (${blockReason}); firecrawl: ${fc.reason}` }
    }
  }
  if (!html) return { ok: false, reason: blockReason || 'no HTML' }

  const candidates: DescriptionCandidate[] = []
  const jsonLd = collectJsonLdBooks(html)
  for (const b of jsonLd) {
    if (b.description && b.description.length >= minChars) {
      candidates.push({ text: b.description, via: 'jsonld' })
    }
  }
  for (const name of ['og:description', 'twitter:description']) {
    const v = extractMetaContent(html, name)
    if (v && v.length >= minChars) candidates.push({ text: v, via: 'og' })
  }
  const metaDesc = extractMetaContent(html, 'description')
  if (metaDesc && metaDesc.length >= minChars) candidates.push({ text: metaDesc, via: 'meta' })

  // Within each via-tier candidates are already push-ordered; prefer jsonld,
  // then og, then meta, longest text first inside a tier.
  const tier: Record<DescriptionCandidate['via'], number> = { jsonld: 0, og: 1, meta: 2 }
  candidates.sort((a, b) => tier[a.via] - tier[b.via] || b.text.length - a.text.length)

  const pageName =
    jsonLd.find(b => b.name)?.name ??
    extractMetaContent(html, 'og:title') ??
    extractTitleTag(html)
  const pageAuthors = jsonLd.flatMap(b => b.authors)

  return { ok: true, finalUrl, candidates, pageName, pageAuthors }
}

// ── HTML helpers (regex over HTML, same approach as the cover extractor) ──

type JsonLdBook = { name: string | null; description: string | null; authors: string[] }

function collectJsonLdBooks(html: string): JsonLdBook[] {
  const out: JsonLdBook[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let parsed: unknown
    try { parsed = JSON.parse(m[1].trim()) } catch { continue }
    walkJsonLd(parsed, out)
  }
  return out
}

function walkJsonLd(node: unknown, out: JsonLdBook[]): void {
  if (Array.isArray(node)) { node.forEach(n => walkJsonLd(n, out)); return }
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (Array.isArray(obj['@graph'])) walkJsonLd(obj['@graph'], out)

  const t = obj['@type']
  const types = Array.isArray(t) ? t : [t]
  if (types.some(x => x === 'Book' || x === 'Product')) {
    out.push({
      name: typeof obj.name === 'string' ? decodeEntities(obj.name).trim() : null,
      description: typeof obj.description === 'string'
        ? decodeEntities(stripTags(obj.description)).replace(/\s+/g, ' ').trim() || null
        : null,
      authors: jsonLdAuthorNames(obj.author),
    })
  }
  // Products sometimes nest the Book under hasVariant / mainEntity.
  for (const key of ['mainEntity', 'hasVariant', 'itemListElement', 'item']) {
    if (obj[key]) walkJsonLd(obj[key], out)
  }
}

function jsonLdAuthorNames(author: unknown): string[] {
  if (!author) return []
  const arr = Array.isArray(author) ? author : [author]
  const names: string[] = []
  for (const a of arr) {
    if (typeof a === 'string') names.push(a)
    else if (a && typeof a === 'object' && typeof (a as Record<string, unknown>).name === 'string') {
      names.push((a as Record<string, string>).name)
    }
  }
  return names.map(n => decodeEntities(n).trim()).filter(Boolean)
}

function extractMetaContent(html: string, nameOrProp: string): string | null {
  // property= and name= variants, attribute order both ways.
  const esc = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      const v = decodeEntities(m[1]).replace(/\s+/g, ' ').trim()
      if (v) return v
    }
  }
  return null
}

function extractTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() || null : null
}

function stripTags(s: string): string {
  return s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
}
