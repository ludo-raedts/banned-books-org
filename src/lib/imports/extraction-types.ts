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

// ----------------------------------------------------------------------------
// ExtractionResult: normalized output of the "extracted" pipeline phase.
//
// Bridges the LLM `Extraction` (which has 4 title variants, freeform reason
// hint, no country code) and the downstream verifier/gate/committer (which
// need a canonical title, an author list with canonical names, a country
// code, and a list of reason slugs).
//
// Produced by src/lib/imports/normalize-extraction.ts as a pure function of
// (BothPassesResult, SourceConfig). Consumed by verifier, gate, and committer.
//
// Title-canonical rules (per design discussion):
//   Latin script     -> title_native ?? title_transliterated
//   Non-Latin script -> title_transliterated (must be non-null per script-convention)
//
// Author-canonical rules (mirror title):
//   Latin script     -> name_native ?? name_english
//   Non-Latin script -> name_transliterated
//
// reasons: always ['other'] for Sprint A — the LLM only emits a freeform
// theme_or_reason_hint and no slug-mapper exists yet. The slug 'other' is
// verified to exist in production (label_en='Other').
//
// non_latin_disagreement: encodes the Sprint-0.5 doctrine that non-Latin
// title-translation partials NEVER auto-accept. True iff:
//   - is_book AND
//   - script is set AND not 'latin' AND
//   - agreement_classification is not 'full'
// Cold-start gate (first import per source) is a separate concern handled
// by the verifier (which has DB access) — not encoded here.
// ----------------------------------------------------------------------------

export type AuthorRef = {
  name: string                            // canonical name per author rules above
  name_native: string | null              // raw, for review queue display
  name_transliterated: string | null      // raw, for review queue display
  name_english: string                    // raw, always present
  birth_year: number | null
}

// Audit trail of the two parallel LLM passes that produced the canonical
// extraction. Carried on ExtractionResult so it persists into
// `import_jobs.extraction` (jsonb) and survives a crash/resume; also forwarded
// explicitly via CommitContext so the committer can write each side's raw
// output into `import_review_queue.pass_{a,b}_{provider,output}`.
//
// `output` is null when that pass failed; `error` carries the reason in that
// case. Provider strings are the resolved model identifiers (e.g.
// 'gemini-2.5-pro', 'gpt-4o-mini') from MODELS[tier] in llm-extraction.ts.
export type PassAudit = {
  provider: string
  output: Extraction | null
  error: string | null
}

export type PassesAudit = {
  pass_a: PassAudit   // Gemini
  pass_b: PassAudit   // OpenAI
}

export type ExtractionResult = {
  agreement_classification: AgreementResult['agreement']
  is_book: boolean
  title: string                           // canonical for slug-lookup
  title_native: string | null             // raw, for committer (books.title_native)
  title_native_script: ScriptType | null  // raw, for committer (books.title_native_script)
  title_transliterated: string | null     // raw, for committer (books.title_transliterated)
  title_english_meaningful: string | null // raw, for committer (books.title_english_meaningful)
  script: ScriptType | null               // = title_native_script, surfaced for gate
  original_language: string | null
  year_published: number | null
  authors: AuthorRef[]
  country_code: string | null             // from SOURCE_REGISTRY[sourceType].default_country_code
  reasons: string[]                       // reason slugs; always ['other'] for Sprint A
  non_latin_disagreement: boolean         // Sprint-0.5 doctrine flag; gate uses conjunctively
  passes_audit: PassesAudit               // raw two-pass audit; surfaced in review queue
}
