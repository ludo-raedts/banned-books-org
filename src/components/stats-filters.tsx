'use client'

import { useRouter, usePathname } from 'next/navigation'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'

export type StatsFilterValues = {
  country: string
  reason: string
  active: boolean
}

type Props = {
  countries: { code: string; name: string }[]
  reasons: string[]
  current: StatsFilterValues
}

export default function StatsFilters({ countries, reasons, current }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function update(patch: Partial<StatsFilterValues>) {
    const next = { ...current, ...patch }
    const p = new URLSearchParams()
    if (next.country) p.set('country', next.country)
    if (next.reason) p.set('reason', next.reason)
    if (next.active) p.set('active', '1')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const hasFilter = !!(current.country || current.reason || current.active)

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm mb-10">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 font-medium uppercase tracking-wide">Filter:</span>

      {/* Active-only toggle */}
      <button
        onClick={() => update({ active: !current.active })}
        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
          current.active
            ? 'bg-brand text-white border-brand'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        🚫 Active bans only
      </button>

      {/* Country dropdown */}
      <select
        value={current.country}
        onChange={(e) => update({ country: e.target.value })}
        className={`px-3 py-1 rounded-full text-xs border bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer transition-colors ${
          current.country
            ? 'border-brand text-brand font-medium'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>

      <span className="text-gray-200 dark:text-gray-700 select-none hidden sm:block">|</span>

      {/* Reason pills */}
      {reasons.map((slug) => (
        <button
          key={slug}
          onClick={() => update({ reason: current.reason === slug ? '' : slug })}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            current.reason === slug
              ? 'bg-brand text-white border-brand'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <span aria-hidden>{reasonIcon(slug)}</span> {reasonLabel(slug)}
        </button>
      ))}

      {/* Clear all */}
      {hasFilter && (
        <button
          onClick={() => router.push(pathname)}
          className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
