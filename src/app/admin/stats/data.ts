import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import { withDbRetry } from '@/lib/db-retry'

// ── Filters ──────────────────────────────────────────────────────────────────
// Everything on /admin/stats that is range-scoped reads from the daily rollups
// (pageviews_daily, pageviews_daily_dim) — tiny tables, so a range switch never
// touches the raw pageviews table. Only the top-pages drill-down does, and it is
// cached per filter combination.

export const RANGES = ['7', '30', '90', 'all'] as const
export type RangeKey = (typeof RANGES)[number]

export const RANGE_LABEL: Record<RangeKey, string> = {
  '7': '7 days',
  '30': '30 days',
  '90': '90 days',
  all: 'All time',
}

export type StatsFilters = {
  range: RangeKey
  /** referrer host; '' = direct / no referrer; null = no filter */
  ref: string | null
  /** ISO country code; '' = unknown; null = no filter */
  country: string | null
}

type RawParams = Record<string, string | string[] | undefined>

function one(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v
  return s === undefined ? null : s
}

export function parseFilters(sp: RawParams): StatsFilters {
  const range = one(sp.range)
  const ref = one(sp.ref)
  const country = one(sp.country)
  return normalise({
    range: (RANGES as readonly string[]).includes(range ?? '') ? (range as RangeKey) : '30',
    // Hostnames / ISO codes only — these go into an RPC parameter and the URL.
    ref: ref !== null && /^[a-z0-9.-]{0,100}$/i.test(ref) ? ref.toLowerCase() : null,
    country: country !== null && /^[A-Za-z]{0,2}$/.test(country) ? country.toUpperCase() : null,
  })
}

/** Referrer wins when both are in the URL (one dimension at a time). */
function normalise(f: StatsFilters): StatsFilters {
  return f.ref !== null && f.country !== null ? { ...f, country: null } : f
}

/** Builds a /admin/stats URL, dropping filters that are unset / default. */
export function statsHref(f: StatsFilters, patch: Partial<StatsFilters> = {}): string {
  const next = { ...f, ...patch }
  // The traffic rollup can scope to one dimension at a time: choosing a
  // referrer replaces a country filter and vice versa.
  if (patch.ref != null && patch.country === undefined) next.country = null
  if (patch.country != null && patch.ref === undefined) next.ref = null
  const q = new URLSearchParams()
  if (next.range !== '30') q.set('range', next.range)
  if (next.ref !== null) q.set('ref', next.ref)
  if (next.country !== null) q.set('country', next.country)
  const s = q.toString()
  return s ? `/admin/stats?${s}` : '/admin/stats'
}

// ── Types ────────────────────────────────────────────────────────────────────

export type DailyTrafficRow = { day: string; visitors: number; pageviews: number }
export type BreakdownRow = { key: string; visitors: number; pageviews: number }
export type TopPageRow = {
  path: string
  pageviews: number
  label: string
  href: string
}

export type TrafficData = {
  from: string
  to: string
  series: DailyTrafficRow[]
  totals: { visitors: number; pageviews: number }
  /** null for "all time" (nothing to compare against) */
  prevTotals: { visitors: number; pageviews: number } | null
  countries: BreakdownRow[]
  referrers: BreakdownRow[]
  prevCountries: Record<string, number>
  prevReferrers: Record<string, number>
}

// ── Date helpers (UTC days, same convention as the rollups) ─────────────────

const DAY_MS = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)

function addDays(day: string, n: number): string {
  return iso(new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS))
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

// ── Traffic (chart, KPIs, country / referrer breakdowns) ────────────────────

// Site-wide days come from pageviews_daily; a single referrer / country comes
// from the same-shaped rows in pageviews_daily_dim (one filter dimension at a
// time — the rollup has no referrer × country cross-section).
async function dailyRows(
  from: string,
  to: string,
  scope: { dim: 'country' | 'referrer'; key: string } | null,
): Promise<Map<string, DailyTrafficRow>> {
  const sb = adminClient()
  const { data, error } = await withDbRetry(
    () => (scope
      ? sb.from('pageviews_daily_dim').select('day, visitors, pageviews').eq('dim', scope.dim).eq('key', scope.key)
      : sb.from('pageviews_daily').select('day, visitors, pageviews'))
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true })
      .limit(1000),
    'daily traffic',
  )
  if (error) throw new Error(`daily traffic: ${error.message}`)
  return new Map((data ?? []).map(r => [
    r.day as string,
    { day: r.day as string, visitors: Number(r.visitors), pageviews: Number(r.pageviews) },
  ]))
}

async function dimTotals(dim: 'country' | 'referrer', from: string, to: string, limit: number): Promise<BreakdownRow[]> {
  const { data, error } = await withDbRetry(
    () => adminClient().rpc('admin_dim_totals', { p_dim: dim, p_from: from, p_to: to, p_limit: limit }),
    `admin_dim_totals(${dim})`,
  )
  if (error) throw new Error(`admin_dim_totals(${dim}): ${error.message}`)
  return ((data ?? []) as { key: string; visitors: number | string; pageviews: number | string }[]).map(r => ({
    key: r.key ?? '',
    visitors: Number(r.visitors),
    pageviews: Number(r.pageviews),
  }))
}

async function fetchTraffic(range: RangeKey, today: string, f: StatsFilters): Promise<TrafficData> {
  const scope = f.ref !== null ? { dim: 'referrer' as const, key: f.ref }
    : f.country !== null ? { dim: 'country' as const, key: f.country }
    : null
  let from: string
  if (range === 'all') {
    const { data } = await adminClient()
      .from('pageviews_daily').select('day').order('day', { ascending: true }).limit(1)
    from = (data?.[0]?.day as string | undefined) ?? today
  } else {
    from = addDays(today, -(Number(range) - 1))
  }
  const days = eachDay(from, today)
  const prevTo = addDays(from, -1)
  const prevFrom = range === 'all' ? null : addDays(from, -days.length)

  const [cur, prev, countries, referrers, prevCountries, prevReferrers] = await Promise.all([
    dailyRows(from, today, scope),
    prevFrom ? dailyRows(prevFrom, prevTo, scope) : Promise.resolve(new Map<string, DailyTrafficRow>()),
    dimTotals('country', from, today, 50),
    dimTotals('referrer', from, today, 50),
    prevFrom ? dimTotals('country', prevFrom, prevTo, 500) : Promise.resolve([] as BreakdownRow[]),
    prevFrom ? dimTotals('referrer', prevFrom, prevTo, 500) : Promise.resolve([] as BreakdownRow[]),
  ])

  // Days without a rollup row had no tracked traffic: fill with zeros so the
  // x-axis stays linear.
  const series = days.map(day => cur.get(day) ?? { day, visitors: 0, pageviews: 0 })
  const sum = (rows: Iterable<DailyTrafficRow>) => {
    let visitors = 0
    let pageviews = 0
    for (const r of rows) { visitors += r.visitors; pageviews += r.pageviews }
    return { visitors, pageviews }
  }

  return {
    from,
    to: today,
    series,
    totals: sum(series),
    prevTotals: prevFrom ? sum(prev.values()) : null,
    countries,
    referrers,
    prevCountries: Object.fromEntries(prevCountries.map(r => [r.key, r.visitors])),
    prevReferrers: Object.fromEntries(prevReferrers.map(r => [r.key, r.visitors])),
  }
}

// 5-minute cache per range; `today` is part of the key so a new UTC day never
// serves yesterday's frame. The owner re-checking the page costs no queries.
export const getTraffic = (f: StatsFilters) => {
  const today = iso(new Date())
  return unstable_cache(
    () => fetchTraffic(f.range, today, f),
    ['admin-traffic', f.range, f.ref ?? '∅', f.country ?? '∅', today],
    { revalidate: 300 },
  )()
}

// ── Top pages (raw table, filtered by referrer / country) ───────────────────

type RawTopPage = { entity_type: string; entity_id: number | string; path: string; pageviews: number | string }

async function fetchTopPages(f: StatsFilters, today: string): Promise<TopPageRow[]> {
  // The raw table is pruned at 90 days, so "all time" is the last 90 days here.
  const days = f.range === 'all' ? 90 : Number(f.range)
  const from = addDays(today, -(days - 1))
  const sb = adminClient()
  const { data, error } = await withDbRetry(
    () => sb.rpc('admin_top_pages', {
      p_from: `${from}T00:00:00Z`,
      p_to: `${addDays(today, 1)}T00:00:00Z`,
      p_referrer: f.ref,
      p_country: f.country,
      p_limit: 25,
    }),
    'admin_top_pages',
  )
  if (error) throw new Error(`admin_top_pages: ${error.message}`)
  const rows = (data ?? []) as RawTopPage[]

  const bookIds = rows.filter(r => r.entity_type === 'book').map(r => Number(r.entity_id))
  const authorIds = rows.filter(r => r.entity_type === 'author').map(r => Number(r.entity_id))
  const [books, authors] = await Promise.all([
    bookIds.length ? sb.from('books').select('id, title, slug').in('id', bookIds) : Promise.resolve({ data: [] }),
    authorIds.length ? sb.from('authors').select('id, display_name, slug').in('id', authorIds) : Promise.resolve({ data: [] }),
  ])
  const bookMap = new Map((books.data ?? []).map(b => [Number(b.id), b]))
  const authorMap = new Map((authors.data ?? []).map(a => [Number(a.id), a]))

  return rows.map(r => {
    const id = Number(r.entity_id)
    if (r.entity_type === 'book') {
      const b = bookMap.get(id)
      if (b?.slug) return { path: r.path, pageviews: Number(r.pageviews), label: b.title, href: `/books/${b.slug}` }
    }
    if (r.entity_type === 'author') {
      const a = authorMap.get(id)
      if (a?.slug) return { path: r.path, pageviews: Number(r.pageviews), label: a.display_name, href: `/authors/${a.slug}` }
    }
    return { path: r.path, pageviews: Number(r.pageviews), label: r.path, href: r.path }
  })
}

export const getTopPages = (f: StatsFilters) => {
  const today = iso(new Date())
  return unstable_cache(
    () => fetchTopPages(f, today),
    ['admin-top-pages', f.range, f.ref ?? '∅', f.country ?? '∅', today],
    { revalidate: 300 },
  )()
}
