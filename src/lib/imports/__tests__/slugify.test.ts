import { describe, it, expect } from 'vitest'
import { slugify } from '../slugify'

describe('slugify', () => {
  describe('basic ASCII behaviour', () => {
    it('lowercases and hyphen-joins plain ASCII', () => {
      expect(slugify('Hello World')).toBe('hello-world')
    })

    it('strips ASCII and curly apostrophes', () => {
      expect(slugify("It's a Wonderful Life")).toBe('its-a-wonderful-life')
      expect(slugify('It’s a Wonderful Life')).toBe('its-a-wonderful-life')
    })

    it('collapses repeated punctuation into a single hyphen', () => {
      expect(slugify('La  Question --- Encore')).toBe('la-question-encore')
    })

    it('trims leading and trailing hyphens', () => {
      expect(slugify('  --hello world--  ')).toBe('hello-world')
    })

    it('handles empty input', () => {
      expect(slugify('')).toBe('')
      expect(slugify('   ')).toBe('')
    })
  })

  describe('Latin-script diacritics (the bug this helper exists to fix)', () => {
    // Acceptance cases from docs/sprint-a/step-0-findings.md §1
    it('normalises Julián -> julian (the known corrupt production slug)', () => {
      expect(slugify('Julián Is a Mermaid')).toBe('julian-is-a-mermaid')
    })

    it('normalises French acutes (Éden, Éden, Éden)', () => {
      expect(slugify('Éden, Éden, Éden')).toBe('eden-eden-eden')
    })

    it('normalises Les Misérables', () => {
      expect(slugify('Les Misérables')).toBe('les-miserables')
    })

    it('normalises French graves and circumflexes', () => {
      expect(slugify('La Question')).toBe('la-question')
      expect(slugify('À la recherche du temps perdu')).toBe('a-la-recherche-du-temps-perdu')
      expect(slugify('Être ou ne pas être')).toBe('etre-ou-ne-pas-etre')
    })

    it('normalises ç and ñ', () => {
      expect(slugify('Crónica de una muerte anunciada')).toBe('cronica-de-una-muerte-anunciada')
      expect(slugify('Garçon')).toBe('garcon')
    })

    it('normalises ï / ü / ö (diaeresis)', () => {
      expect(slugify('Naïveté')).toBe('naivete')
      expect(slugify('Über alles')).toBe('uber-alles')
    })

    it('expands French ligature œ to oe', () => {
      expect(slugify('Œuvres complètes')).toBe('oeuvres-completes')
      expect(slugify('cœur')).toBe('coeur')
    })

    it('expands German sharp s (ß) to ss', () => {
      expect(slugify('Straße')).toBe('strasse')
    })
  })

  describe('regression: the production bug', () => {
    it('does NOT produce juli-n-is-a-mermaid (the known corrupt slug)', () => {
      // This is exactly the case that the old implementation got wrong:
      // accented chars were stripped by [^a-z0-9]+ -> hyphen, producing a
      // hyphen where the base letter should have remained.
      expect(slugify('Julián Is a Mermaid')).not.toBe('juli-n-is-a-mermaid')
    })
  })

  describe('non-Latin scripts (documented limitation)', () => {
    // NFD does nothing useful for Cyrillic/Han/Arabic — the helper returns
    // empty. Callers (Sprint A import pipeline) must slug from a Latin-script
    // transliteration instead. We pin this behaviour so it stays explicit.
    it('returns empty for Cyrillic input', () => {
      expect(slugify('Война и мир')).toBe('')
    })

    it('returns empty for Arabic input', () => {
      expect(slugify('ألف ليلة وليلة')).toBe('')
    })
  })
})
