import { Cloud, ShieldAlert, Network, BarChart3 } from 'lucide-react'
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

  const { totals, topIPs, statusBuckets } = snapshot
  const cacheHitPct = totals.requests > 0 ? Math.round((totals.cachedRequests / totals.requests) * 100) : 0

  const statusTotal = statusBuckets.s2xx + statusBuckets.s3xx + statusBuckets.s4xx + statusBuckets.s5xx + statusBuckets.other
  const pct = (n: number) => statusTotal > 0 ? (n / statusTotal) * 100 : 0
  const statusRows: Array<{ label: string; value: number; color: string; pct: number }> = [
    { label: '2xx OK', value: statusBuckets.s2xx, color: 'bg-emerald-500', pct: pct(statusBuckets.s2xx) },
    { label: '3xx Redirect', value: statusBuckets.s3xx, color: 'bg-blue-500', pct: pct(statusBuckets.s3xx) },
    { label: '4xx Client', value: statusBuckets.s4xx, color: 'bg-amber-500', pct: pct(statusBuckets.s4xx) },
    { label: '5xx Server', value: statusBuckets.s5xx, color: 'bg-red-500', pct: pct(statusBuckets.s5xx) },
  ]
  if (statusBuckets.other > 0) {
    statusRows.push({ label: 'Other', value: statusBuckets.other, color: 'bg-gray-400', pct: pct(statusBuckets.other) })
  }

  return (
    <>
      {/* Card 1 — 24h health */}
      <div className={cardCls}>
        <Cloud className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Cloudflare — 24h</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Edge requests, cache, and threats.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-1">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requests</dt>
            <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
              {compactNumber(totals.requests)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cache hit</dt>
            <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
              {cacheHitPct}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bandwidth</dt>
            <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
              {formatBytes(totals.bytes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Threats</dt>
            <dd className={`text-2xl font-bold tabular-nums leading-tight ${
              totals.threats > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'
            }`}>
              {compactNumber(totals.threats)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Card 2 — Top IPs */}
      <div className={cardCls}>
        <Network className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Top IPs — 24h</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">High‑volume sources — scraper indicators.</p>
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
                {row.home && (
                  <span className="text-xs shrink-0" title="Known admin IP">🏠</span>
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">5xx spike = something broke.</p>
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
            <dl className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 text-xs mt-1">
              {statusRows.map(r => (
                <div key={r.label} className="contents">
                  <dt className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-sm ${r.color}`} />
                    <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                  </dt>
                  <dd className="text-gray-400 dark:text-gray-500 tabular-nums text-right">
                    {r.pct.toFixed(1)}%
                  </dd>
                  <dd className="text-gray-700 dark:text-gray-300 tabular-nums text-right">
                    {compactNumber(r.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {totals.threats > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mt-auto">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {totals.threats.toLocaleString('en')} threat{totals.threats === 1 ? '' : 's'} blocked
          </p>
        )}
      </div>
    </>
  )
}
