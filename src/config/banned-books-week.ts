// Banned Books Week feature flag + window.
//
// Editing this file is the *only* way to surface the BBW homepage tile and
// flip the public hub from "preview" to "live promo" — there is no admin UI
// for the flag, on purpose. Each year, the editor:
//   1. opens this file,
//   2. updates `year`, `startDate`, `endDate`,
//   3. optionally sets `promoStartDate` to start the homepage tile a few
//      weeks before the actual BBW window opens,
//   4. flips `enabled` to `true` once content blocks are all `published`.
//
// `enabled: false` is the default after every BBW window so the homepage
// returns to its normal four-tile layout automatically. There is no
// auto-rolling year logic; the editor must touch this file each cycle.

export type BannedBooksWeekConfig = {
  enabled: boolean
  /** ISO date, inclusive (UTC) — first day of the actual BBW week. */
  startDate: string
  /** ISO date, inclusive (UTC) — last day of the actual BBW week. */
  endDate: string
  /**
   * Optional ISO date — when to start promoting on the homepage tile and
   * Reading Club hub. Useful for the lead-up weeks before BBW begins.
   * Defaults to `startDate` (no lead-up).
   */
  promoStartDate?: string
  /** Year used for content-block lookups, archive routes, and the tile label. */
  year: number
}

export const BANNED_BOOKS_WEEK: BannedBooksWeekConfig = {
  enabled: false,
  // Banned Books Week is traditionally the last week of September / first week
  // of October. Update these for the active year before flipping `enabled`.
  startDate: '2026-09-27',
  endDate:   '2026-10-03',
  // Show the homepage tile from this date instead of waiting for the actual
  // window to open. Comment out to promote only during the BBW week itself.
  promoStartDate: '2026-09-01',
  year: 2026,
}

// True only during the actual BBW week. Use this when an action only makes
// sense during the week itself (e.g., a "happening this week" banner).
export function isBannedBooksWeekActive(now: Date = new Date()): boolean {
  if (!BANNED_BOOKS_WEEK.enabled) return false
  const today = now.toISOString().slice(0, 10)
  return today >= BANNED_BOOKS_WEEK.startDate && today <= BANNED_BOOKS_WEEK.endDate
}

// True during the broader promo window (lead-up + actual week). Use this
// for the homepage tile-swap and the Reading Club → BBW cross-link, where
// you want to start drawing attention to BBW before it opens.
export function isBannedBooksWeekPromoActive(now: Date = new Date()): boolean {
  if (!BANNED_BOOKS_WEEK.enabled) return false
  const today = now.toISOString().slice(0, 10)
  const start = BANNED_BOOKS_WEEK.promoStartDate ?? BANNED_BOOKS_WEEK.startDate
  return today >= start && today <= BANNED_BOOKS_WEEK.endDate
}

// "Sep 27 – Oct 3"-style range string for the homepage tile and other
// places that show the BBW week at a glance. UTC-anchored so the result
// is identical regardless of server / client timezone.
export function formatBBWDateRange(): string {
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  return `${fmt(BANNED_BOOKS_WEEK.startDate)} – ${fmt(BANNED_BOOKS_WEEK.endDate)}`
}
