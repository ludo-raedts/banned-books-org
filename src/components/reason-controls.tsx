'use client'

import { useRouter, usePathname } from 'next/navigation'

type Current = {
  country: string
  year: string
  active: boolean
  sort: string
}

type Props = {
  current: Current
  countries: { code: string; name: string }[]
  years: number[]
  totalBooks: number
  filteredBooks: number
}

const pill = (active: boolean) =>
  `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
    active
      ? 'bg-brand text-white border-brand'
      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
  }`

const select = 'text-xs border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors'

export default function ReasonControls({ current, countries, years, totalBooks, filteredBooks }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function update(patch: Partial<Current>) {
    const next = { ...current, ...patch }
    const p = new URLSearchParams()
    if (next.country) p.set('country', next.country)
    if (next.year) p.set('year', next.year)
    if (next.active) p.set('active', '1')
    if (next.sort && next.sort !== 'bans') p.set('sort', next.sort)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const hasFilter = !!(current.country || current.year || current.active)
  const isFiltered = filteredBooks < totalBooks

  return (
    <div className="space-y-2 mb-6">
      {/* Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium w-10 shrink-0">Sort:</span>
        {[
          { value: 'bans', label: 'Ban count' },
          { value: 'title', label: 'Title' },
          { value: 'year', label: 'Year' },
        ].map(({ value, label }) => (
          <button key={value} onClick={() => update({ sort: value })} className={pill(current.sort === value)}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium w-10 shrink-0">Filter:</span>

        {/* Country dropdown */}
        <select
          value={current.country}
          onChange={e => update({ country: e.target.value })}
          className={select}
        >
          <option value="">All countries</option>
          {countries.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>

        {/* Year dropdown */}
        <select
          value={current.year}
          onChange={e => update({ year: e.target.value })}
          className={select}
        >
          <option value="">All years</option>
          {years.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        {/* Active only toggle */}
        <button onClick={() => update({ active: !current.active })} className={pill(current.active)}>
          🚫 Active bans only
        </button>

        {hasFilter && (
          <button
            onClick={() => update({ country: '', year: '', active: false })}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {isFiltered && (
        <p className="text-xs text-brand">
          Showing {filteredBooks.toLocaleString()} of {totalBooks.toLocaleString()} books
        </p>
      )}
    </div>
  )
}
