import Link from '@/components/link'
import { flagEmoji } from '../kit'
import {
  RANGES, RANGE_LABEL, statsHref,
  type BreakdownRow, type StatsFilters, type TopPageRow, type TrafficData,
} from './data'

// Server-rendered pieces of /admin/stats. Everything here is a plain link or
// static markup: the filters are URL state (?range=&ref=&country=), so a view
// is shareable, back-button friendly, and needs no client JS.

const nf = (n: number) => n.toLocaleString('en')

const REFERRER_LABELS: Record<string, string> = {
  'google.com': 'Google',
  'google.nl': 'Google NL',
  'com.google.android.googlequicksearchbox': 'Google (Android app)',
  'bing.com': 'Bing',
  'search.yahoo.com': 'Yahoo',
  'noai.duckduckgo.com': 'DuckDuckGo (no-AI)',
  'qwant.com': 'Qwant',
  'duckduckgo.com': 'DuckDuckGo',
  'ecosia.org': 'Ecosia',
  'yahoo.com': 'Yahoo',
  'search.brave.com': 'Brave Search',
  'twitter.com': 'Twitter / X',
  'x.com': 'Twitter / X',
  't.co': 'Twitter / X',
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'lm.facebook.com': 'Facebook',
  'reddit.com': 'Reddit',
  'old.reddit.com': 'Reddit',
  'news.ycombinator.com': 'Hacker News',
  'bsky.app': 'Bluesky',
  'linkedin.com': 'LinkedIn',
  'pocket.com': 'Pocket',
  'feedly.com': 'Feedly',
  'substack.com': 'Substack',
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export function referrerLabel(key: string): string {
  return key === '' ? 'Direct / none' : (REFERRER_LABELS[key] ?? key)
}

export function countryLabel(key: string): string {
  if (key === '') return 'Unknown'
  try {
    return regionNames.of(key) ?? key
  } catch {
    return key
  }
}

// ── Filter row ───────────────────────────────────────────────────────────────

export function FilterBar({ filters, from, to }: { filters: StatsFilters; from: string; to: string }) {
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
    }`
  const active: { label: string; clear: string }[] = []
  if (filters.ref !== null) active.push({ label: `Referrer: ${referrerLabel(filters.ref)}`, clear: statsHref(filters, { ref: null }) })
  if (filters.country !== null) active.push({ label: `Country: ${countryLabel(filters.country)}`, clear: statsHref(filters, { country: null }) })

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <nav aria-label="Date range" className="flex flex-wrap gap-1.5">
        {RANGES.map(r => (
          <Link key={r} href={statsHref(filters, { range: r })} className={chip(filters.range === r)} aria-current={filters.range === r ? 'page' : undefined}>
            {r === 'all' ? RANGE_LABEL.all : `Last ${RANGE_LABEL[r]}`}
          </Link>
        ))}
      </nav>
      <span className="text-xs text-gray-500 tabular-nums">{from} → {to} (UTC)</span>
      {active.map(a => (
        <Link
          key={a.label}
          href={a.clear}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 text-xs font-medium hover:bg-blue-100"
          aria-label={`Remove filter ${a.label}`}
        >
          {a.label} <span aria-hidden>×</span>
        </Link>
      ))}
    </div>
  )
}

// ── KPI row ──────────────────────────────────────────────────────────────────

function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <span className="text-xs text-gray-400">no earlier period</span>
  if (before === 0) return <span className="text-xs text-gray-400">no earlier traffic</span>
  const pct = Math.round(((now - before) / before) * 100)
  const cls = pct > 0 ? 'text-emerald-700' : pct < 0 ? 'text-red-600' : 'text-gray-500'
  return (
    <span className={`text-xs font-medium tabular-nums ${cls}`}>
      {pct > 0 ? '↑' : pct < 0 ? '↓' : '→'} {Math.abs(pct)}%
      <span className="text-gray-400 font-normal"> vs previous period ({nf(before)})</span>
    </span>
  )
}

export function KpiRow({ data, scope }: { data: TrafficData; scope: string | null }) {
  const days = data.series.length
  const { visitors, pageviews } = data.totals
  const tile = 'border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-1'
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className={tile}>
        <span className="text-xs font-medium text-gray-500">Visitors{scope ? ` · ${scope}` : ''}</span>
        <span className="text-4xl font-bold text-gray-900 tabular-nums leading-tight">{nf(visitors)}</span>
        <Delta now={visitors} before={data.prevTotals?.visitors ?? null} />
        <span className="text-[11px] text-gray-400">Unique per day, summed over the period</span>
      </div>
      <div className={tile}>
        <span className="text-xs font-medium text-gray-500">Pageviews{scope ? ` · ${scope}` : ''}</span>
        <span className="text-4xl font-bold text-gray-900 tabular-nums leading-tight">{nf(pageviews)}</span>
        <Delta now={pageviews} before={data.prevTotals?.pageviews ?? null} />
        <span className="text-[11px] text-gray-400">Bots excluded</span>
      </div>
      <div className={tile}>
        <span className="text-xs font-medium text-gray-500">Average per day</span>
        <span className="text-4xl font-bold text-gray-900 tabular-nums leading-tight">
          {nf(Math.round(visitors / Math.max(1, days)))}
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          visitors · {visitors > 0 ? (pageviews / visitors).toFixed(1) : '–'} pageviews each
        </span>
        <span className="text-[11px] text-gray-400">{days} day{days === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

// ── Breakdown lists (country / referrer) ─────────────────────────────────────

const SHOWN = 10

function BreakdownList({
  title, rows, prev, filters, kind, selected, total,
}: {
  title: string
  rows: BreakdownRow[]
  prev: Record<string, number>
  filters: StatsFilters
  kind: 'ref' | 'country'
  selected: string | null
  total: number
}) {
  const max = rows[0]?.visitors ?? 1
  const hasPrev = Object.keys(prev).length > 0

  const renderRow = (r: BreakdownRow) => {
    const isSel = selected === r.key
    const label = kind === 'ref' ? referrerLabel(r.key) : countryLabel(r.key)
    const pct = max > 0 ? Math.max(2, Math.round((r.visitors / max) * 100)) : 0
    const share = total > 0 ? Math.round((r.visitors / total) * 100) : 0
    const before = hasPrev ? (prev[r.key] ?? 0) : null
    return (
      <li key={r.key || '__none__'}>
        <Link
          href={statsHref(filters, { [kind]: isSel ? null : r.key })}
          title={isSel ? 'Remove this filter' : `Show the pages ${label} visitors viewed`}
          className={`group grid grid-cols-[minmax(0,9rem)_1fr_auto_2.5rem_3.5rem] items-center gap-3 rounded-md px-2 py-1 -mx-2 text-xs transition-colors ${
            isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center gap-1.5 min-w-0 text-gray-700">
            {kind === 'country' && <span aria-hidden className="text-base leading-none">{flagEmoji(r.key || null)}</span>}
            <span className="truncate">{label}</span>
          </span>
          <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-gray-900 font-medium tabular-nums text-right">{nf(r.visitors)}</span>
          <span className="text-gray-400 tabular-nums text-right">{share}%</span>
          <TrendMark now={r.visitors} before={before} />
        </Link>
      </li>
    )
  }

  const head = rows.slice(0, SHOWN)
  const rest = rows.slice(SHOWN)

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No data for this period.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-0.5">{head.map(renderRow)}</ul>
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-800 py-1">
                Show {rest.length} more
              </summary>
              <ul className="flex flex-col gap-0.5">{rest.map(renderRow)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function TrendMark({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <span />
  if (before === 0) return <span className="text-[10px] font-medium text-blue-600 text-right">new</span>
  const pct = Math.round(((now - before) / before) * 100)
  if (Math.abs(pct) < 5) return <span className="text-[10px] text-gray-300 text-right">→</span>
  return (
    <span className={`text-[10px] font-medium tabular-nums text-right ${pct > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  )
}

export function BreakdownCard({ data, filters, cardCls }: { data: TrafficData; filters: StatsFilters; cardCls: string }) {
  const total = data.totals.visitors
  return (
    <div className={`${cardCls} col-span-full`}>
      <div>
        <h2 className="font-semibold text-gray-900">Where visitors come from</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Click a row to scope the numbers and the chart to it and see the pages those visitors viewed (one filter at a time). These lists always show all visitors; share is of all visitors in the period, the arrow compares with the previous period.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6 mt-2">
        <BreakdownList
          title="Referrer" kind="ref" rows={data.referrers} prev={data.prevReferrers}
          filters={filters} selected={filters.ref} total={total}
        />
        <BreakdownList
          title="Country" kind="country" rows={data.countries} prev={data.prevCountries}
          filters={filters} selected={filters.country} total={total}
        />
      </div>
    </div>
  )
}

// ── Top pages ────────────────────────────────────────────────────────────────

export function TopPagesCard({
  pages, filters, cardCls,
}: {
  pages: TopPageRow[]
  filters: StatsFilters
  cardCls: string
}) {
  const filtered = filters.ref !== null || filters.country !== null
  const parts: string[] = []
  if (filters.ref !== null) parts.push(`from ${referrerLabel(filters.ref)}`)
  if (filters.country !== null) parts.push(`in ${countryLabel(filters.country)}`)
  const max = pages[0]?.pageviews ?? 1
  const capped = filters.range === 'all'

  return (
    <div className={`${cardCls} col-span-full`}>
      <div>
        <h2 className="font-semibold text-gray-900">
          {filtered ? `Pages viewed ${parts.join(' ')}` : 'Top pages'}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Pageviews per page, same period and filter as above{capped ? ' (last 90 days — raw pageviews are pruned after 90 days)' : ''}.
          {!filtered && ' Pick a referrer or country above to see where those visitors went.'}
        </p>
      </div>
      {pages.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4">No pageviews for this selection.</p>
      ) : (
        <ol className="flex flex-col gap-0.5 mt-1">
          {pages.map((p, i) => (
            <li key={p.path}>
              <Link
                href={p.href}
                className="group grid grid-cols-[1.5rem_minmax(0,1fr)_8rem_3.5rem] items-center gap-3 rounded-md px-2 py-1 -mx-2 text-xs hover:bg-gray-50"
              >
                <span className="text-gray-400 tabular-nums text-center">{i + 1}</span>
                <span className="truncate text-gray-700 group-hover:text-brand">
                  {p.label}
                  {p.label !== p.href && <span className="ml-2 text-gray-400">{p.href}</span>}
                </span>
                <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(2, Math.round((p.pageviews / max) * 100))}%` }} />
                </span>
                <span className="text-gray-900 font-medium tabular-nums text-right">{nf(p.pageviews)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
