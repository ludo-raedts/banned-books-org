import React from 'react'

export type TimelineBan = {
  id: number | string
  year_started: number
  year_ended: number | null
  status: string
  action_type: string
}

export type TimelineRow = {
  key: string
  label: string
  sublabel?: string | null
  flag?: string | null
  href?: string | null
  bans: TimelineBan[]
}

export type BanTimelineProps = {
  rows: TimelineRow[]
  firstPublishedYear?: number | null
  firstPublishedLabel?: string
  caption?: string
  /** Minimum total bans across all rows required to render. Below this returns null. */
  minBansToRender?: number
  /** Optional override of "today" — primarily for deterministic snapshot tests. */
  currentYear?: number
}

const ROW_H = 28
const AXIS_H = 32
const FOOTER_H = 22
const VIEW_W = 800
const LABEL_PAD_X = 12

function decadeTicks(min: number, max: number): number[] {
  const start = Math.ceil(min / 10) * 10
  const end = Math.floor(max / 10) * 10
  const out: number[] = []
  for (let y = start; y <= end; y += 10) out.push(y)
  return out
}

function chooseTickStep(rangeYears: number): number {
  if (rangeYears > 200) return 50
  if (rangeYears > 100) return 25
  if (rangeYears > 40) return 10
  if (rangeYears > 15) return 5
  return 2
}

function ticksForRange(min: number, max: number): number[] {
  const step = chooseTickStep(max - min)
  const start = Math.ceil(min / step) * step
  const end = Math.floor(max / step) * step
  const out: number[] = []
  for (let y = start; y <= end; y += step) out.push(y)
  return out
}

function edgeAnchor(
  xPos: number,
  viewW: number,
  approxTextW: number,
): { textAnchor: 'start' | 'middle' | 'end'; xOffset: number } {
  const halfW = approxTextW / 2
  if (xPos - halfW < 0) return { textAnchor: 'start', xOffset: 4 }
  if (xPos + halfW > viewW) return { textAnchor: 'end', xOffset: -4 }
  return { textAnchor: 'middle', xOffset: 0 }
}

export default function BanTimeline({
  rows,
  firstPublishedYear,
  firstPublishedLabel = 'First published',
  caption,
  minBansToRender = 3,
  currentYear = new Date().getUTCFullYear(),
}: BanTimelineProps) {
  const allBans = rows.flatMap(r => r.bans)
  if (allBans.length < minBansToRender) return null
  if (rows.length === 0) return null

  const banStarts = allBans.map(b => b.year_started)
  const banEnds = allBans.map(b => b.year_ended ?? currentYear)
  const yearMinRaw = Math.min(
    firstPublishedYear ?? Number.POSITIVE_INFINITY,
    ...banStarts,
  )
  const yearMaxRaw = Math.max(currentYear, ...banEnds)
  const range = Math.max(1, yearMaxRaw - yearMinRaw)
  const padLeft = Math.max(2, Math.round(range * 0.02))
  const padRight = 5
  const yearMin = yearMinRaw - padLeft
  const yearMax = yearMaxRaw + padRight

  const x = (year: number) => ((year - yearMin) / (yearMax - yearMin)) * VIEW_W

  const totalH = AXIS_H + rows.length * ROW_H + FOOTER_H
  const ticks = ticksForRange(yearMin, yearMax)
  const decades = decadeTicks(yearMin, yearMax)

  const titleId = 'ban-timeline-title'
  const descId = 'ban-timeline-desc'
  const stripeId = 'ban-timeline-stripe'

  const summary =
    caption ??
    `${allBans.length} ban${allBans.length === 1 ? '' : 's'} across ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}, from ${yearMinRaw} to ${currentYear}.`

  return (
    <figure
      role="group"
      aria-labelledby={titleId}
      className="not-prose mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
    >
      <h3 id={titleId} className="sr-only">
        Ban timeline
      </h3>
      <div className="grid grid-cols-[max-content_minmax(0,1fr)] max-h-[800px] overflow-y-auto">
        {/* Header — label column spacer */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-r border-gray-200 dark:border-gray-700 sticky top-0 z-20" style={{ height: AXIS_H }} />
        {/* Header — axis spacer (the axis itself is drawn inside the main SVG, but we keep the column visually separated) */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10" style={{ height: AXIS_H }} />

        {/* Labels column — leading spacer aligns label[0] with bar[0] (SVG has internal axis of AXIS_H) */}
        <div className="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div style={{ height: AXIS_H }} aria-hidden="true" />
          {rows.map((row) => {
            const inner = (
              <span className="flex items-center gap-2 truncate">
                {row.flag && <span aria-hidden="true" className="text-[14px] leading-none shrink-0">{row.flag}</span>}
                <span className="truncate text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200">
                  {row.label}
                </span>
                {row.sublabel && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline">
                    {row.sublabel}
                  </span>
                )}
              </span>
            )
            return (
              <div
                key={row.key}
                className="flex items-center px-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                style={{ height: ROW_H, paddingLeft: LABEL_PAD_X, paddingRight: LABEL_PAD_X }}
              >
                {row.href ? (
                  <a href={row.href} className="hover:underline w-full overflow-hidden">
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </div>
            )
          })}
          <div style={{ height: FOOTER_H }} />
        </div>

        {/* Timeline column — horizontally scrollable */}
        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
            viewBox={`0 0 ${VIEW_W} ${totalH}`}
            preserveAspectRatio="none"
            className="block w-full"
            style={{ minWidth: VIEW_W, height: totalH }}
          >
            <desc id={descId}>{summary}</desc>

            <defs>
              <pattern id={stripeId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="currentColor" opacity="0.18" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2.5" opacity="0.95" />
              </pattern>
            </defs>

            {/* Axis: ticks + decade gridlines */}
            <g className="text-gray-300 dark:text-gray-700">
              {decades.map((y) => (
                <line
                  key={`grid-${y}`}
                  x1={x(y)}
                  x2={x(y)}
                  y1={AXIS_H - 4}
                  y2={totalH - FOOTER_H}
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.45"
                />
              ))}
            </g>
            <g className="text-gray-500 dark:text-gray-400" fontSize="10">
              {ticks.map((y) => (
                <text
                  key={`tick-${y}`}
                  x={x(y)}
                  y={AXIS_H - 10}
                  textAnchor="middle"
                  fill="currentColor"
                >
                  {y}
                </text>
              ))}
              <line x1="0" x2={VIEW_W} y1={AXIS_H - 4} y2={AXIS_H - 4} stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
            </g>

            {/* First-published reference line */}
            {firstPublishedYear != null && firstPublishedYear >= yearMin && firstPublishedYear <= yearMax && (() => {
              const fpText = `${firstPublishedLabel} (${firstPublishedYear})`
              const fpXPos = x(firstPublishedYear)
              const { textAnchor, xOffset } = edgeAnchor(fpXPos, VIEW_W, fpText.length * 5.5)
              return (
                <g className="text-amber-600 dark:text-amber-400">
                  <line
                    x1={fpXPos}
                    x2={fpXPos}
                    y1={AXIS_H - 4}
                    y2={totalH - FOOTER_H}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.85"
                  />
                  <text
                    x={fpXPos + xOffset}
                    y={totalH - 8}
                    textAnchor={textAnchor}
                    fontSize="10"
                    fill="currentColor"
                  >
                    {fpText}
                  </text>
                </g>
              )
            })()}

            {/* Today reference line */}
            {(() => {
              const todayXPos = x(currentYear)
              const { textAnchor, xOffset } = edgeAnchor(todayXPos, VIEW_W, 'Today'.length * 5.5)
              return (
                <g className="text-gray-400 dark:text-gray-500">
                  <line
                    x1={todayXPos}
                    x2={todayXPos}
                    y1={AXIS_H - 4}
                    y2={totalH - FOOTER_H}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />
                  <text
                    x={todayXPos + xOffset}
                    y={totalH - 8}
                    textAnchor={textAnchor}
                    fontSize="10"
                    fill="currentColor"
                  >
                    Today
                  </text>
                </g>
              )
            })()}

            {/* Bars per row */}
            {rows.map((row, rowIdx) => {
              const yTop = AXIS_H + rowIdx * ROW_H
              const yMid = yTop + ROW_H / 2
              return (
                <g key={row.key}>
                  {/* Row separator */}
                  {rowIdx > 0 && (
                    <line
                      x1={0}
                      x2={VIEW_W}
                      y1={yTop}
                      y2={yTop}
                      className="text-gray-100 dark:text-gray-800"
                      stroke="currentColor"
                      strokeWidth="0.5"
                    />
                  )}
                  {row.bans.map((ban) => {
                    const start = ban.year_started
                    const end = ban.year_ended ?? currentYear
                    const x1 = x(start)
                    const x2 = x(end)
                    const w = Math.max(6, x2 - x1)
                    const barH = 14
                    const barY = yMid - barH / 2

                    const isActive = ban.status === 'active'
                    const colorClass = isActive
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-gray-400 dark:text-gray-500'
                    const action = ban.action_type
                    const endLabel = ban.year_ended ?? 'present'
                    const titleText = `${row.label} — ${action} ${start}–${endLabel}, status: ${ban.status}`

                    let fill = 'currentColor'
                    let stroke = 'currentColor'
                    let fillOpacity = 0.85
                    let strokeWidth = 0
                    if (action === 'restricted') {
                      fill = `url(#${stripeId})`
                      fillOpacity = 1
                      stroke = 'currentColor'
                      strokeWidth = 1
                    } else if (action === 'challenged') {
                      fill = 'transparent'
                      stroke = 'currentColor'
                      strokeWidth = 1.5
                    }

                    return (
                      <g key={ban.id} className={colorClass}>
                        <title>{titleText}</title>
                        <rect
                          x={x1}
                          y={barY}
                          width={w}
                          height={barH}
                          rx={2}
                          ry={2}
                          fill={fill}
                          fillOpacity={fillOpacity}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30">
        <span className="font-medium text-gray-600 dark:text-gray-300 mr-1">Status:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-red-500 dark:bg-red-400" /> active
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-gray-400 dark:bg-gray-500" /> historical
        </span>
        <span className="hidden sm:inline-block w-px h-3 bg-gray-300 dark:bg-gray-700" aria-hidden="true" />
        <span className="font-medium text-gray-600 dark:text-gray-300 mr-1">Action:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-gray-500 dark:bg-gray-400" /> banned
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <svg width="14" height="10" aria-hidden="true" className="overflow-visible">
            <rect width="14" height="10" fill={`url(#${stripeId})`} stroke="currentColor" strokeWidth="0.5" />
          </svg>
          restricted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm border-[1.5px] border-gray-500 dark:border-gray-400" />
          challenged
        </span>
      </div>
    </figure>
  )
}
