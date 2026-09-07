import { describe, expect, it } from 'vitest'
import { matchNames, nameTokens, surnameOf } from '../_audit_author_photo_olid'

describe('nameTokens', () => {
  it('strips diacritics, lowercases and drops lone initials', () => {
    expect(nameTokens('P. C. Cast')).toEqual(['cast'])
    expect(nameTokens('Gabriel García Márquez')).toEqual(['gabriel', 'garcia', 'marquez'])
  })

  it('folds ligatures that have no NFD decomposition', () => {
    // "Kœstler" used to tokenise to ['stler'] and miss OL's "Arthur Koestler".
    expect(nameTokens('Kœstler')).toEqual(['koestler'])
    expect(nameTokens('Søren Kierkegaard')).toEqual(['soren', 'kierkegaard'])
    expect(nameTokens('Stanisław Lem')).toEqual(['stanislaw', 'lem'])
  })

  it('drops particles and honorifics so they can never clear a row', () => {
    expect(nameTokens('Ludwig van Beethoven')).toEqual(['ludwig', 'beethoven'])
    expect(nameTokens('Martin Luther King Jr.')).toEqual(['martin', 'luther', 'king'])
  })
})

describe('surnameOf', () => {
  it('handles both plain and inverted "Surname, First" forms', () => {
    expect(surnameOf('Alex London')).toBe('london')
    expect(surnameOf('London, Alex')).toBe('london')
    expect(surnameOf('Geisel, Theodor Seuss')).toBe('geisel')
  })

  it('ignores parentheticals', () => {
    expect(surnameOf('Twain, Mark (pseud.)')).toBe('twain')
  })

  it('keeps a non-Latin surname (it is compared in its own script)', () => {
    expect(surnameOf('残雪')).toBe('残雪')
    expect(surnameOf('Петров, Константин Павлович')).toBe('петров')
  })

  it('returns null when nothing usable survives', () => {
    expect(surnameOf('F. M. T. C')).toBeNull() // all initials
    expect(surnameOf('残雪', new Set(['latin' as const]))).toBeNull() // wrong script
  })
})

describe('matchNames', () => {
  it('flags the Alex London / Mark Twain contamination with zero overlap', () => {
    const r = matchNames('Alex London', ['Mark Twain', 'Twain, Mark', 'Samuel Langhorne Clemens'])
    expect(r.verdict).toBe('NO_NAME_OVERLAP')
    expect(r.sharedTokens).toEqual([])
  })

  it('clears an inverted OL record for the same person', () => {
    expect(matchNames('Alex London', ['London, Alex']).verdict).toBe('OK')
  })

  it('clears on a diacritic-only difference', () => {
    expect(matchNames('Gabriel García Márquez', ['Gabriel Garcia Marquez']).verdict).toBe('OK')
  })

  it('clears a pen name via alternate_names / personal_name', () => {
    expect(matchNames('Dr. Seuss', ['Dr. Seuss', 'Geisel, Theodor Seuss']).verdict).toBe('OK')
  })

  it('clears when only a middle-name variant differs', () => {
    expect(matchNames('J. K. Rowling', ['Joanne Kathleen Rowling']).verdict).toBe('OK')
  })

  it('reports a namesake sharing only the given name as SURNAME_MISMATCH', () => {
    const r = matchNames('Michelle Levy', ['Michelle Obama'])
    expect(r.verdict).toBe('SURNAME_MISMATCH')
    expect(r.sharedTokens).toEqual(['michelle'])
  })

  it('does not let a shared particle clear a row', () => {
    expect(matchNames('Jan van Dijk', ['Piet van Houten']).verdict).toBe('NO_NAME_OVERLAP')
  })

  it('clears a ligature-only difference against the OL record', () => {
    expect(matchNames('Kœstler', ['Arthur Koestler', 'Koestler, Arthur']).verdict).toBe('OK')
  })

  it('refuses to judge a cross-script pair rather than guessing', () => {
    expect(matchNames('残雪', ['Can Xue']).verdict).toBe('UNVERIFIABLE')
    expect(matchNames('Can Xue', ['残雪']).verdict).toBe('UNVERIFIABLE')
  })

  it('refuses to judge an all-initials display_name', () => {
    // authors #16901 "F. M. T. C" — a mangled name fragment, nothing to compare.
    expect(matchNames('F. M. T. C', ['Maurice Bowra', 'C. M. Bowra']).verdict).toBe('UNVERIFIABLE')
  })

  it('matches a Cyrillic name against the OL record own native variant', () => {
    // authors #12353 — OL carries both the transliteration and the native form,
    // so the row must clear in Cyrillic instead of being punted as unverifiable.
    const r = matchNames('Петров Константин Павлович', [
      'Konstantin Pavlovich Petrov',
      'K. P. Petrov',
      'Петров, Константин Павлович',
    ])
    expect(r.verdict).toBe('OK')
    expect(r.matchedOn).toBe('Петров, Константин Павлович')
  })

  it('still flags a Cyrillic-vs-Cyrillic mismatch instead of punting', () => {
    expect(matchNames('Петров Константин', ['Толстой, Лев Николаевич']).verdict).toBe(
      'NO_NAME_OVERLAP',
    )
  })

  it('ignores a cross-script variant when a same-script one disagrees', () => {
    // The Latin variant is unjudgeable against a Cyrillic name; the Cyrillic
    // one must still be judged rather than skipped along with it.
    const r = matchNames('Петров Константин', ['Leo Tolstoy', 'Толстой, Лев'])
    expect(r.verdict).toBe('NO_NAME_OVERLAP')
    expect(r.matchedOn).toBe('Толстой, Лев')
  })
})
