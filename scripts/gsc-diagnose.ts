/**
 * Diagnose GSC traffic — daily breakdown sitewide + filtered.
 *
 * Usage:
 *   pnpm tsx scripts/gsc-diagnose.ts                    # last 60 days sitewide
 *   pnpm tsx scripts/gsc-diagnose.ts --days=90
 *   pnpm tsx scripts/gsc-diagnose.ts --query=deenie     # filter to queries containing "deenie"
 *   pnpm tsx scripts/gsc-diagnose.ts --page=/books/deenie
 *   pnpm tsx scripts/gsc-diagnose.ts --exclude-bots     # daily breakdown, organic-only (drops templated bot queries)
 *   pnpm tsx scripts/gsc-diagnose.ts --only-bots        # daily breakdown, templated bot queries only
 *
 * "Templated/bot" queries are machine-generated lookups of the form
 *   "<title>" <author> challenged banned   (and word-order permutations).
 * No human phrases searches this way; it's automated/AI tooling enumerating
 * banned-book status. High volume, ~0 CTR — it pollutes impression/CTR trends,
 * so we label and optionally exclude it.
 */
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
const HOME = os.homedir()
const CLIENT_FILE = path.join(HOME, '.gcp', 'banned-books-gsc-oauth.json')
const TOKEN_FILE = path.join(HOME, '.gcp', 'banned-books-gsc-token.json')

type OAuthKeys = { client_id: string; client_secret: string; redirect_uris: string[] }
async function readOAuthKeys(): Promise<OAuthKeys> {
  const parsed = JSON.parse(await fs.readFile(CLIENT_FILE, 'utf8'))
  const k = parsed.installed ?? parsed.web
  if (!k) throw new Error(`No installed/web block in ${CLIENT_FILE}`)
  return k
}
async function authorize(): Promise<OAuth2Client> {
  const k = await readOAuthKeys()
  const client = new google.auth.OAuth2(k.client_id, k.client_secret, k.redirect_uris[0])
  try {
    client.setCredentials(JSON.parse(await fs.readFile(TOKEN_FILE, 'utf8')))
    await client.getAccessToken()
    return client
  } catch {
    const fresh = await authenticate({ scopes: SCOPES, keyfilePath: CLIENT_FILE })
    const payload = {
      type: 'authorized_user',
      client_id: k.client_id,
      client_secret: k.client_secret,
      refresh_token: fresh.credentials.refresh_token,
    }
    await fs.writeFile(TOKEN_FILE, JSON.stringify(payload, null, 2))
    await fs.chmod(TOKEN_FILE, 0o600)
    return fresh as OAuth2Client
  }
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysAgo(n: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d }
function arg(name: string, fallback?: string) {
  const a = process.argv.slice(2).find(x => x.startsWith(`--${name}=`))
  return a ? a.split('=').slice(1).join('=') : fallback
}
function flag(name: string) { return process.argv.slice(2).includes(`--${name}`) }

/**
 * Signature of the templated / bot query pattern, e.g.
 *   "turtles all the way down" challenged banned
 *   "let it snow" john green banned challenged book
 * The tell is the bare adjacency of "challenged" + "banned" in either order —
 * no human formulates a search this way.
 * BOT_QUERY_RE2 is the RE2 form for GSC's includingRegex/excludingRegex (server-side);
 * BOT_QUERY_RE is the JS equivalent for client-side classification.
 */
const BOT_QUERY_RE2 = '(?i)(challenged banned|banned challenged)'
const BOT_QUERY_RE = /(challenged banned|banned challenged)/i
function isTemplatedQuery(q: string) { return BOT_QUERY_RE.test(q) }

async function main() {
  const site = arg('site', 'sc-domain:banned-books.org')!
  const days = Number(arg('days', '60'))
  const queryFilter = arg('query')
  const pageFilter = arg('page')
  const excludeBots = flag('exclude-bots')
  const onlyBots = flag('only-bots')
  const auth = await authorize()
  const sc = google.searchconsole({ version: 'v1', auth })

  const endDate = isoDate(daysAgo(2))
  const startDate = isoDate(daysAgo(days + 2))
  const baseLabel = queryFilter ? `query~"${queryFilter}"` : pageFilter ? `page~"${pageFilter}"` : 'sitewide'
  const botLabel = excludeBots ? ' (organic only)' : onlyBots ? ' (templated/bot only)' : ''
  console.log(`\n${site}  (${startDate} → ${endDate})  filter: ${baseLabel}${botLabel}\n`)
  if (excludeBots || onlyBots) {
    console.log('⚠  Query-dimension filter active: GSC drops anonymized long-tail rows, which carry')
    console.log('   most clicks. Use these daily totals for IMPRESSION patterns, not click trends.\n')
  }

  const filters: Array<{ dimension: string; operator: string; expression: string }> = []
  if (queryFilter) filters.push({ dimension: 'query', operator: 'contains', expression: queryFilter })
  if (pageFilter) filters.push({ dimension: 'page', operator: 'contains', expression: pageFilter })
  if (excludeBots) filters.push({ dimension: 'query', operator: 'excludingRegex', expression: BOT_QUERY_RE2 })
  if (onlyBots) filters.push({ dimension: 'query', operator: 'includingRegex', expression: BOT_QUERY_RE2 })
  const dimensionFilterGroups = filters.length ? [{ filters }] : undefined

  const { data } = await sc.searchanalytics.query({
    siteUrl: site,
    requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: days + 5, dimensionFilterGroups },
  })

  const rows = (data.rows ?? []).sort((a, b) => (a.keys?.[0] ?? '').localeCompare(b.keys?.[0] ?? ''))
  if (!rows.length) { console.log('(no rows)'); return }

  const maxImpr = Math.max(...rows.map(r => r.impressions ?? 0))
  const barW = 40
  console.log('date         clicks   impr   ctr%  pos   ' + 'impressions'.padEnd(barW))
  console.log('─'.repeat(80))
  for (const row of rows) {
    const date = row.keys?.[0] ?? '?'
    const clicks = String(row.clicks ?? 0).padStart(5)
    const impr = row.impressions ?? 0
    const imprStr = String(impr).padStart(6)
    const ctr = ((row.ctr ?? 0) * 100).toFixed(1).padStart(5)
    const pos = (row.position ?? 0).toFixed(1).padStart(5)
    const bar = '█'.repeat(Math.round((impr / maxImpr) * barW))
    console.log(`${date}  ${clicks}  ${imprStr}  ${ctr}  ${pos}  ${bar}`)
  }

  // 7-day rolling average for the last stretch
  const window = 7
  const recentTrail = rows.slice(-window).reduce((s, r) => s + (r.clicks ?? 0), 0) / window
  const priorTrail = rows.slice(-window * 2, -window).reduce((s, r) => s + (r.clicks ?? 0), 0) / window
  const trailChange = priorTrail > 0 ? ((recentTrail - priorTrail) / priorTrail) * 100 : 0
  console.log(`\nLast ${window}d avg clicks: ${recentTrail.toFixed(1)}/day`)
  console.log(`Prior ${window}d avg clicks: ${priorTrail.toFixed(1)}/day`)
  console.log(`Change: ${trailChange >= 0 ? '+' : ''}${trailChange.toFixed(1)}%`)

  // Query classification: split traffic into organic vs templated/bot lookups.
  // Skipped when a query/page filter or a bot flag is active (the split is the whole point of the default view).
  if (!queryFilter && !pageFilter && !excludeBots && !onlyBots) {
    // High rowLimit: templated bot queries have ~0 clicks and sort to the bottom,
    // so a small cap truncates them out and understates their share. 25000 is the GSC max.
    const { data: qData } = await sc.searchanalytics.query({
      siteUrl: site,
      requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: 25000 },
    })
    const qRows = qData.rows ?? []
    const bucket = (rs: typeof qRows) => rs.reduce<{ q: number; clicks: number; impr: number }>(
      (a, r) => ({ q: a.q + 1, clicks: a.clicks + (r.clicks ?? 0), impr: a.impr + (r.impressions ?? 0) }),
      { q: 0, clicks: 0, impr: 0 },
    )
    const bots = qRows.filter(r => isTemplatedQuery(r.keys?.[0] ?? ''))
    const organic = qRows.filter(r => !isTemplatedQuery(r.keys?.[0] ?? ''))
    const b = bucket(bots)
    const o = bucket(organic)
    const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) : '0.0')
    const ctr = (c: number, i: number) => (i > 0 ? ((c / i) * 100).toFixed(2) : '0.00')

    console.log(`\nQuery classification (${qRows.length} named queries; anonymized long-tail not included):`)
    console.log('bucket          queries   clicks      impr   ctr%')
    console.log('─'.repeat(56))
    console.log(`organic         ${String(o.q).padStart(7)}  ${String(o.clicks).padStart(7)}  ${String(o.impr).padStart(8)}  ${ctr(o.clicks, o.impr).padStart(5)}`)
    console.log(`templated/bot   ${String(b.q).padStart(7)}  ${String(b.clicks).padStart(7)}  ${String(b.impr).padStart(8)}  ${ctr(b.clicks, b.impr).padStart(5)}`)
    console.log(`\nTemplated/bot share: ${pct(b.impr, b.impr + o.impr)}% of impressions, ${pct(b.clicks, b.clicks + o.clicks)}% of clicks`)
    if (bots.length) {
      console.log('Examples:')
      bots.slice(0, 5).forEach(r => console.log(`  · ${r.keys?.[0]}  (${r.impressions ?? 0}i, ${r.clicks ?? 0}c)`))
      console.log('Re-run with --only-bots to inspect the pattern, or --exclude-bots for organic-only impressions (clicks unreliable — anonymized rows drop out).')
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
