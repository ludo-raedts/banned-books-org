// Daily rotation helpers for the homepage section pickers.
//
// The homepage is force-dynamic but we want the per-section book selection
// to be stable across refreshes within a day (caches feel broken if a hard
// reload changes what's on the page). We also want different reasons in
// "Why books get banned" to NOT all land on positions 0,1,2 of their pools
// on the same day. And we want cross-section dedup so a single book never
// shows up twice on the same render.
//
// The two-knob recipe: day-of-year as the global seed, a per-section salt
// (hashReasonSlug) so each section rotates a different amount, plus a
// running excludeIds set that the caller threads through sequential picks.

export type SelectArgs<T extends { id: number }> = {
  /** Already-filtered, already-sorted, already-cover-valid candidates. */
  pool: T[]
  /** How many to return. */
  count: number
  /** Day-of-year-style integer; same seed → same selection. */
  seed: number
  /** Per-section salt so different sections rotate to different start indices. */
  reasonOffset?: number
  /** Book IDs already chosen in earlier sections; filtered out before rotation. */
  excludeIds?: Set<number>
}

export function selectRotatingBooks<T extends { id: number }>({
  pool,
  count,
  seed,
  reasonOffset = 0,
  excludeIds = new Set(),
}: SelectArgs<T>): T[] {
  const available = pool.filter(b => !excludeIds.has(b.id))
  if (available.length === 0) return []
  const rotation = ((seed + reasonOffset) % available.length + available.length) % available.length
  const rotated = [...available.slice(rotation), ...available.slice(0, rotation)]
  return rotated.slice(0, count)
}

/**
 * Greedy distinct-language pass, then fill remaining slots with any
 * remaining books regardless of language. Use after `selectRotatingBooks`
 * gives you a rotated pool; this picks the final N from those candidates.
 */
export function selectWithLanguageDiversity<
  T extends { id: number; original_language: string | null },
>(rotated: T[], count = 3): T[] {
  const result: T[] = []
  const used = new Set<string>()

  for (const book of rotated) {
    if (result.length >= count) break
    const lang = book.original_language ?? ''
    if (!used.has(lang)) {
      result.push(book)
      used.add(lang)
    }
  }

  if (result.length < count) {
    const taken = new Set(result.map(b => b.id))
    for (const book of rotated) {
      if (result.length >= count) break
      if (!taken.has(book.id)) {
        result.push(book)
        taken.add(book.id)
      }
    }
  }

  return result
}

/**
 * 1..366 day-of-year, UTC-anchored so different server regions agree.
 * Date.UTC(year, 0, 0) gives Dec 31 of the previous year, so subtracting
 * yields a 1-based ordinal for Jan 1 onwards.
 */
export function dayOfYear(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const diff = date.getTime() - start
  return Math.floor(diff / 86_400_000)
}

/**
 * Stable, deterministic, non-cryptographic hash for short slug strings.
 * Only used as a per-section salt for rotation; collisions are harmless
 * (worst case two sections rotate to the same index on the same day,
 * which we already accept across days).
 */
export function hashReasonSlug(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0
  return Math.abs(h)
}
