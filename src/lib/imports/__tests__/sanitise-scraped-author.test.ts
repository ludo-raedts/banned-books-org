import { describe, it, expect } from 'vitest'
import { sanitiseScrapedAuthor } from '../sanitise-scraped-author'

describe('sanitiseScrapedAuthor', () => {
  it('passes through clean names untouched', () => {
    expect(sanitiseScrapedAuthor('Sasha Filipenko')).toEqual({ cleanName: 'Sasha Filipenko', reason: null })
    expect(sanitiseScrapedAuthor('Kaciaryna Andrejeva')).toEqual({ cleanName: 'Kaciaryna Andrejeva', reason: null })
    expect(sanitiseScrapedAuthor('Yukio Mishima')).toEqual({ cleanName: 'Yukio Mishima', reason: null })
  })

  it('strips section-header suffix produced by PEN-Belarus scraper', () => {
    expect(sanitiseScrapedAuthor('Sui Ishida (Japan) 24.01.2025 (30 items):')).toEqual({
      cleanName: 'Sui Ishida', reason: 'section-header',
    })
    expect(sanitiseScrapedAuthor('Casey McQuiston (USA) 01.04.2025 (27 items):')).toEqual({
      cleanName: 'Casey McQuiston', reason: 'section-header',
    })
    expect(sanitiseScrapedAuthor('Ann Shulgin (USA) 26.02.2026 (16 items):')).toEqual({
      cleanName: 'Ann Shulgin', reason: 'section-header',
    })
  })

  it('strips role prefix', () => {
    expect(sanitiseScrapedAuthor('Translations — Vladimir Khoroshko')).toEqual({
      cleanName: 'Vladimir Khoroshko', reason: 'role-prefix',
    })
    expect(sanitiseScrapedAuthor('ed. by V. Korkunov')).toEqual({
      cleanName: 'V. Korkunov', reason: 'role-prefix',
    })
    expect(sanitiseScrapedAuthor('illus. by Chip Zdarsky')).toEqual({
      cleanName: 'Chip Zdarsky', reason: 'role-prefix',
    })
    expect(sanitiseScrapedAuthor('Illustrated by Stevie Lewis')).toEqual({
      cleanName: 'Stevie Lewis', reason: 'role-prefix',
    })
  })

  it('strips trailing "et al" / ",Etc" / "and others"', () => {
    expect(sanitiseScrapedAuthor('Hu Hwa ,Etc')).toEqual({
      cleanName: 'Hu Hwa', reason: 'trailing-etc',
    })
    expect(sanitiseScrapedAuthor('Wang Hai et al.')).toEqual({
      cleanName: 'Wang Hai', reason: 'trailing-etc',
    })
    expect(sanitiseScrapedAuthor('John Smith and others')).toEqual({
      cleanName: 'John Smith', reason: 'trailing-etc',
    })
  })

  it('handles combined section-header + role-prefix', () => {
    const r = sanitiseScrapedAuthor('ed. by V. Korkunov (Russia) 30.09.2025 (32 items):')
    expect(r.cleanName).toBe('V. Korkunov')
  })

  it('strips leading garbage', () => {
    expect(sanitiseScrapedAuthor(') – Ryū Murakami (Japan) 29.12.2025 (32 items):')).toEqual({
      cleanName: 'Ryū Murakami', reason: 'garbage-prefix',
    })
  })

  it('handles reverse pen-name "(Real Name) Pen Name"', () => {
    expect(sanitiseScrapedAuthor('(Hamidin bin Kasim) Pak Wa')).toEqual({
      cleanName: 'Pak Wa', reason: 'reverse-pen-name',
    })
  })

  it('strips trailing standalone country tag', () => {
    expect(sanitiseScrapedAuthor('Legs McNeil (USA)')).toEqual({
      cleanName: 'Legs McNeil', reason: 'trailing-country',
    })
  })

  it('takes the post-dash personal name when a title got prepended', () => {
    expect(sanitiseScrapedAuthor('All Shades of Fall – Ivan Belov')).toEqual({
      cleanName: 'Ivan Belov', reason: 'title-dash-author',
    })
  })

  it('REJECTS misplaced book titles with unmatched paren tail', () => {
    expect(sanitiseScrapedAuthor('Murder on Makajonka Street (Warsaw').cleanName).toBeNull()
    expect(sanitiseScrapedAuthor('Red Crosses (Kraków').cleanName).toBeNull()
    expect(sanitiseScrapedAuthor('Partisans of the USSR: From Myths to Reality (Vilnius').cleanName).toBeNull()
  })

  it('does NOT eat a single (Country) tag on a one-token name', () => {
    // Could be a real disambiguator on its own.
    expect(sanitiseScrapedAuthor('Anonymous (USA)').reason).toBeNull()
  })

  it('returns empty for empty/whitespace input', () => {
    expect(sanitiseScrapedAuthor('').cleanName).toBeNull()
    expect(sanitiseScrapedAuthor('   ').cleanName).toBeNull()
  })
})
