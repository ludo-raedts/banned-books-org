'use client'

import { useState } from 'react'
import { Map as MapIcon } from 'lucide-react'

const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-3 bg-white dark:bg-gray-900'

type LastSubmission = {
  submittedAt: string
  kind: 'full' | 'delta'
  urlCount: number
} | null

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const day = 86_400_000
  if (diffMs < day) return 'today'
  if (diffMs < 2 * day) return 'yesterday'
  const days = Math.floor(diffMs / day)
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export default function SitemapClient({
  sitemapCounts,
  lastSubmission,
}: {
  sitemapCounts: {
    static: number
    books: number
    authors: number
    countries: number
    reasons: number
  }
  lastSubmission: LastSubmission
}) {
  const [indexNowState, setIndexNowState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [indexNowMsg, setIndexNowMsg] = useState('')
  const [deltaState, setDeltaState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [deltaMsg, setDeltaMsg] = useState('')

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

  async function handleIndexNowDelta() {
    setDeltaState('loading')
    setDeltaMsg('')
    try {
      const res = await fetch('/api/admin/indexnow-delta', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.total === 0) {
        setDeltaMsg(data.message ?? 'No new pages since last successful submission.')
        setDeltaState('done')
        return
      }
      type BatchResult = { ok: boolean; status: number; error?: string; count: number }
      const results: BatchResult[] = data.results ?? []
      const failed = results.filter((r) => !r.ok)
      const staticPages: number = data.staticPages ?? 0
      const breakdownParts = [
        `${data.books} book${data.books === 1 ? '' : 's'}`,
        `${data.authors} author${data.authors === 1 ? '' : 's'}`,
        ...(staticPages > 0 ? [`${staticPages} landing page${staticPages === 1 ? '' : 's'}`] : []),
      ]
      const detail = `${data.total} new URL${data.total === 1 ? '' : 's'} (${breakdownParts.join(', ')})`
      if (failed.length > 0) {
        const first = failed[0]
        setDeltaMsg(`${detail} — ${failed.length} batch failed. Upstream: HTTP ${first.status} ${first.error ?? ''}`.trim())
        setDeltaState('error')
      } else {
        setDeltaMsg(`Submitted ${detail}.`)
        setDeltaState('done')
      }
    } catch (err) {
      setDeltaMsg(err instanceof Error ? err.message : 'Failed')
      setDeltaState('error')
    }
  }

  return (
    <div className={cardCls}>
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

      <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">IndexNow</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {lastSubmission
            ? (
              <>
                Last submitted{' '}
                <span title={new Date(lastSubmission.submittedAt).toLocaleString('en')}>
                  {formatRelative(lastSubmission.submittedAt)}
                </span>{' '}
                — {lastSubmission.urlCount.toLocaleString('en')} URLs ({lastSubmission.kind}).
              </>
            )
            : 'No successful submissions recorded yet.'}
        </p>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleIndexNowDelta}
            disabled={deltaState === 'loading'}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {deltaState === 'loading' ? 'Submitting…' : 'Submit new pages'}
          </button>
          <button
            onClick={handleIndexNowBulk}
            disabled={indexNowState === 'loading'}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {indexNowState === 'loading' ? 'Submitting…' : 'Resubmit all'}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          &ldquo;Submit new pages&rdquo; pings books/authors added since the last successful submission, plus any landing pages added to the static sitemap entries since then.
          &ldquo;Resubmit all&rdquo; pings every canonical URL — use sparingly (rate-limited).
        </p>

        {deltaMsg && (
          <p className={`text-xs mt-1 ${deltaState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
            {deltaMsg}
          </p>
        )}
        {indexNowMsg && (
          <p className={`text-xs mt-1 ${indexNowState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
            {indexNowMsg}
          </p>
        )}
      </div>
    </div>
  )
}
