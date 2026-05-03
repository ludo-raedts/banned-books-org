'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, RefreshCw } from 'lucide-react'

type Metric = {
  key: string
  label: string
  type: 'ban' | 'book'
  count: number
  total: number
}

type CountsData = {
  totalBans: number
  totalBooks: number
  metrics: Metric[]
}

type BanDetailRow = {
  ban_id: number; book_title: string; book_slug: string
  author: string; country_code: string; year_started: number | null
}
type BookDetailRow = {
  book_id: number; title: string; slug: string
  author: string; ban_count: number; created_at: string | null
}
type DupDetailRow = {
  title: string; slug: string; author: string; count: number; first_created_at: string | null
}

type DetailData = {
  rows: (BanDetailRow | BookDetailRow | DupDetailRow)[]
  total: number
  type: 'ban' | 'book' | 'duplicates' | 'unknown'
}

function pct(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

function priorityFor(p: number) {
  if (p >= 30) return {
    border: 'border-l-4 border-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    label: 'Critical',
  }
  if (p >= 10) return {
    border: 'border-l-4 border-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    label: 'Needs attention',
  }
  return {
    border: 'border-l-4 border-green-400',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    label: 'Good',
  }
}

function healthLabel(score: number) {
  if (score >= 90) return { text: 'Excellent', cls: 'text-green-600 dark:text-green-400' }
  if (score >= 70) return { text: 'Good', cls: 'text-blue-600 dark:text-blue-400' }
  if (score >= 50) return { text: 'Fair', cls: 'text-orange-500 dark:text-orange-400' }
  return { text: 'Poor', cls: 'text-red-600 dark:text-red-400' }
}

function downloadCsv(rows: DetailData['rows'], metricKey: string, detailType: DetailData['type']) {
  const date = new Date().toISOString().slice(0, 10)
  const filename = `quality_${metricKey}_${date}.csv`

  let header: string
  let toRow: (r: any) => string[]

  if (detailType === 'ban') {
    header = 'ban_id,book_title,book_slug,author,country_code,year_started'
    toRow = (r: BanDetailRow) => [
      String(r.ban_id), r.book_title, r.book_slug, r.author, r.country_code, String(r.year_started ?? ''),
    ]
  } else if (detailType === 'duplicates') {
    header = 'title,slug,author,count,first_added'
    toRow = (r: DupDetailRow) => [r.title, r.slug, r.author, String(r.count), r.first_created_at ?? '']
  } else {
    header = 'book_id,title,slug,author,ban_count,created_at'
    toRow = (r: BookDetailRow) => [
      String(r.book_id), r.title, r.slug, r.author, String(r.ban_count), r.created_at ?? '',
    ]
  }

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = [header, ...rows.map(r => toRow(r).map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function BanDetailTable({ rows, metric }: { rows: BanDetailRow[]; metric: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Book title', 'Author', 'Country', 'Year', 'Edit'].map(h => (
              <th key={h} className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ban_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 px-3 font-medium">{r.book_title}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.author || '—'}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.country_code}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.year_started ?? '—'}</td>
              <td className="py-2 px-3">
                {r.book_slug && (
                  <a href={`/admin/books/${r.book_slug}`} className="text-brand hover:underline">Edit →</a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BookDetailTable({ rows }: { rows: BookDetailRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Title', 'Author', 'Bans', 'Added', 'Edit'].map(h => (
              <th key={h} className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.book_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 px-3 font-medium">{r.title}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.author || '—'}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400 tabular-nums">{r.ban_count}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                {r.created_at ? new Date(r.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </td>
              <td className="py-2 px-3">
                <a href={`/admin/books/${r.slug}`} className="text-brand hover:underline">Edit →</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DupDetailTable({ rows }: { rows: DupDetailRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Title', 'Author', 'Count', 'First added', 'View'].map(h => (
              <th key={h} className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 px-3 font-medium">{r.title}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.author || '—'}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400 tabular-nums">{r.count}</td>
              <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                {r.first_created_at ? new Date(r.first_created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </td>
              <td className="py-2 px-3">
                <a href={`/admin/books/${r.slug}`} className="text-brand hover:underline">View all →</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataQualityCard() {
  const [data, setData] = useState<CountsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fetchCounts = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/data-quality', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  async function handleMetricClick(key: string) {
    if (activeMetric === key) {
      setActiveMetric(null)
      setDetail(null)
      return
    }
    setActiveMetric(key)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/data-quality?detail=${key}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDetail(await res.json())
    } finally {
      setDetailLoading(false)
    }
  }

  const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-3 bg-white dark:bg-gray-900'

  if (loading) {
    return (
      <div className={`${cardCls} col-span-2`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Data Quality</h2>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">Loading quality metrics…</p>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className={`${cardCls} col-span-2`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Data Quality</h2>
        </div>
        <p className="text-sm text-red-500">{err ?? 'Unknown error'}</p>
        <button onClick={fetchCounts} className="text-sm text-brand hover:underline w-fit">Retry</button>
      </div>
    )
  }

  // Sort metrics by pct descending
  const sorted = [...data.metrics].sort((a, b) => pct(b.count, b.total) - pct(a.count, a.total))

  // Health score = average of all (100 - pct)
  const healthScore = sorted.length === 0 ? 100
    : Math.round(sorted.reduce((sum, m) => sum + (100 - pct(m.count, m.total)), 0) / sorted.length)
  const health = healthLabel(healthScore)

  return (
    <div className={`${cardCls} col-span-2`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Data Quality</h2>
        </div>
        <button
          onClick={() => { setActiveMetric(null); setDetail(null); fetchCounts() }}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Health score */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Data health:</span>
        <span className={`text-sm font-bold tabular-nums ${health.cls}`}>{healthScore}%</span>
        <span className={`text-sm font-medium ${health.cls}`}>— {health.text}</span>
      </div>

      {/* Metric rows */}
      <div className="flex flex-col gap-1 mt-1">
        {sorted.map(m => {
          const p = pct(m.count, m.total)
          const priority = priorityFor(p)
          const isActive = activeMetric === m.key

          return (
            <div key={m.key}>
              <button
                onClick={() => handleMetricClick(m.key)}
                className={`w-full text-left pl-3 pr-4 py-2.5 rounded-lg ${priority.border}
                  bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800
                  transition-colors flex items-center justify-between gap-4
                  ${isActive ? 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600' : ''}`}
              >
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 min-w-0 truncate">{m.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
                    {m.count.toLocaleString()}
                    <span className="text-gray-400 dark:text-gray-500 ml-1">({p}%)</span>
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.badge}`}>
                    {priority.label}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs">{isActive ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Inline detail panel */}
              {isActive && (
                <div className="mt-1 mb-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {detailLoading ? 'Loading…' : detail ? `Showing ${(detail.rows as any[]).length} of ${detail.total}` : ''}
                    </span>
                    {detail && (detail.rows as any[]).length > 0 && (
                      <button
                        onClick={() => downloadCsv(detail.rows as any, m.key, detail.type)}
                        className="text-xs text-brand hover:underline"
                      >
                        Download CSV
                      </button>
                    )}
                  </div>

                  <div className="p-2">
                    {detailLoading && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 p-3 animate-pulse">Loading detail…</p>
                    )}
                    {!detailLoading && detail && (detail.rows as any[]).length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 p-3">No records found.</p>
                    )}
                    {!detailLoading && detail && (detail.rows as any[]).length > 0 && (
                      <>
                        {detail.type === 'ban' && (
                          <BanDetailTable rows={detail.rows as BanDetailRow[]} metric={m.key} />
                        )}
                        {detail.type === 'book' && (
                          <BookDetailTable rows={detail.rows as BookDetailRow[]} />
                        )}
                        {detail.type === 'duplicates' && (
                          <DupDetailTable rows={detail.rows as DupDetailRow[]} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
