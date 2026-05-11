import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { Extraction, type AgreementResult, type AuthorExtraction } from './extraction-types'
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from './extraction-prompt'

export type ModelTier = 'high-volume' | 'high-stakes'

const MODELS = {
  'high-volume': {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
  },
  'high-stakes': {
    gemini: 'gemini-2.5-pro',
    openai: 'gpt-4o',
  },
} as const

const TIMEOUT_MS = 30_000

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
}

export interface ExtractionWithUsage {
  extraction: Extraction
  usage: TokenUsage
}

let _openai: OpenAI | null = null
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

let _genai: GoogleGenAI | null = null
function genai(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set in environment')
    }
    _genai = new GoogleGenAI({ apiKey })
  }
  return _genai
}

function stripJsonFences(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  return t
}

export async function extractWithGemini(
  rawText: string,
  tier: ModelTier = 'high-volume',
): Promise<ExtractionWithUsage> {
  // Flash supports thinkingBudget: 0 to disable thinking; Pro requires thinking on.
  const thinkingConfig =
    tier === 'high-volume' ? { thinkingBudget: 0 } : undefined
  const response = await genai().models.generateContent({
    model: MODELS[tier].gemini,
    contents: EXTRACTION_USER_PROMPT(rawText),
    config: {
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      temperature: 0,
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  })

  const text = response.text ?? ''
  const parsed = JSON.parse(stripJsonFences(text))
  const extraction = Extraction.parse(parsed)
  const usage: TokenUsage = {
    input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  }
  return { extraction, usage }
}

export async function extractWithOpenAI(
  rawText: string,
  tier: ModelTier = 'high-volume',
): Promise<ExtractionWithUsage> {
  const response = await openai().chat.completions.create({
    model: MODELS[tier].openai,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: EXTRACTION_USER_PROMPT(rawText) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  })

  const text = response.choices[0]?.message?.content ?? ''
  const parsed = JSON.parse(stripJsonFences(text))
  const extraction = Extraction.parse(parsed)
  const usage: TokenUsage = {
    input_tokens: response.usage?.prompt_tokens ?? 0,
    output_tokens: response.usage?.completion_tokens ?? 0,
  }
  return { extraction, usage }
}

export interface BothPassesResult {
  gemini: Extraction | null
  openai: Extraction | null
  usage: { gemini: TokenUsage | null; openai: TokenUsage | null }
  errors: { gemini?: string; openai?: string }
}

export async function extractBothPasses(
  rawText: string,
  tier: ModelTier = 'high-volume',
): Promise<BothPassesResult> {
  const results = await Promise.allSettled([
    withTimeout(extractWithGemini(rawText, tier), TIMEOUT_MS),
    withTimeout(extractWithOpenAI(rawText, tier), TIMEOUT_MS),
  ])

  const gem = results[0]
  const oai = results[1]

  return {
    gemini: gem.status === 'fulfilled' ? gem.value.extraction : null,
    openai: oai.status === 'fulfilled' ? oai.value.extraction : null,
    usage: {
      gemini: gem.status === 'fulfilled' ? gem.value.usage : null,
      openai: oai.status === 'fulfilled' ? oai.value.usage : null,
    },
    errors: {
      gemini: gem.status === 'rejected' ? String(gem.reason) : undefined,
      openai: oai.status === 'rejected' ? String(oai.reason) : undefined,
    },
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms`)),
      ms,
    )
    p.then(
      v => {
        clearTimeout(handle)
        resolve(v)
      },
      e => {
        clearTimeout(handle)
        reject(e)
      },
    )
  })
}

export function compareExtractions(
  a: Extraction | null,
  b: Extraction | null,
): AgreementResult {
  if (!a || !b) {
    return { agreement: 'single-pass-only', conflict_fields: [] }
  }

  if (a.is_book !== b.is_book) {
    return { agreement: 'conflict', conflict_fields: ['is_book'] }
  }

  if (!a.is_book && !b.is_book) {
    return { agreement: 'full', conflict_fields: [] }
  }

  const conflicts: string[] = []

  if (!fuzzyEqualTitle(a.title_native, b.title_native))
    conflicts.push('title_native')
  if (a.title_native_script !== b.title_native_script)
    conflicts.push('title_native_script')
  if (!fuzzyEqualTransliteration(a.title_transliterated, b.title_transliterated))
    conflicts.push('title_transliterated')
  if (!fuzzyEqualTitle(a.title_english_meaningful, b.title_english_meaningful))
    conflicts.push('title_english_meaningful')
  if (
    a.original_language !== b.original_language &&
    a.original_language &&
    b.original_language
  )
    conflicts.push('original_language')
  if (!yearWithinTolerance(a.year_published, b.year_published))
    conflicts.push('year_published')

  if (a.authors.length !== b.authors.length) {
    conflicts.push('authors_count')
  } else if (a.authors[0] && b.authors[0]) {
    if (!fuzzyEqualAuthor(a.authors[0], b.authors[0])) {
      conflicts.push('authors[0]')
    }
  }

  const criticalConflicts = conflicts.filter(c =>
    ['title_native', 'is_book', 'authors[0]', 'authors_count'].includes(c),
  )

  if (conflicts.length === 0) return { agreement: 'full', conflict_fields: [] }
  if (criticalConflicts.length === 0)
    return { agreement: 'partial', conflict_fields: conflicts }
  return { agreement: 'conflict', conflict_fields: conflicts }
}

function normalize(s: string | null): string {
  if (!s) return ''
  return s
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[«»""'']/g, '"')
    .replace(/\s+/g, ' ')
}

function fuzzyEqualTitle(a: string | null, b: string | null): boolean {
  return normalize(a) === normalize(b)
}

function fuzzyEqualTransliteration(
  a: string | null,
  b: string | null,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const stripDecorations = (s: string) =>
    s
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\s\-'.,]/g, '')
      .replace(/[ʹʼ']/g, '')
  return stripDecorations(a) === stripDecorations(b)
}

function yearWithinTolerance(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return Math.abs(a - b) <= 1
}

function fuzzyEqualAuthor(
  a: AuthorExtraction,
  b: AuthorExtraction,
): boolean {
  return (
    fuzzyEqualTitle(a.name_native, b.name_native) ||
    fuzzyEqualTitle(a.name_english, b.name_english)
  )
}
