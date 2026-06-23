// Canonical "banned book of the day" resolver for all public surfaces
// (the /share hub, the /embed widget, the hot-linkable badge image).
//
// It reuses the SAME pick as the Bluesky bot — pickDailyBook() draws from the
// full ~8.6k-book catalogue, NOT the homepage hero's top-100 pool. That keeps
// every shareable surface consistent with what we actually broadcast: someone
// who sees the Bluesky post and opens /share lands on the same title.
//
// pickDailyBook() scans the whole books table (paginated) to build its
// eligible-id list, so we wrap it in unstable_cache keyed by the UTC date: the
// scan runs once per day and is shared across /share, /embed and the badge,
// instead of once per request (crawlers hit these). The pick is deterministic
// per UTC day, so the cache key rolling at 00:00 UTC lines up with the rotation.

import { unstable_cache } from 'next/cache'
import { pickDailyBook, type DailyBook } from './bluesky-post'

export type { DailyBook }

/** Today's banned book of the day (UTC), cached once per day. */
export function getBookOfTheDay(): Promise<DailyBook | null> {
  const ymd = new Date().toISOString().slice(0, 10)
  return unstable_cache(
    () => pickDailyBook(ymd),
    ['book-of-the-day', ymd],
    { revalidate: 3600, tags: ['book-of-the-day'] },
  )()
}

/** Reason slug → readable phrase for card/hero copy ("sexual content"). Mirrors
 *  the Bluesky post's labels; "other" is dropped (adds nothing as a tag). */
const REASON_PHRASES: Record<string, string> = {
  drugs: 'drug use',
  language: 'offensive language',
  lgbtq: 'LGBTQ+ content',
  moral: 'immorality',
  obscenity: 'obscenity',
  political: 'political content',
  racial: 'race / colonialism',
  religious: 'religious or blasphemous content',
  sexual: 'sexual content',
  violence: 'violence',
}

export function reasonPhrases(slugs: string[]): string[] {
  return slugs.map(s => REASON_PHRASES[s]).filter((s): s is string => !!s)
}

/** Human list join: "a", "a and b", "a, b and c". */
export function joinHuman(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "in the United States" for the few names that take a definite article. */
export function withArticle(name: string): string {
  return /\b(United|Republic|Kingdom|Emirates|Netherlands|Philippines|Islands?|Bahamas|Gambia|Congo|Comoros|Maldives|Sudan)\b/.test(name)
    ? `the ${name}`
    : name
}

/** "in France", "in France and Iran", or "in 5 countries" when too many to name. */
export function whereClause(countries: string[], countryCount: number): string {
  if (countryCount === 0) return ''
  const named = countries.map(withArticle)
  if (named.length === 1) return `in ${named[0]}`
  if (named.length === 2) return `in ${named[0]} and ${named[1]}`
  return `in ${countryCount} countries`
}
