// Gemini-grounded cover-image search.
//
// Asks gemini-2.5-flash with the googleSearch tool to find the book's cover.
// Returns the URL it claims to have seen on the page, plus the source page URL
// (for anti-hallucination verification downstream) and a confidence label.
//
// Gemini cannot enforce responseMimeType=application/json when a tool is
// enabled, so we instruct the model to wrap its answer in a clearly-fenced
// JSON block and parse from the text response. If the JSON is missing or
// malformed, we return a low-confidence null result rather than throwing —
// the caller treats that as "no cover found".

import { GoogleGenAI } from '@google/genai'

let _genai: GoogleGenAI | null = null
function genai(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set in environment')
    _genai = new GoogleGenAI({ apiKey })
  }
  return _genai
}

export type CoverSearchInput = {
  title: string
  titleNative?: string | null
  titleTransliterated?: string | null
  author?: string | null
  year?: number | null
  language?: string | null     // ISO-639-1, picks the site-preference list (zh, pt, …)
  contextHint?: string | null  // e.g. "Banned in Hong Kong under NSL", "Portugal Estado Novo list"
  sitePreferences?: string | null // override the per-language site list entirely
}

export type CoverSearchResult = {
  pageUrl: string | null
  site: string | null
  confidence: 'high' | 'med' | 'low'
  reasoning: string | null
  rawText: string
  inputTokens: number
  outputTokens: number
}

// Per-language ordered site preferences, injected into the system prompt.
// Order matters twice: Gemini picks the first site that has the book, and the
// earlier sites are the ones whose og:image extraction we've validated. Add a
// language here when a new import batch needs web-searched covers.
const SITE_PREFERENCES: Record<string, string> = {
  zh: 'douban.com → books.com.tw → eslite.com → kingstone.com.tw → hkbookcity.com → readmoo.com → publisher sites → other',
  // NB: ordered by image-CDN mirrorability, not catalog size — wook.pt and
  // bertrand.pt (same Porto Editora platform) 403 every non-browser image
  // fetch incl. the weserv proxy, so they sit at the tail as last resorts.
  pt: 'fnac.pt → estantevirtual.com.br → goodreads.com → pt.wikipedia.org → almedina.net → livraria sites → publisher sites → wook.pt → bertrand.pt → other',
  es: 'casadellibro.com → todostuslibros.com → iberlibro.com → goodreads.com → es.wikipedia.org → publisher sites → other',
  ru: 'labirint.ru → livelib.ru → fantlab.ru → goodreads.com → ru.wikipedia.org → publisher sites → other',
  // Antiquarian sites (zvab/booklooker) rank high for de: the Nazi-era banned
  // batches (Berlin 1938, Liste Otto) are full of never-reprinted editions
  // that only exist as used-book listings with seller photos.
  de: 'buecher.de → thalia.de → zvab.com → booklooker.de → lovelybooks.de → goodreads.com → de.wikipedia.org → publisher sites → other',
  fr: 'babelio.com → fnac.com → decitre.fr → goodreads.com → fr.wikipedia.org → publisher sites → other',
  ms: 'mphonline.com → goodreads.com → bookurve.com → ms.wikipedia.org → publisher sites → other',
}
const DEFAULT_SITE_PREFERENCE =
  'goodreads.com → bookshop/retailer sites in the book\'s own language → the language-matched Wikipedia → national-library catalogues → publisher sites → other'

export function sitePreferencesFor(language: string | null | undefined): string {
  return (language && SITE_PREFERENCES[language]) ?? DEFAULT_SITE_PREFERENCE
}

function buildSystemPrompt(input: CoverSearchInput): string {
  const prefs = input.sitePreferences ?? sitePreferencesFor(input.language)
  return `You are a research assistant that locates the canonical page for a banned or censored book on a book site, so our pipeline can extract the cover image from that page.

Your job:
1. Use Google Search to find the book on a site that catalogues it with cover art.
2. Prefer sites in this order: ${prefs}.
3. Return the URL of the BOOK'S PAGE on the chosen site. We will fetch that page ourselves and extract og:image; you do NOT need to find the image URL. Don't guess image URLs — that's our job downstream.
4. Verify the page is for the RIGHT book: match title (both romanised and native if available), author, and ideally publication year. Reject hits where title is too generic and author doesn't match. A page for a DIFFERENT EDITION of the same work (reprint, different publisher/year) is fine; a film/DVD/audiobook adaptation page is NOT.
5. Good page URLs are book-detail pages such as wook.pt/livro/<slug>/<id>, book.douban.com/subject/<id>/ or goodreads.com/book/show/<id>. The <id> is opaque — it MUST be copied character-for-character from a search result, never invented or reused from these format descriptions.

Return ONLY a JSON object inside a \`\`\`json fenced block, no prose before or after:
{
  "page_url": "https://...",        // the book's page on one of the preferred sites. null if you didn't find a confident match.
  "site": "short hostname of the chosen site, e.g. wook.pt",
  "confidence": "high" | "med" | "low",
  "reasoning": "one sentence explaining why this is the right book"
}

"high" = title + author + year all line up with the cited page; "med" = title matches and author plausible; "low" = guess or partial match. If unsure, return page_url=null and confidence=low — don't invent URLs.

CRITICAL: only return a page_url if you saw it VERBATIM in a Google Search result (either as the listed URL of a hit, or quoted in the snippet text). Never construct a URL from an ID pattern — product URLs end in opaque numeric IDs you cannot guess. If you saw the book on a preferred site but did NOT see that page's exact URL, return the page from a lower-preference site whose URL you DID see verbatim instead; if none, set page_url=null. Hallucinated URLs cost us more than misses do.`
}

function buildPrompt(input: CoverSearchInput): string {
  const lines: string[] = []
  lines.push(`Title: ${input.title}`)
  if (input.titleNative && input.titleNative !== input.title) lines.push(`Native title: ${input.titleNative}`)
  if (input.titleTransliterated && input.titleTransliterated !== input.title) lines.push(`Transliterated: ${input.titleTransliterated}`)
  if (input.author) lines.push(`Author: ${input.author}`)
  if (input.year) lines.push(`Year: ${input.year}`)
  if (input.language) lines.push(`Language: ${input.language}`)
  if (input.contextHint) lines.push(`Context: ${input.contextHint}`)
  lines.push('')
  lines.push('Find this book\'s cover image. Reply with the JSON block only.')
  return lines.join('\n')
}

// Pull the first ```json … ``` fenced block out of a Gemini response. Gemini
// occasionally also adds prose around the block despite instructions, so we
// scan rather than slice from byte 0. If no fenced block, fall back to first
// { ... } substring.
function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ }
  }
  const fencedAny = text.match(/```\s*([\s\S]*?)```/)
  if (fencedAny) {
    try { return JSON.parse(fencedAny[1].trim()) } catch { /* fall through */ }
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch { /* fall through */ }
  }
  return null
}

export async function geminiCoverSearch(input: CoverSearchInput): Promise<CoverSearchResult> {
  // One retry on transient failures (5xx, parse failures). Gemini's flash
  // model occasionally returns malformed JSON or 500s on the first attempt.
  let response: Awaited<ReturnType<ReturnType<typeof genai>['models']['generateContent']>>
  let attempt = 0
  while (true) {
    try {
      response = await genai().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildPrompt(input),
        config: {
          systemInstruction: buildSystemPrompt(input),
          // Tried adding urlContext alongside googleSearch, but Gemini
          // consistently tripped on redirect-wrapped URLs from grounding
          // ("could not fetch redirect URL"). Pure search-grounding plus a
          // strong prompt works better — Gemini reads the search snippets and
          // infers image URLs from there. The vision 2nd-opinion downstream
          // catches mistakes.
          tools: [{ googleSearch: {} }],
          temperature: 0,
        },
      })
      break
    } catch (e) {
      attempt++
      const msg = e instanceof Error ? e.message : String(e)
      const transient = /\b(500|502|503|504|INTERNAL|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/.test(msg)
      if (attempt >= 2 || !transient) throw e
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  const rawText = response.text ?? ''
  const parsed = extractJsonObject(rawText) as
    | { page_url?: unknown; site?: unknown; confidence?: unknown; reasoning?: unknown }
    | null

  const inputTokens = response.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0

  if (!parsed) {
    return {
      pageUrl: null, site: null, confidence: 'low',
      reasoning: 'failed to parse JSON from Gemini response',
      rawText, inputTokens, outputTokens,
    }
  }

  const pageUrl = typeof parsed.page_url === 'string' && parsed.page_url.startsWith('http')
    ? parsed.page_url : null
  const site = typeof parsed.site === 'string' ? parsed.site : null
  const confidence = parsed.confidence === 'high' || parsed.confidence === 'med' || parsed.confidence === 'low'
    ? parsed.confidence : 'low'
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : null

  return { pageUrl, site, confidence, reasoning, rawText, inputTokens, outputTokens }
}
