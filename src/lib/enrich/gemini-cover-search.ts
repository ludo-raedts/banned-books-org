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
  language?: string | null     // ISO-639-1, helps Gemini target Chinese sites for zh
  contextHint?: string | null  // e.g. "Banned in Hong Kong under NSL", "Malaysia KDN ban list"
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

const SYSTEM_PROMPT = `You are a research assistant that locates the canonical page for a banned or censored book on a Chinese-language book site, so our pipeline can extract the cover image from that page.

Your job:
1. Use Google Search to find the book on a site that catalogues it with cover art.
2. For Chinese-language books, prefer in this order: douban.com → books.com.tw → eslite.com → kingstone.com.tw → hkbookcity.com → readmoo.com → publisher sites → other.
3. Return the URL of the BOOK'S PAGE on the chosen site. We will fetch that page ourselves and extract og:image; you do NOT need to find the image URL. Don't guess image URLs — that's our job downstream.
4. Verify the page is for the RIGHT book: match title (both romanised and native if available), author, and ideally publication year. Reject hits where title is too generic and author doesn't match.
5. Examples of good page URLs (note these are EXAMPLES of format, not real answers):
   - https://book.douban.com/subject/26954419/
   - https://www.books.com.tw/products/0010696525
   - https://www.eslite.com/product/1001114792003

Return ONLY a JSON object inside a \`\`\`json fenced block, no prose before or after:
{
  "page_url": "https://...",        // the book's page on one of the preferred sites. null if you didn't find a confident match.
  "site": "douban" | "books.com.tw" | "eslite" | "kingstone" | "hkbookcity" | "readmoo" | "other",
  "confidence": "high" | "med" | "low",
  "reasoning": "one sentence explaining why this is the right book"
}

"high" = title + author + year all line up with the cited page; "med" = title matches and author plausible; "low" = guess or partial match. If unsure, return page_url=null and confidence=low — don't invent URLs.

CRITICAL: only return a page_url if you saw it VERBATIM in a Google Search result (either as the listed URL of a hit, or quoted in the snippet text). Never construct a URL from an ID pattern. If you saw the book mentioned but didn't see its actual page URL in the search results, set page_url=null. Hallucinated URLs cost us more than misses do.`

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
          systemInstruction: SYSTEM_PROMPT,
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
