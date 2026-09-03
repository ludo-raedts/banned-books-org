import { describe, it, expect } from 'vitest'
import { isMappedGenre } from '../../src/components/genre-badge'
import {
  DROP,
  FOLD,
  CONTEXTUAL_FOLD,
  NON_FICTION_SLUG_REPAIR,
  resolveGenres,
} from '../lib/genre-folds'

describe('genre-folds table shape', () => {
  it('every fold target is in the canonical vocabulary', () => {
    const targets = [
      ...Object.values(FOLD),
      ...Object.values(CONTEXTUAL_FOLD).flatMap((c) => [c.fiction, c.nonFiction]),
      ...Object.values(NON_FICTION_SLUG_REPAIR),
    ]
    expect(targets.filter((t) => !isMappedGenre(t))).toEqual([])
  })

  it('no slug is both folded and dropped', () => {
    const folded = new Set([...Object.keys(FOLD), ...Object.keys(CONTEXTUAL_FOLD)])
    expect(Object.keys(DROP).filter((s) => folded.has(s))).toEqual([])
  })

  it('never folds a slug onto itself', () => {
    expect(Object.entries(FOLD).filter(([from, to]) => from === to)).toEqual([])
  })
})

describe('resolveGenres', () => {
  it('leaves an already-canonical row untouched', () => {
    expect(resolveGenres(['young-adult', 'dystopian'])).toEqual(['young-adult', 'dystopian'])
  })

  it('is idempotent', () => {
    const once = resolveGenres(['fiction', 'political'])
    expect(resolveGenres(once)).toEqual(once)
  })

  it('folds exact synonyms and dedupes the result', () => {
    expect(resolveGenres(['young-adult', 'young-adult-fiction'])).toEqual(['young-adult'])
    expect(resolveGenres(['essays'])).toEqual(['essay'])
    expect(resolveGenres(['memoir', 'nonfiction'])).toEqual(['memoir', 'non-fiction'])
  })

  it('caps at the 3 slugs the vocabulary allows, keeping the earliest', () => {
    // The 4-slug rows in the DB were all an audience tag appended to a full set.
    expect(resolveGenres(['young-adult', 'dystopian', 'science-fiction', 'young-adult-fiction']))
      .toEqual(['young-adult', 'dystopian', 'science-fiction'])
  })

  it("drops slugs that were never genres, and empties a row that had nothing else", () => {
    expect(resolveGenres(['literary-fiction', 'war'])).toEqual(['literary-fiction'])
    expect(resolveGenres(['children', 'lgbtq', 'picture-book'])).toEqual(['children', 'picture-book'])
    // Bare `fiction` alone → back into the enrich-genres candidate pool.
    expect(resolveGenres(['fiction'])).toEqual([])
  })

  it('resolves the contextual slugs by the mode of the row', () => {
    expect(resolveGenres(['non-fiction', 'political'])).toEqual(['non-fiction', 'political-non-fiction'])
    expect(resolveGenres(['literary-fiction', 'politics'])).toEqual(['literary-fiction', 'political-fiction'])
    // A history book is non-fiction; `history` collapses into it.
    expect(resolveGenres(['non-fiction', 'history'])).toEqual(['non-fiction'])
  })

  it('votes on the ORIGINAL array, so a dropped `fiction` still proves the row is a novel', () => {
    // #1022 The Black Prophet — a famine NOVEL. Voting after the drop made it
    // political-NON-fiction.
    expect(resolveGenres(['fiction', 'political'])).toEqual(['political-fiction'])
  })

  it('never INTRODUCES non-fiction into a row that reads as fiction or verse', () => {
    // #6245 The Red Sari — a novelised biography.
    expect(resolveGenres(['historical-fiction', 'biography'])).toEqual(['historical-fiction'])
    // #996 The Prophet — a 1-1 vote tie; the guard still holds.
    expect(resolveGenres(['poetry', 'philosophy'])).toEqual(['poetry'])
  })

  it('keeps a non-fiction slug the row already carried', () => {
    expect(resolveGenres(['non-fiction', 'philosophy'])).toEqual(['non-fiction'])
  })

  it('repairs political-fiction on a row that declares itself non-fiction', () => {
    // Mein Kampf, Das Kapital and The Communist Manifesto were all tagged
    // political FICTION.
    expect(resolveGenres(['non-fiction', 'political-fiction'])).toEqual(['non-fiction', 'political-non-fiction'])
    // …but political-fiction on an actual novel is left alone.
    expect(resolveGenres(['literary-fiction', 'political-fiction'])).toEqual(['literary-fiction', 'political-fiction'])
  })

  it('treats graphic-novel as a form, not a mode', () => {
    // A graphic adaptation of a non-fiction work must keep its non-fiction slug.
    expect(resolveGenres(['graphic-novel', 'non-fiction'])).toEqual(['graphic-novel', 'non-fiction'])
    expect(resolveGenres(['graphic-novel', 'memoir'])).toEqual(['graphic-novel', 'memoir'])
  })

  it('only ever emits slugs the app can render', () => {
    const samples = [
      ['young-adult-fiction'], ['middle-grade-fiction'], ['picture-book'], ['fiction'],
      ['essays'], ['political'], ['politics'], ['history'], ['philosophy'], ['poetry'],
      ['short-stories'], ['biography'], ['war'], ['historical'], ['drama'], ['science'],
      ['mystery'], ['childrens-literature'], ['law'], ['novella'], ['nonfiction'],
      ['psychology'], ['political-theory'], ['autobiographical'], ['travel'], ['lgbtq'],
      ['health'],
    ]
    for (const s of samples) {
      for (const g of resolveGenres(s)) expect(isMappedGenre(g), `${s} → ${g}`).toBe(true)
    }
  })
})
