/**
 * Diagnose Bing Webmaster Tools traffic — daily breakdown + top queries + top pages.
 *
 * Bing covers Bing.com, Yahoo, DuckDuckGo, Ecosia, and several smaller engines,
 * so it's roughly 5-10% of "non-Google" search traffic in many markets.
 *
 * Usage:
 *   pnpm tsx scripts/bing-diagnose.ts
 *   pnpm tsx scripts/bing-diagnose.ts --site=https://example.com/
 *
 * Auth: reads BING_WEBMASTER_API_KEY from .env.local.
 * Site URL must match how the property is registered in Bing Webmaster Tools
 * (often the canonical apex/non-www form — Bing does not use the GSC
 * `sc-domain:` prefix).
 */
import { existsSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1).replace(/^["']|["']$/g, '')
  }
}
loadEnvLocal()

function arg(name: string, fallback?: string) {
  const a = process.argv.slice(2).find(x => x.startsWith(`--${name}=`))
  return a ? a.split('=').slice(1).join('=') : fallback
}

// Bing's JSON dates come back as "/Date(unix_ms-0700)/" — extract the ms.
function parseBingDate(s: string): Date | null {
  const m = s.match(/\/Date\((\d+)/)
  return m ? new Date(parseInt(m[1], 10)) : null
}
function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

async function call<T>(endpoint: string, siteUrl: string, apiKey: string): Promise<T[]> {
  const url = `https://ssl.bing.com/webmaster/api.svc/json/${endpoint}?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${endpoint} → HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return (json.d ?? []) as T[]
}

type TrafficRow = { Date: string; Clicks: number; Impressions: number }
type QueryRow = { Query: string; Date: string; Clicks: number; Impressions: number; AvgImpressionPosition: number; AvgClickPosition: number }
// Bing API quirk: GetPageStats reuses the same shape as GetQueryStats — the page URL
// arrives in the `Query` field, not a separate `Page` field.
type PageRow = QueryRow

async function main() {
  const apiKey = process.env.BING_WEBMASTER_API_KEY
  if (!apiKey) throw new Error('BING_WEBMASTER_API_KEY not set (looked in .env.local + environment)')
  const site = arg('site', 'https://banned-books.org/')!
  console.log(`\nBing Webmaster Tools — ${site}\n`)

  // ─── Daily traffic ──────────────────────────────────────────────────────
  const traffic = await call<TrafficRow>('GetRankAndTrafficStats', site, apiKey)
  const daily = traffic
    .map(r => ({ date: parseBingDate(r.Date), clicks: r.Clicks, impr: r.Impressions }))
    .filter((r): r is { date: Date; clicks: number; impr: number } => r.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  if (daily.length === 0) {
    console.log('(no daily traffic rows)')
    return
  }
  const maxImpr = Math.max(...daily.map(r => r.impr), 1)
  const barW = 40
  console.log(`=== Daily traffic (${daily.length} days, ${isoDate(daily[0].date)} → ${isoDate(daily[daily.length - 1].date)}) ===`)
  console.log('date         clicks   impr   ' + 'impressions'.padEnd(barW))
  console.log('─'.repeat(70))
  for (const r of daily) {
    const clicks = String(r.clicks).padStart(5)
    const impr = String(r.impr).padStart(6)
    const bar = '█'.repeat(Math.round((r.impr / maxImpr) * barW))
    console.log(`${isoDate(r.date)}  ${clicks}  ${impr}  ${bar}`)
  }
  const window = 7
  const recent = daily.slice(-window).reduce((s, r) => s + r.clicks, 0) / window
  const prior = daily.slice(-window * 2, -window).reduce((s, r) => s + r.clicks, 0) / window
  const change = prior > 0 ? ((recent - prior) / prior) * 100 : recent > 0 ? Infinity : 0
  console.log(`\nLast ${window}d avg clicks: ${recent.toFixed(1)}/day`)
  console.log(`Prior ${window}d avg clicks: ${prior.toFixed(1)}/day`)
  console.log(`Change: ${change === Infinity ? '∞ (from zero)' : (change >= 0 ? '+' : '') + change.toFixed(1) + '%'}`)

  // ─── Top queries ────────────────────────────────────────────────────────
  console.log(`\n=== Top queries (aggregated across window) ===`)
  const queries = await call<QueryRow>('GetQueryStats', site, apiKey)
  const aggQ = new Map<string, { clicks: number; impr: number; posSum: number; rows: number }>()
  for (const q of queries) {
    const cur = aggQ.get(q.Query) ?? { clicks: 0, impr: 0, posSum: 0, rows: 0 }
    cur.clicks += q.Clicks
    cur.impr += q.Impressions
    cur.posSum += q.AvgImpressionPosition * q.Impressions
    cur.rows += 1
    aggQ.set(q.Query, cur)
  }
  const rankedQ = [...aggQ.entries()]
    .map(([query, s]) => ({ query, clicks: s.clicks, impr: s.impr, avgPos: s.impr > 0 ? s.posSum / s.impr : 0 }))
    .sort((a, b) => b.impr - a.impr)
  console.log(`  ${'impr'.padStart(5)} ${'clk'.padStart(4)} ${'ctr%'.padStart(5)} ${'pos'.padStart(5)}  query`)
  console.log('  ' + '─'.repeat(80))
  for (const q of rankedQ.slice(0, 20)) {
    const impr = String(q.impr).padStart(5)
    const clk = String(q.clicks).padStart(4)
    const ctr = q.impr > 0 ? ((q.clicks / q.impr) * 100).toFixed(1).padStart(5) : '  0.0'
    const pos = q.avgPos.toFixed(1).padStart(5)
    console.log(`  ${impr} ${clk} ${ctr} ${pos}  ${q.query.slice(0, 80)}`)
  }

  // ─── Top pages ──────────────────────────────────────────────────────────
  console.log(`\n=== Top pages (aggregated across window) ===`)
  const pages = await call<PageRow>('GetPageStats', site, apiKey)
  const aggP = new Map<string, { clicks: number; impr: number }>()
  for (const p of pages) {
    const url = p.Query  // see PageRow note: Bing reuses `Query` for page URL
    if (!url) continue
    const cur = aggP.get(url) ?? { clicks: 0, impr: 0 }
    cur.clicks += p.Clicks
    cur.impr += p.Impressions
    aggP.set(url, cur)
  }
  const rankedP = [...aggP.entries()]
    .map(([page, s]) => ({ page, clicks: s.clicks, impr: s.impr }))
    .sort((a, b) => b.impr - a.impr)
  console.log(`  ${'impr'.padStart(5)} ${'clk'.padStart(4)} ${'ctr%'.padStart(5)}  page`)
  console.log('  ' + '─'.repeat(80))
  for (const p of rankedP.slice(0, 15)) {
    const impr = String(p.impr).padStart(5)
    const clk = String(p.clicks).padStart(4)
    const ctr = p.impr > 0 ? ((p.clicks / p.impr) * 100).toFixed(1).padStart(5) : '  0.0'
    const pagePath = p.page.replace(/^https?:\/\/[^/]+/, '') || '/'
    console.log(`  ${impr} ${clk} ${ctr}  ${pagePath}`)
  }

  // Save full results for follow-up
  const outDir = join(process.cwd(), 'data', 'gsc')  // share dir with GSC outputs
  await fs.mkdir(outDir, { recursive: true })
  const stamp = isoDate(daily[daily.length - 1].date)
  const file = join(outDir, `bing-snapshot-${stamp}.json`)
  await fs.writeFile(file, JSON.stringify({ site, daily, queries: rankedQ, pages: rankedP }, null, 2))
  console.log(`\nSnapshot → ${file.replace(process.cwd() + '/', '')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
