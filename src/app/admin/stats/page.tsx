import { cardCls } from '../kit'
import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import AdminBackLink from '@/components/admin-back-link'
import CloudflareCards from '../cloudflare-cards'
import TrafficChart from './traffic-chart'
import { FilterBar, KpiRow, BreakdownCard, TopPagesCard, referrerLabel, countryLabel } from './sections'
import { getTraffic, getTopPages, parseFilters, type StatsFilters } from './data'
import TrendingCard, { type TrendingBookRow, type TrendingAuthorRow, type AllTimeBookRow, type AllTimeAuthorRow } from '../trending-card'

export const dynamic = 'force-dynamic'

type StatsData = {
  trendingBooks: TrendingBookRow[]
  trendingAuthors: TrendingAuthorRow[]
  allTimeBooks: AllTimeBookRow[]
  allTimeAuthors: AllTimeAuthorRow[]
  firstViewDate: string | null
}

// Trending / all-time lists behind one 5-minute cache. (The traffic numbers —
// totals, countries, referrers — moved to the range-scoped rollups in ./data;
// the heavy v_weekly_totals scan is no longer read here.) Any error is thrown
// (not cached) so the page can show it instead of a silent-empty state.
async function fetchStatsData(): Promise<StatsData> {
  const supabase = adminClient()

  const [
    booksThisWeekRes,
    booksLastWeekRes,
    authorsThisWeekRes,
    authorsLastWeekRes,
    booksAllTimeRes,
    authorsAllTimeRes,
    firstViewRes,
  ] = await Promise.all([
    supabase.from('v_top_books_this_week').select('entity_id, views'),
    supabase.from('v_top_books_last_week').select('entity_id, views'),
    supabase.from('v_top_authors_this_week').select('entity_id, views'),
    supabase.from('v_top_authors_last_week').select('entity_id, views'),
    supabase.from('v_top_books_all_time').select('entity_id, views').limit(5),
    supabase.from('v_top_authors_all_time').select('entity_id, views').limit(5),
    supabase.from('pageviews').select('viewed_at').order('viewed_at', { ascending: true }).limit(1).single(),
  ])

  const failed = [
    ['v_top_books_this_week', booksThisWeekRes.error],
    ['v_top_books_last_week', booksLastWeekRes.error],
    ['v_top_authors_this_week', authorsThisWeekRes.error],
    ['v_top_authors_last_week', authorsLastWeekRes.error],
    ['v_top_books_all_time', booksAllTimeRes.error],
    ['v_top_authors_all_time', authorsAllTimeRes.error],
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

  const out: StatsData = {
    trendingBooks: [],
    trendingAuthors: [],
    allTimeBooks: [],
    allTimeAuthors: [],
    firstViewDate: firstViewRes.data?.viewed_at ?? null,
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
  firstViewDate: null,
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters: StatsFilters = parseFilters(await searchParams)

  // Range-scoped data (rollups) and the filtered top-pages list are independent
  // of the trending lists; a failure in one must not blank the others.
  const [traffic, topPages, trending] = await Promise.allSettled([
    getTraffic(filters),
    getTopPages(filters),
    getStatsData(),
  ])
  const errors: string[] = []
  const reason = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : String(r.reason))
  if (traffic.status === 'rejected') errors.push(`Traffic: ${reason(traffic)}`)
  if (topPages.status === 'rejected') errors.push(`Top pages: ${reason(topPages)}`)
  if (trending.status === 'rejected') errors.push(`Trending: ${reason(trending)}`)
  const stats = trending.status === 'fulfilled' ? trending.value : EMPTY
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stats</h1>
          <p className="text-sm text-gray-500 mt-1">Traffic, where it comes from, and trending pages.</p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Some stats failed to load: {errors.join(' · ')}
        </div>
      )}

      {traffic.status === 'fulfilled' && (
        <>
          <FilterBar filters={filters} from={traffic.value.from} to={traffic.value.to} />
          <KpiRow
            data={traffic.value}
            scope={filters.ref !== null ? referrerLabel(filters.ref) : filters.country !== null ? countryLabel(filters.country) : null}
          />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {traffic.status === 'fulfilled' && (
          <>
            <div className={`${cardCls} col-span-full`}>
              <div>
                <h2 className="font-semibold text-gray-900">{traffic.value.granularity === 'hour' ? 'Traffic per hour' : 'Traffic per day'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {filters.ref !== null || filters.country !== null ? 'For the selected filter. ' : ''}{traffic.value.granularity === 'hour' ? 'Per hour (UTC); visitors are unique within each hour.' : 'Visitors are unique per day.'} Hover (or use ← →) for the numbers, or switch to the table.
                </p>
              </div>
              {traffic.value.series.length > 1 ? (
                <TrafficChart series={traffic.value.series} today={today} granularity={traffic.value.granularity} />
              ) : (
                <p className="text-sm text-gray-400 italic py-6">Not enough days yet for a chart.</p>
              )}
            </div>
            <BreakdownCard data={traffic.value} filters={filters} cardCls={cardCls} />
          </>
        )}

        {topPages.status === 'fulfilled' && (
          <TopPagesCard pages={topPages.value} filters={filters} cardCls={cardCls} />
        )}

        <TrendingCard
          trendingBooks={stats.trendingBooks}
          trendingAuthors={stats.trendingAuthors}
          allTimeBooks={stats.allTimeBooks}
          allTimeAuthors={stats.allTimeAuthors}
          firstViewDate={stats.firstViewDate}
          cardCls={cardCls}
        />

        <CloudflareCards />
      </div>
    </main>
  )
}
