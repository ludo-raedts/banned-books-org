import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import { withDbRetry } from '@/lib/db-retry'
import AdminBackLink from '@/components/admin-back-link'
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

type StatsData = {
  trendingBooks: TrendingBookRow[]
  trendingAuthors: TrendingAuthorRow[]
  allTimeBooks: AllTimeBookRow[]
  allTimeAuthors: AllTimeAuthorRow[]
  visitorsThisWeek: number
  visitorsLastWeek: number
  pageviewsThisWeek: number
  pageviewsLastWeek: number
  firstViewDate: string | null
  countriesThisWeek: CountryViewRow[]
  countriesLastWeek: CountryViewRow[]
  referrersThisWeek: ReferrerViewRow[]
  referrersLastWeek: ReferrerViewRow[]
}

// All pageview aggregations behind one 5-minute cache. v_weekly_totals is the
// heaviest single statement in the admin (full scan over 90 days of pageviews
// with two count(DISTINCT)) — it gets a retry against transient 57014s, and
// any error is thrown (not cached) so the page can show it instead of the old
// silent-empty state.
async function fetchStatsData(): Promise<StatsData> {
  const supabase = adminClient()

  const [
    booksThisWeekRes,
    booksLastWeekRes,
    authorsThisWeekRes,
    authorsLastWeekRes,
    booksAllTimeRes,
    authorsAllTimeRes,
    weeklyTotalsRes,
    firstViewRes,
    countriesThisWeekRes,
    countriesLastWeekRes,
    referrersThisWeekRes,
    referrersLastWeekRes,
  ] = await Promise.all([
    supabase.from('v_top_books_this_week').select('entity_id, views'),
    supabase.from('v_top_books_last_week').select('entity_id, views'),
    supabase.from('v_top_authors_this_week').select('entity_id, views'),
    supabase.from('v_top_authors_last_week').select('entity_id, views'),
    supabase.from('v_top_books_all_time').select('entity_id, views').limit(5),
    supabase.from('v_top_authors_all_time').select('entity_id, views').limit(5),
    withDbRetry(
      () => supabase
        .from('v_weekly_totals')
        .select('views_this_week, views_last_week, pageviews_this_week, pageviews_last_week')
        .single(),
      'v_weekly_totals',
    ),
    supabase.from('pageviews').select('viewed_at').order('viewed_at', { ascending: true }).limit(1).single(),
    supabase.from('v_top_countries_this_week').select('country, views').limit(20),
    supabase.from('v_top_countries_last_week').select('country, views').limit(20),
    supabase.from('v_top_referrers_this_week').select('referrer_host, views').limit(20),
    supabase.from('v_top_referrers_last_week').select('referrer_host, views').limit(20),
  ])

  const failed = [
    ['v_top_books_this_week', booksThisWeekRes.error],
    ['v_top_books_last_week', booksLastWeekRes.error],
    ['v_top_authors_this_week', authorsThisWeekRes.error],
    ['v_top_authors_last_week', authorsLastWeekRes.error],
    ['v_top_books_all_time', booksAllTimeRes.error],
    ['v_top_authors_all_time', authorsAllTimeRes.error],
    ['v_weekly_totals', weeklyTotalsRes.error],
    ['v_top_countries_this_week', countriesThisWeekRes.error],
    ['v_top_countries_last_week', countriesLastWeekRes.error],
    ['v_top_referrers_this_week', referrersThisWeekRes.error],
    ['v_top_referrers_last_week', referrersLastWeekRes.error],
  ].filter(([, err]) => err) as Array<[string, { message?: string }]>
  if (failed.length > 0) {
    throw new Error(failed.map(([name, err]) => `${name}: ${err.message ?? 'unknown error'}`).join(' · '))
  }

  const booksThisWeek = booksThisWeekRes.data ?? []
  const booksLastWeek = booksLastWeekRes.data ?? []
  const authorsThisWeek = authorsThisWeekRes.data ?? []
  const authorsLastWeek = authorsLastWeekRes.data ?? []
  const booksAllTime = booksAllTimeRes.data ?? []
  const authorsAllTime = authorsAllTimeRes.data ?? []
  const weeklyTotals = weeklyTotalsRes.data

  const out: StatsData = {
    trendingBooks: [],
    trendingAuthors: [],
    allTimeBooks: [],
    allTimeAuthors: [],
    visitorsThisWeek: Number(weeklyTotals?.views_this_week ?? 0),
    visitorsLastWeek: Number(weeklyTotals?.views_last_week ?? 0),
    pageviewsThisWeek: Number(weeklyTotals?.pageviews_this_week ?? 0),
    pageviewsLastWeek: Number(weeklyTotals?.pageviews_last_week ?? 0),
    firstViewDate: firstViewRes.data?.viewed_at ?? null,
    countriesThisWeek: (countriesThisWeekRes.data ?? []).map(r => ({ country: r.country, views: Number(r.views) })),
    countriesLastWeek: (countriesLastWeekRes.data ?? []).map(r => ({ country: r.country, views: Number(r.views) })),
    referrersThisWeek: (referrersThisWeekRes.data ?? []).map(r => ({ referrer_host: r.referrer_host, views: Number(r.views) })),
    referrersLastWeek: (referrersLastWeekRes.data ?? []).map(r => ({ referrer_host: r.referrer_host, views: Number(r.views) })),
  }

  const topBookEntries = booksThisWeek.slice(0, 5)
  const topAllTimeBookEntries = booksAllTime.slice(0, 5)
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
      booksLastWeek.map((r, i) => [Number(r.entity_id), i + 1])
    )
    out.trendingBooks = topBookEntries
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
    out.allTimeBooks = topAllTimeBookEntries
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

  const topAuthorEntries = authorsThisWeek.slice(0, 5)
  const topAllTimeAuthorEntries = authorsAllTime.slice(0, 5)
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
      authorsLastWeek.map((r, i) => [Number(r.entity_id), i + 1])
    )
    out.trendingAuthors = topAuthorEntries
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
    out.allTimeAuthors = topAllTimeAuthorEntries
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

  return out
}

const getStatsData = unstable_cache(fetchStatsData, ['admin-stats-data'], { revalidate: 300 })

const EMPTY: StatsData = {
  trendingBooks: [], trendingAuthors: [], allTimeBooks: [], allTimeAuthors: [],
  visitorsThisWeek: 0, visitorsLastWeek: 0, pageviewsThisWeek: 0, pageviewsLastWeek: 0,
  firstViewDate: null, countriesThisWeek: [], countriesLastWeek: [],
  referrersThisWeek: [], referrersLastWeek: [],
}

export default async function AdminStatsPage() {
  let dailySeries: DailyTrafficRow[] = []
  try {
    dailySeries = await getDailyTraffic()
  } catch {
    // pageviews_daily rollup not yet created — chart hides itself
  }

  let stats = EMPTY
  let loadError: string | null = null
  try {
    stats = await getStatsData()
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stats</h1>
          <p className="text-sm text-gray-500 mt-1">Traffic, trending pages and edge health.</p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Pageview stats failed to load (showing empty data): {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CloudflareCards />

        <TrafficCard
          countriesThisWeek={stats.countriesThisWeek}
          countriesLastWeek={stats.countriesLastWeek}
          referrersThisWeek={stats.referrersThisWeek}
          referrersLastWeek={stats.referrersLastWeek}
          visitorsThisWeek={stats.visitorsThisWeek}
          visitorsLastWeek={stats.visitorsLastWeek}
          pageviewsThisWeek={stats.pageviewsThisWeek}
          pageviewsLastWeek={stats.pageviewsLastWeek}
          dailySeries={dailySeries}
          cardCls={cardCls}
        />

        <TrendingCard
          trendingBooks={stats.trendingBooks}
          trendingAuthors={stats.trendingAuthors}
          allTimeBooks={stats.allTimeBooks}
          allTimeAuthors={stats.allTimeAuthors}
          firstViewDate={stats.firstViewDate}
          cardCls={cardCls}
        />
      </div>
    </main>
  )
}
