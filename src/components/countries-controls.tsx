'use client'

import { useRouter, usePathname } from 'next/navigation'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'

type Current = { sort: string; reason: string; active: boolean }

type Props = {
  reasons: string[]
  current: Current
}

export default function CountriesControls({ reasons, current }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function update(patch: Partial<Current>) {
    const next = { ...current, ...patch }
    const p = new URLSearchParams()
    if (next.sort && next.sort !== 'volume') p.set('sort', next.sort)
    if (next.reason) p.set('reason', next.reason)
    if (next.active) p.set('active', '1')
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const hasFilter = !!(current.reason || current.active)

  return (
    <div className="space-y-2 mb-5">
      {/* Sort row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium w-12 shrink-0">Sort:</span>
        <button
          onClick={() => update({ sort: 'volume' })}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            current.sort !== 'alpha'
              ? 'bg-brand text-white border-brand'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          By volume
        </button>
        <button
          onClick={() => update({ sort: 'alpha' })}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            current.sort === 'alpha'
              ? 'bg-brand text-white border-brand'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          Alphabetical
        </button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium w-12 shrink-0">Filter:</span>

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

        <span className="text-gray-200 dark:text-gray-700 select-none hidden sm:block">|</span>

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

        {hasFilter && (
          <button
            onClick={() => update({ reason: '', active: false })}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
