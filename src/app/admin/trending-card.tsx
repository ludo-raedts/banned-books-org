'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, TrendingUp, Users } from 'lucide-react'

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

export type AllTimeBookRow = {
  rank: number
  entityId: number
  views: number
  title: string
  slug: string
}

export type AllTimeAuthorRow = {
  rank: number
  entityId: number
  views: number
  name: string
  slug: string
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
  showRankChange,
}: {
  Icon: typeof BookOpen
  label: string
  items: { entityId: number; rank: number; views: number; slug: string; lastWeekRank?: number | null; title?: string; name?: string }[]
  linkPrefix: string
  nameKey: 'title' | 'name'
  showRankChange: boolean
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        <span>{label}</span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No data yet.</p>
      ) : (
        <div className="flex flex-col">
          {items.map(item => (
            <Link
              key={item.entityId}
              href={`/${linkPrefix}/${item.slug}`}
              className="group flex items-baseline gap-3 py-1 px-2 -mx-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs text-gray-400 tabular-nums shrink-0 w-5 text-center leading-none">{item.rank}</span>
              <span className="flex-1 min-w-0 text-sm text-gray-700 truncate group-hover:text-brand">
                {item[nameKey]}
              </span>
              <span className="text-xs text-gray-500 tabular-nums shrink-0">
                {item.views.toLocaleString('en')}
              </span>
              {showRankChange && (
                <RankChange thisWeekRank={item.rank} lastWeekRank={item.lastWeekRank ?? null} />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TrendingCard({
  trendingBooks,
  trendingAuthors,
  allTimeBooks,
  allTimeAuthors,
  firstViewDate,
  cardCls,
}: {
  trendingBooks: TrendingBookRow[]
  trendingAuthors: TrendingAuthorRow[]
  allTimeBooks: AllTimeBookRow[]
  allTimeAuthors: AllTimeAuthorRow[]
  firstViewDate: string | null
  cardCls: string
}) {
  const [range, setRange] = useState<'week' | 'all'>('week')

  const books = range === 'week' ? trendingBooks : allTimeBooks
  const authors = range === 'week' ? trendingAuthors : allTimeAuthors
  const isEmpty = books.length === 0 && authors.length === 0

  return (
    <div className={`${cardCls} col-span-full`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <h2 className="font-semibold text-gray-900">
              {range === 'week' ? 'Trending this week' : 'Trending all time'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {range === 'week' ? 'Most visited in the last 7 days.' : 'Most visited since tracking began.'}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {(['week', 'all'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r === 'week' ? 'This week' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-400 italic mt-1">
          No data yet. Views appear once the site receives production traffic.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mt-1">
          <TrendingSection
            Icon={BookOpen}
            label="Books"
            items={books}
            linkPrefix="books"
            nameKey="title"
            showRankChange={range === 'week'}
          />
          <TrendingSection
            Icon={Users}
            label="Authors"
            items={authors}
            linkPrefix="authors"
            nameKey="name"
            showRankChange={range === 'week'}
          />
        </div>
      )}

      {firstViewDate && (
        <p className="text-xs text-gray-400 mt-auto">
          Tracking since:{' '}
          {new Date(firstViewDate).toLocaleDateString('en', {
            year: 'numeric', month: 'short', day: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
