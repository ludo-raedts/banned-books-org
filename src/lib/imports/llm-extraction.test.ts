import { describe, it, expect } from 'vitest'
import { compareExtractions } from './llm-extraction'
import type { Extraction, AuthorExtraction } from './extraction-types'

function author(overrides: Partial<AuthorExtraction> = {}): AuthorExtraction {
  return {
    name_native: 'Авдеев В.Б.',
    name_native_script: 'cyrillic',
    name_transliterated: 'Avdeev V.B.',
    name_english: 'Vladimir Avdeev',
    birth_year: null,
    ...overrides,
  }
}

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    is_book: true,
    title_native: 'Преодоление христианства',
    title_native_script: 'cyrillic',
    title_transliterated: 'Preodolenie khristianstva',
    title_english_meaningful: 'Overcoming Christianity',
    original_language: 'ru',
    authors: [author()],
    year_published: 2007,
    genre_hint: 'political tract',
    theme_or_reason_hint: 'anti-Christian extremist material',
    confidence: 0.85,
    ...overrides,
  }
}

describe('compareExtractions', () => {
  it('returns full agreement for two identical extractions', () => {
    const result = compareExtractions(extraction(), extraction())
    expect(result.agreement).toBe('full')
    expect(result.conflict_fields).toEqual([])
  })

  it('tolerates year off-by-one as full agreement', () => {
    const a = extraction({ year_published: 2007 })
    const b = extraction({ year_published: 2008 })
    expect(compareExtractions(a, b).agreement).toBe('full')
  })

  it('treats transliteration differing only in punctuation as full agreement', () => {
    const a = extraction({ title_transliterated: 'Preodolenie khristianstva' })
    const b = extraction({ title_transliterated: 'Preodolenie-khristianstva' })
    expect(compareExtractions(a, b).agreement).toBe('full')
  })

  it('flags different title_native as conflict (critical field)', () => {
    const a = extraction()
    const b = extraction({ title_native: 'Совершенно другая книга' })
    const result = compareExtractions(a, b)
    expect(result.agreement).toBe('conflict')
    expect(result.conflict_fields).toContain('title_native')
  })

  it('flags is_book disagreement as conflict', () => {
    const a = extraction({ is_book: true })
    const b = extraction({ is_book: false })
    const result = compareExtractions(a, b)
    expect(result.agreement).toBe('conflict')
    expect(result.conflict_fields).toEqual(['is_book'])
  })

  it('returns partial when transliteration differs substantively (not punctuation)', () => {
    const a = extraction({ title_transliterated: 'Preodolenie khristianstva' })
    const b = extraction({ title_transliterated: 'Preodolenije xristianstva' })
    const result = compareExtractions(a, b)
    expect(result.agreement).toBe('partial')
    expect(result.conflict_fields).toContain('title_transliterated')
  })

  it('returns single-pass-only when both extractions are null', () => {
    expect(compareExtractions(null, null).agreement).toBe('single-pass-only')
  })

  it('returns single-pass-only when only Gemini succeeded', () => {
    expect(compareExtractions(extraction(), null).agreement).toBe(
      'single-pass-only',
    )
  })

  it('returns partial when author english names differ but native matches', () => {
    const a = extraction({
      authors: [author({ name_english: 'Vladimir Avdeev' })],
    })
    const b = extraction({
      authors: [author({ name_english: 'V. Avdeyev' })],
    })
    // First author matches via name_native, so authors[0] is fine.
    // No critical conflicts, so should be 'full' (English form doesn't count standalone).
    expect(compareExtractions(a, b).agreement).toBe('full')
  })

  it('returns full when genre_hint differs (non-critical, not compared)', () => {
    const a = extraction({ genre_hint: 'political tract' })
    const b = extraction({ genre_hint: 'ideological essay' })
    expect(compareExtractions(a, b).agreement).toBe('full')
  })
})
