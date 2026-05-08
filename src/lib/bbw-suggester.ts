// Banned Books Week featured-books suggestion engine.
//
// Deterministic, stateless, no machine learning. Given a normalized input of
// candidate books with computed feature values, this returns:
//   • the top 10 picks (constrained by diversity rules below)
//   • up to 15 alternates the admin can swap in
//
// Determinism is critical: rerunning the suggester with the same inputs must
// produce the same output (so admins can preview, refresh, and re-publish
// without surprise reorderings). All tiebreaks fall through to book id.

export const BBW_WEIGHTS = {
  recencyOfBans:    0.25,
  totalBanCount:    0.20,
  geographicSpread: 0.15,
  topListPresence:  0.15,
  diversityBonus:   0.25,
} as const

// Penalty for books featured in either of the previous two years (unless
// pinned). Applied as a multiplicative discount on the raw score so that a
// previously-featured book has to earn its slot back on merit.
export const PREV_YEAR_PENALTY = 0.40

// Diversity rules applied to the top 10:
export const RULE_MIN_NON_US      = 4
export const RULE_MIN_REASONS     = 3
export const RULE_MAX_PER_AUTHOR  = 2

// ── Inputs ────────────────────────────────────────────────────────────────────

export type SuggesterBook = {
  id: number
  authorIds: number[]
  /** Total number of recorded bans. */
  banCount: number
  /**
   * 0..1 score reflecting how recent the bans are. Caller computes this
   * however they like; a reasonable default is the share of bans whose
   * year_started falls in the last 5 years.
   */
  recentBanScore: number
  /** Number of distinct countries with a documented ban. */
  countryCount: number
  /** Country codes (ISO-2) of all bans. Used for the non-US diversity rule. */
  countries: string[]
  /** Reason slugs across all bans for this book. */
  reasons: string[]
  /**
   * 0..1 — caller decides; a reasonable mapping is:
   *   1.0 → in v_top_books_this_week top 10
   *   0.5 → in v_top_books_all_time top 100
   *   0   → otherwise
   */
  topListPresence: number
  /** Pinned books are immune to the previous-year penalty AND to diversity-rule swaps. */
  pinned: boolean
  /** True when the book was in the previous-year OR year-before-last featured set. */
  inPreviousYears: boolean
}

export type ScoredBook = SuggesterBook & {
  rawScore: number
  finalScore: number
  components: {
    recencyOfBans: number
    totalBanCount: number
    geographicSpread: number
    topListPresence: number
    diversityBonus: number
  }
  penaltyApplied: boolean
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreBooks(books: SuggesterBook[]): ScoredBook[] {
  if (books.length === 0) return []

  const maxBans      = Math.max(1, ...books.map(b => b.banCount))
  const maxCountries = Math.max(1, ...books.map(b => b.countryCount))
  const totalBooks   = books.length

  // Reason rarity table: fewer-occurring reasons earn a higher diversity bonus.
  const reasonOccurrences = new Map<string, number>()
  for (const b of books) {
    for (const r of new Set(b.reasons)) {
      reasonOccurrences.set(r, (reasonOccurrences.get(r) ?? 0) + 1)
    }
  }

  const scored: ScoredBook[] = books.map(b => {
    const recencyOfBans    = clamp01(b.recentBanScore)
    const totalBanCount    = b.banCount / maxBans
    const geographicSpread = b.countryCount / maxCountries
    const topListPresence  = clamp01(b.topListPresence)

    const nonUSShare = b.countries.length === 0
      ? 0
      : b.countries.filter(c => c !== 'US').length / b.countries.length
    const reasonRarityBoost = b.reasons.length === 0
      ? 0
      : Math.max(0, ...b.reasons.map(r => 1 - (reasonOccurrences.get(r) ?? totalBooks) / totalBooks))
    const diversityBonus = (nonUSShare + reasonRarityBoost) / 2

    const components = { recencyOfBans, totalBanCount, geographicSpread, topListPresence, diversityBonus }
    const rawScore =
      BBW_WEIGHTS.recencyOfBans    * recencyOfBans    +
      BBW_WEIGHTS.totalBanCount    * totalBanCount    +
      BBW_WEIGHTS.geographicSpread * geographicSpread +
      BBW_WEIGHTS.topListPresence  * topListPresence  +
      BBW_WEIGHTS.diversityBonus   * diversityBonus

    const penaltyApplied = b.inPreviousYears && !b.pinned
    const finalScore = penaltyApplied ? rawScore * (1 - PREV_YEAR_PENALTY) : rawScore

    return { ...b, rawScore, finalScore, components, penaltyApplied }
  })

  // Sort by final score desc, breaking ties by id for determinism.
  scored.sort((a, b) => (b.finalScore - a.finalScore) || (a.id - b.id))
  return scored
}

// ── Selection with diversity rules ────────────────────────────────────────────

export type SuggesterResult = {
  top10: ScoredBook[]
  alternates: ScoredBook[]
}

export function pickTop10(scored: ScoredBook[]): SuggesterResult {
  const pinned   = scored.filter(s => s.pinned)
  const unpinned = scored.filter(s => !s.pinned)

  // Pinned books bypass diversity constraints and go in first.
  const selected: ScoredBook[] = [...pinned].slice(0, 10)
  const authorCount = new Map<number, number>()
  for (const b of selected) {
    for (const aid of b.authorIds) {
      authorCount.set(aid, (authorCount.get(aid) ?? 0) + 1)
    }
  }

  const canAddByAuthor = (b: ScoredBook): boolean =>
    b.authorIds.every(aid => (authorCount.get(aid) ?? 0) < RULE_MAX_PER_AUTHOR)

  // Greedy fill respecting the "no more than 2 per author" rule.
  for (const b of unpinned) {
    if (selected.length >= 10) break
    if (!canAddByAuthor(b)) continue
    selected.push(b)
    for (const aid of b.authorIds) {
      authorCount.set(aid, (authorCount.get(aid) ?? 0) + 1)
    }
  }

  // ── Non-US rule ────────────────────────────────────────────────────────────
  let guard = 0
  while (countNonUS(selected) < RULE_MIN_NON_US && guard++ < 20) {
    // Lowest-scoring US-only, non-pinned book is the one to drop.
    const dropIdx = lowestIdxMatching(selected, b => !b.pinned && !hasNonUS(b))
    if (dropIdx < 0) break
    const replacement = unpinned.find(b =>
      !selected.includes(b)
      && hasNonUS(b)
      && b.authorIds.every(aid => effectiveAuthorCount(authorCount, selected[dropIdx], aid) < RULE_MAX_PER_AUTHOR),
    )
    if (!replacement) break
    swap(selected, authorCount, dropIdx, replacement)
  }

  // ── Reason-diversity rule ──────────────────────────────────────────────────
  guard = 0
  while (countDistinctReasons(selected) < RULE_MIN_REASONS && guard++ < 20) {
    const present = new Set(selected.flatMap(b => b.reasons))
    const replacement = unpinned.find(b =>
      !selected.includes(b)
      && b.reasons.some(r => !present.has(r))
      && b.authorIds.every(aid => (authorCount.get(aid) ?? 0) < RULE_MAX_PER_AUTHOR),
    )
    if (!replacement) break
    // Drop the lowest-scoring non-pinned book whose reasons are all already
    // duplicated elsewhere in the selection (i.e. removing it doesn't shrink
    // the distinct-reasons set).
    const dropIdx = lowestIdxMatching(selected, (b, i) => {
      if (b.pinned) return false
      const others = new Set(selected.filter((_, j) => j !== i).flatMap(x => x.reasons))
      return b.reasons.every(r => others.has(r))
    })
    if (dropIdx < 0) break
    swap(selected, authorCount, dropIdx, replacement)
  }

  // Final ordering by score desc; alternates are everything not selected, top 15.
  const top10 = [...selected].sort((a, b) => (b.finalScore - a.finalScore) || (a.id - b.id))
  const top10Ids = new Set(top10.map(b => b.id))
  const alternates = scored.filter(b => !top10Ids.has(b.id)).slice(0, 15)

  return { top10, alternates }
}

export function suggestBBWFeatured(books: SuggesterBook[]): SuggesterResult {
  return pickTop10(scoreBooks(books))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return Math.min(1, Math.max(0, x))
}

function hasNonUS(b: ScoredBook): boolean {
  return b.countries.some(c => c !== 'US')
}

function countNonUS(list: ScoredBook[]): number {
  return list.filter(hasNonUS).length
}

function countDistinctReasons(list: ScoredBook[]): number {
  return new Set(list.flatMap(b => b.reasons)).size
}

function lowestIdxMatching(
  list: ScoredBook[],
  predicate: (b: ScoredBook, i: number) => boolean,
): number {
  let bestIdx = -1
  let bestScore = Infinity
  for (let i = 0; i < list.length; i++) {
    if (!predicate(list[i], i)) continue
    if (list[i].finalScore < bestScore) {
      bestScore = list[i].finalScore
      bestIdx = i
    }
  }
  return bestIdx
}

function effectiveAuthorCount(
  authorCount: Map<number, number>,
  removed: ScoredBook,
  aid: number,
): number {
  const base = authorCount.get(aid) ?? 0
  return removed.authorIds.includes(aid) ? base - 1 : base
}

function swap(
  selected: ScoredBook[],
  authorCount: Map<number, number>,
  dropIdx: number,
  replacement: ScoredBook,
): void {
  const removed = selected[dropIdx]
  selected[dropIdx] = replacement
  for (const aid of removed.authorIds) {
    authorCount.set(aid, (authorCount.get(aid) ?? 1) - 1)
  }
  for (const aid of replacement.authorIds) {
    authorCount.set(aid, (authorCount.get(aid) ?? 0) + 1)
  }
}
