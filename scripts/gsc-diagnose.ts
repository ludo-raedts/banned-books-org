/**
 * Diagnose GSC traffic — daily breakdown sitewide + filtered.
 *
 * Usage:
 *   pnpm tsx scripts/gsc-diagnose.ts                    # last 60 days sitewide
 *   pnpm tsx scripts/gsc-diagnose.ts --days=90
 *   pnpm tsx scripts/gsc-diagnose.ts --query=deenie     # filter to queries containing "deenie"
 *   pnpm tsx scripts/gsc-diagnose.ts --page=/books/deenie
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

async function main() {
  const site = arg('site', 'sc-domain:banned-books.org')!
  const days = Number(arg('days', '60'))
  const queryFilter = arg('query')
  const pageFilter = arg('page')
  const auth = await authorize()
  const sc = google.searchconsole({ version: 'v1', auth })

  const endDate = isoDate(daysAgo(2))
  const startDate = isoDate(daysAgo(days + 2))
  const label = queryFilter ? `query~"${queryFilter}"` : pageFilter ? `page~"${pageFilter}"` : 'sitewide'
  console.log(`\n${site}  (${startDate} → ${endDate})  filter: ${label}\n`)

  const dimensionFilterGroups = queryFilter
    ? [{ filters: [{ dimension: 'query', operator: 'contains', expression: queryFilter }] }]
    : pageFilter
    ? [{ filters: [{ dimension: 'page', operator: 'contains', expression: pageFilter }] }]
    : undefined

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
}

main().catch(e => { console.error(e); process.exit(1) })
