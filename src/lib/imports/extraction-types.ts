import { z } from 'zod'

export const ScriptType = z.enum([
  'latin',
  'cyrillic',
  'han_traditional',
  'han_simplified',
  'arabic',
  'hebrew',
  'devanagari',
  'greek',
  'thai',
  'georgian',
  'armenian',
  'tibetan',
  'mixed',
])
export type ScriptType = z.infer<typeof ScriptType>

export const AuthorExtraction = z.object({
  name_native: z.string().nullable(),
  name_native_script: ScriptType.nullable(),
  name_transliterated: z.string().nullable(),
  name_english: z.string(),
  birth_year: z.number().int().min(800).max(2100).nullable(),
})
export type AuthorExtraction = z.infer<typeof AuthorExtraction>

export const Extraction = z.object({
  is_book: z.boolean(),
  title_native: z.string().nullable(),
  title_native_script: ScriptType.nullable(),
  title_transliterated: z.string().nullable(),
  title_english_meaningful: z.string().nullable(),
  original_language: z.string().length(2).nullable(),
  authors: z.array(AuthorExtraction),
  year_published: z.number().int().min(800).max(2100).nullable(),
  genre_hint: z.string().max(100).nullable(),
  theme_or_reason_hint: z.string().max(300).nullable(),
  confidence: z.number().min(0).max(1),
})
export type Extraction = z.infer<typeof Extraction>

export const AgreementResult = z.object({
  agreement: z.enum(['full', 'partial', 'conflict', 'single-pass-only']),
  conflict_fields: z.array(z.string()),
})
export type AgreementResult = z.infer<typeof AgreementResult>
