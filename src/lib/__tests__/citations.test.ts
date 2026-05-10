import { describe, expect, it } from 'vitest'
import { formatCitation, type CitationInput } from '../citations'

const ACCESSED = new Date(Date.UTC(2026, 4, 10, 12, 0, 0)) // 10 May 2026 — fixed to match prompt example

const BOOK: CitationInput = {
  entityType: 'book',
  entity: {
    title: '1984',
    authors: ['George Orwell'],
    slug: '1984',
  },
  url: 'https://www.banned-books.org/books/1984',
  accessedAt: ACCESSED,
}

const AUTHOR: CitationInput = {
  entityType: 'author',
  entity: { title: 'George Orwell', slug: 'george-orwell' },
  url: 'https://www.banned-books.org/authors/george-orwell',
  accessedAt: ACCESSED,
}

const COUNTRY: CitationInput = {
  entityType: 'country',
  entity: { title: 'Iran', slug: 'ir', code: 'IR' },
  url: 'https://www.banned-books.org/countries/ir',
  accessedAt: ACCESSED,
}

const ESSAY: CitationInput = {
  entityType: 'essay',
  entity: { title: 'The grey zone where censorship debates actually live', slug: 'the-grey-zone' },
  url: 'https://www.banned-books.org/essays/the-grey-zone',
  accessedAt: ACCESSED,
}

const METHODOLOGY: CitationInput = {
  entityType: 'methodology',
  entity: { title: 'Why the United States dominates this data', slug: 'methodology' },
  url: 'https://www.banned-books.org/methodology',
  accessedAt: ACCESSED,
}

describe('formatCitation', () => {
  describe('book', () => {
    it('APA includes year, sentence-case "Censorship history", and Retrieved date', () => {
      const out = formatCitation(BOOK, 'apa')
      expect(out).toBe(
        'Banned Books. (2026). 1984 by George Orwell: Censorship history. Retrieved May 10, 2026, from https://www.banned-books.org/books/1984',
      )
    })

    it('MLA uses title-case "Censorship History", DD Month YYYY, and bare URL', () => {
      const out = formatCitation(BOOK, 'mla')
      expect(out).toBe(
        '"1984 by George Orwell: Censorship History." Banned Books, 10 May 2026, www.banned-books.org/books/1984.',
      )
    })

    it('Chicago uses title-case and "Accessed" + URL', () => {
      const out = formatCitation(BOOK, 'chicago')
      expect(out).toBe(
        '"1984 by George Orwell: Censorship History." Banned Books. Accessed May 10, 2026. https://www.banned-books.org/books/1984.',
      )
    })

    it('collapses 4+ authors to first three + "et al."', () => {
      const fourAuthors: CitationInput = {
        ...BOOK,
        entity: { ...BOOK.entity, authors: ['A One', 'B Two', 'C Three', 'D Four'] },
      }
      expect(formatCitation(fourAuthors, 'apa')).toContain('by A One, B Two, C Three, et al.')
    })

    it('joins exactly two authors with "and"', () => {
      const two: CitationInput = {
        ...BOOK,
        entity: { ...BOOK.entity, authors: ['A One', 'B Two'] },
      }
      expect(formatCitation(two, 'apa')).toContain('by A One and B Two')
    })

    it('falls back to plain title when authors list is empty', () => {
      const noAuthors: CitationInput = { ...BOOK, entity: { ...BOOK.entity, authors: [] } }
      expect(formatCitation(noAuthors, 'apa')).toContain('1984: Censorship history')
    })
  })

  describe('author', () => {
    it('APA: "Banned books and censorship"', () => {
      expect(formatCitation(AUTHOR, 'apa')).toBe(
        'Banned Books. (2026). George Orwell: Banned books and censorship. Retrieved May 10, 2026, from https://www.banned-books.org/authors/george-orwell',
      )
    })

    it('MLA: title-case "Banned Books and Censorship"', () => {
      expect(formatCitation(AUTHOR, 'mla')).toBe(
        '"George Orwell: Banned Books and Censorship." Banned Books, 10 May 2026, www.banned-books.org/authors/george-orwell.',
      )
    })

    it('Chicago: title-case + "Accessed"', () => {
      expect(formatCitation(AUTHOR, 'chicago')).toBe(
        '"George Orwell: Banned Books and Censorship." Banned Books. Accessed May 10, 2026. https://www.banned-books.org/authors/george-orwell.',
      )
    })
  })

  describe('country', () => {
    it('APA: "Book censorship in {country}"', () => {
      expect(formatCitation(COUNTRY, 'apa')).toBe(
        'Banned Books. (2026). Book censorship in Iran. Retrieved May 10, 2026, from https://www.banned-books.org/countries/ir',
      )
    })

    it('MLA: "Book Censorship in {country}"', () => {
      expect(formatCitation(COUNTRY, 'mla')).toBe(
        '"Book Censorship in Iran." Banned Books, 10 May 2026, www.banned-books.org/countries/ir.',
      )
    })

    it('Chicago: title-case + "Accessed"', () => {
      expect(formatCitation(COUNTRY, 'chicago')).toBe(
        '"Book Censorship in Iran." Banned Books. Accessed May 10, 2026. https://www.banned-books.org/countries/ir.',
      )
    })
  })

  describe('essay', () => {
    it('APA: personal author "Raedts, L." + Banned Books as publisher', () => {
      expect(formatCitation(ESSAY, 'apa')).toBe(
        'Raedts, L. (2026). The grey zone where censorship debates actually live. Banned Books. Retrieved May 10, 2026, from https://www.banned-books.org/essays/the-grey-zone',
      )
    })

    it('MLA: full name "Raedts, Ludo"', () => {
      expect(formatCitation(ESSAY, 'mla')).toBe(
        'Raedts, Ludo. "The grey zone where censorship debates actually live." Banned Books, 10 May 2026, www.banned-books.org/essays/the-grey-zone.',
      )
    })

    it('Chicago: full name + "Accessed"', () => {
      expect(formatCitation(ESSAY, 'chicago')).toBe(
        'Raedts, Ludo. "The grey zone where censorship debates actually live." Banned Books. Accessed May 10, 2026. https://www.banned-books.org/essays/the-grey-zone.',
      )
    })
  })

  describe('methodology', () => {
    it('APA: fixed title "Methodology and coverage notes" + personal author', () => {
      expect(formatCitation(METHODOLOGY, 'apa')).toBe(
        'Raedts, L. (2026). Methodology and coverage notes. Banned Books. Retrieved May 10, 2026, from https://www.banned-books.org/methodology',
      )
    })

    it('MLA: title-case "Methodology and Coverage Notes"', () => {
      expect(formatCitation(METHODOLOGY, 'mla')).toBe(
        'Raedts, Ludo. "Methodology and Coverage Notes." Banned Books, 10 May 2026, www.banned-books.org/methodology.',
      )
    })

    it('Chicago: title-case + "Accessed"', () => {
      expect(formatCitation(METHODOLOGY, 'chicago')).toBe(
        'Raedts, Ludo. "Methodology and Coverage Notes." Banned Books. Accessed May 10, 2026. https://www.banned-books.org/methodology.',
      )
    })
  })
})
