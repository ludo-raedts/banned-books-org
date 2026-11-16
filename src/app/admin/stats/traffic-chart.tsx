'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DailyTrafficRow } from './data'

// Daily traffic chart for /admin/stats. Plain SVG, real pixel geometry (the old
// version stretched a 600×150 viewBox with preserveAspectRatio="none").
//
// Reading aids: y-axis with hairline gridlines, x-axis date ticks, a crosshair
// with a tooltip that follows the pointer (keyboard: ←/→), a legend, an optional
// 7-day average, and a table view of the same numbers.
//
// "Visitors" is unique per UTC day (the visitor hash is salted daily), so the
// series is a daily-unique count: comparable day by day, and a range's total is
// the sum of those daily counts.
//
// Colors: categorical slots 1 (blue) and 2 (orange) of the dataviz reference
// palette, validated light-mode (CVD ΔE 24.7, normal-vision 33.6). The admin is
// light-only.
const VISITORS = '#2a78d6'
const PAGEVIEWS = '#eb6834'
const SURFACE = '#ffffff'
const GRID = '#e5e7eb'

const H = 260
const M = { top: 12, right: 16, bottom: 28, left: 44 }

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 4, step: 1 }
  const raw = v / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow
  return { max: Math.ceil(v / step) * step, step }
}

const fmtTick = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString('en'))
const fmtDay = (day: string, withYear = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en', {
    month: 'short', day: 'numeric', timeZone: 'UTC', ...(withYear ? { year: 'numeric' } : {}),
  })

function rollingAvg(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export default function TrafficChart({ series, today }: { series: DailyTrafficRow[]; today: string }) {
  // Callback ref: the chart <div> is re-created when switching back from the
  // table view, and state (unlike useRef) re-runs the observer effect for it.
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [smooth, setSmooth] = useState(false)
  const [clip, setClip] = useState(false)

  useEffect(() => {
    if (!wrapEl) return
    const ro = new ResizeObserver(entries => setWidth(Math.max(280, Math.round(entries[0].contentRect.width))))
    ro.observe(wrapEl)
    return () => ro.disconnect()
  }, [wrapEl])

  const n = series.length
  const canSmooth = n >= 14
  const useSmooth = smooth && canSmooth

  const visitors = useMemo(() => series.map(d => d.visitors), [series])
  const pageviews = useMemo(() => series.map(d => d.pageviews), [series])
  const visitorsLine = useMemo(() => (useSmooth ? rollingAvg(visitors) : visitors), [useSmooth, visitors])
  const pageviewsLine = useMemo(() => (useSmooth ? rollingAvg(pageviews) : pageviews), [useSmooth, pageviews])

  // A single viral day (e.g. 27 Oct) flattens everything else. "Clip spikes"
  // caps the axis at 2.5× the median day; clipped days are marked
  // with a ▲ at the top edge and keep their true values in the tooltip / table.
  const sortedPv = [...pageviewsLine].sort((a, b) => a - b)
  const median = sortedPv[Math.floor(sortedPv.length / 2)] ?? 0
  const fullMax = Math.max(...pageviewsLine, ...visitorsLine)
  const canClip = fullMax > median * 4 && n >= 14
  const useClip = clip && canClip
  const { max, step } = niceMax(useClip ? median * 2.5 : fullMax)
  const innerW = width - M.left - M.right
  const innerH = H - M.top - M.bottom
  const x = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
  const y = (v: number) => M.top + (1 - Math.min(v, max) / max) * innerH

  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = (vals: number[]) => `${path(vals)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`

  const yTicks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) yTicks.push(v)

  // ~6 x labels at most, always including the first and the last day.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))))
  const xTicks = series.map((_, i) => i).filter(i => i % every === 0 || i === n - 1)
    .filter(i => i === n - 1 || n - 1 - i >= every * 0.6 || i === 0)

  function indexFromX(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left
    const frac = (px - M.left) / innerW
    return Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))))
  }

  const shown = hover ?? n - 1
  const row = series[shown]
  const tipLeft = Math.min(Math.max(x(shown), 90), width - 90)

  if (view === 'table') {
    return (
      <div>
        <ChartToolbar view={view} setView={setView} smooth={smooth} setSmooth={setSmooth} canSmooth={canSmooth} clip={clip} setClip={setClip} canClip={false} />
        <div className="max-h-[320px] overflow-auto border border-gray-100 rounded-lg">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-3 py-2">Day (UTC)</th>
                <th className="text-right font-medium px-3 py-2">Visitors</th>
                <th className="text-right font-medium px-3 py-2">Pageviews</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map(d => (
                <tr key={d.day} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-gray-700">{fmtDay(d.day, true)}{d.day === today ? ' · today so far' : ''}</td>
                  <td className="px-3 py-1.5 text-right text-gray-900">{d.visitors.toLocaleString('en')}</td>
                  <td className="px-3 py-1.5 text-right text-gray-600">{d.pageviews.toLocaleString('en')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <ChartToolbar view={view} setView={setView} smooth={smooth} setSmooth={setSmooth} canSmooth={canSmooth} clip={clip} setClip={setClip} canClip={canClip} />
      <div ref={setWrapEl} className="relative w-full min-w-0 overflow-hidden" style={{ height: H }}>
        <svg
          width={width}
          height={H}
          role="img"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard-operable chart (←/→ moves the crosshair); the table view is the non-visual alternative
          tabIndex={0}
          aria-label={`Daily visitors and pageviews, ${fmtDay(series[0].day)} to ${fmtDay(series[n - 1].day)}. Use the table view for exact numbers.`}
          className="absolute left-0 top-0 block outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded"
          onPointerMove={e => setHover(indexFromX(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max(0, (h ?? n - 1) - 1)) }
            if (e.key === 'ArrowRight') { e.preventDefault(); setHover(h => Math.min(n - 1, (h ?? n - 1) + 1)) }
            if (e.key === 'Escape') setHover(null)
          }}
        >
          {/* y gridlines + labels */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={M.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b7280">
                {fmtTick(v)}
              </text>
            </g>
          ))}
          {/* x labels */}
          {xTicks.map(i => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill="#6b7280"
            >
              {fmtDay(series[i].day)}
            </text>
          ))}

          {/* pageviews behind, visitors in front; area = wash, line = 2px */}
          <path d={area(pageviewsLine)} fill={PAGEVIEWS} fillOpacity={0.1} />
          <path d={path(pageviewsLine)} fill="none" stroke={PAGEVIEWS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={area(visitorsLine)} fill={VISITORS} fillOpacity={0.1} />
          <path d={path(visitorsLine)} fill="none" stroke={VISITORS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {useClip && pageviewsLine.map((v, i) => v > max && (
            <path key={series[i].day} d={`M${x(i) - 4},${M.top + 7} L${x(i) + 4},${M.top + 7} L${x(i)},${M.top}Z`} fill={PAGEVIEWS}>
              <title>{`${fmtDay(series[i].day)}: ${Math.round(v).toLocaleString('en')} pageviews (above the axis)`}</title>
            </path>
          ))}

          {/* crosshair + markers (surface ring keeps them legible on the lines) */}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={y(0)} stroke="#9ca3af" strokeWidth={1} />
          )}
          {[
            { v: pageviewsLine[shown], c: PAGEVIEWS },
            { v: visitorsLine[shown], c: VISITORS },
          ].map(p => (
            <circle key={p.c} cx={x(shown)} cy={y(p.v)} r={4} fill={p.c} stroke={SURFACE} strokeWidth={2} />
          ))}
        </svg>

        {/* tooltip: values lead, labels follow; line keys, not boxes */}
        {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs"
          style={{ left: tipLeft }}
        >
          <p className="text-gray-500 mb-1 whitespace-nowrap">
            {fmtDay(row.day, true)}{row.day === today ? ' · today so far' : ''}
            {useSmooth ? ' · 7-day avg' : ''}
          </p>
          <p className="flex items-center gap-2 whitespace-nowrap tabular-nums">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: VISITORS }} />
            <span className="font-semibold text-gray-900">{Math.round(visitorsLine[shown]).toLocaleString('en')}</span>
            <span className="text-gray-500">visitors</span>
          </p>
          <p className="flex items-center gap-2 whitespace-nowrap tabular-nums">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: PAGEVIEWS }} />
            <span className="font-semibold text-gray-900">{Math.round(pageviewsLine[shown]).toLocaleString('en')}</span>
            <span className="text-gray-500">pageviews</span>
          </p>
        </div>
        )}
      </div>
    </div>
  )
}

function ChartToolbar({
  view, setView, smooth, setSmooth, canSmooth, clip, setClip, canClip,
}: {
  clip: boolean
  setClip: (v: boolean) => void
  canClip: boolean
  view: 'chart' | 'table'
  setView: (v: 'chart' | 'table') => void
  smooth: boolean
  setSmooth: (v: boolean) => void
  canSmooth: boolean
}) {
  const btn = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: VISITORS }} /> Visitors
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: PAGEVIEWS }} /> Pageviews
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {canClip && view === 'chart' && (
          <button type="button" aria-pressed={clip} onClick={() => setClip(!clip)} className={btn(clip)}>
            Clip spikes
          </button>
        )}
        {canSmooth && view === 'chart' && (
          <button type="button" aria-pressed={smooth} onClick={() => setSmooth(!smooth)} className={btn(smooth)}>
            7-day average
          </button>
        )}
        <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')} className={btn(view === 'chart')}>
          Chart
        </button>
        <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} className={btn(view === 'table')}>
          Table
        </button>
      </div>
    </div>
  )
}
