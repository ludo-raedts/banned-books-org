import { unstable_cache } from 'next/cache'
import { identifyBot } from './known-bots'

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'

type Totals = {
  requests: number
  cachedRequests: number
  bytes: number
  cachedBytes: number
  threats: number
}

type StatusBuckets = {
  s2xx: number
  s3xx: number
  s4xx: number
  s5xx: number
  other: number
}

// Splits the raw "threats" count into "blocks from our own WAF rules" (bots we
// deliberately keep out — scrapers / AI-training crawlers / empty UA) vs. blocks
// that came from Cloudflare's own threat detection (managed ruleset / Bot Fight
// Mode) — i.e. genuinely suspicious traffic. Without this, the bare threats
// number reads as "under attack" when it's mostly our own bot policy at work.
export type ThreatBreakdown = {
  ownRules: number   // source = firewallCustom (our rules)
  managed: number    // source = firewallManaged (CF managed ruleset — exploits)
  botFight: number   // source = botFight (legacy Bot Fight Mode)
  other: number      // anything else (rate limit, etc.)
  truncated: boolean // hit the pagination safety cap → counts are a floor
}

export type CloudflareSnapshot = {
  totals: Totals
  prevTotals: Totals
  threatBreakdown: ThreatBreakdown
  topIPs: Array<{
    clientIP: string
    country: string | null
    requests: number
    tag: 'home' | 'work' | null
    bot: string | null
  }>
  statusBuckets: StatusBuckets
  prevStatusBuckets: StatusBuckets
}

const QUERY = `
  query ZoneSnapshot($zone: String!, $since: Time!, $prevSince: Time!, $prevUntil: Time!) {
    viewer {
      zones(filter: { zoneTag: $zone }) {
        now: httpRequests1hGroups(
          limit: 24
          filter: { datetime_geq: $since }
        ) {
          sum {
            requests
            cachedRequests
            bytes
            cachedBytes
            threats
          }
        }
        prev: httpRequests1hGroups(
          limit: 24
          filter: { datetime_geq: $prevSince, datetime_lt: $prevUntil }
        ) {
          sum {
            requests
            cachedRequests
            bytes
            cachedBytes
            threats
          }
        }
        topIPs: httpRequestsAdaptiveGroups(
          limit: 5
          filter: { datetime_geq: $since }
          orderBy: [count_DESC]
        ) {
          count
          dimensions {
            clientIP
            clientCountryName
          }
        }
        statusCodes: httpRequestsAdaptiveGroups(
          limit: 100
          filter: { datetime_geq: $since }
          orderBy: [count_DESC]
        ) {
          count
          dimensions {
            edgeResponseStatus
          }
        }
        prevStatusCodes: httpRequestsAdaptiveGroups(
          limit: 100
          filter: { datetime_geq: $prevSince, datetime_lt: $prevUntil }
          orderBy: [count_DESC]
        ) {
          count
          dimensions {
            edgeResponseStatus
          }
        }
      }
    }
  }
`

// Per-event firewall log. We can't use firewallEventsAdaptiveGroups (the
// aggregating variant needs a broader token scope than our Analytics:Read and
// returns an authz error), so we page through the raw events instead. Each page
// caps at 200; we walk datetime_lt backwards until a short page or the safety cap.
const FW_QUERY = `
  query Threats($zone: String!, $since: Time!, $until: Time!) {
    viewer {
      zones(filter: { zoneTag: $zone }) {
        firewallEventsAdaptive(
          limit: 200
          filter: { datetime_geq: $since, datetime_lt: $until }
          orderBy: [datetime_DESC]
        ) {
          datetime
          source
        }
      }
    }
  }
`

type FWEvent = { datetime: string; source: string }
type FWResponse = {
  data?: { viewer?: { zones?: Array<{ firewallEventsAdaptive: FWEvent[] }> } }
  errors?: Array<{ message: string }>
}

async function fetchThreatBreakdown(token: string, zone: string, since: string): Promise<ThreatBreakdown> {
  const out: ThreatBreakdown = { ownRules: 0, managed: 0, botFight: 0, other: 0, truncated: false }
  let until = new Date().toISOString()
  const MAX_PAGES = 10 // 10 × 200 = 2000 events ceiling; far above normal daily volume
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: FW_QUERY, variables: { zone, since, until } }),
      cache: 'no-store',
    })
    if (!res.ok) break
    const json = (await res.json()) as FWResponse
    if (json.errors?.length) {
      console.error('[cloudflare] firewall events errors', json.errors)
      break
    }
    const events = json.data?.viewer?.zones?.[0]?.firewallEventsAdaptive ?? []
    for (const e of events) {
      if (e.source === 'firewallCustom') out.ownRules++
      else if (e.source === 'firewallManaged') out.managed++
      else if (e.source === 'botFight') out.botFight++
      else out.other++
    }
    if (events.length < 200) return out
    const oldest = events[events.length - 1].datetime
    if (oldest <= since) return out
    until = oldest
    if (page === MAX_PAGES - 1) out.truncated = true
  }
  return out
}

type HourBucket = { sum: Totals }
type AdaptiveStatusRow = { count: number; dimensions: { edgeResponseStatus: number } }

type CFResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        now: HourBucket[]
        prev: HourBucket[]
        topIPs: Array<{
          count: number
          dimensions: {
            clientIP: string
            clientCountryName: string | null
          }
        }>
        statusCodes: AdaptiveStatusRow[]
        prevStatusCodes: AdaptiveStatusRow[]
      }>
    }
  }
  errors?: Array<{ message: string }>
}

type IPMatcher = { exact: Set<string>; prefixes: string[] }

function parseIPList(raw: string | undefined): IPMatcher {
  const exact = new Set<string>()
  const prefixes: string[] = []
  if (!raw) return { exact, prefixes }
  for (const entry of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    if (entry.endsWith(':')) prefixes.push(entry.toLowerCase())
    else exact.add(entry.toLowerCase())
  }
  return { exact, prefixes }
}

function matchIP(ip: string, m: IPMatcher): boolean {
  const lower = ip.toLowerCase()
  if (m.exact.has(lower)) return true
  return m.prefixes.some(p => lower.startsWith(p))
}

function tagIP(ip: string, home: IPMatcher, work: IPMatcher): 'home' | 'work' | null {
  if (matchIP(ip, work)) return 'work'
  if (matchIP(ip, home)) return 'home'
  return null
}

function sumHourBuckets(rows: HourBucket[]): Totals {
  return rows.reduce(
    (acc, b) => ({
      requests: acc.requests + (b.sum.requests ?? 0),
      cachedRequests: acc.cachedRequests + (b.sum.cachedRequests ?? 0),
      bytes: acc.bytes + (b.sum.bytes ?? 0),
      cachedBytes: acc.cachedBytes + (b.sum.cachedBytes ?? 0),
      threats: acc.threats + (b.sum.threats ?? 0),
    }),
    { requests: 0, cachedRequests: 0, bytes: 0, cachedBytes: 0, threats: 0 },
  )
}

function bucketStatusRows(rows: AdaptiveStatusRow[]): StatusBuckets {
  const buckets: StatusBuckets = { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, other: 0 }
  for (const row of rows) {
    const code = row.dimensions.edgeResponseStatus
    const reqs = row.count
    if (code >= 200 && code < 300) buckets.s2xx += reqs
    else if (code >= 300 && code < 400) buckets.s3xx += reqs
    else if (code >= 400 && code < 500) buckets.s4xx += reqs
    else if (code >= 500 && code < 600) buckets.s5xx += reqs
    else buckets.other += reqs
  }
  return buckets
}

async function fetchSnapshot(): Promise<CloudflareSnapshot | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zone = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zone) return null

  const homeIPs = parseIPList(process.env.ADMIN_HOME_IPS)
  const workIPs = parseIPList(process.env.ADMIN_WORK_IPS)

  // Free plan caps each window at 1 day — pull a minute under the limit so clock skew
  // can't push us into a "time range wider than 1d" error from Cloudflare.
  const minute = 60 * 1000
  const dayMinusOne = (24 * 60 - 1) * minute
  const now = Date.now()
  const since = new Date(now - dayMinusOne).toISOString()
  const prevUntil = new Date(now - 24 * 60 * minute).toISOString()
  const prevSince = new Date(now - (48 * 60 - 1) * minute).toISOString()

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY, variables: { zone, since, prevSince, prevUntil } }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.error('[cloudflare] HTTP', res.status, await res.text().catch(() => ''))
    return null
  }
  const json = (await res.json()) as CFResponse
  if (json.errors?.length) {
    console.error('[cloudflare] GraphQL errors', json.errors)
    return null
  }
  const zoneData = json.data?.viewer?.zones?.[0]
  if (!zoneData) return null

  const totals = sumHourBuckets(zoneData.now)
  const prevTotals = sumHourBuckets(zoneData.prev)

  // Categorise the threats into our-own-rules vs genuinely-suspicious. Best-effort:
  // if this fails it stays all-zero and the card falls back to the bare count.
  const threatBreakdown = await fetchThreatBreakdown(token, zone, since)

  const topIPs = zoneData.topIPs.map(r => ({
    clientIP: r.dimensions.clientIP,
    country: r.dimensions.clientCountryName,
    requests: r.count,
    tag: tagIP(r.dimensions.clientIP, homeIPs, workIPs),
    bot: identifyBot(r.dimensions.clientIP),
  }))

  const statusBuckets = bucketStatusRows(zoneData.statusCodes)
  const prevStatusBuckets = bucketStatusRows(zoneData.prevStatusCodes ?? [])

  return { totals, prevTotals, threatBreakdown, topIPs, statusBuckets, prevStatusBuckets }
}

export const getCloudflareSnapshot = unstable_cache(
  fetchSnapshot,
  ['cloudflare-snapshot-v9'],
  { revalidate: 300 },
)
