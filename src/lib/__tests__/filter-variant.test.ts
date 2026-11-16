import { describe, expect, it } from 'vitest'
import { hasFilterParams, noindexFollow } from '../filter-variant'

describe('hasFilterParams', () => {
  const keys = ['q', 'country'] as const
  it('is false for no/empty/unknown params', () => {
    expect(hasFilterParams({}, keys)).toBe(false)
    expect(hasFilterParams({ q: '  ' }, keys)).toBe(false)
    expect(hasFilterParams({ utm_source: 'x' }, keys)).toBe(false)
  })
  it('is true when a known filter has a value (string or array)', () => {
    expect(hasFilterParams({ q: 'maus' }, keys)).toBe(true)
    expect(hasFilterParams({ country: ['US'] }, keys)).toBe(true)
  })
})

describe('noindexFollow', () => {
  it('only emits robots for variants', () => {
    expect(noindexFollow(false)).toEqual({})
    expect(noindexFollow(true)).toEqual({ robots: { index: false, follow: true } })
  })
})
