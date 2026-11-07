// OpenAI web-search cover-page search — same contract as geminiCoverSearch
// (same prompt, same JSON answer), used when Gemini is unavailable or as the
// default provider of enrich-covers-websearch.ts (--search=openai|gemini).
//
// Anti-hallucination: the Responses API reports every URL the web_search tool
// actually returned or opened (action.sources / action.url) plus the message's
// url_citation annotations. A page_url that is not among them is dropped —
// the failure mode that made Gemini invent opaque product ids.

import OpenAI from 'openai'
import { OPENAI_FAST } from '@/lib/llm-models'
import {
  buildPrompt, buildSystemPrompt, extractJsonObject,
  type CoverSearchInput, type CoverSearchResult,
} from './gemini-cover-search'

let _openai: OpenAI | null = null
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

// Compare URLs without the tracking params OpenAI appends (utm_source=openai),
// fragment, trailing slash or host case.
function normUrl(u: string): string {
  try {
    const url = new URL(u)
    for (const k of [...url.searchParams.keys()]) if (k.startsWith('utm_')) url.searchParams.delete(k)
    url.hash = ''
    return `${url.host.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`
  } catch {
    return u
  }
}

type OutputItem = {
  type: string
  action?: { url?: string; sources?: { url?: string }[] }
  content?: { type: string; text?: string; annotations?: { type: string; url?: string }[] }[]
}

export async function openaiCoverSearch(input: CoverSearchInput): Promise<CoverSearchResult> {
  let response: Awaited<ReturnType<ReturnType<typeof openai>['responses']['create']>>
  for (let attempt = 1; ; attempt++) {
    try {
      response = await openai().responses.create({
        model: OPENAI_FAST,
        instructions: buildSystemPrompt(input),
        input: buildPrompt(input),
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        reasoning: { effort: 'low' },
      })
      break
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt >= 2 || !/\b(429|500|502|503|504)\b/.test(msg)) throw e
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  const output = response.output as unknown as OutputItem[]
  const seen = new Set<string>()
  for (const item of output) {
    if (item.action?.url) seen.add(normUrl(item.action.url))
    for (const s of item.action?.sources ?? []) if (s.url) seen.add(normUrl(s.url))
    for (const c of item.content ?? []) for (const a of c.annotations ?? []) if (a.url) seen.add(normUrl(a.url))
  }

  const rawText = response.output_text ?? ''
  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  const parsed = extractJsonObject(rawText) as
    | { page_url?: unknown; site?: unknown; confidence?: unknown; reasoning?: unknown }
    | null
  if (!parsed) {
    return {
      pageUrl: null, site: null, confidence: 'low',
      reasoning: 'failed to parse JSON from OpenAI response',
      rawText, inputTokens, outputTokens,
    }
  }

  let pageUrl = typeof parsed.page_url === 'string' && parsed.page_url.startsWith('http')
    ? parsed.page_url : null
  let reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : null
  if (pageUrl && !seen.has(normUrl(pageUrl))) {
    reasoning = `page_url not among the ${seen.size} search sources, dropped: ${pageUrl}`
    pageUrl = null
  }
  const site = typeof parsed.site === 'string' ? parsed.site : null
  const confidence = parsed.confidence === 'high' || parsed.confidence === 'med' || parsed.confidence === 'low'
    ? parsed.confidence : 'low'

  return { pageUrl, site, confidence, reasoning, rawText, inputTokens, outputTokens }
}
