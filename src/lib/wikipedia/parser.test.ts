import { describe, it, expect } from 'vitest'
import { parseAuthors, isAggregateCountPlaceholder, isAllCategoryAggregate } from './parser'

describe('parseAuthors — "Lastname, Firstname." sorted form', () => {
  // The Wikipedia HK book-censorship page appends a trailing period to
  // every author cell. Without the SORTED_NAME regex tolerating that
  // period, the unflip step failed and the naive comma-split below
  // produced two bogus authors ("Thomas" + "Gordon.") for every cell
  // with a single Latin-only author in "Last, First" form. See chat
  // 2026-05-18 for the production fallout (~70 affected books).

  it('unflips "Thomas, Gordon." → "Gordon Thomas"', () => {
    const r = parseAuthors('Thomas, Gordon.')
    expect(r.authors).toEqual(['Gordon Thomas'])
  })

  it('unflips "Diamond, Larry." → "Larry Diamond"', () => {
    const r = parseAuthors('Diamond, Larry.')
    expect(r.authors).toEqual(['Larry Diamond'])
  })

  it('unflips without trailing period (regression: still works)', () => {
    const r = parseAuthors('Machiavelli, Niccolo')
    expect(r.authors).toEqual(['Niccolo Machiavelli'])
  })

  it('unflips bilingual "陳雲 / Chen, Yun." → "Yun Chen" with name_native', () => {
    const r = parseAuthors('陳雲 / Chen, Yun.')
    expect(r.authors).toEqual(['Yun Chen'])
    expect(r.author_meta[0]?.name_native).toBe('陳雲')
  })

  it('does NOT unflip a 3-author list "Smith, Jones, and Doe"', () => {
    // Multiple commas → SORTED_NAME doesn't match (it requires exactly
    // one comma), so we fall through to the comma-split path.
    const r = parseAuthors('Smith, Jones, and Doe')
    expect(r.authors.length).toBeGreaterThan(1)
  })

  it('handles "Bacon, Franciscus" without exploding into two authors', () => {
    const r = parseAuthors('Bacon, Franciscus')
    expect(r.authors).toEqual(['Franciscus Bacon'])
  })

})

describe('isAggregateCountPlaceholder — guard against count-as-title rows', () => {
  // Regression: 2026-05-28. Wikipedia Index Librorum auto-import created
  // book rows like "19 titles" (Renan), "6 titles" (Michelet) and "7 works"
  // (Lamennais) because the Works cell on Wikipedia uses these as
  // shorthand instead of enumerating actual titles. The downstream LLM
  // then fabricated plausible-sounding synopses, ban descriptions and even
  // ISBNs around the bogus titles.

  it('flags "19 titles"', () => {
    expect(isAggregateCountPlaceholder('19 titles')).toBe(true)
  })

  it('flags "6 titles"', () => {
    expect(isAggregateCountPlaceholder('6 titles')).toBe(true)
  })

  it('flags "7 works"', () => {
    expect(isAggregateCountPlaceholder('7 works')).toBe(true)
  })

  it('flags various phrasings: volumes, writings, publications', () => {
    expect(isAggregateCountPlaceholder('3 volumes')).toBe(true)
    expect(isAggregateCountPlaceholder('12 writings')).toBe(true)
    expect(isAggregateCountPlaceholder('4 publications')).toBe(true)
    expect(isAggregateCountPlaceholder('Opera omnia')).toBe(true)
    expect(isAggregateCountPlaceholder('Various works')).toBe(true)
    expect(isAggregateCountPlaceholder('His works')).toBe(true)
  })

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isAggregateCountPlaceholder('  19 TITLES  ')).toBe(true)
    expect(isAggregateCountPlaceholder('opera Omnia')).toBe(true)
  })

  it('does NOT flag real titles that start with a number', () => {
    expect(isAggregateCountPlaceholder('1984')).toBe(false)
    expect(isAggregateCountPlaceholder('1Q84')).toBe(false)
    expect(isAggregateCountPlaceholder('19 Minutes')).toBe(false)
    expect(isAggregateCountPlaceholder('Fahrenheit 451')).toBe(false)
  })

  it('does NOT flag "All works" — that is the author-prefix aggregate path', () => {
    // parseRowCells turns these into "Author — All works"; keep them.
    expect(isAggregateCountPlaceholder('All works')).toBe(false)
    expect(isAggregateCountPlaceholder('All works of theology')).toBe(false)
  })

  it('flags placeholder words', () => {
    expect(isAggregateCountPlaceholder('Unknown')).toBe(true)
    expect(isAggregateCountPlaceholder('Untitled')).toBe(true)
    expect(isAggregateCountPlaceholder('TBD')).toBe(true)
    expect(isAggregateCountPlaceholder('N/A')).toBe(true)
  })

  it('does NOT flag empty/whitespace (caller handles upstream)', () => {
    expect(isAggregateCountPlaceholder('')).toBe(false)
    expect(isAggregateCountPlaceholder('   ')).toBe(false)
  })
})

describe('isAllCategoryAggregate — author-prefix path for Index aggregates', () => {
  // Regression: pre-2026-05-28 the regex was ^all works( of \w+)?$ which
  // let "All plays" (id 6596, Voltaire on the Index) and "All love stories"
  // (id 6663) slip through without author-prefix, leaving bare aggregate
  // titles in the DB. The widened pattern accepts a closed set of category
  // nouns but rejects arbitrary "All <anything>" so real titles like
  // "All Quiet on the Western Front" still parse as real titles.

  it('flags previously-missed cases', () => {
    expect(isAllCategoryAggregate('All plays')).toBe(true)
    expect(isAllCategoryAggregate('All love stories')).toBe(true)
    expect(isAllCategoryAggregate('All writings of theology')).toBe(true)
  })

  it('still flags the original "All works[ of X]" cases', () => {
    expect(isAllCategoryAggregate('All works')).toBe(true)
    expect(isAllCategoryAggregate('All works of theology')).toBe(true)
  })

  it('flags other Index-style category nouns', () => {
    expect(isAllCategoryAggregate('All novels')).toBe(true)
    expect(isAllCategoryAggregate('All essays')).toBe(true)
    expect(isAllCategoryAggregate('All poems')).toBe(true)
    expect(isAllCategoryAggregate('All sermons')).toBe(true)
    expect(isAllCategoryAggregate('All letters')).toBe(true)
    expect(isAllCategoryAggregate('All memoirs')).toBe(true)
  })

  it('does NOT flag real book titles that happen to start with "All"', () => {
    expect(isAllCategoryAggregate('All Quiet on the Western Front')).toBe(false)
    expect(isAllCategoryAggregate("All the King's Men")).toBe(false)
    expect(isAllCategoryAggregate('All About Eve')).toBe(false)
    expect(isAllCategoryAggregate('All the Pretty Horses')).toBe(false)
    expect(isAllCategoryAggregate('All Things Bright and Beautiful')).toBe(false)
  })

  it('is case-insensitive and tolerates whitespace', () => {
    expect(isAllCategoryAggregate('  ALL WORKS  ')).toBe(true)
    expect(isAllCategoryAggregate('all PLAYS')).toBe(true)
  })
})
