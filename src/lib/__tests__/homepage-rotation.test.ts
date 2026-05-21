import { describe, expect, it } from 'vitest'
import {
  dayOfYear,
  hashReasonSlug,
  selectRotatingBooks,
  selectWithLanguageDiversity,
} from '../homepage-rotation'

type Book = { id: number; original_language: string | null }

function pool(n: number, langs: string[] = []): Book[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    original_language: langs[i] ?? 'en',
  }))
}

describe('selectRotatingBooks', () => {
  it('is deterministic for the same seed + pool', () => {
    const p = pool(10)
    const a = selectRotatingBooks({ pool: p, count: 3, seed: 42 })
    const b = selectRotatingBooks({ pool: p, count: 3, seed: 42 })
    expect(a.map(x => x.id)).toEqual(b.map(x => x.id))
  })

  it('different reason offsets return different rotations for the same seed', () => {
    const p = pool(10)
    const a = selectRotatingBooks({ pool: p, count: 3, seed: 100, reasonOffset: 0 })
    const b = selectRotatingBooks({ pool: p, count: 3, seed: 100, reasonOffset: 5 })
    expect(a.map(x => x.id)).not.toEqual(b.map(x => x.id))
  })

  it('different seeds rotate the same pool to different start indices', () => {
    const p = pool(10)
    const a = selectRotatingBooks({ pool: p, count: 3, seed: 1 })
    const b = selectRotatingBooks({ pool: p, count: 3, seed: 5 })
    expect(a.map(x => x.id)).not.toEqual(b.map(x => x.id))
  })

  it('excluded IDs never appear in the result', () => {
    const p = pool(10)
    const excluded = new Set([1, 2, 3, 4, 5])
    const result = selectRotatingBooks({ pool: p, count: 5, seed: 0, excludeIds: excluded })
    for (const id of result.map(b => b.id)) {
      expect(excluded.has(id)).toBe(false)
    }
  })

  it('returns [] for an empty pool without crashing', () => {
    expect(selectRotatingBooks({ pool: [], count: 3, seed: 7 })).toEqual([])
  })

  it('returns up to `count` items when the pool is smaller than `count`', () => {
    const result = selectRotatingBooks({ pool: pool(2), count: 5, seed: 3 })
    expect(result.length).toBe(2)
  })

  it('returns [] when excludeIds covers the entire pool', () => {
    const p = pool(3)
    const ex = new Set([1, 2, 3])
    expect(selectRotatingBooks({ pool: p, count: 3, seed: 0, excludeIds: ex })).toEqual([])
  })
})

describe('selectWithLanguageDiversity', () => {
  it('prefers distinct languages over pool order', () => {
    const rotated: Book[] = [
      { id: 1, original_language: 'fr' },
      { id: 2, original_language: 'fr' },
      { id: 3, original_language: 'ru' },
      { id: 4, original_language: 'zh' },
    ]
    const result = selectWithLanguageDiversity(rotated, 3)
    const langs = new Set(result.map(b => b.original_language))
    expect(langs.size).toBe(3)
    expect(result.map(b => b.id)).toEqual([1, 3, 4])
  })

  it('falls back to repeating a language if the pool has no diversity', () => {
    const rotated: Book[] = [
      { id: 1, original_language: 'fr' },
      { id: 2, original_language: 'fr' },
      { id: 3, original_language: 'fr' },
    ]
    const result = selectWithLanguageDiversity(rotated, 3)
    expect(result.map(b => b.id)).toEqual([1, 2, 3])
  })

  it('returns up to `count` items when the pool is smaller', () => {
    const result = selectWithLanguageDiversity(
      [{ id: 1, original_language: 'fr' }],
      3,
    )
    expect(result.length).toBe(1)
  })
})

describe('dayOfYear', () => {
  it('returns 1 for Jan 1 UTC', () => {
    expect(dayOfYear(new Date(Date.UTC(2026, 0, 1)))).toBe(1)
  })

  it('returns 365 for Dec 31 of a non-leap year UTC', () => {
    expect(dayOfYear(new Date(Date.UTC(2026, 11, 31)))).toBe(365)
  })

  it('returns 366 for Dec 31 of a leap year UTC', () => {
    expect(dayOfYear(new Date(Date.UTC(2024, 11, 31)))).toBe(366)
  })
})

describe('hashReasonSlug', () => {
  it('is stable for the same input', () => {
    expect(hashReasonSlug('lgbtq')).toBe(hashReasonSlug('lgbtq'))
  })

  it('returns a non-negative integer', () => {
    for (const slug of ['lgbtq', 'sexual', 'political', 'religious', 'racial', 'non-english']) {
      const h = hashReasonSlug(slug)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
    }
  })

  it('typically distinguishes the homepage reason slugs', () => {
    const slugs = ['lgbtq', 'sexual', 'political', 'religious', 'racial']
    const hashes = new Set(slugs.map(hashReasonSlug))
    expect(hashes.size).toBe(slugs.length)
  })
})
