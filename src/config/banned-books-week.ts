// Banned Books Week feature flag + window.
//
// Editing this file is the *only* way to surface the BBW homepage tile and
// flip the public hub from "preview" to "live promo" — there is no admin UI
// for the flag, on purpose. Each year, the editor:
//   1. opens this file,
//   2. updates `year`, `startDate`, `endDate`,
//   3. flips `enabled` to `true` once content blocks are all `published`.
//
// `enabled: false` is the default after every BBW window so the homepage
// returns to its normal four-tile layout automatically. There is no
// auto-rolling year logic; the editor must touch this file each cycle.

export type BannedBooksWeekConfig = {
  enabled: boolean
  /** ISO date, inclusive (UTC). */
  startDate: string
  /** ISO date, inclusive (UTC). */
  endDate: string
  /** Year used for content-block lookups, archive routes, and the tile label. */
  year: number
}

export const BANNED_BOOKS_WEEK: BannedBooksWeekConfig = {
  enabled: false,
  // Banned Books Week is traditionally the last week of September / first week
  // of October. Update these for the active year before flipping `enabled`.
  startDate: '2026-09-27',
  endDate:   '2026-10-03',
  year: 2026,
}

// Pure helper — returns true when the configured window is currently active.
// Uses UTC date comparison (inclusive on both ends) so the result doesn't
// depend on the server's timezone.
export function isBannedBooksWeekActive(now: Date = new Date()): boolean {
  if (!BANNED_BOOKS_WEEK.enabled) return false
  const today = now.toISOString().slice(0, 10)
  return today >= BANNED_BOOKS_WEEK.startDate && today <= BANNED_BOOKS_WEEK.endDate
}
