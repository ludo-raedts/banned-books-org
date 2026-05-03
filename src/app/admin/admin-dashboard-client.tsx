'use client'

import { useState } from 'react'
import { BookOpen, Newspaper, BarChart2, Zap } from 'lucide-react'
import DataQualityCard from './data-quality-card'

interface Props {
  bookCount: number
  newsCount: number
  banCount: number
  countryCount: number
  noCoverCount: number
  noDescCount: number
}

export default function AdminDashboardClient({
  bookCount, newsCount, banCount, countryCount, noCoverCount, noDescCount,
}: Props) {
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [fetchMsg, setFetchMsg] = useState('')

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
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">banned-books.org</p>
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Books */}
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
          <p className="text-xs text-gray-400 dark:text-gray-500">{bookCount.toLocaleString()} books in database</p>
          <span className="text-sm text-brand font-medium group-hover:underline mt-auto">Manage books →</span>
        </a>

        {/* News */}
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

        {/* Database stats */}
        <div className={cardCls}>
          <BarChart2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Database</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Current catalogue size.</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-1">
            <dt className="text-gray-500 dark:text-gray-400">Books</dt>
            <dd className="tabular-nums font-medium">{bookCount.toLocaleString()}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Bans</dt>
            <dd className="tabular-nums font-medium">{banCount.toLocaleString()}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Countries</dt>
            <dd className="tabular-nums font-medium">{countryCount}</dd>
            <dt className="text-gray-500 dark:text-gray-400">No cover</dt>
            <dd className="tabular-nums font-medium">{noCoverCount.toLocaleString()}</dd>
            <dt className="text-gray-500 dark:text-gray-400">No description</dt>
            <dd className="tabular-nums font-medium">{noDescCount.toLocaleString()}</dd>
          </dl>
        </div>

        {/* Data quality — spans full row */}
        <DataQualityCard />

        {/* Quick actions */}
        <div className={cardCls}>
          <Zap className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Quick actions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Common tasks.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm mt-1">
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

      </div>
    </main>
  )
}
