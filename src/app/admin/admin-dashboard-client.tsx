'use client'

import { cardCls, formatBytes } from './kit'
import { useState } from 'react'
import { BarChart2, Zap, RefreshCw, Download, AlertTriangle, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ZENODO_DOI_URL, ZENODO_RECORD_MANAGE_URL } from '@/lib/zenodo'
import { useAdminUi } from './admin-ui'
import DataQualityCard from './data-quality-card'
import EssayPromptCard from './essay-prompt-card'
import PipelineCard from './pipeline-card'

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
  // build-dataset spawns a local child process — the API route 400s on Vercel.
  isLocalDev: boolean
  bookCount: number
  authorCount: number
  newsCount: number
  banCount: number
  countryCount: number
  needsEnrichment: number
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

// Compact at-a-glance tile. Clickable when href is set — the tiles replace
// the old full-size Books/Writers/News link cards.
function StatTile({
  label, value, sub, href, badge,
}: {
  label: string
  value: string
  sub?: string
  href?: string
  badge?: boolean
}) {
  const inner = (
    <>
      <p className={`text-xl font-bold tabular-nums leading-tight ${badge ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 tabular-nums">{sub}</p>}
    </>
  )
  const tileCls = 'border border-gray-200 rounded-xl px-4 py-3 bg-white min-w-0'
  return href ? (
    <a href={href} className={`${tileCls} block hover:border-gray-400 transition-colors`}>{inner}</a>
  ) : (
    <div className={tileCls}>{inner}</div>
  )
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
      <Mail className="w-5 h-5 text-gray-400" />
      <div>
        <h2 className="font-semibold text-gray-900">Inbox</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Last 5 e-mail messages. Manual sync only — use Sync now.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 italic mt-1">
          No messages yet — waiting for the first sync.
        </p>
      ) : (
        <ul className="flex flex-col -mx-2">
          {rows.map(r => (
            <li
              key={r.uid}
              className="flex items-baseline gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${r.isUnread ? 'bg-blue-500' : 'bg-transparent'}`}
                aria-label={r.isUnread ? 'Unread' : 'Read'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm truncate ${r.isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                    title={r.fromAddress ?? undefined}
                  >
                    {r.fromName ?? r.fromAddress ?? 'Unknown sender'}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                    {formatRelativeTime(r.receivedAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">
                  {r.subject ?? '(no subject)'}
                </p>
                {r.snippet && (
                  <p className="text-xs text-gray-400 truncate">
                    {r.snippet}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {syncState === 'error' && (
        <p className="text-xs text-red-600 -mt-1 break-words">{syncError}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-gray-100 flex-wrap">
        <span className="text-[11px] text-gray-400">
          {fetchedAt ? `Synced ${formatRelativeTime(fetchedAt)}` : 'Not synced yet'}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncState === 'loading'}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
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


export default function AdminDashboardClient({
  bookCount, authorCount, newsCount, banCount, countryCount, needsEnrichment,
  dbSizeBytes, dbLimitBytes, pageviewsSizeBytes, pageviewsRows,
  dataLastChanged, viewsLastRefreshed, datasetStats,
  inboxRows, inboxFetchedAt, isLocalDev,
}: Props) {
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [refreshMsg, setRefreshMsg] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(viewsLastRefreshed)
  const [buildDatasetState, setBuildDatasetState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [buildDatasetMsg, setBuildDatasetMsg] = useState('')
  const [datasetBuiltAt, setDatasetBuiltAt] = useState(datasetStats.datasetBuiltAt)
  const ui = useAdminUi()

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
    const ok = await ui.confirm({
      title: 'Rebuild dataset?',
      body: 'Rebuild the downloadable dataset ZIP from current data. This takes ~5 seconds.',
      confirmLabel: 'Rebuild',
    })
    if (!ok) return
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


  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Overview</h1>
      </div>

      {/* At-a-glance tiles — the cheap counts that used to be scattered over
          full-size cards. Books/Authors/Drafts link straight to their section. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatTile label="Books" value={bookCount.toLocaleString('en')} href="/admin/books" />
        <StatTile label="Authors" value={authorCount.toLocaleString('en')} href="/admin/authors" />
        <StatTile label="Bans" value={banCount.toLocaleString('en')} />
        <StatTile label="Countries" value={String(countryCount)} />
        <StatTile
          label={`News draft${newsCount === 1 ? '' : 's'}`}
          value={String(newsCount)}
          href="/admin/news"
          badge={newsCount > 0}
        />
        <StatTile
          label="DB size"
          value={dbSizeBytes !== null ? formatBytes(dbSizeBytes) : '—'}
          sub={dbSizeBytes !== null ? `${((dbSizeBytes / dbLimitBytes) * 100).toFixed(1)}% of ${formatBytes(dbLimitBytes)}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Row 0 — Import pipeline overview (full width) */}
        <PipelineCard
          needsEnrichment={needsEnrichment}
          cardCls={cardCls}
        />

        {/* Row 1 — Inbox */}
        <InboxCard rows={inboxRows} fetchedAt={inboxFetchedAt} cardCls={cardCls} />

        {/* BBW / Reading Club / Content blocks cards intentionally removed —
            those sections are reachable via the top nav bar, and duplicating
            the entry points clutters the overview. */}

        {/* Row 2 — Storage (catalogue counts live in the tiles above) */}
        <div className={cardCls}>
          <BarChart2 className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="font-semibold text-gray-900">Storage</h2>
            <p className="text-sm text-gray-500 mt-0.5">Supabase database usage.</p>
          </div>

          {dbSizeBytes !== null && (() => {
            const pct = Math.min(100, (dbSizeBytes / dbLimitBytes) * 100)
            const warn = pct >= 80
            const near = pct >= 60
            const fill = warn ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-brand'
            const txt  = warn ? 'text-red-600'
                       : near ? 'text-amber-600'
                       : 'text-gray-700'
            return (
              <div className="mt-auto pt-2 border-t border-gray-100">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-gray-500">DB size</span>
                  <span className={`tabular-nums font-medium ${txt}`}>
                    {formatBytes(dbSizeBytes)} / {formatBytes(dbLimitBytes)}
                    <span className="text-gray-400 font-normal ml-1">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
                </div>
                {pageviewsSizeBytes !== null && pageviewsRows !== null && (
                  <p className="mt-1.5 text-[11px] text-gray-400 tabular-nums">
                    Pageviews · {formatBytes(pageviewsSizeBytes)} · {pageviewsRows.toLocaleString('en')} rows
                  </p>
                )}
              </div>
            )
          })()}
        </div>

        {/* Row 2 — Quick actions: the three daily dashboards up front, the
            long tail behind a disclosure (13 flat links was a bookmarks bar). */}
        <div className={cardCls}>
          <Zap className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="font-semibold text-gray-900">Quick actions</h2>
          </div>
          <div className="flex flex-col gap-1.5 text-sm mt-1">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Supabase dashboard</a>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Vercel dashboard</a>
            <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Cloudflare dashboard</a>
          </div>
          <details className="mt-1">
            <summary className="text-sm text-gray-500 cursor-pointer select-none hover:text-gray-700">All dashboards &amp; links</summary>
            <div className="flex flex-col gap-1.5 text-sm mt-2">
              <a href="https://eu1.make.com/organization/8159588/dashboard" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Make dashboard (social auto-posting)</a>
              <a href="https://resend.com/overview" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Resend dashboard</a>
              <a href="https://formspree.io/forms" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Formspree dashboard</a>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Stripe dashboard</a>
              <a href="https://bookshop.org/affiliates/dashboard" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Bookshop.org affiliate dashboard</a>
              <a href="https://publisher.rakutenadvertising.com/" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Kobo affiliate dashboard (Rakuten)</a>
              <a href={ZENODO_DOI_URL ?? 'https://doi.org/10.5281/zenodo.20511553'} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Zenodo dataset (concept DOI)</a>
              <a href={ZENODO_RECORD_MANAGE_URL} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ Zenodo record (manage / new version)</a>
              <a href="https://orcid.org/0009-0006-8358-7119" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand transition-colors">→ ORCID — Ludo Raedts</a>
            </div>
          </details>
        </div>

        {/* Row 3 — Data quality (full width) */}
        <DataQualityCard />

        {/* Materialized views — slim card */}
        <div className={cardCls}>
          <RefreshCw className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="font-semibold text-gray-900">Materialized views</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Pre-aggregated data for countries and stats pages.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-1">
            <dt className="text-gray-500">Data changed</dt>
            <dd className="tabular-nums text-gray-700">
              {dataLastChanged
                ? new Date(dataLastChanged).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">—</span>}
            </dd>
            <dt className="text-gray-500">Last refresh</dt>
            <dd className="tabular-nums text-gray-700">
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
            <p className={`text-xs ${refreshState === 'error' ? 'text-red-500' : 'text-green-600'}`}>
              {refreshMsg}
            </p>
          )}
        </div>

        {/* Dataset (paid download) — slim card */}
        <div className={cardCls}>
          <Download className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="font-semibold text-gray-900">Dataset Sales</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Paid downloads · regenerated when DB changes.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-1">
            <dt className="text-gray-500">Paid orders</dt>
            <dd className="tabular-nums text-gray-700">
              {datasetStats.paidOrders.toLocaleString('en')}
              {datasetStats.totalOrders > datasetStats.paidOrders && (
                <span className="text-gray-400"> ({datasetStats.totalOrders - datasetStats.paidOrders} pending)</span>
              )}
            </dd>
            <dt className="text-gray-500">Revenue</dt>
            <dd className="tabular-nums text-gray-700">
              {(datasetStats.totalRevenueCents / 100).toLocaleString('en', {
                style: 'currency',
                currency: datasetStats.currency.toUpperCase(),
              })}
            </dd>
            <dt className="text-gray-500">Downloads</dt>
            <dd className="tabular-nums text-gray-700">
              {datasetStats.totalDownloads.toLocaleString('en')}
              {datasetStats.paidOrders > 0 && (
                <span className="text-gray-400">
                  {' '}(avg {(datasetStats.totalDownloads / datasetStats.paidOrders).toFixed(1)}/order)
                </span>
              )}
            </dd>
            <dt className="text-gray-500">Data changed</dt>
            <dd className="tabular-nums text-gray-700">
              {dataLastChanged
                ? new Date(dataLastChanged).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">—</span>}
            </dd>
            <dt className="text-gray-500">Last build</dt>
            <dd className="tabular-nums text-gray-700">
              {datasetBuiltAt
                ? new Date(datasetBuiltAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
                : <span className="text-gray-400">never</span>}
            </dd>
          </dl>
          {datasetStats.suspiciousOrderCount > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 -mx-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>
                {datasetStats.suspiciousOrderCount} order{datasetStats.suspiciousOrderCount === 1 ? '' : 's'} with
                more than {datasetStats.suspiciousThreshold} downloads — link may be shared.
                Highest: {datasetStats.maxDownloadsOnSingleOrder}.
              </span>
            </div>
          )}
          {dataLastChanged && datasetBuiltAt && new Date(dataLastChanged) > new Date(datasetBuiltAt) && (
            <p className="text-xs text-amber-700">
              ⚠ Data has changed since last build — buyers will get the previous snapshot until you rebuild.
            </p>
          )}
          {isLocalDev ? (
            <>
              <button
                onClick={handleBuildDataset}
                disabled={buildDatasetState === 'loading'}
                className="mt-auto self-start px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                {buildDatasetState === 'loading' ? 'Building…' : 'Rebuild now'}
              </button>
              {buildDatasetMsg && (
                <p className={`text-xs ${buildDatasetState === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                  {buildDatasetMsg}
                </p>
              )}
            </>
          ) : (
            <p className="mt-auto text-xs text-gray-400">
              Rebuild runs locally only: <code>pnpm build:dataset</code> (spawns a child process, blocked on Vercel).
            </p>
          )}
        </div>

        <EssayPromptCard cardCls={cardCls} />

      </div>
    </main>
  )
}
