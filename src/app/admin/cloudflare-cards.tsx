import { Cloud, Network, BarChart3 } from 'lucide-react'
import { getCloudflareSnapshot } from '@/lib/cloudflare-analytics'

const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-3 bg-white dark:bg-gray-900'

function flagEmoji(code: string | null) {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

function compactNumber(n: number): string {
  if (n < 1000) return n.toLocaleString('en')
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`
}

type Verdict = { tone: 'good' | 'info' | 'warn' | 'alert'; message: string }

const TONE_CLS: Record<Verdict['tone'], { text: string; dot: string }> = {
  good:  { text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  info:  { text: 'text-gray-500 dark:text-gray-400',       dot: 'bg-gray-400' },
  warn:  { text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500' },
  alert: { text: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500' },
}

function VerdictLine({ verdict }: { verdict: Verdict }) {
  const cls = TONE_CLS[verdict.tone]
  return (
    <p className={`text-xs flex items-center gap-1.5 mt-auto ${cls.text}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`} aria-hidden />
      <span>{verdict.message}</span>
    </p>
  )
}

function healthVerdict(threats: number, cacheHitPct: number, requests: number): Verdict {
  if (requests === 0) return { tone: 'info', message: 'No traffic in the last 24h.' }
  if (threats >= 100) return { tone: 'warn', message: `${threats} threats blocked — high. Check the CF firewall events.` }
  if (cacheHitPct < 20) return { tone: 'info', message: 'Low cache hit — expected, the site is mostly dynamic.' }
  return { tone: 'good', message: 'Healthy. CF is doing its job.' }
}

function statusVerdict(buckets: { s2xx: number; s4xx: number; s5xx: number; other: number }, total: number): Verdict {
  if (total === 0) return { tone: 'info', message: 'No requests in the last 24h.' }
  const pct5xx = (buckets.s5xx / total) * 100
  const pct4xx = (buckets.s4xx / total) * 100
  if (pct5xx > 1) return { tone: 'alert', message: `${pct5xx.toFixed(1)}% server errors — investigate.` }
  if (pct5xx > 0.1) return { tone: 'warn', message: `${buckets.s5xx} server errors — keep an eye on it.` }
  if (pct4xx > 15) return { tone: 'warn', message: `${pct4xx.toFixed(1)}% client errors — broken links worth checking.` }
  return { tone: 'good', message: 'No server errors. 4xx is normal background.' }
}

type Direction = 'up-good' | 'up-bad' | 'neutral'

function Delta({ current, previous, direction = 'neutral' }: { current: number; previous: number; direction?: Direction }) {
  if (previous === 0 && current === 0) {
    return <span className="text-[11px] text-gray-400 dark:text-gray-500">— vs prev 24h</span>
  }
  if (previous === 0) {
    return <span className="text-[11px] text-blue-500 dark:text-blue-400">new vs prev 24h</span>
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) {
    return <span className="text-[11px] text-gray-400 dark:text-gray-500">→ 0% vs prev 24h</span>
  }
  const up = pct > 0
  const arrow = up ? '↑' : '↓'
  let cls = 'text-gray-500 dark:text-gray-400'
  if (direction === 'up-good') cls = up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
  else if (direction === 'up-bad') cls = up ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
  return (
    <span className={`text-[11px] tabular-nums ${cls}`}>
      {arrow} {Math.abs(pct)}% <span className="text-gray-400 dark:text-gray-500 font-normal">vs prev 24h</span>
    </span>
  )
}

function Metric({ label, tooltip, value, valueClassName, current, previous, direction }: {
  label: string
  tooltip: string
  value: string
  valueClassName?: string
  current: number
  previous: number
  direction?: Direction
}) {
  return (
    <div>
      <dt
        className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-help"
        title={tooltip}
      >
        {label}
      </dt>
      <dd className={`text-2xl font-bold tabular-nums leading-tight ${valueClassName ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </dd>
      <Delta current={current} previous={previous} direction={direction} />
    </div>
  )
}

export default async function CloudflareCards() {
  const snapshot = await getCloudflareSnapshot()

  if (!snapshot) {
    return (
      <div className={`${cardCls} col-span-full`}>
        <Cloud className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Cloudflare</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Set <code>CLOUDFLARE_API_TOKEN</code> and <code>CLOUDFLARE_ZONE_ID</code> to see traffic, threats, and top IPs here.
          </p>
        </div>
      </div>
    )
  }

  const { totals, prevTotals, topIPs, statusBuckets, prevStatusBuckets } = snapshot
  const cacheHitPct = totals.requests > 0 ? Math.round((totals.cachedRequests / totals.requests) * 100) : 0
  const prevCacheHitPct = prevTotals.requests > 0 ? Math.round((prevTotals.cachedRequests / prevTotals.requests) * 100) : 0

  const statusTotal = statusBuckets.s2xx + statusBuckets.s3xx + statusBuckets.s4xx + statusBuckets.s5xx + statusBuckets.other
  const prevStatusTotal = prevStatusBuckets.s2xx + prevStatusBuckets.s3xx + prevStatusBuckets.s4xx + prevStatusBuckets.s5xx + prevStatusBuckets.other
  const pct = (n: number) => statusTotal > 0 ? (n / statusTotal) * 100 : 0
  const statusRows: Array<{
    label: string; tooltip: string; value: number; prevValue: number;
    color: string; pct: number; direction: Direction
  }> = [
    { label: '2xx OK',       tooltip: 'Successful responses. Higher is better.',                        value: statusBuckets.s2xx, prevValue: prevStatusBuckets.s2xx, color: 'bg-emerald-500', pct: pct(statusBuckets.s2xx), direction: 'up-good' },
    { label: '3xx Redirect', tooltip: 'Redirects (e.g. http→https or canonical URLs). Normal traffic.', value: statusBuckets.s3xx, prevValue: prevStatusBuckets.s3xx, color: 'bg-blue-500',    pct: pct(statusBuckets.s3xx), direction: 'neutral' },
    { label: '4xx Client',   tooltip: 'Client errors — usually 404s for dead URLs. <5% is fine.',       value: statusBuckets.s4xx, prevValue: prevStatusBuckets.s4xx, color: 'bg-amber-500',   pct: pct(statusBuckets.s4xx), direction: 'up-bad' },
    { label: '5xx Server',   tooltip: 'Server errors — your code or upstream broke. Should be ~0%.',    value: statusBuckets.s5xx, prevValue: prevStatusBuckets.s5xx, color: 'bg-red-500',     pct: pct(statusBuckets.s5xx), direction: 'up-bad' },
  ]
  if (statusBuckets.other > 0 || prevStatusBuckets.other > 0) {
    statusRows.push({ label: 'Other', tooltip: 'Non-standard codes (1xx informational, etc.).', value: statusBuckets.other, prevValue: prevStatusBuckets.other, color: 'bg-gray-400', pct: pct(statusBuckets.other), direction: 'neutral' })
  }

  const cardOneVerdict = healthVerdict(totals.threats, cacheHitPct, totals.requests)
  const cardThreeVerdict = statusVerdict(statusBuckets, statusTotal)

  return (
    <>
      {/* Card 1 — 24h health */}
      <div className={cardCls}>
        <Cloud className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Cloudflare — 24h</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Edge requests, cache, and threats. Hover labels for explanations.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-1">
          <Metric
            label="Requests"
            tooltip="Total HTTP requests Cloudflare's edge handled in the last 24 hours — including cache hits, dynamic SSR, and bot traffic."
            value={compactNumber(totals.requests)}
            current={totals.requests}
            previous={prevTotals.requests}
            direction="neutral"
          />
          <Metric
            label="Cache hit"
            tooltip="% of requests served from CF's edge cache. Static-heavy sites hit 70–90%. Banned-books is mostly dynamic SSR, so anything from 5–30% is normal."
            value={`${cacheHitPct}%`}
            current={cacheHitPct}
            previous={prevCacheHitPct}
            direction="up-good"
          />
          <Metric
            label="Bandwidth"
            tooltip="Total bytes Cloudflare served from the edge in the last 24h."
            value={formatBytes(totals.bytes)}
            current={totals.bytes}
            previous={prevTotals.bytes}
            direction="neutral"
          />
          <Metric
            label="Threats"
            tooltip="Requests CF auto-blocked (bots, exploits, WAF rules). <100/day is background noise. >1000/day suggests an active attack."
            value={compactNumber(totals.threats)}
            valueClassName={totals.threats > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
            current={totals.threats}
            previous={prevTotals.threats}
            direction="up-bad"
          />
        </dl>
        <VerdictLine verdict={cardOneVerdict} />
      </div>

      {/* Card 2 — Top IPs */}
      <div className={cardCls}>
        <Network className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Top IPs — 24h</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">High‑volume sources. 🏠 = home, 🏢 = work — ignore those.</p>
        </div>
        {topIPs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-1">No traffic in the last 24h.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm mt-1">
            {topIPs.map(row => (
              <li key={row.clientIP} className="flex items-baseline gap-2 min-w-0">
                <span className="text-base shrink-0 leading-none">{flagEmoji(row.country)}</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0" title={row.clientIP}>
                  {row.clientIP}
                </span>
                {row.tag === 'home' && (
                  <span className="text-xs shrink-0" title="Home IP">🏠</span>
                )}
                {row.tag === 'work' && (
                  <span className="text-xs shrink-0" title="Work IP">🏢</span>
                )}
                <span className="text-xs text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                  {compactNumber(row.requests)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Card 3 — Status code distribution */}
      <div className={cardCls}>
        <BarChart3 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Status codes — 24h</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">5xx = server broke · 4xx = client errors / 404s.</p>
        </div>
        {statusTotal === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-1">No requests in the last 24h.</p>
        ) : (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              {statusRows.map(r => r.pct > 0 && (
                <div key={r.label} className={r.color} style={{ width: `${r.pct}%` }} title={`${r.label}: ${r.value.toLocaleString('en')}`} />
              ))}
            </div>
            <dl className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1 text-xs mt-1 items-baseline">
              {statusRows.map(r => (
                <div key={r.label} className="contents">
                  <dt className="flex items-center gap-1.5 cursor-help" title={r.tooltip}>
                    <span className={`w-2 h-2 rounded-sm ${r.color}`} />
                    <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                  </dt>
                  <dd className="text-gray-400 dark:text-gray-500 tabular-nums text-right">
                    {r.pct.toFixed(1)}%
                  </dd>
                  <dd className="text-gray-700 dark:text-gray-300 tabular-nums text-right">
                    {compactNumber(r.value)}
                  </dd>
                  <dd className="text-right shrink-0">
                    <Delta current={r.value} previous={r.prevValue} direction={r.direction} />
                  </dd>
                </div>
              ))}
            </dl>
            {prevStatusTotal === 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                No prior 24h data yet — deltas will populate after 48h.
              </p>
            )}
          </div>
        )}
        <VerdictLine verdict={cardThreeVerdict} />
      </div>
    </>
  )
}
