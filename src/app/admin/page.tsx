import { adminClient } from '@/lib/supabase'
import AdminDashboardClient from './admin-dashboard-client'
import type { TrendingBookRow, TrendingAuthorRow } from './admin-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = adminClient()

  const [
    { count: bookCount },
    { count: newsCount },
    { count: banCount },
    { count: noCoverCount },
    { count: noDescCount },
    { data: countryRows },
    { data: refreshLog },
  ] = await Promise.all([
    // rows: 0 (count only) × 5 | reason: dashboard stat cards
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('news_items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }).is('cover_url', null),
    supabase.from('books').select('*', { count: 'exact', head: true }).is('description_book', null),
    // rows: ≤10000 | fields: [country_code] | reason: COUNT(DISTINCT) unavailable in PostgREST
    supabase.from('bans').select('country_code').range(0, 9999),
    // rows: 2 | reason: materialized view freshness card
    supabase.from('mv_refresh_log').select('key, updated_at'),
  ])

  const countryCount = new Set((countryRows ?? []).map(r => r.country_code)).size
  const logMap = new Map((refreshLog ?? []).map(r => [r.key, r.updated_at as string]))
  const dataLastChanged  = logMap.get('data_last_changed') ?? null
  const viewsLastRefreshed = logMap.get('last_refreshed') ?? null

  // ── Trending / pageview data ──────────────────────────────────────────────────
  let trendingBooks: TrendingBookRow[] = []
  let trendingAuthors: TrendingAuthorRow[] = []
  let viewsThisWeek = 0
  let viewsLastWeek = 0
  let firstViewDate: string | null = null
  let countriesThisWeek: { country: string | null; views: number }[] = []
  let countriesLastWeek: { country: string | null; views: number }[] = []
  let referrersThisWeek: { referrer_host: string | null; views: number }[] = []
  let referrersLastWeek: { referrer_host: string | null; views: number }[] = []

  try {
    const [
      { data: booksThisWeek },
      { data: booksLastWeek },
      { data: authorsThisWeek },
      { data: authorsLastWeek },
      { data: weeklyTotals },
      { data: firstView },
      { data: countriesThisWeekRaw },
      { data: countriesLastWeekRaw },
      { data: referrersThisWeekRaw },
      { data: referrersLastWeekRaw },
    ] = await Promise.all([
      supabase.from('v_top_books_this_week').select('entity_id, views'),
      supabase.from('v_top_books_last_week').select('entity_id, views'),
      supabase.from('v_top_authors_this_week').select('entity_id, views'),
      supabase.from('v_top_authors_last_week').select('entity_id, views'),
      supabase.from('v_weekly_totals').select('views_this_week, views_last_week').single(),
      supabase.from('pageviews').select('viewed_at').order('viewed_at', { ascending: true }).limit(1).single(),
      supabase.from('v_top_countries_this_week').select('country, views'),
      supabase.from('v_top_countries_last_week').select('country, views'),
      supabase.from('v_top_referrers_this_week').select('referrer_host, views'),
      supabase.from('v_top_referrers_last_week').select('referrer_host, views'),
    ])

    countriesThisWeek = (countriesThisWeekRaw ?? []).map(r => ({ country: r.country, views: Number(r.views) }))
    countriesLastWeek = (countriesLastWeekRaw ?? []).map(r => ({ country: r.country, views: Number(r.views) }))
    referrersThisWeek = (referrersThisWeekRaw ?? []).map(r => ({ referrer_host: r.referrer_host, views: Number(r.views) }))
    referrersLastWeek = (referrersLastWeekRaw ?? []).map(r => ({ referrer_host: r.referrer_host, views: Number(r.views) }))

    viewsThisWeek = Number(weeklyTotals?.views_this_week ?? 0)
    viewsLastWeek = Number(weeklyTotals?.views_last_week ?? 0)
    firstViewDate = firstView?.viewed_at ?? null

    // ── Books ──────────────────────────────────────────────────────────────────
    const topBookEntries = (booksThisWeek ?? []).slice(0, 5)
    const topBookIds = topBookEntries.map(r => Number(r.entity_id))
    if (topBookIds.length > 0) {
      const { data: bookDetails } = await supabase
        .from('books')
        .select('id, title, slug')
        .in('id', topBookIds)
      const bookMap = new Map((bookDetails ?? []).map(b => [b.id, b]))
      const lastWeekRankMap = new Map(
        (booksLastWeek ?? []).map((r, i) => [Number(r.entity_id), i + 1])
      )
      trendingBooks = topBookEntries
        .map((r, i) => {
          const book = bookMap.get(Number(r.entity_id))
          if (!book?.slug) return null
          return {
            rank: i + 1,
            entityId: Number(r.entity_id),
            views: Number(r.views),
            lastWeekRank: lastWeekRankMap.get(Number(r.entity_id)) ?? null,
            title: book.title,
            slug: book.slug,
          }
        })
        .filter((b): b is TrendingBookRow => b !== null)
    }

    // ── Authors ────────────────────────────────────────────────────────────────
    const topAuthorEntries = (authorsThisWeek ?? []).slice(0, 5)
    const topAuthorIds = topAuthorEntries.map(r => Number(r.entity_id))
    if (topAuthorIds.length > 0) {
      const { data: authorDetails } = await supabase
        .from('authors')
        .select('id, display_name, slug')
        .in('id', topAuthorIds)
      const authorMap = new Map((authorDetails ?? []).map(a => [a.id, a]))
      const lastWeekRankMap = new Map(
        (authorsLastWeek ?? []).map((r, i) => [Number(r.entity_id), i + 1])
      )
      trendingAuthors = topAuthorEntries
        .map((r, i) => {
          const author = authorMap.get(Number(r.entity_id))
          if (!author?.slug) return null
          return {
            rank: i + 1,
            entityId: Number(r.entity_id),
            views: Number(r.views),
            lastWeekRank: lastWeekRankMap.get(Number(r.entity_id)) ?? null,
            name: author.display_name,
            slug: author.slug,
          }
        })
        .filter((a): a is TrendingAuthorRow => a !== null)
    }
  } catch {
    // pageviews table not yet created — show empty state
  }

  return (
    <AdminDashboardClient
      bookCount={bookCount ?? 0}
      newsCount={newsCount ?? 0}
      banCount={banCount ?? 0}
      countryCount={countryCount}
      noCoverCount={noCoverCount ?? 0}
      noDescCount={noDescCount ?? 0}
      trendingBooks={trendingBooks}
      trendingAuthors={trendingAuthors}
      viewsThisWeek={viewsThisWeek}
      viewsLastWeek={viewsLastWeek}
      firstViewDate={firstViewDate}
      countriesThisWeek={countriesThisWeek}
      countriesLastWeek={countriesLastWeek}
      referrersThisWeek={referrersThisWeek}
      referrersLastWeek={referrersLastWeek}
      dataLastChanged={dataLastChanged}
      viewsLastRefreshed={viewsLastRefreshed}
    />
  )
}
