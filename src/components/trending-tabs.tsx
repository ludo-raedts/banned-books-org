'use client'

import { useState } from 'react'

export default function TrendingTabs({
  trendingSlot,
  risingSlot,
}: {
  trendingSlot: React.ReactNode
  risingSlot: React.ReactNode
}) {
  const [tab, setTab] = useState<'trending' | 'rising'>('trending')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0.5 mb-3 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 bg-gray-100 dark:bg-gray-800/60">
        <button
          onClick={() => setTab('trending')}
          className={`flex-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
            tab === 'trending'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          All time
        </button>
        <button
          onClick={() => setTab('rising')}
          className={`flex-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
            tab === 'rising'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          This week ↑
        </button>
      </div>

      {/* Content */}
      <div className={tab === 'trending' ? '' : 'hidden'}>{trendingSlot}</div>
      <div className={tab === 'rising' ? '' : 'hidden'}>{risingSlot}</div>
    </div>
  )
}
