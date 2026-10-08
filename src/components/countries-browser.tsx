'use client'

// Client-side filtering for /countries. The page itself is static (ISR) — all
// filter data (≈90 countries × 12 reasons of pre-aggregated counts) ships in
// the payload and sort/era/reason/active are applied here, so no request ever
// needs a server render. State mirrors the URL (?sort=&reason=&active=&era=)
// via history.replaceState so filtered views stay shareable; the server HTML
// is always the default view (canonical /countries).

import { useEffect, useState } from 'react'
import Link from '@/components/link'
import CountriesControls, { type Current } from '@/components/countries-controls'

const DEFUNCT = ['SU', 'CS', 'DD', 'YU']

export type CountryRow = { code: string; name_en: string }
export type BanCountRow = {
  country_code: string
  distinct_books: number
  distinct_active_books: number
  distinct_books_historical: number
  distinct_books_contemporary: number
}

function countryFlag(code: string): string {
  if (DEFUNCT.includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

const DEFAULT: Current = { sort: 'volume', reason: '', active: false, era: '' }

function readUrl(reasons: string[]): Current {
  const p = new URLSearchParams(window.location.search)
  const era = p.get('era')
  const reason = p.get('reason') ?? ''
  return {
    sort: p.get('sort') === 'alpha' ? 'alpha' : 'volume',
    reason: reasons.includes(reason) ? reason : '',
    active: p.get('active') === '1',
    era: era === 'historical' || era === 'contemporary' ? era : '',
  }
}

export default function CountriesBrowser({
  countries,
  banCounts,
  reasonCounts,
  reasons,
}: {
  countries: CountryRow[]
  banCounts: BanCountRow[]
  reasonCounts: Record<string, BanCountRow[]>
  reasons: string[]
}) {
  const [cur, setCur] = useState<Current>(DEFAULT)

  // Deep links (?reason=…) are applied after hydration so the server HTML
  // (default view) always matches the first client render.
  useEffect(() => {
    const fromUrl = readUrl(reasons)
    if (JSON.stringify(fromUrl) !== JSON.stringify(DEFAULT)) setCur(fromUrl)
  }, [reasons])

  function onChange(next: Current) {
    setCur(next)
    const p = new URLSearchParams()
    if (next.sort !== 'volume') p.set('sort', next.sort)
    if (next.reason) p.set('reason', next.reason)
    if (next.active) p.set('active', '1')
    if (next.era) p.set('era', next.era)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }

  const isAlpha = cur.sort === 'alpha'
  const eraFilter = cur.era
  const eraCount = (r: BanCountRow) =>
    eraFilter === 'historical' ? r.distinct_books_historical
    : eraFilter === 'contemporary' ? r.distinct_books_contemporary
    : r.distinct_books

  // Source rows: all-reasons view, or the selected reason's pre-aggregated rows.
  const rows = new Map((cur.reason ? (reasonCounts[cur.reason] ?? []) : banCounts).map(r => [r.country_code, r]))
  const total = new Map(banCounts.map(r => [r.country_code, r.distinct_books]))

  const visible = countries
    .filter(c => (total.get(c.code) ?? 0) > 0)
    .map(c => {
      const r = rows.get(c.code)
      return { ...c, displayCount: r ? eraCount(r) : 0, displayActive: r?.distinct_active_books ?? 0 }
    })
    .filter(c => c.displayCount > 0)
    .filter(c => !cur.active || c.displayActive > 0)

  const sorted = [...visible].sort(isAlpha
    ? (a, b) => a.name_en.localeCompare(b.name_en)
    : (a, b) => b.displayCount - a.displayCount
  )
  const maxCount = sorted[0] ? Math.max(...sorted.map(c => c.displayCount)) : 1
  const activeCountries = sorted.filter(c => !DEFUNCT.includes(c.code))
  const historicalCountries = sorted.filter(c => DEFUNCT.includes(c.code))
  const isFiltered = !!(cur.reason || cur.active || cur.era)

  return (
    <>
      <CountriesControls reasons={reasons} current={cur} onChange={onChange} />

      {isFiltered && (
        <p className="text-xs text-brand mb-4">
          Showing {activeCountries.length + historicalCountries.length} countr{activeCountries.length + historicalCountries.length !== 1 ? 'ies' : 'y'} matching your filters.
        </p>
      )}

      {/* Country list */}
      <div className="space-y-1.5 mb-12">
        {activeCountries.map((c, i) => (
          <Link key={c.code} href={`/countries/${c.code.toLowerCase()}`} className="flex items-center gap-2 group py-1 rounded-lg hover:bg-gray-50 px-2 -mx-2 transition-colors">
            {isAlpha
              ? <span className="w-6 shrink-0" />
              : <span className="w-6 text-right text-xs text-gray-400 tabular-nums shrink-0">{i + 1}</span>
            }
            <span className="text-xl leading-none shrink-0 w-8">{countryFlag(c.code)}</span>
            <span className="w-44 shrink-0 text-sm font-medium text-gray-800 group-hover:underline truncate">{c.name_en}</span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div
                className="h-4 rounded bg-red-400 shrink-0"
                style={{ width: `${(c.displayCount / maxCount * 100).toFixed(1)}%`, maxWidth: 'calc(100% - 2.5rem)', minWidth: '3px' }}
              />
              <span className="text-xs tabular-nums text-gray-500 shrink-0">{c.displayCount}</span>
            </div>
            <span className="w-20 text-right shrink-0 text-xs text-red-500 tabular-nums">
              {!eraFilter && c.displayActive > 0 ? `${c.displayActive} active` : ''}
            </span>
          </Link>
        ))}
      </div>

      {historicalCountries.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Defunct states
          </h2>
          <div className="space-y-1.5 mb-10">
            {historicalCountries.map(c => (
              <Link key={c.code} href={`/countries/${c.code.toLowerCase()}`} className="flex items-center gap-3 group py-1 rounded-lg hover:bg-gray-50 px-2 -mx-2 transition-colors">
                <span className="w-6 shrink-0" />
                <span className="text-xl leading-none shrink-0 w-8">{countryFlag(c.code)}</span>
                <span className="w-44 shrink-0 text-sm font-medium text-gray-500 group-hover:underline truncate">{c.name_en}</span>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div
                    className="h-4 rounded bg-gray-400 shrink-0"
                    style={{ width: `${(c.displayCount / maxCount * 100).toFixed(1)}%`, minWidth: '3px' }}
                  />
                  <span className="text-xs tabular-nums text-gray-500">{c.displayCount}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

    </>
  )
}
