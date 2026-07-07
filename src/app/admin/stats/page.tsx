import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import CloudflareCards from '../cloudflare-cards'
import TrafficCard, { type CountryViewRow, type ReferrerViewRow, type DailyTrafficRow } from '../traffic-card'
import TrendingCard, { type TrendingBookRow, type TrendingAuthorRow, type AllTimeBookRow, type AllTimeAuthorRow } from '../trending-card'

export const dynamic = 'force-dynamic'

const cardCls = 'border border-gray-200 rounded-xl p-6 flex flex-col gap-3 bg-white'

// 30-day daily series for the Traffic chart, read from the pageviews_daily
// rollup (upserted hourly by /api/cron/refresh-views) — never from the raw
// pageviews table. Cached for 5 minutes on top of that, so the owner
// re-checking the page repeatedly costs zero queries. Days without a rollup
// row (zero tracked traffic) are filled with zeros so the x-axis stays linear.
const getDailyTraffic = unstable_cache(
  async (): Promise<DailyTrafficRow[]> => {
    const DAYS = 30
    const today = new Date().toISOString().slice(0, 10)
    const since = new Date(Date.now() - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10)
    const { data } = await adminClient()
      .from('pageviews_daily')
      .select('day, visitors, pageviews')
      .gte('day', since)
      .order('day', { ascending: true })
    const byDay = new Map((data ?? []).map(r => [r.day as string, r]))
    const series: DailyTrafficRow[] = []
    for (let d = new Date(`${since}T00:00:00Z`); d.toISOString().slice(0, 10) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.toISOString().slice(0, 10)
      const row = byDay.get(day)
      series.push({
        day,
        visitors: Number(row?.visitors ?? 0),
        pageviews: Number(row?.pageviews ?? 0),
      })
    }
    return series
  },
  ['admin-traffic-daily'],
  { revalidate: 300 },
)

export default async function AdminStatsPage() {
  const supabase = adminClient()

  let trendingBooks: TrendingBookRow[] = []
  let trendingAuthors: TrendingAuthorRow[] = []
  let allTimeBooks: AllTimeBookRow[] = []
  let allTimeAuthors: AllTimeAuthorRow[] = []
  let visitorsThisWeek = 0
  let visitorsLastWeek = 0
  let pageviewsThisWeek = 0
  let pageviewsLastWeek = 0
  let firstViewDate: string | null = null
  let countriesThisWeek: CountryViewRow[] = []
  let countriesLastWeek: CountryViewRow[] = []
  let referrersThisWeek: ReferrerViewRow[] = []
  let referrersLastWeek: ReferrerViewRow[] = []
  let dailySeries: DailyTrafficRow[] = []

  try {
    dailySeries = await getDailyTraffic()
  } catch {
    // pageviews_daily rollup not yet created — chart hides itself
  }

  try {
    const [
      { data: booksThisWeek },
      { data: booksLastWeek },
      { data: authorsThisWeek },
      { data: authorsLastWeek },
      { data: booksAllTime },
      { data: authorsAllTime },
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
      supabase.from('v_top_books_all_time').select('entity_id, views').limit(5),
      supabase.from('v_top_authors_all_time').select('entity_id, views').limit(5),
      supabase
        .from('v_weekly_totals')
        .select('views_this_week, views_last_week, pageviews_this_week, pageviews_last_week')
        .single(),
      supabase.from('pageviews').select('viewed_at').order('viewed_at', { ascending: true }).limit(1).single(),
      supabase.from('v_top_countries_this_week').select('country, views').limit(20),
      supabase.from('v_top_countries_last_week').select('country, views').limit(20),
      supabase.from('v_top_referrers_this_week').select('referrer_host, views').limit(20),
      supabase.from('v_top_referrers_last_week').select('referrer_host, views').limit(20),
    ])

    countriesThisWeek = (countriesThisWeekRaw ?? []).map(r => ({ country: r.country, views: Number(r.views) }))
    countriesLastWeek = (countriesLastWeekRaw ?? []).map(r => ({ country: r.country, views: Number(r.views) }))
    referrersThisWeek = (referrersThisWeekRaw ?? []).map(r => ({ referrer_host: r.referrer_host, views: Number(r.views) }))
    referrersLastWeek = (referrersLastWeekRaw ?? []).map(r => ({ referrer_host: r.referrer_host, views: Number(r.views) }))

    visitorsThisWeek = Number(weeklyTotals?.views_this_week ?? 0)
    visitorsLastWeek = Number(weeklyTotals?.views_last_week ?? 0)
    pageviewsThisWeek = Number(weeklyTotals?.pageviews_this_week ?? 0)
    pageviewsLastWeek = Number(weeklyTotals?.pageviews_last_week ?? 0)
    firstViewDate = firstView?.viewed_at ?? null

    const topBookEntries = (booksThisWeek ?? []).slice(0, 5)
    const topAllTimeBookEntries = (booksAllTime ?? []).slice(0, 5)
    const allBookIds = Array.from(new Set([
      ...topBookEntries.map(r => Number(r.entity_id)),
      ...topAllTimeBookEntries.map(r => Number(r.entity_id)),
    ]))
    if (allBookIds.length > 0) {
      const { data: bookDetails } = await supabase
        .from('books')
        .select('id, title, slug')
        .in('id', allBookIds)
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
      allTimeBooks = topAllTimeBookEntries
        .map((r, i) => {
          const book = bookMap.get(Number(r.entity_id))
          if (!book?.slug) return null
          return {
            rank: i + 1,
            entityId: Number(r.entity_id),
            views: Number(r.views),
            title: book.title,
            slug: book.slug,
          }
        })
        .filter((b): b is AllTimeBookRow => b !== null)
    }

    const topAuthorEntries = (authorsThisWeek ?? []).slice(0, 5)
    const topAllTimeAuthorEntries = (authorsAllTime ?? []).slice(0, 5)
    const allAuthorIds = Array.from(new Set([
      ...topAuthorEntries.map(r => Number(r.entity_id)),
      ...topAllTimeAuthorEntries.map(r => Number(r.entity_id)),
    ]))
    if (allAuthorIds.length > 0) {
      const { data: authorDetails } = await supabase
        .from('authors')
        .select('id, display_name, slug')
        .in('id', allAuthorIds)
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
      allTimeAuthors = topAllTimeAuthorEntries
        .map((r, i) => {
          const author = authorMap.get(Number(r.entity_id))
          if (!author?.slug) return null
          return {
            rank: i + 1,
            entityId: Number(r.entity_id),
            views: Number(r.views),
            name: author.display_name,
            slug: author.slug,
          }
        })
        .filter((a): a is AllTimeAuthorRow => a !== null)
    }
  } catch {
    // pageviews table not yet created — show empty state
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">banned-books.org</p>
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CloudflareCards />

        <TrafficCard
          countriesThisWeek={countriesThisWeek}
          countriesLastWeek={countriesLastWeek}
          referrersThisWeek={referrersThisWeek}
          referrersLastWeek={referrersLastWeek}
          visitorsThisWeek={visitorsThisWeek}
          visitorsLastWeek={visitorsLastWeek}
          pageviewsThisWeek={pageviewsThisWeek}
          pageviewsLastWeek={pageviewsLastWeek}
          dailySeries={dailySeries}
          cardCls={cardCls}
        />

        <TrendingCard
          trendingBooks={trendingBooks}
          trendingAuthors={trendingAuthors}
          allTimeBooks={allTimeBooks}
          allTimeAuthors={allTimeAuthors}
          firstViewDate={firstViewDate}
          cardCls={cardCls}
        />
      </div>
    </main>
  )
}
