import { describe, it, expect } from 'vitest'
import { normalizeExtraction, NormalizeExtractionError } from '../normalize-extraction'
import type { Extraction } from '../extraction-types'
import type { BothPassesResult } from '../llm-extraction'
import type { SourceConfig } from '../source-registry'

const HIGH_VOLUME_FR: SourceConfig = {
  tier: 'high-volume',
  fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
  default_country_code: 'FR',
  archive_strategy: ['wayback', 'archive_today'],
  default_scope: 'school',
  default_action_type: 'challenged',
}

const HIGH_STAKES_RU: SourceConfig = {
  tier: 'high-stakes',
  fuzzy_thresholds: { book_title: 0.85, author_name: 0.75 },
  default_country_code: 'RU',
  archive_strategy: ['archive_today', 'wayback'],
  default_scope: 'government',
  default_action_type: 'banned',
}

function ext(over: Partial<Extraction>): Extraction {
  return {
    is_book: true,
    title_native: null,
    title_native_script: null,
    title_transliterated: null,
    title_english_meaningful: null,
    original_language: null,
    authors: [],
    year_published: null,
    genre_hint: null,
    theme_or_reason_hint: null,
    confidence: 0.9,
    ...over,
  }
}

function bp(over: Partial<BothPassesResult>): BothPassesResult {
  return {
    gemini: null,
    openai: null,
    providers: { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini' },
    usage: { gemini: null, openai: null },
    errors: {},
    ...over,
  }
}

describe('normalizeExtraction', () => {
  describe('Latin script', () => {
    const latinExt = ext({
      title_native: 'La Question',
      title_native_script: 'latin',
      original_language: 'fr',
      authors: [{
        name_native: 'Henri Alleg',
        name_native_script: 'latin',
        name_transliterated: null,
        name_english: 'Henri Alleg',
        birth_year: 1921,
      }],
    })

    it('picks title_native for Latin script', () => {
      const out = normalizeExtraction(bp({ gemini: latinExt, openai: latinExt }), HIGH_VOLUME_FR)
      expect(out.title).toBe('La Question')
      expect(out.script).toBe('latin')
    })

    it('picks name_native for Latin-script author', () => {
      const out = normalizeExtraction(bp({ gemini: latinExt, openai: latinExt }), HIGH_VOLUME_FR)
      expect(out.authors[0]?.name).toBe('Henri Alleg')
    })

    it('falls back to title_transliterated when title_native is null', () => {
      const e = ext({ ...latinExt, title_native: null, title_transliterated: 'La Question' })
      const out = normalizeExtraction(bp({ gemini: e, openai: e }), HIGH_VOLUME_FR)
      expect(out.title).toBe('La Question')
    })

    it('non_latin_disagreement is false for Latin even on partial agreement', () => {
      const a = latinExt
      const b = ext({ ...latinExt, year_published: 1958 })
      const out = normalizeExtraction(bp({ gemini: a, openai: b }), HIGH_VOLUME_FR)
      expect(out.agreement_classification).toBe('partial')
      expect(out.non_latin_disagreement).toBe(false)
    })
  })

  describe('Non-Latin script', () => {
    const cyrillicExt = ext({
      title_native: 'Архипелаг ГУЛАГ',
      title_native_script: 'cyrillic',
      title_transliterated: 'Arkhipelag GULAG',
      title_english_meaningful: 'The Gulag Archipelago',
      original_language: 'ru',
      authors: [{
        name_native: 'Александр Солженицын',
        name_native_script: 'cyrillic',
        name_transliterated: 'Aleksandr Solzhenitsyn',
        name_english: 'Aleksandr Solzhenitsyn',
        birth_year: 1918,
      }],
    })

    it('picks title_transliterated for non-Latin script', () => {
      const out = normalizeExtraction(bp({ gemini: cyrillicExt, openai: cyrillicExt }), HIGH_STAKES_RU)
      expect(out.title).toBe('Arkhipelag GULAG')
      expect(out.script).toBe('cyrillic')
    })

    it('picks name_transliterated for non-Latin author', () => {
      const out = normalizeExtraction(bp({ gemini: cyrillicExt, openai: cyrillicExt }), HIGH_STAKES_RU)
      expect(out.authors[0]?.name).toBe('Aleksandr Solzhenitsyn')
    })

    it('throws if title_transliterated is missing for non-Latin script', () => {
      const e = ext({ ...cyrillicExt, title_transliterated: null })
      expect(() => normalizeExtraction(bp({ gemini: e, openai: e }), HIGH_STAKES_RU))
        .toThrow(NormalizeExtractionError)
    })

    // Sprint-0.5 doctrine: non-Latin + non-full agreement => requires review.
    // This is the load-bearing case the doctrine memory is about.
    it('flags non_latin_disagreement on partial agreement', () => {
      const a = cyrillicExt
      const b = ext({ ...cyrillicExt, title_transliterated: 'Arxipelag GULAG' }) // BGN/PCGN vs ALA-LC
      const out = normalizeExtraction(bp({ gemini: a, openai: b }), HIGH_STAKES_RU)
      expect(out.agreement_classification).toBe('partial')
      expect(out.non_latin_disagreement).toBe(true)
    })

    it('flags non_latin_disagreement on conflict', () => {
      const a = cyrillicExt
      const b = ext({ ...cyrillicExt, title_native: 'Different title entirely' })
      const out = normalizeExtraction(bp({ gemini: a, openai: b }), HIGH_STAKES_RU)
      expect(out.agreement_classification).toBe('conflict')
      expect(out.non_latin_disagreement).toBe(true)
    })

    it('flags non_latin_disagreement on single-pass-only', () => {
      const out = normalizeExtraction(bp({ gemini: cyrillicExt, openai: null }), HIGH_STAKES_RU)
      expect(out.agreement_classification).toBe('single-pass-only')
      expect(out.non_latin_disagreement).toBe(true)
    })

    it('does NOT flag non_latin_disagreement on full agreement', () => {
      const out = normalizeExtraction(bp({ gemini: cyrillicExt, openai: cyrillicExt }), HIGH_STAKES_RU)
      expect(out.agreement_classification).toBe('full')
      expect(out.non_latin_disagreement).toBe(false)
    })
  })

  describe('country_code', () => {
    const e = ext({ title_native: 'La Question', title_native_script: 'latin' })

    it('comes from sourceConfig.default_country_code', () => {
      const out = normalizeExtraction(bp({ gemini: e, openai: e }), HIGH_VOLUME_FR)
      expect(out.country_code).toBe('FR')
    })

    it('is null for manual sources (default_country_code: null)', () => {
      const manual: SourceConfig = { ...HIGH_VOLUME_FR, default_country_code: null }
      const out = normalizeExtraction(bp({ gemini: e, openai: e }), manual)
      expect(out.country_code).toBeNull()
    })
  })

  describe('reasons', () => {
    const e = ext({ title_native: 'La Question', title_native_script: 'latin' })

    it("always returns ['other'] for Sprint A", () => {
      const out = normalizeExtraction(bp({ gemini: e, openai: e }), HIGH_VOLUME_FR)
      expect(out.reasons).toEqual(['other'])
    })
  })

  describe('non-book entries', () => {
    const notBook = ext({ is_book: false })

    it('returns is_book=false with empty authors and empty title', () => {
      const out = normalizeExtraction(bp({ gemini: notBook, openai: notBook }), HIGH_VOLUME_FR)
      expect(out.is_book).toBe(false)
      expect(out.title).toBe('')
      expect(out.authors).toEqual([])
      expect(out.non_latin_disagreement).toBe(false)
    })
  })

  describe('canonical picker', () => {
    it('prefers Pass A (Gemini) when both present', () => {
      const gem = ext({ title_native: 'Gemini Title', title_native_script: 'latin' })
      const oai = ext({ title_native: 'OpenAI Title', title_native_script: 'latin' })
      const out = normalizeExtraction(bp({ gemini: gem, openai: oai }), HIGH_VOLUME_FR)
      expect(out.title).toBe('Gemini Title')
    })

    it('falls back to OpenAI when Gemini is null', () => {
      const oai = ext({ title_native: 'OpenAI Title', title_native_script: 'latin' })
      const out = normalizeExtraction(bp({ gemini: null, openai: oai }), HIGH_VOLUME_FR)
      expect(out.title).toBe('OpenAI Title')
    })

    it('throws when both passes are null', () => {
      expect(() => normalizeExtraction(bp({}), HIGH_VOLUME_FR))
        .toThrow(NormalizeExtractionError)
    })
  })
})
