export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'Countries Where Books Are Banned',
  description: 'Browse books banned or challenged in 30 countries, from school challenges in the United States to government bans across Asia, the Middle East, and Latin America.',
  alternates: { canonical: '/countries' },
}

function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

export default async function CountriesPage() {
  const supabase = adminClient()

  const [{ data: countries }, { data: banCounts }] = await Promise.all([
    // rows: ~50 | fields: [code, name_en, description] | reason: full country list for index page
    supabase.from('countries').select('code, name_en, description'),
    // rows: ~50 | fields: [country_code, total_bans, active_bans] | reason: materialized view — one row per country, no scan of bans table
    supabase.from('mv_ban_counts').select('country_code, total_bans, active_bans'),
  ])

  const countMap = new Map((banCounts ?? []).map(r => [r.country_code, r.total_bans as number]))
  const activeMap = new Map((banCounts ?? []).map(r => [r.country_code, r.active_bans as number]))

  const ranked = (countries ?? [])
    .map(c => ({ ...c, count: countMap.get(c.code) ?? 0, active: activeMap.get(c.code) ?? 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const maxCount = ranked[0]?.count ?? 1

  // Separate defunct states
  const defunct = ['SU', 'CS', 'DD', 'YU']
  const active = ranked.filter(c => !defunct.includes(c.code))
  const historical = ranked.filter(c => defunct.includes(c.code))

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Catalogue</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Countries</h1>
        <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
          Browse books banned in 30 countries, from school challenges in the United States to government bans across Asia, the Middle East, and Latin America.
        </p>
      </div>

      {/* Country list */}
      <div className="space-y-1.5 mb-12">
        {active.map((c, i) => (
          <Link key={c.code} href={`/countries/${c.code}`} className="flex items-center gap-2 group py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 px-2 -mx-2 transition-colors">
            <span className="w-6 text-right text-xs text-gray-400 dark:text-gray-600 tabular-nums shrink-0">{i + 1}</span>
            <span className="text-xl leading-none shrink-0 w-8">{countryFlag(c.code)}</span>
            <span className="w-44 shrink-0 text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:underline truncate">{c.name_en}</span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div
                className="h-4 rounded bg-red-400 dark:bg-red-600 shrink-0"
                style={{ width: `${(c.count / maxCount * 100).toFixed(1)}%`, maxWidth: 'calc(100% - 2.5rem)', minWidth: '3px' }}
              />
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 shrink-0">{c.count}</span>
            </div>
            <span className="w-20 text-right shrink-0 text-xs text-red-500 dark:text-red-400 tabular-nums">
              {c.active > 0 ? `${c.active} active` : ''}
            </span>
          </Link>
        ))}
      </div>

      {historical.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs mb-3">
            Defunct states
          </h2>
          <div className="space-y-1.5 mb-10">
            {historical.map(c => (
              <Link key={c.code} href={`/countries/${c.code}`} className="flex items-center gap-3 group py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 px-2 -mx-2 transition-colors">
                <span className="w-6 shrink-0" />
                <span className="text-xl leading-none shrink-0 w-8">{countryFlag(c.code)}</span>
                <span className="w-44 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:underline truncate">{c.name_en}</span>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div
                    className="h-4 rounded bg-gray-400 dark:bg-gray-600 shrink-0"
                    style={{ width: `${(c.count / maxCount * 100).toFixed(1)}%`, minWidth: '3px' }}
                  />
                  <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{c.count}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 pt-6">
        <p>
          Coverage is uneven: well-documented democracies like the United States appear to have more bans
          because their censorship attempts are systematically recorded. Bans in closed authoritarian states
          often go undocumented. This catalogue is a work in progress.
        </p>
      </div>
    </main>
  )
}
