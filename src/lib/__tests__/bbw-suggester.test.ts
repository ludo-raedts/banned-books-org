import { describe, expect, it } from 'vitest'
import {
  scoreBooks,
  suggestBBWFeatured,
  RULE_MIN_NON_US,
  RULE_MIN_REASONS,
  RULE_MAX_PER_AUTHOR,
  PREV_YEAR_PENALTY,
  type SuggesterBook,
} from '../bbw-suggester'

// Helper: make a book with sensible defaults so each test only states what
// matters for the property it's testing.
function book(overrides: Partial<SuggesterBook> & { id: number }): SuggesterBook {
  return {
    authorIds: [overrides.id],
    banCount: 5,
    recentBanScore: 0.5,
    countryCount: 1,
    countries: ['US'],
    reasons: ['lgbtq'],
    topListPresence: 0,
    pinned: false,
    inPreviousYears: false,
    ...overrides,
  }
}

describe('BBW suggester — diversity rules', () => {
  it('top 10 has at least 4 non-US books even when US books score higher', () => {
    // 8 US books (high score) and 7 non-US books (lower score).
    const books: SuggesterBook[] = [
      ...Array.from({ length: 8 }, (_, i) => book({
        id: 100 + i,
        countries: ['US'],
        banCount: 50,
        recentBanScore: 0.9,
      })),
      ...Array.from({ length: 7 }, (_, i) => book({
        id: 200 + i,
        countries: ['NL', 'DE'],
        countryCount: 2,
        banCount: 5,
        recentBanScore: 0.2,
      })),
    ]
    const { top10 } = suggestBBWFeatured(books)
    const nonUS = top10.filter(b => b.countries.some(c => c !== 'US')).length
    expect(top10.length).toBe(10)
    expect(nonUS).toBeGreaterThanOrEqual(RULE_MIN_NON_US)
  })

  it('top 10 has at least 3 different reasons', () => {
    // 12 high-scoring books all with reason A; 3 low-scoring with B / C / D.
    const books: SuggesterBook[] = [
      ...Array.from({ length: 12 }, (_, i) => book({
        id: 100 + i,
        reasons: ['religion'],
        banCount: 50,
        recentBanScore: 0.9,
      })),
      book({ id: 200, reasons: ['lgbtq'],   banCount: 1, recentBanScore: 0.1 }),
      book({ id: 201, reasons: ['politics'], banCount: 1, recentBanScore: 0.1 }),
      book({ id: 202, reasons: ['sex'],      banCount: 1, recentBanScore: 0.1 }),
    ]
    const { top10 } = suggestBBWFeatured(books)
    const distinct = new Set(top10.flatMap(b => b.reasons)).size
    expect(distinct).toBeGreaterThanOrEqual(RULE_MIN_REASONS)
  })

  it('no more than 2 books per author in top 10', () => {
    // 6 books from author 1 + 9 from various others.
    const books: SuggesterBook[] = [
      ...Array.from({ length: 6 }, (_, i) => book({
        id: 100 + i,
        authorIds: [1],
        banCount: 100,
        recentBanScore: 0.9,
      })),
      ...Array.from({ length: 9 }, (_, i) => book({
        id: 200 + i,
        authorIds: [10 + i],
        banCount: 5,
        recentBanScore: 0.3,
      })),
    ]
    const { top10 } = suggestBBWFeatured(books)
    const a1Count = top10.filter(b => b.authorIds.includes(1)).length
    expect(a1Count).toBeLessThanOrEqual(RULE_MAX_PER_AUTHOR)
  })

  it('previous-year books take a 40% penalty unless pinned', () => {
    const a = book({ id: 1, banCount: 10, recentBanScore: 1, inPreviousYears: true })
    const b = book({ id: 2, banCount: 10, recentBanScore: 1, inPreviousYears: false })
    const c = book({ id: 3, banCount: 10, recentBanScore: 1, inPreviousYears: true, pinned: true })

    const scored = scoreBooks([a, b, c])
    const sa = scored.find(s => s.id === 1)!
    const sb = scored.find(s => s.id === 2)!
    const sc = scored.find(s => s.id === 3)!

    expect(sa.penaltyApplied).toBe(true)
    expect(sb.penaltyApplied).toBe(false)
    expect(sc.penaltyApplied).toBe(false) // pinned overrides
    expect(sa.finalScore).toBeCloseTo(sb.finalScore * (1 - PREV_YEAR_PENALTY), 6)
  })
})

describe('BBW suggester — determinism', () => {
  it('same input twice returns the same output', () => {
    const books: SuggesterBook[] = Array.from({ length: 25 }, (_, i) => book({
      id: 100 + i,
      countries: i % 2 === 0 ? ['US'] : ['NL'],
      reasons: ['r' + (i % 5)],
      banCount: 10 + (i % 7),
      recentBanScore: (i % 11) / 10,
      authorIds: [200 + (i % 6)],
    }))

    const r1 = suggestBBWFeatured(books)
    const r2 = suggestBBWFeatured(books)
    expect(r1.top10.map(b => b.id)).toEqual(r2.top10.map(b => b.id))
    expect(r1.alternates.map(b => b.id)).toEqual(r2.alternates.map(b => b.id))
  })

  it('returns at most 25 candidates total (10 + 15)', () => {
    const books: SuggesterBook[] = Array.from({ length: 50 }, (_, i) => book({
      id: 100 + i,
      countries: i % 2 === 0 ? ['US'] : ['DE'],
      reasons: ['r' + (i % 4)],
      authorIds: [200 + (i % 12)],
    }))
    const { top10, alternates } = suggestBBWFeatured(books)
    expect(top10.length).toBe(10)
    expect(alternates.length).toBeLessThanOrEqual(15)
  })
})
