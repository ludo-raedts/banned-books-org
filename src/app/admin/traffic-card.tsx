'use client'

import { useState } from 'react'

export type CountryViewRow = { country: string | null; views: number }
export type ReferrerViewRow = { referrer_host: string | null; views: number }
export type DailyTrafficRow = { day: string; visitors: number; pageviews: number }

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
  const base = 'text-[10px] font-medium shrink-0 w-8 text-left leading-none'
  if (lastWeek === null) return <span className={`${base} text-blue-500`}>new</span>
  const delta = thisWeek - lastWeek
  if (delta > 0) return <span className={`${base} text-emerald-600`}>↑</span>
  if (delta < 0) return <span className={`${base} text-red-400`}>↓</span>
  return <span className={base} aria-hidden />
}

function MiniBar({ value, max, color }: { value: number; max: number; color: 'red' | 'blue' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const bg = color === 'red' ? 'bg-red-200' : 'bg-blue-200'
  const fill = color === 'red' ? 'bg-red-600' : 'bg-blue-600'
  return (
    <div className={`flex-1 h-1.5 rounded-full ${bg} min-w-[40px]`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// 30-day area chart of daily visitors + pageviews, fed by the pageviews_daily
// rollup. Plain SVG in the existing admin style — no chart lib. "Visitors" is
// per-day unique (daily-salted hash), so the series is only comparable
// day-by-day, never summed across days.
function TrafficChart({ series }: { series: DailyTrafficRow[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const W = 600
  const H = 150
  const PAD_T = 6
  const n = series.length
  const max = Math.max(1, ...series.map(d => d.pageviews))
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2)
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T)

  const line = (key: 'visitors' | 'pageviews') =>
    series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')
  const area = (key: 'visitors' | 'pageviews') => `${line(key)} L${W},${H} L0,${H} Z`

  const shown = hover !== null ? series[hover] : series[n - 1]
  const isToday = shown === series[n - 1]

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    setHover(Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1)))))
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
        <div className="flex items-center gap-4">
          <p className="text-sm font-medium text-gray-700">Last 30 days</p>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-red-500" /> visitors
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-blue-300" /> pageviews
          </span>
        </div>
        <p className="text-xs text-gray-500 tabular-nums">
          {formatDay(shown.day)}{isToday && hover === null ? ' (today so far)' : ''} —{' '}
          <span className="font-medium text-gray-700">{shown.visitors.toLocaleString('en')}</span> visitors ·{' '}
          {shown.pageviews.toLocaleString('en')} pageviews
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-36 block"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={area('pageviews')} fill="#dbeafe" />
        <path d={line('pageviews')} fill="none" stroke="#93c5fd" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={area('visitors')} fill="#fecaca" fillOpacity={0.75} />
        <path d={line('visitors')} fill="none" stroke="#dc2626" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#9ca3af" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
        )}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">{formatDay(series[0].day)}</span>
        <span className="text-[10px] text-gray-400">{formatDay(series[n - 1].day)}</span>
      </div>
    </div>
  )
}

export default function TrafficCard({
  countriesThisWeek, countriesLastWeek,
  referrersThisWeek, referrersLastWeek,
  visitorsThisWeek, visitorsLastWeek,
  pageviewsThisWeek, pageviewsLastWeek,
  dailySeries,
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
  dailySeries: DailyTrafficRow[]
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
      <div>
        <h2 className="font-semibold text-gray-900">Traffic</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Unique visitors per day by country and referrer.
        </p>
      </div>

      {dailySeries.length > 1 && <TrafficChart series={dailySeries} />}

      {/* Weekly section — the toggle sits next to the numbers it controls,
          so it can't be read as controlling the 30-day chart above. */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-t border-gray-100 pt-4 mt-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
            {totalViews.toLocaleString('en')}
          </span>
          <span className="text-sm text-gray-500">visitors</span>
          <span className="text-xs text-gray-400 tabular-nums">
            · {totalPageviews.toLocaleString('en')} pageviews
          </span>
          {totalPct !== null && (
            <span className={`text-xs font-medium tabular-nums ${
              totalPct > 0 ? 'text-emerald-600' :
              totalPct < 0 ? 'text-red-500' :
              'text-gray-400'
            }`}>
              {totalPct > 0 ? `↑ ${totalPct}%` : totalPct < 0 ? `↓ ${Math.abs(totalPct)}%` : '→ 0%'}
              <span className="text-gray-400 font-normal ml-1">
                vs {week === 'this' ? 'last week' : 'this week'} ({compareViews.toLocaleString('en')})
              </span>
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {(['this', 'last'] as const).map(w => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                week === w
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {w === 'this' ? 'This week' : 'Last week'}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-400 italic text-center py-8">
          No traffic data yet for this period.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">By country</p>
            <div className="flex flex-col gap-2">
              {countries.map(row => (
                <div key={row.country ?? '__null__'} className="flex items-center gap-2 min-w-0">
                  <span className="text-base w-5 shrink-0 text-center leading-none">
                    {row.country ? flagEmoji(row.country) : '🌐'}
                  </span>
                  <span className="text-xs text-gray-700 w-28 shrink-0 truncate">
                    {row.country ?? 'Direct / unknown'}
                  </span>
                  <MiniBar
                    value={row.views}
                    max={maxCountryViews}
                    color="red"
                  />
                  <span className="text-xs text-gray-500 w-12 text-right shrink-0 tabular-nums">
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
            <p className="text-sm font-medium text-gray-700 mb-3">By referrer</p>
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
                    <span className="text-xs text-gray-700 w-[140px] truncate shrink-0">
                      {label}
                    </span>
                    <MiniBar value={row.views} max={maxReferrerViews} color="blue" />
                    <span className="text-xs text-gray-500 w-12 text-right shrink-0 tabular-nums">
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
                <p className="text-xs text-gray-400 mt-1">
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
