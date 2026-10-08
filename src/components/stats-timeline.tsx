'use client'

// "Bans Through History" timeline for /stats. The page is static (ISR); the
// filters (country / reason / active) are applied here against the compact
// pre-aggregated groups from the server, and mirrored to the URL via
// replaceState so filtered views stay shareable. Server HTML = unfiltered view.

import { useEffect, useState } from 'react'
import StatsFilters, { type StatsFilterValues } from '@/components/stats-filters'

export type TimelineGroup = {
  country: string
  decade: number | null // null = no usable year (missing or < 1000)
  active: boolean
  reasons: number[] // indices into reasonSlugs
  count: number
}

const CURRENT_DECADE = Math.floor(new Date().getFullYear() / 10) * 10
const NO_FILTER: StatsFilterValues = { country: '', reason: '', active: false }

export default function StatsTimeline({
  timelineGroups: allGroups,
  reasonSlugs,
  countryOptions,
}: {
  timelineGroups: TimelineGroup[]
  reasonSlugs: string[]
  countryOptions: { code: string; name: string }[]
}) {
  const [filters, setFilters] = useState<StatsFilterValues>(NO_FILTER)
  const { country: filterCountry, reason: filterReason, active: filterActive } = filters

  // Deep links (?country=&reason=&active=1) apply after hydration so the first
  // client render matches the server HTML.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const reason = p.get('reason') ?? ''
    const country = p.get('country') ?? ''
    const next: StatsFilterValues = {
      country: countryOptions.some(c => c.code === country) ? country : '',
      reason: reasonSlugs.includes(reason) ? reason : '',
      active: p.get('active') === '1',
    }
    if (next.country || next.reason || next.active) setFilters(next)
  }, [countryOptions, reasonSlugs])

  function onChange(next: StatsFilterValues) {
    setFilters(next)
    const p = new URLSearchParams()
    if (next.country) p.set('country', next.country)
    if (next.reason) p.set('reason', next.reason)
    if (next.active) p.set('active', '1')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }

  // ── Timeline: apply filters, then bucket by decade ─────────────────
  const reasonFilterIdx = filterReason ? reasonSlugs.indexOf(filterReason) : -1
  let timelineGroups = allGroups
  if (filterCountry) timelineGroups = timelineGroups.filter((g) => g.country === filterCountry)
  if (filterReason)  timelineGroups = timelineGroups.filter((g) => reasonFilterIdx !== -1 && g.reasons.includes(reasonFilterIdx))
  if (filterActive)  timelineGroups = timelineGroups.filter((g) => g.active)

  const isFiltered = !!(filterCountry || filterReason || filterActive)

  const decadeCounts = new Map<number, number>()
  let matchingBans = 0
  let timelineWithoutYear = 0
  for (const g of timelineGroups) {
    matchingBans += g.count
    if (g.decade === null) { timelineWithoutYear += g.count; continue }
    decadeCounts.set(g.decade, (decadeCounts.get(g.decade) ?? 0) + g.count)
  }
  const decades = [...decadeCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ decade, count }))
  const maxDecade = Math.max(...decades.map((d) => d.count), 1)

  // Log scale so small historical eras stay visible next to the 2020s peak.
  // log10(count + 1) keeps count=1 at 0 and avoids -Infinity for count=0.
  const TIMELINE_PX = 112
  const logMax = Math.log10(maxDecade + 1)
  const logHeight = (count: number) =>
    Math.max(Math.round((Math.log10(count + 1) / logMax) * TIMELINE_PX), 4)

  // Gridlines at each power of 10 up to (and including) the next one above max.
  const gridTicks: number[] = []
  for (let exp = 0; 10 ** exp <= maxDecade * 10; exp++) {
    const v = 10 ** exp
    if (v <= 1 || v > maxDecade * 1.5) continue
    gridTicks.push(v)
  }

  // Color buckets so the log-flattened bars still carry a "much / little" signal.
  const TIMELINE_BUCKETS = [
    { max: 10,     label: '< 10',     bar: 'bg-red-200', swatch: 'bg-red-200' },
    { max: 100,    label: '< 100',    bar: 'bg-red-300', swatch: 'bg-red-300' },
    { max: 500,    label: '< 500',    bar: 'bg-red-400', swatch: 'bg-red-400' },
    { max: 1000,   label: '< 1,000',  bar: 'bg-red-500', swatch: 'bg-red-500' },
    { max: 10000,  label: '< 10,000', bar: 'bg-red-700', swatch: 'bg-red-700' },
    { max: Infinity, label: '≥ 10,000', bar: 'bg-red-900', swatch: 'bg-red-900' },
  ] as const
  const bucketFor = (count: number) => TIMELINE_BUCKETS.find((b) => count < b.max) ?? TIMELINE_BUCKETS[TIMELINE_BUCKETS.length - 1]

  return (
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Bans Through History</h2>
        <p className="text-sm text-gray-500 mb-4">
          From the Catholic Index Librorum Prohibitorum (1559) to today&apos;s school board removals.
          Bars use a <span className="font-medium">logarithmic scale</span> — each gridline is a 10× increase, so earlier eras stay visible alongside the 2020s peak.
          {timelineWithoutYear > 0 && (
            <> {timelineWithoutYear.toLocaleString('en')} bans with no recorded year are excluded.</>
          )}
        </p>

        {/* Timeline filter */}
        <StatsFilters
          countries={countryOptions}
          reasons={reasonSlugs}
          current={{ country: filterCountry, reason: filterReason, active: filterActive }}
          onChange={onChange}
        />
        {isFiltered && (
          <p className="text-xs text-brand mb-4">
            Showing {matchingBans.toLocaleString('en')} ban{matchingBans !== 1 ? 's' : ''} matching your filters.
          </p>
        )}

        <div className="flex items-stretch">
          {/* Y-axis (sticky, outside the horizontal scroll) */}
          <div
            className="relative shrink-0 pr-2 select-none"
            style={{ width: '3rem', height: `${TIMELINE_PX + 32}px` }}
            aria-hidden
          >
            {gridTicks.map(v => {
              const y = Math.round((Math.log10(v + 1) / logMax) * TIMELINE_PX * 10) / 10 // rounded: float text must match server HTML
              return (
                <span
                  key={v}
                  className="absolute right-2 text-[10px] tabular-nums text-gray-400 leading-none"
                  style={{ bottom: `${y + 16}px`, transform: 'translateY(50%)' }}
                >
                  {v >= 1000 ? `${v / 1000}k` : v}
                </span>
              )
            })}
          </div>

          <div className="flex-1 overflow-x-auto pb-1" dir="rtl">
            <div
              className="relative inline-flex items-end gap-1 min-w-max"
              style={{ height: `${TIMELINE_PX + 32}px` }}
              dir="ltr"
            >
              {/* Gridlines spanning the full chart width */}
              {gridTicks.map(v => {
                const y = Math.round((Math.log10(v + 1) / logMax) * TIMELINE_PX * 10) / 10 // rounded: float text must match server HTML
                return (
                  <div
                    key={v}
                    className="absolute inset-x-0 border-t border-dashed border-gray-200 pointer-events-none"
                    style={{ bottom: `${y + 16}px` }}
                  />
                )
              })}

              {decades.map((d, i) => {
                const isOngoing = d.decade === CURRENT_DECADE
                const barH = logHeight(d.count)
                const labelClass = i % 2 === 0
                  ? 'text-[10px] text-gray-400 tabular-nums'
                  : 'text-[10px] text-gray-400 tabular-nums hidden md:block'
                const bucket = bucketFor(d.count)
                return (
                  <div key={d.decade} className="flex flex-col items-center shrink-0 relative z-10" style={{ width: '2.5rem' }}>
                    <div className="flex-1 flex items-end relative w-full justify-center">
                      <div
                        className={`w-8 rounded-t transition-all ${bucket.bar} ${isOngoing ? 'ring-2 ring-brand ring-offset-1 ring-offset-white' : ''}`}
                        style={{ height: `${barH}px` }}
                        title={`${d.decade}s: ${d.count.toLocaleString('en')} ban${d.count !== 1 ? 's' : ''}${isOngoing ? ' (ongoing)' : ''}`}
                      />
                      {/* Count label anchored just above the bar */}
                      <span
                        className="absolute text-[9px] tabular-nums leading-none pointer-events-none select-none text-gray-500"
                        style={{ bottom: `${barH + 3}px` }}
                      >
                        {d.count.toLocaleString('en')}
                      </span>
                    </div>
                    <span className={labelClass}>{d.decade}s</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Color-bucket legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="uppercase tracking-wide text-gray-400">Bans per decade:</span>
          {TIMELINE_BUCKETS.map(b => (
            <span key={b.label} className="inline-flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-sm ${b.swatch}`} aria-hidden />
              <span className="tabular-nums">{b.label}</span>
            </span>
          ))}
        </div>
      </section>
  )
}
