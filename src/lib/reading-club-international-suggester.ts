// Reading Club — International track suggestion engine.
//
// Same shape as the BBW suggester (lib/bbw-suggester.ts) but with weights and
// diversity rules tuned for an international, regime-diverse reading list:
//   • Geographic spread is the dominant signal (this is "international")
//   • Recency matters less — classics of dissident literature still belong
//   • A regime-diversity bonus rewards non-US, non-Western contexts
//
// Diversity rules (stricter than BBW because this track is *defined* by being
// international): every pick must be non-US; the top 10 must span at least
// five distinct countries; at most two books per author; at least three
// distinct reasons.

import type { SuggesterBook } from './bbw-suggester'

export const RC_INTL_WEIGHTS = {
  recencyOfBans:    0.10,
  totalBanCount:    0.15,
  geographicSpread: 0.35,
  topListPresence:  0.10,
  diversityBonus:   0.30, // "topic / regime diversity bonus" in the spec
} as const

export const RC_INTL_RULE_MIN_COUNTRIES = 5
export const RC_INTL_RULE_MIN_REASONS   = 3
export const RC_INTL_RULE_MAX_PER_AUTHOR = 2

// Coarse buckets of "regime context" for the diversity bonus. Bans whose
// country code falls in different buckets earn a higher contribution. This is
// intentionally coarse — meant to break a top-10 dominated by, say, US +
// Western Europe + Russia and reward a Cuban or Iranian title that contrasts.
const REGIME_BUCKETS: Record<string, string> = {
  // Western liberal democracies
  US: 'west',  CA: 'west',  GB: 'west',  IE: 'west',  AU: 'west',  NZ: 'west',
  DE: 'west',  FR: 'west',  NL: 'west',  BE: 'west',  IT: 'west',  ES: 'west',
  PT: 'west',  AT: 'west',  CH: 'west',  SE: 'west',  NO: 'west',  DK: 'west',
  FI: 'west',  IS: 'west',  LU: 'west',  GR: 'west',  CZ: 'west',  PL: 'west',
  // Authoritarian / one-party
  CN: 'authoritarian', RU: 'authoritarian', BY: 'authoritarian', KP: 'authoritarian',
  CU: 'authoritarian', VN: 'authoritarian', LA: 'authoritarian', ER: 'authoritarian',
  // Theocratic / clerical
  IR: 'theocratic', AF: 'theocratic', SA: 'theocratic', PK: 'theocratic',
  QA: 'theocratic', YE: 'theocratic',
  // Hybrid / illiberal democracies
  HU: 'hybrid', TR: 'hybrid', PH: 'hybrid', IN: 'hybrid', SG: 'hybrid', MY: 'hybrid',
  TH: 'hybrid', UA: 'hybrid', VE: 'hybrid', NI: 'hybrid', RW: 'hybrid',
  // Africa (default bucket where not otherwise classified)
  ZA: 'africa', NG: 'africa', KE: 'africa', UG: 'africa', GH: 'africa',
  ZW: 'africa', ET: 'africa', SD: 'africa', SO: 'africa', EG: 'africa',
  // Latin America
  MX: 'latam', BR: 'latam', AR: 'latam', CL: 'latam', CO: 'latam', PE: 'latam',
  // Misc (catch-all)
}
const DEFAULT_BUCKET = 'other'

function bucket(country: string): string {
  return REGIME_BUCKETS[country] ?? DEFAULT_BUCKET
}

export type ScoredBookIntl = SuggesterBook & {
  rawScore: number
  finalScore: number
  components: {
    recencyOfBans: number
    totalBanCount: number
    geographicSpread: number
    topListPresence: number
    diversityBonus: number
  }
}

export type SuggesterResultIntl = {
  top10: ScoredBookIntl[]
  alternates: ScoredBookIntl[]
}

export function scoreBooksIntl(books: SuggesterBook[]): ScoredBookIntl[] {
  // Drop any US-only book up-front: this is the *international* track.
  const eligible = books.filter(b => b.countries.some(c => c !== 'US'))
  if (eligible.length === 0) return []

  const maxBans      = Math.max(1, ...eligible.map(b => b.banCount))
  const maxCountries = Math.max(1, ...eligible.map(b => b.countryCount))

  // For each book, the regime-diversity score is the share of distinct
  // regime buckets covered by its bans, normalized 0..1 against the maximum
  // observed in the corpus. Books that span e.g. authoritarian + theocratic +
  // hybrid score higher than books with bans only in 'west'.
  const bucketCounts = eligible.map(b => new Set(b.countries.map(bucket)).size)
  const maxBuckets = Math.max(1, ...bucketCounts)

  const scored: ScoredBookIntl[] = eligible.map((b, idx) => {
    const recencyOfBans    = clamp01(b.recentBanScore)
    const totalBanCount    = b.banCount / maxBans
    const geographicSpread = b.countryCount / maxCountries
    const topListPresence  = clamp01(b.topListPresence)
    const diversityBonus   = bucketCounts[idx] / maxBuckets

    const components = { recencyOfBans, totalBanCount, geographicSpread, topListPresence, diversityBonus }
    const rawScore =
      RC_INTL_WEIGHTS.recencyOfBans    * recencyOfBans    +
      RC_INTL_WEIGHTS.totalBanCount    * totalBanCount    +
      RC_INTL_WEIGHTS.geographicSpread * geographicSpread +
      RC_INTL_WEIGHTS.topListPresence  * topListPresence  +
      RC_INTL_WEIGHTS.diversityBonus   * diversityBonus

    // No previous-year penalty for the International track: it's evergreen,
    // not a yearly featured-set.
    return { ...b, rawScore, finalScore: rawScore, components }
  })

  scored.sort((a, b) => (b.finalScore - a.finalScore) || (a.id - b.id))
  return scored
}

export function pickTop10Intl(scored: ScoredBookIntl[]): SuggesterResultIntl {
  const pinned   = scored.filter(s => s.pinned)
  const unpinned = scored.filter(s => !s.pinned)

  const selected: ScoredBookIntl[] = [...pinned].slice(0, 10)
  const authorCount = new Map<number, number>()
  for (const b of selected) {
    for (const aid of b.authorIds) {
      authorCount.set(aid, (authorCount.get(aid) ?? 0) + 1)
    }
  }

  const canAddByAuthor = (b: ScoredBookIntl): boolean =>
    b.authorIds.every(aid => (authorCount.get(aid) ?? 0) < RC_INTL_RULE_MAX_PER_AUTHOR)

  for (const b of unpinned) {
    if (selected.length >= 10) break
    if (!canAddByAuthor(b)) continue
    selected.push(b)
    for (const aid of b.authorIds) {
      authorCount.set(aid, (authorCount.get(aid) ?? 0) + 1)
    }
  }

  // ── Distinct-countries rule ───────────────────────────────────────────────
  let guard = 0
  while (countDistinctCountries(selected) < RC_INTL_RULE_MIN_COUNTRIES && guard++ < 20) {
    const present = new Set(selected.flatMap(b => b.countries))
    const replacement = unpinned.find(b =>
      !selected.includes(b)
      && b.countries.some(c => !present.has(c))
      && b.authorIds.every(aid => (authorCount.get(aid) ?? 0) < RC_INTL_RULE_MAX_PER_AUTHOR),
    )
    if (!replacement) break
    const dropIdx = lowestIdxMatching(selected, (b, i) => {
      if (b.pinned) return false
      const others = new Set(selected.filter((_, j) => j !== i).flatMap(x => x.countries))
      return b.countries.every(c => others.has(c))
    })
    if (dropIdx < 0) break
    swap(selected, authorCount, dropIdx, replacement)
  }

  // ── Distinct-reasons rule ─────────────────────────────────────────────────
  guard = 0
  while (countDistinctReasons(selected) < RC_INTL_RULE_MIN_REASONS && guard++ < 20) {
    const present = new Set(selected.flatMap(b => b.reasons))
    const replacement = unpinned.find(b =>
      !selected.includes(b)
      && b.reasons.some(r => !present.has(r))
      && b.authorIds.every(aid => (authorCount.get(aid) ?? 0) < RC_INTL_RULE_MAX_PER_AUTHOR),
    )
    if (!replacement) break
    const dropIdx = lowestIdxMatching(selected, (b, i) => {
      if (b.pinned) return false
      const others = new Set(selected.filter((_, j) => j !== i).flatMap(x => x.reasons))
      return b.reasons.every(r => others.has(r))
    })
    if (dropIdx < 0) break
    swap(selected, authorCount, dropIdx, replacement)
  }

  const top10 = [...selected].sort((a, b) => (b.finalScore - a.finalScore) || (a.id - b.id))
  const top10Ids = new Set(top10.map(b => b.id))
  const alternates = scored.filter(b => !top10Ids.has(b.id)).slice(0, 15)
  return { top10, alternates }
}

export function suggestInternational(books: SuggesterBook[]): SuggesterResultIntl {
  return pickTop10Intl(scoreBooksIntl(books))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return Math.min(1, Math.max(0, x))
}

function countDistinctCountries(list: ScoredBookIntl[]): number {
  return new Set(list.flatMap(b => b.countries)).size
}

function countDistinctReasons(list: ScoredBookIntl[]): number {
  return new Set(list.flatMap(b => b.reasons)).size
}

function lowestIdxMatching(
  list: ScoredBookIntl[],
  predicate: (b: ScoredBookIntl, i: number) => boolean,
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

function swap(
  selected: ScoredBookIntl[],
  authorCount: Map<number, number>,
  dropIdx: number,
  replacement: ScoredBookIntl,
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
