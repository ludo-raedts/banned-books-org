import type { Metadata } from 'next'

// Filter/deeplink variants of a listing page (`/search?country=US`,
// `/discover?r=lgbtq`) all canonicalise to the bare page and carry no unique
// content, yet every crawled combination is a dynamic render + DB query. They
// stay crawlable (`follow`, so link equity keeps flowing through them) but are
// kept out of the index (`noindex`). Not a robots.txt Disallow on purpose:
// blocked URLs can't show their noindex/canonical to Google and can still be
// indexed URL-only.
type Params = Record<string, string | string[] | undefined>

/** True when any of `keys` carries a non-empty value in `searchParams`. */
export function hasFilterParams(searchParams: Params, keys: readonly string[]): boolean {
  return keys.some((k) => {
    const v = searchParams[k]
    return Array.isArray(v) ? v.some((x) => x.trim() !== '') : (v ?? '').trim() !== ''
  })
}

/** Metadata fragment to spread into a page's metadata for filter variants. */
export function noindexFollow(isVariant: boolean): Pick<Metadata, 'robots'> {
  return isVariant ? { robots: { index: false, follow: true } } : {}
}
