import { describe, it, expect } from 'vitest'
import { pickSlugSource } from '../review-commit'

describe('pickSlugSource', () => {
  it('uses the Latin title directly', () => {
    expect(pickSlugSource('Les Misérables', null, null)).toBe('les-miserables')
  })

  it('falls back to transliteration when title is non-Latin (Hanzi)', () => {
    // Regression: the production bug in the /admin/import-review UI where
    // committing a wikipedia-hong-kong entry with a Hanzi title threw
    // "slugify produced empty slug". See screenshot 2026-05-19.
    expect(
      pickSlugSource(
        '香港政治：發展歷程與核心課題',
        'Xianggang zheng zhi : fa zhan li cheng yu he xin ke ti',
        'Hong Kong Politics: Development History and Core Issues',
      ),
    ).toBe('xianggang-zheng-zhi-fa-zhan-li-cheng-yu-he-xin-ke-ti')
  })

  it('falls back to transliteration for Cyrillic', () => {
    expect(
      pickSlugSource('Война и мир', 'Voyna i mir', 'War and Peace'),
    ).toBe('voyna-i-mir')
  })

  it('falls back to English-meaningful when transliteration is missing', () => {
    expect(
      pickSlugSource('ألف ليلة وليلة', null, 'One Thousand and One Nights'),
    ).toBe('one-thousand-and-one-nights')
  })

  it('returns empty when every candidate slugs to empty', () => {
    expect(pickSlugSource('香港政治', null, null)).toBe('')
    expect(pickSlugSource('香港政治', '', '')).toBe('')
  })

  it('prefers the title even when transliteration is also present', () => {
    // For Latin titles we want the human-readable form, not the romanisation.
    expect(
      pickSlugSource('Café', 'Cafe', 'Coffee'),
    ).toBe('cafe')
  })
})
