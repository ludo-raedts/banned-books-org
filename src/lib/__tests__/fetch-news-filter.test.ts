import { describe, it, expect } from 'vitest'
import { matchesBooksFilter, BOOKS_KEYWORDS } from '@/lib/fetch-news'

describe('matchesBooksFilter', () => {
  it('matches when title mentions a book/banning keyword', () => {
    expect(matchesBooksFilter('Florida district bans novel from school libraries', '')).toBe(true)
    expect(matchesBooksFilter('Author detained at border', 'irrelevant body')).toBe(true)
    expect(matchesBooksFilter('Library shuts down after pressure', '')).toBe(true)
  })

  it('matches when only the description mentions a keyword', () => {
    expect(matchesBooksFilter('Court ruling in Tehran', 'A publisher was ordered to halt distribution of a book.')).toBe(true)
  })

  it('rejects items that are entirely off-topic', () => {
    expect(matchesBooksFilter('Journalist arrested over protest coverage', 'Police detained a reporter in the capital after street demonstrations.')).toBe(false)
    expect(matchesBooksFilter('Football match postponed', 'Bad weather forced organisers to delay the fixture.')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchesBooksFilter('CENSORSHIP ROW IN BEIJING', '')).toBe(true)
    expect(matchesBooksFilter('headline', 'AUTHOR speaks at conference')).toBe(true)
  })

  it('catches inflected forms like "banned" and "publishing"', () => {
    expect(matchesBooksFilter('Memoir banned from public schools', '')).toBe(true)
    expect(matchesBooksFilter('Independent publishing house raided', '')).toBe(true)
  })

  it('accepts a custom regex', () => {
    expect(matchesBooksFilter('Random news', 'something about poetry', /poetry/i)).toBe(true)
    expect(matchesBooksFilter('Random news', 'something else', /poetry/i)).toBe(false)
  })

  it('exposes the default regex shape', () => {
    expect(BOOKS_KEYWORDS.flags).toContain('i')
    expect(BOOKS_KEYWORDS.test('book')).toBe(true)
    expect(BOOKS_KEYWORDS.test('weather')).toBe(false)
  })
})
