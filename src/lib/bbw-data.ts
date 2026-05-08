// Data fetching + adapter for the BBW suggester and the public hub.
//
// The suggester is pure (lib/bbw-suggester.ts). This module is the impure
// glue between Supabase rows and the SuggesterBook shape, plus reusable
// queries for the public hub.

import { adminClient, serverClient } from './supabase'
import type { SuggesterBook } from './bbw-suggester'

// ── Types: rows we care about ────────────────────────────────────────────────

type RawBookForSuggester = {
  id: number
  bans: {
    country_code: string
    year_started: number | null
    ban_reason_links: { reasons: { slug: string } | null }[] | null
  }[] | null
  book_authors: { author_id: number }[] | null
}

const SUGGESTER_SELECT = `
  id,
  book_authors(author_id),
  bans(
    country_code,
    year_started,
    ban_reason_links(reasons(slug))
  )
`

// ── Public-hub featured book row ─────────────────────────────────────────────
// Same shape used by the BBW admin "current selection" panel.

export type FeaturedBookRow = {
  bookId: number
  position: number
  customBlurb: string | null
  pinned: boolean
  publishedAt: string | null
  book: {
    id: number
    title: string
    slug: string
    cover_url: string | null
    description_book: string | null
    authors: string[]
    reasons: string[]
    countryCount: number
    banCount: number
  }
}

const FEATURED_BOOK_JOIN = `
  year, book_id, position, custom_blurb, pinned, published_at,
  books(
    id, title, slug, cover_url, description_book,
    book_authors(authors(display_name)),
    bans(
      country_code,
      ban_reason_links(reasons(slug))
    )
  )
`

type FeaturedJoinedRow = {
  year: number
  book_id: number
  position: number
  custom_blurb: string | null
  pinned: boolean
  published_at: string | null
  books: {
    id: number
    title: string
    slug: string
    cover_url: string | null
    description_book: string | null
    book_authors: { authors: { display_name: string } | null }[] | null
    bans: {
      country_code: string
      ban_reason_links: { reasons: { slug: string } | null }[] | null
    }[] | null
  } | null
}

function projectFeatured(row: FeaturedJoinedRow): FeaturedBookRow | null {
  if (!row.books) return null
  const b = row.books
  const authors = (b.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)
  const reasons = Array.from(new Set(
    (b.bans ?? []).flatMap(ban =>
      (ban.ban_reason_links ?? []).map(l => l.reasons?.slug).filter((s): s is string => !!s),
    ),
  ))
  const countries = new Set((b.bans ?? []).map(x => x.country_code))
  return {
    bookId: row.book_id,
    position: row.position,
    customBlurb: row.custom_blurb,
    pinned: row.pinned,
    publishedAt: row.published_at,
    book: {
      id: b.id,
      title: b.title,
      slug: b.slug,
      cover_url: b.cover_url,
      description_book: b.description_book,
      authors,
      reasons,
      countryCount: countries.size,
      banCount: (b.bans ?? []).length,
    },
  }
}

// ── Public hub: published featured books for a year ──────────────────────────

export async function getPublishedFeaturedBooks(year: number): Promise<FeaturedBookRow[]> {
  const { data } = await serverClient()
    .from('bbw_featured_selections')
    .select(FEATURED_BOOK_JOIN)
    .eq('year', year)
    .not('published_at', 'is', null)
    .order('position')
  return ((data ?? []) as unknown as FeaturedJoinedRow[])
    .map(projectFeatured)
    .filter((r): r is FeaturedBookRow => r != null)
}

// Admin variant: returns *all* rows (draft + published) so the admin can edit.
export async function getAllFeaturedBooksForAdmin(year: number): Promise<FeaturedBookRow[]> {
  const { data } = await adminClient()
    .from('bbw_featured_selections')
    .select(FEATURED_BOOK_JOIN)
    .eq('year', year)
    .order('position')
  return ((data ?? []) as unknown as FeaturedJoinedRow[])
    .map(projectFeatured)
    .filter((r): r is FeaturedBookRow => r != null)
}

// ── Suggester data ───────────────────────────────────────────────────────────

const FIVE_YEARS_AGO = new Date().getFullYear() - 5

// Build the SuggesterBook[] for the engine. Pulls every book + its bans +
// authors in 1000-row chunks (mirrors the homepage pattern), then layers in
// top-list membership and previous-years featured-set membership.
export async function buildSuggesterCorpus(currentYear: number): Promise<SuggesterBook[]> {
  const supabase = adminClient()

  // 1. All books with bans + authors.
  const all: RawBookForSuggester[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select(SUGGESTER_SELECT)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) break
    all.push(...((data ?? []) as unknown as RawBookForSuggester[]))
    if (!data || data.length < PAGE) break
    offset += PAGE
  }

  // 2. Top-list membership.
  const [{ data: topWeek }, { data: topAll }] = await Promise.all([
    supabase.from('v_top_books_this_week').select('entity_id').limit(50),
    supabase.from('v_top_books_all_time').select('entity_id').limit(200),
  ])
  const topWeekIds = new Set((topWeek ?? []).map(r => Number(r.entity_id)))
  const topAllIds  = new Set((topAll  ?? []).map(r => Number(r.entity_id)))

  // 3. Previous two years' featured sets.
  const { data: prevYears } = await supabase
    .from('bbw_featured_selections')
    .select('book_id, year')
    .in('year', [currentYear - 1, currentYear - 2])
    .not('published_at', 'is', null)
  const prevIds = new Set((prevYears ?? []).map(r => Number(r.book_id)))

  return all
    .filter(b => (b.bans ?? []).length > 0) // only books with at least one ban
    .map<SuggesterBook>(b => {
      const bans = b.bans ?? []
      const banCount = bans.length
      const countries = bans.map(x => x.country_code)
      const reasons = Array.from(new Set(
        bans.flatMap(x => (x.ban_reason_links ?? []).map(l => l.reasons?.slug).filter((s): s is string => !!s)),
      ))
      const recent = bans.filter(x => (x.year_started ?? 0) >= FIVE_YEARS_AGO).length
      const recentBanScore = banCount === 0 ? 0 : recent / banCount
      const topListPresence = topWeekIds.has(b.id) ? 1 : topAllIds.has(b.id) ? 0.5 : 0
      const authorIds = (b.book_authors ?? []).map(x => x.author_id)
      return {
        id: b.id,
        authorIds,
        banCount,
        recentBanScore,
        countryCount: new Set(countries).size,
        countries,
        reasons,
        topListPresence,
        pinned: false,
        inPreviousYears: prevIds.has(b.id),
      }
    })
}

// ── Live stats for the public hub ────────────────────────────────────────────

export async function getBBWLiveStats(): Promise<{
  totalBans: number
  countryCount: number
  recentBans: number
}> {
  const supabase = serverClient()
  const FIVE_YEARS = new Date().getFullYear() - 5

  const [{ count: totalBans }, { data: countryRows }, { count: recentBans }] = await Promise.all([
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('country_code').range(0, 9999),
    supabase.from('bans').select('*', { count: 'exact', head: true }).gte('year_started', FIVE_YEARS),
  ])
  const countryCount = new Set((countryRows ?? []).map(r => r.country_code)).size
  return {
    totalBans: totalBans ?? 0,
    countryCount,
    recentBans: recentBans ?? 0,
  }
}
