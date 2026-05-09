'use client'

import { useState } from 'react'

export type CountryViewRow = { country: string | null; views: number }
export type ReferrerViewRow = { referrer_host: string | null; views: number }

const REFERRER_LABELS: Record<string, string> = {
  'google.com': 'Google',
  'google.nl': 'Google NL',
  'twitter.com': 'Twitter / X',
  'x.com': 'Twitter / X',
  't.co': 'Twitter / X',
  'facebook.com': 'Facebook',
  'reddit.com': 'Reddit',
  'news.ycombinator.com': 'Hacker News',
  'pocket.com': 'Pocket',
  'feedly.com': 'Feedly',
  'substack.com': 'Substack',
}

function flagEmoji(code: string) {
  return code.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

function ViewDelta({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number | null }) {
  if (lastWeek === null) return <span className="text-[10px] text-blue-500 font-medium shrink-0">new</span>
  const delta = thisWeek - lastWeek
  if (delta > 0) return <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">↑</span>
  if (delta < 0) return <span className="text-[10px] text-red-400 shrink-0">↓</span>
  return null
}

function MiniBar({ value, max, color }: { value: number; max: number; color: 'red' | 'blue' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const bg = color === 'red' ? 'bg-red-200 dark:bg-red-900/40' : 'bg-blue-200 dark:bg-blue-900/40'
  const fill = color === 'red' ? 'bg-red-600' : 'bg-blue-600'
  return (
    <div className={`flex-1 h-1.5 rounded-full ${bg} min-w-[40px]`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function TrafficCard({
  countriesThisWeek, countriesLastWeek,
  referrersThisWeek, referrersLastWeek,
  visitorsThisWeek, visitorsLastWeek,
  pageviewsThisWeek, pageviewsLastWeek,
  cardCls,
}: {
  countriesThisWeek: CountryViewRow[]
  countriesLastWeek: CountryViewRow[]
  referrersThisWeek: ReferrerViewRow[]
  referrersLastWeek: ReferrerViewRow[]
  visitorsThisWeek: number
  visitorsLastWeek: number
  pageviewsThisWeek: number
  pageviewsLastWeek: number
  cardCls: string
}) {
  const [week, setWeek] = useState<'this' | 'last'>('this')

  const countries = week === 'this' ? countriesThisWeek : countriesLastWeek
  const referrers = week === 'this' ? referrersThisWeek : referrersLastWeek
  const totalViews = week === 'this' ? visitorsThisWeek : visitorsLastWeek
  const compareViews = week === 'this' ? visitorsLastWeek : visitorsThisWeek
  const totalPageviews = week === 'this' ? pageviewsThisWeek : pageviewsLastWeek

  const countryLastWeekMap = new Map(countriesLastWeek.map(r => [r.country, r.views]))
  const referrerLastWeekMap = new Map(referrersLastWeek.map(r => [r.referrer_host, r.views]))
  const countryThisWeekMap = new Map(countriesThisWeek.map(r => [r.country, r.views]))
  const referrerThisWeekMap = new Map(referrersThisWeek.map(r => [r.referrer_host, r.views]))

  const maxCountryViews = countries[0]?.views ?? 1
  const maxReferrerViews = referrers[0]?.views ?? 1

  const knownReferrerViews = referrers.reduce((sum, r) => sum + r.views, 0)
  const directViews = Math.max(0, totalViews - knownReferrerViews)

  const totalDelta = totalViews - compareViews
  const totalPct = compareViews > 0 ? Math.round((totalDelta / compareViews) * 100) : null

  const isEmpty = countries.length === 0 && referrers.length === 0

  return (
    <div className={`${cardCls} col-span-full`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Traffic</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Unique visitors per day by country and referrer.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {(['this', 'last'] as const).map(w => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                week === w
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {w === 'this' ? 'This week' : 'Last week'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap border-y border-gray-100 dark:border-gray-800 py-4 -mx-2 px-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
          {totalViews.toLocaleString('en')}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">visitors</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          · {totalPageviews.toLocaleString('en')} pageviews
        </span>
        {totalPct !== null && (
          <span className={`text-xs font-medium tabular-nums ${
            totalPct > 0 ? 'text-emerald-600 dark:text-emerald-400' :
            totalPct < 0 ? 'text-red-500' :
            'text-gray-400'
          }`}>
            {totalPct > 0 ? `↑ ${totalPct}%` : totalPct < 0 ? `↓ ${Math.abs(totalPct)}%` : '→ 0%'}
            <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
              vs {week === 'this' ? 'last week' : 'this week'} ({compareViews.toLocaleString('en')})
            </span>
          </span>
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-8">
          No traffic data yet for this period.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By country</p>
            <div className="flex flex-col gap-2">
              {countries.map(row => (
                <div key={row.country ?? '__null__'} className="flex items-center gap-2 min-w-0">
                  <span className="text-base w-5 shrink-0 text-center leading-none">
                    {row.country ? flagEmoji(row.country) : '🌐'}
                  </span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 w-28 shrink-0 truncate">
                    {row.country ?? 'Direct / unknown'}
                  </span>
                  <MiniBar
                    value={row.views}
                    max={maxCountryViews}
                    color="red"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right shrink-0 tabular-nums">
                    {row.views.toLocaleString('en')}
                  </span>
                  <ViewDelta
                    thisWeek={row.views}
                    lastWeek={week === 'this'
                      ? (countryLastWeekMap.get(row.country) ?? null)
                      : (countryThisWeekMap.get(row.country) ?? null)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By referrer</p>
            <div className="flex flex-col gap-2">
              {referrers.map(row => {
                const host = row.referrer_host ?? ''
                const label = REFERRER_LABELS[host] ?? host
                return (
                  <div key={host || '__direct__'} className="flex items-center gap-2 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${host}&sz=16`}
                      className="w-4 h-4 rounded-sm shrink-0"
                      alt=""
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300 w-[140px] truncate shrink-0">
                      {label}
                    </span>
                    <MiniBar value={row.views} max={maxReferrerViews} color="blue" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right shrink-0 tabular-nums">
                      {row.views.toLocaleString('en')}
                    </span>
                    <ViewDelta
                      thisWeek={row.views}
                      lastWeek={week === 'this'
                        ? (referrerLastWeekMap.get(row.referrer_host) ?? null)
                        : (referrerThisWeekMap.get(row.referrer_host) ?? null)
                      }
                    />
                  </div>
                )
              })}
              {directViews > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Direct / no referrer — {directViews.toLocaleString('en')} views
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
