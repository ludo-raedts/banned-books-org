import { describe, it, expect } from 'vitest'
import { parseAuthors } from './parser'

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
