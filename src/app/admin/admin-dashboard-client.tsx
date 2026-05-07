'use client'

import { useState } from 'react'
import { BookOpen, Newspaper, BarChart2, Zap, TrendingUp, Users, Map as MapIcon, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import DataQualityCard from './data-quality-card'
import EssayPromptCard from './essay-prompt-card'

export type TrendingBookRow = {
  rank: number
  entityId: number
  views: number
  lastWeekRank: number | null
  title: string
  slug: string
}

export type TrendingAuthorRow = {
  rank: number
  entityId: number
  views: number
  lastWeekRank: number | null
  name: string
  slug: string
}

type CountryViewRow = { country: string | null; views: number }
type ReferrerViewRow = { referrer_host: string | null; views: number }

const REFERRER_LABELS: Record<string, string> = {
  'google.com': 'Google',
  'google.nl': 'Google NL',
  'twitter.com': 'Twitter / X',
  'x.com': 'Twitter / X',
  't.co': 'Twitter / X',
  'facebook.com': 'Facebook',
  'reddit.com': 'Reddit',
  'news.ycombinator.com': 'Hacker News',
  'pocket.com': 'Pocket',
  'feedly.com': 'Feedly',
  'substack.com': 'Substack',
}

function flagEmoji(code: string) {
  return code.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

function ViewDelta({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number | null }) {
  if (lastWeek === null) return <span className="text-[10px] text-blue-500 font-medium shrink-0">new</span>
  const delta = thisWeek - lastWeek
  if (delta > 0) return <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">↑</span>
  if (delta < 0) return <span className="text-[10px] text-red-400 shrink-0">↓</span>
  return null
}

function MiniBar({ value, max, color }: { value: number; max: number; color: 'red' | 'blue' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const bg = color === 'red' ? 'bg-red-200 dark:bg-red-900/40' : 'bg-blue-200 dark:bg-blue-900/40'
  const fill = color === 'red' ? 'bg-red-600' : 'bg-blue-600'
  return (
    <div className={`flex-1 h-1.5 rounded-full ${bg} min-w-[40px]`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TrafficCard({
  countriesThisWeek, countriesLastWeek,
  referrersThisWeek, referrersLastWeek,
  viewsThisWeek, viewsLastWeek,
  cardCls,
}: {
  countriesThisWeek: CountryViewRow[]
  countriesLastWeek: CountryViewRow[]
  referrersThisWeek: ReferrerViewRow[]
  referrersLastWeek: ReferrerViewRow[]
  viewsThisWeek: number
  viewsLastWeek: number
  cardCls: string
}) {
  const [week, setWeek] = useState<'this' | 'last'>('this')

  const countries = week === 'this' ? countriesThisWeek : countriesLastWeek
  const referrers = week === 'this' ? referrersThisWeek : referrersLastWeek
  const totalViews = week === 'this' ? viewsThisWeek : viewsLastWeek
  const compareViews = week === 'this' ? viewsLastWeek : viewsThisWeek

  const countryLastWeekMap = new Map(countriesLastWeek.map(r => [r.country, r.views]))
  const referrerLastWeekMap = new Map(referrersLastWeek.map(r => [r.referrer_host, r.views]))
  const countryThisWeekMap = new Map(countriesThisWeek.map(r => [r.country, r.views]))
  const referrerThisWeekMap = new Map(referrersThisWeek.map(r => [r.referrer_host, r.views]))

  const maxCountryViews = countries[0]?.views ?? 1
  const maxReferrerViews = referrers[0]?.views ?? 1

  const knownReferrerViews = referrers.reduce((sum, r) => sum + r.views, 0)
  const directViews = Math.max(0, totalViews - knownReferrerViews)

  const totalDelta = totalViews - compareViews
  const totalPct = compareViews > 0 ? Math.round((totalDelta / compareViews) * 100) : null

  const isEmpty = countries.length === 0 && referrers.length === 0

  return (
    <div className={`${cardCls} col-span-full`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Traffic</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Page views by country and referrer.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {(['this', 'last'] as const).map(w => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                week === w
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {w === 'this' ? 'This week' : 'Last week'}
            </button>
          ))}
        </div>
      </div>

      {/* Headline stat — page views for the selected week */}
      <div className="flex items-baseline gap-3 flex-wrap border-y border-gray-100 dark:border-gray-800 py-4 -mx-2 px-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
          {totalViews.toLocaleString('en')}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">page views</span>
        {totalPct !== null && (
          <span className={`text-xs font-medium tabular-nums ${
            totalPct > 0 ? 'text-emerald-600 dark:text-emerald-400' :
            totalPct < 0 ? 'text-red-500' :
            'text-gray-400'
          }`}>
            {totalPct > 0 ? `↑ ${totalPct}%` : totalPct < 0 ? `↓ ${Math.abs(totalPct)}%` : '→ 0%'}
            <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
              vs {week === 'this' ? 'last week' : 'this week'} ({compareViews.toLocaleString('en')})
            </span>
          </span>
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-8">
          No traffic data yet for this period.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
          {/* Countries */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By country</p>
            <div className="flex flex-col gap-2">
              {countries.map(row => (
                <div key={row.country ?? '__null__'} className="flex items-center gap-2 min-w-0">
                  <span className="text-base w-5 shrink-0 text-center leading-none">
                    {row.country ? flagEmoji(row.country) : '🌐'}
                  </span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 w-28 shrink-0 truncate">
                    {row.country ?? 'Direct / unknown'}
                  </span>
                  <MiniBar
                    value={row.views}
                    max={maxCountryViews}
                    color="red"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right shrink-0 tabular-nums">
                    {row.views.toLocaleString('en')}
                  </span>
                  <ViewDelta
                    thisWeek={row.views}
                    lastWeek={week === 'this'
                      ? (countryLastWeekMap.get(row.country) ?? null)
                      : (countryThisWeekMap.get(row.country) ?? null)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Referrers */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By referrer</p>
            <div className="flex flex-col gap-2">
              {referrers.map(row => {
                const host = row.referrer_host ?? ''
                const label = REFERRER_LABELS[host] ?? host
                return (
                  <div key={host || '__direct__'} className="flex items-center gap-2 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${host}&sz=16`}
                      className="w-4 h-4 rounded-sm shrink-0"
                      alt=""
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300 max-w-[140px] truncate shrink-0">
                      {label}
                    </span>
                    <MiniBar value={row.views} max={maxReferrerViews} color="blue" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right shrink-0 tabular-nums">
                      {row.views.toLocaleString('en')}
                    </span>
                    <ViewDelta
                      thisWeek={row.views}
                      lastWeek={week === 'this'
                        ? (referrerLastWeekMap.get(row.referrer_host) ?? null)
                        : (referrerThisWeekMap.get(row.referrer_host) ?? null)
                      }
                    />
                  </div>
                )
              })}
              {directViews > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Direct / no referrer — {directViews.toLocaleString('en')} views
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  bookCount: number
  newsCount: number
  banCount: number
  countryCount: number
  dbSizeBytes: number | null
  dbLimitBytes: number
  pageviewsSizeBytes: number | null
  pageviewsRows: number | null
  trendingBooks: TrendingBookRow[]
  trendingAuthors: TrendingAuthorRow[]
  viewsThisWeek: number
  viewsLastWeek: number
  firstViewDate: string | null
  countriesThisWeek: CountryViewRow[]
  countriesLastWeek: CountryViewRow[]
  referrersThisWeek: ReferrerViewRow[]
  referrersLastWeek: ReferrerViewRow[]
  dataLastChanged: string | null
  viewsLastRefreshed: string | null
  sitemapCounts: {
    static: number
    books: number
    authors: number
    countries: number
    reasons: number
  }
}

function RankChange({ thisWeekRank, lastWeekRank }: { thisWeekRank: number; lastWeekRank: number | null }) {
  if (lastWeekRank === null) {
    return <span className="text-xs text-blue-500 font-medium shrink-0">new</span>
  }
  const change = lastWeekRank - thisWeekRank
  if (change > 0) return <span className="text-xs text-green-600 shrink-0">↑{change}</span>
  if (change < 0) return <span className="text-xs text-red-400 shrink-0">↓{Math.abs(change)}</span>
  return <span className="text-xs text-gray-300 shrink-0">→</span>
}

function TrendingSection({
  Icon,
  label,
  items,
  linkPrefix,
  nameKey,
}: {
  Icon: typeof BookOpen
  label: string
  items: (TrendingBookRow | TrendingAuthorRow)[]
  linkPrefix: string
  nameKey: 'title' | 'name'
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        <span>{label}</span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No data yet.</p>
      ) : (
        <div className="flex flex-col">
          {items.map(item => (
            <Link
              key={item.entityId}
              href={`/${linkPrefix}/${item.slug}`}
              className="group flex items-baseline gap-3 py-1 px-2 -mx-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0 w-5 text-center leading-none">{item.rank}</span>
              <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate group-hover:text-brand dark:group-hover:text-red-400">
                {(item as any)[nameKey]}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                {item.views.toLocaleString('en')}
              </span>
              <RankChange thisWeekRank={item.rank} lastWeekRank={item.lastWeekRank} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export default function AdminDashboardClient({
  bookCount, newsCount, banCount, countryCount,
  dbSizeBytes, dbLimitBytes, pageviewsSizeBytes, pageviewsRows,
  trendingBooks, trendingAuthors, viewsThisWeek, viewsLastWeek, firstViewDate,
  countriesThisWeek, countriesLastWeek, referrersThisWeek, referrersLastWeek,
  dataLastChanged, viewsLastRefreshed, sitemapCounts,
}: Props) {
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [fetchMsg, setFetchMsg] = useState('')
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [refreshMsg, setRefreshMsg] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(viewsLastRefreshed)
  const [indexNowState, setIndexNowState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [indexNowMsg, setIndexNowMsg] = useState('')

  const sitemapTotal =
    sitemapCounts.static +
    sitemapCounts.books +
    sitemapCounts.authors +
    sitemapCounts.countries +
    sitemapCounts.reasons

  async function handleIndexNowBulk() {
    if (!confirm(`Submit ~${sitemapTotal.toLocaleString('en')} URLs to IndexNow (Bing)?`)) return
    setIndexNowState('loading')
    setIndexNowMsg('')
    try {
      const res = await fetch('/api/admin/indexnow-bulk', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? `HTTP ${res.status}`)
      type BatchResult = { ok: boolean; status: number; error?: string; count: number }
      const results: BatchResult[] = data.results ?? []
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        const first = failed[0]
        setIndexNowMsg(
          `Submitted ${data.total} URLs in ${data.batches} batch${data.batches === 1 ? '' : 'es'} — ` +
            `${failed.length} failed. Upstream: HTTP ${first.status} ${first.error ?? ''}`.trim(),
        )
        setIndexNowState('error')
      } else {
        setIndexNowMsg(`Submitted ${data.total} URLs in ${data.batches} batch${data.batches === 1 ? '' : 'es'}.`)
        setIndexNowState('done')
      }
    } catch (err) {
      setIndexNowMsg(err instanceof Error ? err.message : 'Failed')
      setIndexNowState('error')
    }
  }

  async function handleRefreshViews() {
    setRefreshState('loading')
    setRefreshMsg('')
    try {
      const res = await fetch('/api/admin/refresh-views', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLastRefreshed(new Date().toISOString())
      setRefreshMsg(data.message ?? 'Done.')
      setRefreshState('done')
    } catch (err) {
      setRefreshMsg(err instanceof Error ? err.message : 'Failed')
      setRefreshState('error')
    }
  }

  async function handleFetchNews() {
    setFetchState('loading')
    setFetchMsg('')
    try {
      const res = await fetch('/api/admin/fetch-news', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFetchMsg(data.message ?? `Fetched ${data.added ?? 0} new item${data.added !== 1 ? 's' : ''}`)
      setFetchState('done')
    } catch (err) {
      setFetchMsg(err instanceof Error ? err.message : 'Failed')
      setFetchState('error')
    }
  }

  const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-3 bg-white dark:bg-gray-900'

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">banned-books.org</p>
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Row 1 — Books */}
        <a href="/admin/books" className={`${cardCls} hover:border-gray-400 dark:hover:border-gray-500 transition-colors group`}>
          <div className="flex items-center justify-between">
            <BookOpen className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Books</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Edit book descriptions, covers, genres, and censorship context.
            </p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{bookCount.toLocaleString('en')} books in database</p>
          <span className="text-sm text-brand font-medium group-hover:underline mt-auto">Manage books →</span>
        </a>

        {/* Row 1 — Writers */}
        <a href="/admin/authors" className={`${cardCls} hover:border-gray-400 dark:hover:border-gray-500 transition-colors group`}>
          <div className="flex items-center justify-between">
            <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Writers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Edit author bios, photos, birth year, and country.
            </p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Add bios from Wikipedia or manually</p>
          <span className="text-sm text-brand font-medium group-hover:underline mt-auto">Manage writers →</span>
        </a>

        {/* Row 1 — News */}
        <a href="/admin/news" className={`${cardCls} hover:border-gray-400 dark:hover:border-gray-500 transition-colors group relative`}>
          {newsCount > 0 && (
            <span className="absolute top-4 right-4 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center tabular-nums">
              {newsCount}
            </span>
          )}
          <div className="flex items-center justify-between">
            <Newspaper className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">News</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Review and publish weekly news digests from RSS feeds.
            </p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{newsCount} draft{newsCount !== 1 ? 's' : ''} awaiting review</p>
          <span className="text-sm text-brand font-medium group-hover:underline mt-auto">Review drafts →</span>
        </a>

        {/* Row 2 — Database */}
        <div className={cardCls}>
          <BarChart2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Database</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Catalogue size and storage usage.</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-1">
            <dt className="text-gray-500 dark:text-gray-400">Books</dt>
            <dd className="tabular-nums font-medium">{bookCount.toLocaleString('en')}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Bans</dt>
            <dd className="tabular-nums font-medium">{banCount.toLocaleString('en')}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Countries</dt>
            <dd className="tabular-nums font-medium">{countryCount}</dd>
          </dl>

          {dbSizeBytes !== null && (() => {
            const pct = Math.min(100, (dbSizeBytes / dbLimitBytes) * 100)
            const warn = pct >= 80
            const near = pct >= 60
            const fill = warn ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-brand'
            const txt  = warn ? 'text-red-600 dark:text-red-400'
                       : near ? 'text-amber-600 dark:text-amber-400'
                       : 'text-gray-700 dark:text-gray-300'
            return (
              <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">DB size</span>
                  <span className={`tabular-nums font-medium ${txt}`}>
                    {formatBytes(dbSizeBytes)} / {formatBytes(dbLimitBytes)}
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
                </div>
                {pageviewsSizeBytes !== null && pageviewsRows !== null && (
                  <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                    Pageviews · {formatBytes(pageviewsSizeBytes)} · {pageviewsRows.toLocaleString('en')} rows
                  </p>
                )}
              </div>
            )
          })()}
        </div>

        {/* Row 2 — Trending — spans 2 cols on lg */}
        <div className={`${cardCls} lg:col-span-2`}>
          <TrendingUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Trending this week</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Most visited in the last 7 days.</p>
          </div>

          {trendingBooks.length === 0 && trendingAuthors.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-1">
              No data yet. Views appear once the site receives production traffic.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mt-1">
              <TrendingSection
                Icon={BookOpen}
                label="Books"
                items={trendingBooks}
                linkPrefix="books"
                nameKey="title"
              />
              <TrendingSection
                Icon={Users}
                label="Authors"
                items={trendingAuthors}
                linkPrefix="authors"
                nameKey="name"
              />
            </div>
          )}

          {firstViewDate && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-auto">
              Tracking since:{' '}
              {new Date(firstViewDate).toLocaleDateString('en', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Row 3 — Traffic (full width) */}
        <TrafficCard
          countriesThisWeek={countriesThisWeek}
          countriesLastWeek={countriesLastWeek}
          referrersThisWeek={referrersThisWeek}
          referrersLastWeek={referrersLastWeek}
          viewsThisWeek={viewsThisWeek}
          viewsLastWeek={viewsLastWeek}
          cardCls={cardCls}
        />

        {/* Row 4 — Data quality (full width) */}
        <DataQualityCard />

        {/* Sitemap card */}
        <div className={`${cardCls} col-span-full`}>
          <MapIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Sitemap</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Sitemap index split per content type so Google can crawl efficiently.
            </p>
          </div>
          <div className="mt-1 text-sm">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors font-mono"
            >
              /sitemap.xml
            </a>
            <span className="text-gray-400 dark:text-gray-500"> — sitemap index</span>
          </div>
          <dl className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1.5 text-sm mt-1 items-baseline">
            {([
              ['/sitemap-static.xml', sitemapCounts.static, 'homepage, nav, year roll-ups, scope'],
              ['/sitemap-books.xml', sitemapCounts.books, 'books with a slug'],
              ['/sitemap-authors.xml', sitemapCounts.authors, 'authors with a slug'],
              ['/sitemap-countries.xml', sitemapCounts.countries, 'countries with at least one ban'],
              ['/sitemap-reasons.xml', sitemapCounts.reasons, 'reason taxonomy pages'],
            ] as const).map(([path, count, note]) => (
              <div key={path} className="contents">
                <dt>
                  <a
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors font-mono"
                  >
                    {path}
                  </a>
                </dt>
                <dd className="tabular-nums font-medium text-gray-900 dark:text-gray-100">
                  {count.toLocaleString('en')}
                </dd>
                <dd className="text-xs text-gray-500 dark:text-gray-400">{note}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Total:{' '}
            <span className="tabular-nums">
              {sitemapTotal.toLocaleString('en')}
            </span>{' '}
            URLs. Excluded: search, filter/query-string variants, pagination,{' '}
            <code>/admin</code>, <code>/api</code>.
          </p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleIndexNowBulk}
              disabled={indexNowState === 'loading'}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              {indexNowState === 'loading' ? 'Submitting…' : 'Submit all to IndexNow'}
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Pings Bing/IndexNow with every canonical URL. Use sparingly (rate-limited).
            </p>
          </div>
          {indexNowMsg && (
            <p className={`text-xs ${indexNowState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {indexNowMsg}
            </p>
          )}
        </div>

        {/* Materialized views — slim card */}
        <div className={cardCls}>
          <RefreshCw className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Materialized views</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Pre-aggregated data for countries and stats pages.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-1">
            <dt className="text-gray-500 dark:text-gray-400">Data changed</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {dataLastChanged
                ? new Date(dataLastChanged).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">—</span>}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Last refresh</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {lastRefreshed
                ? new Date(lastRefreshed).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">—</span>}
            </dd>
          </dl>
          <button
            onClick={handleRefreshViews}
            disabled={refreshState === 'loading'}
            className="mt-auto self-start px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {refreshState === 'loading' ? 'Refreshing…' : 'Refresh now'}
          </button>
          {refreshMsg && (
            <p className={`text-xs ${refreshState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {refreshMsg}
            </p>
          )}
        </div>

        {/* Quick actions — slim card */}
        <div className={cardCls}>
          <Zap className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Quick actions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Common tasks.</p>
          </div>
          <div className="flex flex-col gap-1.5 text-sm mt-1">
            <a
              href="/admin/scripts"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Scripts reference
            </a>
            <button
              onClick={handleFetchNews}
              disabled={fetchState === 'loading'}
              className="text-left text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors disabled:opacity-50"
            >
              {fetchState === 'loading' ? 'Fetching…' : '→ Fetch news now'}
            </button>
            {fetchMsg && (
              <p className={`text-xs ${fetchState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {fetchMsg}
              </p>
            )}
            <a
              href="https://www.banned-books.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → View live site
            </a>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Supabase dashboard
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Vercel dashboard
            </a>
          </div>
        </div>

        <EssayPromptCard cardCls={cardCls} />

      </div>
    </main>
  )
}
