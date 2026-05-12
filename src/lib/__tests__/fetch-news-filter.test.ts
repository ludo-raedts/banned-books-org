import { describe, it, expect } from 'vitest'
import { matchesBooksFilter, BOOKS_KEYWORDS } from '@/lib/fetch-news'

describe('matchesBooksFilter', () => {
  it('matches when title mentions a strong term', () => {
    expect(matchesBooksFilter('Florida district pulls novel from school libraries', '')).toBe(true)
    expect(matchesBooksFilter('Author detained at border', 'irrelevant body')).toBe(true)
    expect(matchesBooksFilter('Library shuts down after pressure', '')).toBe(true)
  })

  it('matches when only the description mentions a strong term', () => {
    expect(matchesBooksFilter('Court ruling in Tehran', 'A publisher was ordered to halt distribution of a book.')).toBe(true)
  })

  it('rejects items that are entirely off-topic', () => {
    expect(matchesBooksFilter('Journalist arrested over protest coverage', 'Police detained a reporter in the capital after street demonstrations.')).toBe(false)
    expect(matchesBooksFilter('Football match postponed', 'Bad weather forced organisers to delay the fixture.')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchesBooksFilter('BANNED BOOKS LIST RELEASED', '')).toBe(true)
    expect(matchesBooksFilter('headline', 'AUTHOR speaks at conference')).toBe(true)
  })

  // The previous regex matched "ban", "censor", and "publish" on their own,
  // which let in press-credential bans, asset bans, censored websites,
  // published regulations — none of them about books. The strong terms
  // (book/author/library/literature) must be present.
  it('rejects weak terms when no strong term co-occurs', () => {
    expect(matchesBooksFilter('Russia revokes press credentials for Victory Day parade', '')).toBe(false)
    expect(matchesBooksFilter('Moscow court bans entertainment website', '')).toBe(false)
    expect(matchesBooksFilter('Independent publishing house raided', '')).toBe(false)
    expect(matchesBooksFilter('Censorship row in Beijing', '')).toBe(false)
    expect(matchesBooksFilter('Memoir banned from public schools', '')).toBe(false)
  })

  it('passes when a weak term co-occurs with a strong term', () => {
    expect(matchesBooksFilter('Memoir banned: school library removes book', '')).toBe(true)
    expect(matchesBooksFilter('Author censored', '')).toBe(true)
    expect(matchesBooksFilter('Censorship of literature in schools', '')).toBe(true)
  })

  it('uses word boundaries to avoid sub-word false positives', () => {
    expect(matchesBooksFilter('Facebook removes posts', '')).toBe(false)
    expect(matchesBooksFilter('Authoritarian regime tightens grip', '')).toBe(false)
    expect(matchesBooksFilter('Authority issues new guidelines', '')).toBe(false)
  })

  it('accepts a custom regex', () => {
    expect(matchesBooksFilter('Random news', 'something about poetry', /poetry/i)).toBe(true)
    expect(matchesBooksFilter('Random news', 'something else', /poetry/i)).toBe(false)
  })

  it('exposes the default regex shape', () => {
    expect(BOOKS_KEYWORDS.flags).toContain('i')
    expect(BOOKS_KEYWORDS.test('book')).toBe(true)
    expect(BOOKS_KEYWORDS.test('weather')).toBe(false)
    expect(BOOKS_KEYWORDS.test('ban')).toBe(false)
    expect(BOOKS_KEYWORDS.test('publish')).toBe(false)
  })
})
