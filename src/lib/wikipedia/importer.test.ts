import { describe, it, expect } from 'vitest'
import { decide } from './importer'
import type { DedupResult, ParsedRow, ReasonMapping } from './types'

function makeRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    year: 1955,
    title: 'Lolita',
    authors: ['Vladimir Nabokov'],
    state: null,
    notes_raw: 'banned for obscenity',
    source_anchor: 'France',
    quality_flags: [],
    ...overrides,
  }
}

const highReason: ReasonMapping = { slug: 'obscenity', confidence: 'high' }
const dupHit: Extract<DedupResult, { kind: 'duplicate' }> = {
  kind: 'duplicate',
  book_id: 51,
  similarity: 0.95,
  match_type: 'fuzzy_title_author',
}

describe('decide() — nearbyBan soft-duplicate routing', () => {
  // Regression: Lolita FR had ban id=58 (1956, sexual) plus ban id=5038 (1955,
  // obscenity) because the importer's auto_add_ban path only checked the
  // strict (book_id, country_code, year_started, scope_id) tuple. Same event,
  // different reporting → two visible rows on /books/lolita.

  it('routes to review when dedup matches an existing book that already has a nearby ban', () => {
    const decision = decide({
      row: makeRow({ year: 1955 }),
      reason: highReason,
      reasonFlags: [],
      dedup: dupHit,
      nearbyBan: { ban_id: 58, year_started: 1956 },
    })
    expect(decision.mode).toBe('review')
    if (decision.mode !== 'review') return
    expect(decision.quality_flags).toContain('possible_year_dup_for_book')
    expect(decision.nearby_ban).toEqual({ ban_id: 58, year_started: 1956 })
  })

  it('auto-adds-ban when dedup matches but no nearby ban exists', () => {
    const decision = decide({
      row: makeRow({ year: 1955 }),
      reason: highReason,
      reasonFlags: [],
      dedup: dupHit,
      nearbyBan: null,
    })
    expect(decision.mode).toBe('auto_add_ban')
  })

  it('auto-adds-ban when nearbyBan param is omitted (backwards compatibility)', () => {
    const decision = decide({
      row: makeRow({ year: 1955 }),
      reason: highReason,
      reasonFlags: [],
      dedup: dupHit,
    })
    expect(decision.mode).toBe('auto_add_ban')
  })

  it('ignores nearbyBan when dedup is none (cannot have a nearby ban on a non-existent book)', () => {
    const decision = decide({
      row: makeRow({ year: 1955 }),
      reason: highReason,
      reasonFlags: [],
      dedup: { kind: 'none' },
      // nearbyBan would be nonsensical here but make sure it doesn't poison
      // the auto_approve path.
      nearbyBan: { ban_id: 99999, year_started: 1956 },
    })
    expect(decision.mode).toBe('auto_approve')
  })
})
