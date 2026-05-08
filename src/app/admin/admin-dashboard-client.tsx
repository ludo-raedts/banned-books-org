'use client'

import { useState } from 'react'
import { BookOpen, Newspaper, BarChart2, Zap, Users, RefreshCw, Download, AlertTriangle, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AdminTabs from './admin-tabs'
import DataQualityCard from './data-quality-card'
import EssayPromptCard from './essay-prompt-card'

export type InboxRow = {
  uid: number
  fromName: string | null
  fromAddress: string | null
  subject: string | null
  snippet: string
  receivedAt: string | null
  isUnread: boolean
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
  dataLastChanged: string | null
  viewsLastRefreshed: string | null
  datasetStats: {
    totalOrders: number
    paidOrders: number
    totalRevenueCents: number
    currency: string
    totalDownloads: number
    maxDownloadsOnSingleOrder: number
    suspiciousOrderCount: number
    datasetBuiltAt: string | null
    suspiciousThreshold: number
  }
  inboxRows: InboxRow[]
  inboxFetchedAt: string | null
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

function InboxCard({ rows, fetchedAt, cardCls }: { rows: InboxRow[]; fetchedAt: string | null; cardCls: string }) {
  const router = useRouter()
  const unreadCount = rows.filter(r => r.isUnread).length
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [syncError, setSyncError] = useState('')

  async function handleSync() {
    setSyncState('loading')
    setSyncError('')
    try {
      const res = await fetch('/api/admin/sync-inbox', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setSyncState('idle')
      router.refresh()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
      setSyncState('error')
    }
  }

  return (
    <div className={`${cardCls} relative`}>
      {unreadCount > 0 && (
        <span className="absolute top-4 right-4 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center tabular-nums">
          {unreadCount}
        </span>
      )}
      <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500" />
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Inbox</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Last 5 e-mail messages. Refreshed hourly.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-1">
          No messages yet — waiting for the first sync.
        </p>
      ) : (
        <ul className="flex flex-col -mx-2">
          {rows.map(r => (
            <li
              key={r.uid}
              className="flex items-baseline gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${r.isUnread ? 'bg-blue-500' : 'bg-transparent'}`}
                aria-label={r.isUnread ? 'Unread' : 'Read'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm truncate ${r.isUnread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                    title={r.fromAddress ?? undefined}
                  >
                    {r.fromName ?? r.fromAddress ?? 'Unknown sender'}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                    {formatRelativeTime(r.receivedAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {r.subject ?? '(no subject)'}
                </p>
                {r.snippet && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {r.snippet}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {syncState === 'error' && (
        <p className="text-xs text-red-600 dark:text-red-400 -mt-1 break-words">{syncError}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {fetchedAt ? `Synced ${formatRelativeTime(fetchedAt)}` : 'Not synced yet'}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncState === 'loading'}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'loading' ? 'animate-spin' : ''}`} aria-hidden />
            {syncState === 'loading' ? 'Syncing…' : 'Sync now'}
          </button>
          <a
            href="https://mail.zoho.eu/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand font-medium hover:underline"
          >
            Open in Zoho →
          </a>
        </div>
      </div>
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
  dataLastChanged, viewsLastRefreshed, datasetStats,
  inboxRows, inboxFetchedAt,
}: Props) {
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [refreshMsg, setRefreshMsg] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(viewsLastRefreshed)
  const [buildDatasetState, setBuildDatasetState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [buildDatasetMsg, setBuildDatasetMsg] = useState('')
  const [datasetBuiltAt, setDatasetBuiltAt] = useState(datasetStats.datasetBuiltAt)

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

  async function handleBuildDataset() {
    if (!confirm('Rebuild the downloadable dataset ZIP from current data? This takes ~5 seconds.')) return
    setBuildDatasetState('loading')
    setBuildDatasetMsg('')
    try {
      const res = await fetch('/api/admin/build-dataset', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDatasetBuiltAt(new Date().toISOString())
      setBuildDatasetMsg(data.message ?? 'Dataset rebuilt.')
      setBuildDatasetState('done')
    } catch (err) {
      setBuildDatasetMsg(err instanceof Error ? err.message : 'Failed')
      setBuildDatasetState('error')
    }
  }

  const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-3 bg-white dark:bg-gray-900'

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">banned-books.org</p>
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <AdminTabs />

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

        {/* Row 1 — Inbox */}
        <InboxCard rows={inboxRows} fetchedAt={inboxFetchedAt} cardCls={cardCls} />

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

        {/* Row 2 — Quick actions (next to Database) */}
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
            <a
              href="/admin/sitemap"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Sitemap &amp; IndexNow
            </a>
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
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Cloudflare dashboard
            </a>
            <a
              href="https://resend.com/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Resend dashboard
            </a>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-300 hover:text-brand dark:hover:text-brand transition-colors"
            >
              → Stripe dashboard
            </a>
          </div>
        </div>

        {/* Row 3 — Data quality (full width) */}
        <DataQualityCard />

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

        {/* Dataset (paid download) — slim card */}
        <div className={cardCls}>
          <Download className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Dataset Sales</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Paid downloads · regenerated when DB changes.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-1">
            <dt className="text-gray-500 dark:text-gray-400">Paid orders</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {datasetStats.paidOrders.toLocaleString('en')}
              {datasetStats.totalOrders > datasetStats.paidOrders && (
                <span className="text-gray-400"> ({datasetStats.totalOrders - datasetStats.paidOrders} pending)</span>
              )}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Revenue</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {(datasetStats.totalRevenueCents / 100).toLocaleString('en', {
                style: 'currency',
                currency: datasetStats.currency.toUpperCase(),
              })}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Downloads</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {datasetStats.totalDownloads.toLocaleString('en')}
              {datasetStats.paidOrders > 0 && (
                <span className="text-gray-400">
                  {' '}(avg {(datasetStats.totalDownloads / datasetStats.paidOrders).toFixed(1)}/order)
                </span>
              )}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Data changed</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {dataLastChanged
                ? new Date(dataLastChanged).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">—</span>}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Last build</dt>
            <dd className="tabular-nums text-gray-700 dark:text-gray-300">
              {datasetBuiltAt
                ? new Date(datasetBuiltAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">never</span>}
            </dd>
          </dl>
          {datasetStats.suspiciousOrderCount > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2 -mx-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>
                {datasetStats.suspiciousOrderCount} order{datasetStats.suspiciousOrderCount === 1 ? '' : 's'} with
                more than {datasetStats.suspiciousThreshold} downloads — link may be shared.
                Highest: {datasetStats.maxDownloadsOnSingleOrder}.
              </span>
            </div>
          )}
          {dataLastChanged && datasetBuiltAt && new Date(dataLastChanged) > new Date(datasetBuiltAt) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠ Data has changed since last build — buyers will get the previous snapshot until you rebuild.
            </p>
          )}
          <button
            onClick={handleBuildDataset}
            disabled={buildDatasetState === 'loading'}
            className="mt-auto self-start px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {buildDatasetState === 'loading' ? 'Building…' : 'Rebuild now'}
          </button>
          {buildDatasetMsg && (
            <p className={`text-xs ${buildDatasetState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {buildDatasetMsg}
            </p>
          )}
        </div>

        <EssayPromptCard cardCls={cardCls} />

      </div>
    </main>
  )
}
