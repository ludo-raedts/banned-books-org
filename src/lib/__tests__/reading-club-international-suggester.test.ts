import { describe, expect, it } from 'vitest'
import {
  suggestInternational,
  RC_INTL_RULE_MIN_COUNTRIES,
  RC_INTL_RULE_MIN_REASONS,
  RC_INTL_RULE_MAX_PER_AUTHOR,
} from '../reading-club-international-suggester'
import type { SuggesterBook } from '../bbw-suggester'

function book(overrides: Partial<SuggesterBook> & { id: number }): SuggesterBook {
  return {
    authorIds: [overrides.id],
    banCount: 5,
    recentBanScore: 0.5,
    countryCount: 1,
    countries: ['NL'],
    reasons: ['political'],
    topListPresence: 0,
    pinned: false,
    inPreviousYears: false,
    ...overrides,
  }
}

describe('Reading Club International suggester — diversity rules', () => {
  it('drops US-only books before scoring (international means international)', () => {
    const books: SuggesterBook[] = [
      ...Array.from({ length: 5 }, (_, i) => book({
        id: 100 + i,
        countries: ['US'],
        countryCount: 1,
        banCount: 100,
        recentBanScore: 1,
      })),
      ...Array.from({ length: 12 }, (_, i) => book({
        id: 200 + i,
        countries: ['DE', 'FR'],
        countryCount: 2,
        reasons: ['r' + (i % 4)],
        authorIds: [300 + i],
      })),
    ]
    const { top10 } = suggestInternational(books)
    const usOnly = top10.filter(b => b.countries.length === 1 && b.countries[0] === 'US')
    expect(usOnly.length).toBe(0)
  })

  it('top 10 spans at least 5 distinct countries', () => {
    // 12 books, 8 from one country pair, 4 from various others.
    const books: SuggesterBook[] = [
      ...Array.from({ length: 8 }, (_, i) => book({
        id: 100 + i,
        countries: ['DE'],
        countryCount: 1,
        banCount: 50,
        authorIds: [200 + i],
      })),
      book({ id: 300, countries: ['IR'], countryCount: 1, authorIds: [400] }),
      book({ id: 301, countries: ['CN'], countryCount: 1, authorIds: [401] }),
      book({ id: 302, countries: ['CU'], countryCount: 1, authorIds: [402] }),
      book({ id: 303, countries: ['SA'], countryCount: 1, authorIds: [403] }),
    ]
    const { top10 } = suggestInternational(books)
    const distinct = new Set(top10.flatMap(b => b.countries)).size
    expect(distinct).toBeGreaterThanOrEqual(RC_INTL_RULE_MIN_COUNTRIES)
  })

  it('no more than 2 books per author and at least 3 distinct reasons', () => {
    const books: SuggesterBook[] = [
      // 5 books from author 1, all "religious"
      ...Array.from({ length: 5 }, (_, i) => book({
        id: 100 + i,
        authorIds: [1],
        countries: ['IR'],
        reasons: ['religious'],
        banCount: 50,
      })),
      // Other authors / reasons
      ...Array.from({ length: 10 }, (_, i) => book({
        id: 200 + i,
        authorIds: [10 + i],
        countries: [['CN', 'CU', 'SA', 'RU', 'PK', 'VN'][i % 6]],
        reasons: [['political', 'lgbtq', 'sexual', 'racial'][i % 4]],
      })),
    ]
    const { top10 } = suggestInternational(books)
    const a1Count = top10.filter(b => b.authorIds.includes(1)).length
    const distinctReasons = new Set(top10.flatMap(b => b.reasons)).size
    expect(a1Count).toBeLessThanOrEqual(RC_INTL_RULE_MAX_PER_AUTHOR)
    expect(distinctReasons).toBeGreaterThanOrEqual(RC_INTL_RULE_MIN_REASONS)
  })

  it('is deterministic — same input produces same output', () => {
    const books: SuggesterBook[] = Array.from({ length: 25 }, (_, i) => book({
      id: 100 + i,
      countries: [['DE', 'FR', 'CN', 'IR', 'CU', 'RU', 'SA'][i % 7]],
      reasons: ['r' + (i % 4)],
      banCount: 10 + (i % 5),
      authorIds: [200 + (i % 8)],
    }))
    const r1 = suggestInternational(books)
    const r2 = suggestInternational(books)
    expect(r1.top10.map(b => b.id)).toEqual(r2.top10.map(b => b.id))
  })
})
