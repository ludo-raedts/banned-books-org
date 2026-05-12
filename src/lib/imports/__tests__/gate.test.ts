import { describe, it, expect } from 'vitest'
import { evaluateGate } from '../gate'
import type { ExtractionResult } from '../extraction-types'
import type { VerificationResult, DimensionMatch } from '../verifier'
import type { SourceConfig } from '../source-registry'

const HIGH_VOLUME: SourceConfig = {
  tier: 'high-volume',
  fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
  default_country_code: 'US',
  archive_strategy: ['wayback', 'archive_today'],
  default_scope: 'school',
  default_action_type: 'challenged',
}

const HIGH_STAKES: SourceConfig = { ...HIGH_VOLUME, tier: 'high-stakes' }

const EXACT: DimensionMatch = { status: 'exact', existing_id: 1, confidence: 1 }
const NO_MATCH: DimensionMatch = { status: 'no_match', existing_id: null, confidence: null }
const FUZZY: DimensionMatch = {
  status: 'fuzzy',
  existing_id: 7,
  confidence: 0.91,
  candidates: [{ id: 7, name: 'Fuzzy Match', score: 0.91 }],
}

function passingExtraction(over: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    agreement_classification: 'full',
    is_book: true,
    title: 'Some Book',
    title_native: 'Some Book',
    title_native_script: 'latin',
    title_transliterated: null,
    title_english_meaningful: null,
    script: 'latin',
    original_language: 'en',
    year_published: 2000,
    authors: [],
    country_code: 'US',
    reasons: ['other'],
    non_latin_disagreement: false,
    ...over,
  }
}

function passingVerification(over: Partial<VerificationResult> = {}): VerificationResult {
  return {
    book: NO_MATCH,
    authors: [],
    country: EXACT,
    reasons: [EXACT],
    redirect_chain_excessive: false,
    duplicate_author_collision: false,
    ...over,
  }
}

describe('evaluateGate', () => {
  it('auto-approves the happy path', () => {
    const out = evaluateGate(passingExtraction(), passingVerification(), HIGH_VOLUME)
    expect(out.auto_approve).toBe(true)
    expect(out.reasons).toEqual([])
  })

  describe('blocking clauses', () => {
    it('blocks when not a book', () => {
      const out = evaluateGate(
        passingExtraction({ is_book: false }),
        passingVerification(),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('not_a_book')
    })

    it('blocks on partial agreement', () => {
      const out = evaluateGate(
        passingExtraction({ agreement_classification: 'partial' }),
        passingVerification(),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('agreement=partial')
    })

    it('blocks on conflict', () => {
      const out = evaluateGate(
        passingExtraction({ agreement_classification: 'conflict' }),
        passingVerification(),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
    })

    it('blocks on single-pass-only', () => {
      const out = evaluateGate(
        passingExtraction({ agreement_classification: 'single-pass-only' }),
        passingVerification(),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
    })

    it('blocks on non-Latin script', () => {
      const out = evaluateGate(
        passingExtraction({ script: 'cyrillic' }),
        passingVerification(),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('script=cyrillic')
    })

    it('blocks on Sprint-0.5 non_latin_disagreement', () => {
      const out = evaluateGate(
        passingExtraction({ non_latin_disagreement: true }),
        passingVerification(),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('non_latin_disagreement')
    })

    it('blocks on high-stakes tier regardless of other signals', () => {
      const out = evaluateGate(passingExtraction(), passingVerification(), HIGH_STAKES)
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('tier=high-stakes')
    })

    it('blocks when any dimension is fuzzy', () => {
      const out = evaluateGate(
        passingExtraction(),
        passingVerification({ book: FUZZY }),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('fuzzy_dimension_present')
    })

    it('blocks when an author is fuzzy', () => {
      const out = evaluateGate(
        passingExtraction(),
        passingVerification({ authors: [FUZZY] }),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
    })

    it('blocks on duplicate_author_collision', () => {
      const out = evaluateGate(
        passingExtraction(),
        passingVerification({ duplicate_author_collision: true }),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('duplicate_author_collision')
    })

    it('blocks on redirect_chain_excessive', () => {
      const out = evaluateGate(
        passingExtraction(),
        passingVerification({ redirect_chain_excessive: true }),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toContain('redirect_chain_excessive')
    })
  })

  describe('multi-clause failures', () => {
    it('reports every triggered clause, not just the first', () => {
      const out = evaluateGate(
        passingExtraction({
          agreement_classification: 'partial',
          script: 'cyrillic',
          non_latin_disagreement: true,
        }),
        passingVerification({
          duplicate_author_collision: true,
          redirect_chain_excessive: true,
          book: FUZZY,
        }),
        HIGH_STAKES,
      )
      expect(out.auto_approve).toBe(false)
      expect(out.reasons).toEqual(expect.arrayContaining([
        'agreement=partial',
        'script=cyrillic',
        'non_latin_disagreement',
        'tier=high-stakes',
        'fuzzy_dimension_present',
        'duplicate_author_collision',
        'redirect_chain_excessive',
      ]))
    })
  })

  describe('no-match dimensions', () => {
    it('treats no_match as gate-passing (greenfield import is fine)', () => {
      const out = evaluateGate(
        passingExtraction(),
        passingVerification({
          book: NO_MATCH,
          authors: [NO_MATCH, NO_MATCH],
          reasons: [NO_MATCH],
        }),
        HIGH_VOLUME,
      )
      expect(out.auto_approve).toBe(true)
    })
  })
})
