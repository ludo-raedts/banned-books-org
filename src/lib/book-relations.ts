// Cached relation lookups for /books/[slug].
//
// WHY THIS EXISTS — the book detail page used to run four relation queries per
// render, on top of the blocklist check, the book fetch and the related-detail
// fetch: ~7 PostgREST round-trips for every cold render. With ~20.3k book pages
// and only the top-2000 prebuilt, the long tail renders cold on first visit, so
// a catalogue-wide crawl multiplies that fan-out by the whole catalogue. That
// is what saturated the Supabase Nano instance during the 2026-06-16 and
// 2026-08-03 incidents, and it is also why Vercel meters ~9 External API events
// per function invocation.
//
// THE KEY OBSERVATION: three of those four queries are not keyed by the book at
// all. "Other books banned in this country" depends only on the country code
// (119 of them), "other books banned for this reason" only on the reason id (11
// of them), and the similar-books lookup only on the book's *set* of reason ids.
// Across 20.3k book pages there are at most a few hundred distinct result sets.
// Caching them collapses those three queries to a Data Cache read on all but
// the first render per key per TTL window.
//
// The fourth (news) was an OR-of-ILIKEs across four title variants — the exact
// shape that tips over the statement timeout under crawl load. The published
// news set is 389 rows / ~296 KB, so it is cheaper to cache it whole and match
// in memory than to ask Postgres to pattern-match per book.
//
// Ordering note: the country and reason lookups previously had no `.order()`,
// so PostgREST truncated an arbitrary unordered subset at the `.limit()` —
// "related books" differed between renders of the same page. They are ordered
// explicitly here for the same reason the similar-books query already was.
import { unstable_cache } from 'next/cache'
import { adminClient } from './supabase'

// Relations change only when bans change, which happens on an import/enrichment
// cadence — not continuously. Six hours matches the sitemap TTL convention.
const RELATION_TTL = 21600
// News lands via the daily fetch-news cron; an hour matches /news itself.
const NEWS_TTL = 3600

// Tags so a batch script can bust these deliberately via
// POST /api/admin/revalidate { tag: … } without waiting out the TTL.
export const BOOK_RELATIONS_TAG = 'book-relations'
export const NEWS_ITEMS_TAG = 'news-items'

export type SimilarReasonLink = { reason_id: number; bans: { book_id: number } }

export type CountryBanRow = {
  book_id: number
  year_started: number | null
  ban_reason_links: { reasons: { slug: string } | null }[]
}

export type ReasonBanRow = {
  bans: {
    book_id: number
    year_started: number | null
    country_code: string
    countries: { name_en: string } | null
  } | null
}

export type NewsItem = {
  id: number
  title: string
  source_url: string
  source_name: string
  published_at: string
  summary: string | null
}

// ── Similar books, by overlapping ban reasons ────────────────────────────────
//
// Keyed by the sorted reason-id set, passed as a string so the cache key is
// stable regardless of the order the ids came out of the book's bans.
const _similarReasonLinks = unstable_cache(
  async (key: string): Promise<SimilarReasonLink[]> => {
    const reasonIds = key.split(',').map(Number)
    const { data } = await adminClient()
      .from('ban_reason_links')
      // Embed stays minimal (book_id only). For common reasons
      // (political/sexual each ~11k links) this matches tens of thousands of
      // rows; bound it deterministically by ban_id. 1000 links is ample to
      // surface the ≥2-reason-overlap set the caller computes.
      .select('reason_id, bans!inner(book_id)')
      .in('reason_id', reasonIds)
      .order('ban_id')
      .limit(1000)
    return (data ?? []) as unknown as SimilarReasonLink[]
  },
  ['book-similar-reason-links'],
  { revalidate: RELATION_TTL, tags: [BOOK_RELATIONS_TAG] },
)

export function loadSimilarReasonLinks(reasonIds: number[]): Promise<SimilarReasonLink[]> {
  if (reasonIds.length === 0) return Promise.resolve([])
  const key = [...new Set(reasonIds)].sort((a, b) => a - b).join(',')
  return _similarReasonLinks(key)
}

// ── Other books banned in the same country ───────────────────────────────────
//
// The caller excludes the current book in memory; the old query did it with
// `.neq('book_id', …)`, which made the result book-specific and therefore
// uncacheable. The limit is raised from 50 to 60 so that excluding one book
// still leaves at least as many candidates as before.
const _countryBans = unstable_cache(
  async (countryCode: string): Promise<CountryBanRow[]> => {
    const { data } = await adminClient()
      .from('bans')
      .select('book_id, year_started, ban_reason_links(reasons(slug))')
      .eq('country_code', countryCode)
      .order('id')
      .limit(60)
    return (data ?? []) as unknown as CountryBanRow[]
  },
  ['book-country-bans'],
  { revalidate: RELATION_TTL, tags: [BOOK_RELATIONS_TAG] },
)

export function loadCountryBans(countryCode: string | null): Promise<CountryBanRow[]> {
  if (!countryCode) return Promise.resolve([])
  return _countryBans(countryCode)
}

// ── Other books banned for the same reason ───────────────────────────────────
const _reasonBans = unstable_cache(
  async (reasonId: number): Promise<ReasonBanRow[]> => {
    const { data } = await adminClient()
      .from('ban_reason_links')
      .select('bans!inner(book_id, year_started, country_code, countries(name_en))')
      .eq('reason_id', reasonId)
      .order('ban_id')
      .limit(100)
    return (data ?? []) as unknown as ReasonBanRow[]
  },
  ['book-reason-bans'],
  { revalidate: RELATION_TTL, tags: [BOOK_RELATIONS_TAG] },
)

export function loadReasonBans(reasonId: number | null): Promise<ReasonBanRow[]> {
  if (reasonId == null) return Promise.resolve([])
  return _reasonBans(reasonId)
}

// ── News ─────────────────────────────────────────────────────────────────────
//
// One cached fetch of every published item (389 rows / ~296 KB, well under the
// 2 MB Data Cache entry ceiling) replaces a per-book OR-of-ILIKEs.
const loadPublishedNews = unstable_cache(
  async (): Promise<NewsItem[]> => {
    const { data } = await adminClient()
      .from('news_items')
      .select('id, title, source_url, source_name, published_at, summary')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    return (data ?? []) as unknown as NewsItem[]
  },
  ['published-news-items'],
  { revalidate: NEWS_TTL, tags: [NEWS_ITEMS_TAG] },
)

/**
 * Up to `limit` published news items mentioning any of `titleVariants` in their
 * title or summary, newest first — the in-memory equivalent of the ILIKE OR
 * this replaces. Matching is case-insensitive substring, same as `ilike %…%`.
 */
export async function findNewsForTitles(
  titleVariants: string[],
  limit = 3,
): Promise<NewsItem[]> {
  const needles = titleVariants
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 4)
  if (needles.length === 0) return []

  const news = await loadPublishedNews()
  const hits: NewsItem[] = []
  for (const item of news) {
    const haystack = `${item.title}\n${item.summary ?? ''}`.toLowerCase()
    if (needles.some(n => haystack.includes(n))) {
      hits.push(item)
      if (hits.length >= limit) break // already sorted newest-first by the query
    }
  }
  return hits
}
