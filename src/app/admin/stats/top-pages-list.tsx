'use client'

import { useState } from 'react'
import Link from '@/components/link'
import type { TopPageRow } from './data'

// Tabs over the already-fetched top pages. The homepage and /search sit at the
// top of any unfiltered list (every visit counts there), which pushed the books
// down; "Books & authors" is the default so the content people actually read
// leads, with the hub/site pages one click away.
type Tab = 'content' | 'hub' | 'all'
const TABS: { key: Tab; label: string }[] = [
  { key: 'content', label: 'Books & authors' },
  { key: 'hub', label: 'Countries, reasons & site pages' },
  { key: 'all', label: 'All' },
]
const SHOWN = 25

const nf = (n: number) => n.toLocaleString('en')

export default function TopPagesList({ pages }: { pages: TopPageRow[] }) {
  const [tab, setTab] = useState<Tab>('content')

  const counts: Record<Tab, number> = {
    content: pages.filter(p => p.kind === 'content').length,
    hub: pages.filter(p => p.kind === 'hub').length,
    all: pages.length,
  }
  // Fall back to "All" when the default tab is empty (e.g. a filter whose
  // visitors only viewed hub pages).
  const active: Tab = counts[tab] === 0 ? 'all' : tab
  const shown = (active === 'all' ? pages : pages.filter(p => p.kind === active)).slice(0, SHOWN)
  const max = shown[0]?.pageviews ?? 1

  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
      on ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            aria-pressed={active === t.key}
            onClick={() => setTab(t.key)}
            className={chip(active === t.key)}
          >
            {t.label} <span className="opacity-60 tabular-nums">{counts[t.key]}</span>
          </button>
        ))}
      </div>
      <ol className="flex flex-col gap-0.5 mt-1">
        {shown.map((p, i) => (
          <li key={p.path}>
            <Link
              href={p.href}
              className="group grid grid-cols-[1.5rem_minmax(0,1fr)_8rem_3.5rem] items-center gap-3 rounded-md px-2 py-1 -mx-2 text-xs hover:bg-gray-50"
            >
              <span className="text-gray-400 tabular-nums text-center">{i + 1}</span>
              <span className="truncate text-gray-700 group-hover:text-brand">
                {p.label}
                {p.label !== p.href && <span className="ml-2 text-gray-400">{p.href}</span>}
              </span>
              <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[#2a78d6]"
                  style={{ width: `${Math.max(2, Math.round((p.pageviews / max) * 100))}%` }}
                />
              </span>
              <span className="text-gray-900 font-medium tabular-nums text-right">{nf(p.pageviews)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  )
}
