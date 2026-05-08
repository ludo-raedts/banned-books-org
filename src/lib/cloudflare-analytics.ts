import { unstable_cache } from 'next/cache'

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'

export type CloudflareSnapshot = {
  totals: {
    requests: number
    cachedRequests: number
    bytes: number
    cachedBytes: number
    threats: number
  }
  topIPs: Array<{
    clientIP: string
    country: string | null
    requests: number
    tag: 'home' | 'work' | null
  }>
  statusBuckets: {
    s2xx: number
    s3xx: number
    s4xx: number
    s5xx: number
    other: number
  }
}

const QUERY = `
  query ZoneSnapshot($zone: String!, $since: Time!) {
    viewer {
      zones(filter: { zoneTag: $zone }) {
        httpRequests1hGroups(
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
      }
    }
  }
`

type CFResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequests1hGroups: Array<{
          sum: {
            requests: number
            cachedRequests: number
            bytes: number
            cachedBytes: number
            threats: number
          }
        }>
        topIPs: Array<{
          count: number
          dimensions: {
            clientIP: string
            clientCountryName: string | null
          }
        }>
        statusCodes: Array<{
          count: number
          dimensions: { edgeResponseStatus: number }
        }>
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

async function fetchSnapshot(): Promise<CloudflareSnapshot | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zone = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zone) return null

  const homeIPs = parseIPList(process.env.ADMIN_HOME_IPS)
  const workIPs = parseIPList(process.env.ADMIN_WORK_IPS)

  // Free plan caps the window at 1 day — pull a minute under the limit so clock skew
  // can't push us into a "time range wider than 1d" error from Cloudflare.
  const since = new Date(Date.now() - (24 * 60 - 1) * 60 * 1000).toISOString()

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY, variables: { zone, since } }),
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

  const totals = zoneData.httpRequests1hGroups.reduce(
    (acc, b) => ({
      requests: acc.requests + (b.sum.requests ?? 0),
      cachedRequests: acc.cachedRequests + (b.sum.cachedRequests ?? 0),
      bytes: acc.bytes + (b.sum.bytes ?? 0),
      cachedBytes: acc.cachedBytes + (b.sum.cachedBytes ?? 0),
      threats: acc.threats + (b.sum.threats ?? 0),
    }),
    { requests: 0, cachedRequests: 0, bytes: 0, cachedBytes: 0, threats: 0 },
  )

  const topIPs = zoneData.topIPs.map(r => ({
    clientIP: r.dimensions.clientIP,
    country: r.dimensions.clientCountryName,
    requests: r.count,
    tag: tagIP(r.dimensions.clientIP, homeIPs, workIPs),
  }))

  const buckets = { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, other: 0 }
  for (const row of zoneData.statusCodes) {
    const code = row.dimensions.edgeResponseStatus
    const reqs = row.count
    if (code >= 200 && code < 300) buckets.s2xx += reqs
    else if (code >= 300 && code < 400) buckets.s3xx += reqs
    else if (code >= 400 && code < 500) buckets.s4xx += reqs
    else if (code >= 500 && code < 600) buckets.s5xx += reqs
    else buckets.other += reqs
  }

  return { totals, topIPs, statusBuckets: buckets }
}

export const getCloudflareSnapshot = unstable_cache(
  fetchSnapshot,
  ['cloudflare-snapshot-v6'],
  { revalidate: 300 },
)
