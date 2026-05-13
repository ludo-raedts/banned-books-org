// Pure function bridging LLM `BothPassesResult` -> downstream `ExtractionResult`.
//
// Stays free of DB access so it is unit-testable from fixtures. Anything that
// needs DB state (cold-start gate, fuzzy matching, RLS) lives in verifier.ts.
//
// Picker: when both passes succeeded, Pass A (Gemini) wins by default. The
// "transliteration tiebreaker by script-convention" lives downstream (it
// only matters when surfacing both candidates to the review queue, not
// here where we pick a canonical to feed verification).
//
// Sprint-0.5 doctrine: non_latin_disagreement is true iff the canonical
// extraction has a known non-Latin script AND the two passes did NOT reach
// full agreement. Gate uses this conjunctively to block auto-approve.

import type { BothPassesResult } from './llm-extraction'
import { compareExtractions } from './llm-extraction'
import type {
  AuthorExtraction,
  AuthorRef,
  Extraction,
  ExtractionResult,
  PassesAudit,
  ScriptType,
} from './extraction-types'
import type { SourceConfig } from './source-registry'

export class NormalizeExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NormalizeExtractionError'
  }
}

export function normalizeExtraction(
  bothPasses: BothPassesResult,
  sourceConfig: SourceConfig,
): ExtractionResult {
  const canonical = pickCanonical(bothPasses)
  const agreement = compareExtractions(bothPasses.gemini, bothPasses.openai)
  const passes_audit = buildPassesAudit(bothPasses)

  if (!canonical.is_book) {
    return {
      agreement_classification: agreement.agreement,
      is_book: false,
      title: '',
      title_native: canonical.title_native,
      title_native_script: canonical.title_native_script,
      title_transliterated: canonical.title_transliterated,
      title_english_meaningful: canonical.title_english_meaningful,
      script: canonical.title_native_script,
      original_language: canonical.original_language,
      year_published: canonical.year_published,
      authors: [],
      country_code: sourceConfig.default_country_code,
      reasons: ['other'],
      non_latin_disagreement: false,
      passes_audit,
    }
  }

  const script = canonical.title_native_script
  const title = chooseCanonicalTitle(canonical, script)
  const authors = canonical.authors.map((a) => normalizeAuthor(a, script))

  return {
    agreement_classification: agreement.agreement,
    is_book: true,
    title,
    title_native: canonical.title_native,
    title_native_script: canonical.title_native_script,
    title_transliterated: canonical.title_transliterated,
    title_english_meaningful: canonical.title_english_meaningful,
    script,
    original_language: canonical.original_language,
    year_published: canonical.year_published,
    authors,
    country_code: sourceConfig.default_country_code,
    reasons: ['other'],
    non_latin_disagreement: computeNonLatinDisagreement(script, agreement.agreement),
    passes_audit,
  }
}

function buildPassesAudit(bp: BothPassesResult): PassesAudit {
  return {
    pass_a: {
      provider: bp.providers.gemini,
      output: bp.gemini,
      error: bp.errors.gemini ?? null,
    },
    pass_b: {
      provider: bp.providers.openai,
      output: bp.openai,
      error: bp.errors.openai ?? null,
    },
  }
}

function pickCanonical(bp: BothPassesResult): Extraction {
  if (bp.gemini) return bp.gemini
  if (bp.openai) return bp.openai
  throw new NormalizeExtractionError(
    'No extraction available: both passes failed',
  )
}

function chooseCanonicalTitle(e: Extraction, script: ScriptType | null): string {
  if (isLatinish(script)) {
    const t = e.title_native ?? e.title_transliterated
    if (!t) {
      throw new NormalizeExtractionError(
        'Latin-script extraction lacks both title_native and title_transliterated',
      )
    }
    return t
  }
  if (!e.title_transliterated) {
    throw new NormalizeExtractionError(
      `Non-Latin-script extraction (${script ?? 'null'}) lacks title_transliterated — required per script-convention`,
    )
  }
  return e.title_transliterated
}

function normalizeAuthor(a: AuthorExtraction, script: ScriptType | null): AuthorRef {
  const name = isLatinish(script)
    ? (a.name_native ?? a.name_english)
    : (a.name_transliterated ?? a.name_english)
  return {
    name,
    name_native: a.name_native,
    name_transliterated: a.name_transliterated,
    name_english: a.name_english,
    birth_year: a.birth_year,
  }
}

function isLatinish(script: ScriptType | null): boolean {
  return script === 'latin' || script === null
}

function computeNonLatinDisagreement(
  script: ScriptType | null,
  agreement: 'full' | 'partial' | 'conflict' | 'single-pass-only',
): boolean {
  if (script === null) return false
  if (script === 'latin') return false
  return agreement !== 'full'
}
