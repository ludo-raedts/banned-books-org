import { describe, it, expect } from 'vitest'
import { titlesMatch } from '../title-match'

describe('titlesMatch', () => {
  it('rejects siblings that differ by a distinctive word', () => {
    // The exact collision that pinned one cover onto two books.
    expect(
      titlesMatch('The Seven Wonders of the Historic World', 'The Seven Wonders of the Ancient World'),
    ).toBe(false)
  })

  it('rejects a different volume in the same series', () => {
    expect(titlesMatch('Assassination Classroom, Vol. 3', 'Assassination Classroom, Vol. 1')).toBe(false)
    expect(titlesMatch('Dune: House Atreides, Vol. 1', 'Dune: House Harkonnen')).toBe(false)
  })

  it('accepts an exact match ignoring case/punctuation/accents', () => {
    expect(titlesMatch('Don Quijote', 'don quijote')).toBe(true)
    expect(titlesMatch('Les Misérables', 'Les Miserables')).toBe(true)
  })

  it('accepts a candidate carrying extra subtitle/series tokens', () => {
    expect(titlesMatch('Maus', 'Maus I: A Survivor’s Tale')).toBe(true)
    expect(
      titlesMatch('Harry Potter and the Philosopher’s Stone', 'Harry Potter and the Philosopher’s Stone (Book 1)'),
    ).toBe(true)
  })

  it('matches the correct volume to itself', () => {
    expect(titlesMatch('Assassination Classroom, Vol. 3', 'Assassination Classroom, Vol. 3')).toBe(true)
  })

  it('refuses to match when our title has no significant tokens', () => {
    expect(titlesMatch('The', 'The Ancient World')).toBe(false)
    expect(titlesMatch('', 'Anything')).toBe(false)
  })

  it('treats volume/part marker words as noise but keeps the number', () => {
    // "Volume 3" and "Vol. 3" carry the same distinctive token (3).
    expect(titlesMatch('Some Manga Volume 3', 'Some Manga Vol. 3')).toBe(true)
    expect(titlesMatch('Some Manga Volume 3', 'Some Manga Vol. 4')).toBe(false)
  })
})
