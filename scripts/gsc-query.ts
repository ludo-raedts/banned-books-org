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
  const raw = await fs.readFile(CLIENT_FILE, 'utf8')
  const parsed = JSON.parse(raw) as { installed?: OAuthKeys; web?: OAuthKeys }
  const k = parsed.installed ?? parsed.web
  if (!k) throw new Error(`No installed/web block in ${CLIENT_FILE}`)
  return k
}

async function loadSavedClient(): Promise<OAuth2Client | null> {
  try {
    const k = await readOAuthKeys()
    const credentials = JSON.parse(await fs.readFile(TOKEN_FILE, 'utf8'))
    const client = new google.auth.OAuth2(k.client_id, k.client_secret, k.redirect_uris[0])
    client.setCredentials(credentials)
    return client
  } catch {
    return null
  }
}

async function saveCredentials(client: OAuth2Client) {
  const k = await readOAuthKeys()
  const payload = {
    type: 'authorized_user',
    client_id: k.client_id,
    client_secret: k.client_secret,
    refresh_token: client.credentials.refresh_token,
  }
  await fs.writeFile(TOKEN_FILE, JSON.stringify(payload, null, 2))
  await fs.chmod(TOKEN_FILE, 0o600)
}

async function authorize(): Promise<OAuth2Client> {
  let client = await loadSavedClient()
  if (!client) {
    console.log('No saved token, starting OAuth flow (browser will open)...')
    const fresh = await authenticate({ scopes: SCOPES, keyfilePath: CLIENT_FILE })
    if (fresh.credentials?.refresh_token) await saveCredentials(fresh as OAuth2Client)
    client = fresh as OAuth2Client
  }
  const at = await client.getAccessToken()
  if (!at.token) throw new Error('Failed to obtain access token; delete ~/.gcp/banned-books-gsc-token.json and retry')
  console.log(`Auth OK (access token len=${at.token.length})`)
  try {
    const info = await client.getTokenInfo(at.token)
    console.log('Token info:', { email: info.email, scopes: info.scopes, aud: info.aud })
  } catch (e) {
    console.log('getTokenInfo failed:', (e as Error).message)
  }
  return client
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysAgo(n: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function arg(name: string, fallback?: string) {
  const a = process.argv.slice(2).find(x => x.startsWith(`--${name}=`))
  return a ? a.split('=').slice(1).join('=') : fallback
}

async function main() {
  const site = arg('site', 'sc-domain:banned-books.org')!
  const days = Number(arg('days', '28'))
  const auth = await authorize()
  const sc = google.searchconsole({ version: 'v1', auth })

  const { data: sitesData } = await sc.sites.list()
  const sites = (sitesData.siteEntry ?? []).map(s => s.siteUrl).filter(Boolean) as string[]
  console.log('Accessible sites:')
  sites.forEach(s => console.log(`  - ${s}`))
  if (!sites.includes(site)) {
    console.warn(`\n⚠  ${site} not in accessible sites. Pass --site=<one-from-above>.\n`)
    return
  }

  const endDate = isoDate(daysAgo(2))   // GSC data lags ~2 days
  const startDate = isoDate(daysAgo(days + 2))
  console.log(`\nQuerying ${site}  (${startDate} → ${endDate})`)

  const outDir = path.join(process.cwd(), 'data', 'gsc')
  await fs.mkdir(outDir, { recursive: true })

  const reports = [
    { name: 'queries', dimensions: ['query'] as string[] },
    { name: 'pages', dimensions: ['page'] as string[] },
  ]

  for (const r of reports) {
    const { data } = await sc.searchanalytics.query({
      siteUrl: site,
      requestBody: { startDate, endDate, dimensions: r.dimensions, rowLimit: 1000 },
    })
    const rows = data.rows ?? []
    const file = path.join(outDir, `${r.name}-${endDate}.json`)
    await fs.writeFile(file, JSON.stringify({ site, startDate, endDate, rows }, null, 2))
    console.log(`\n[${r.name}] ${rows.length} rows → ${path.relative(process.cwd(), file)}`)
    rows.slice(0, 10).forEach(row => {
      const key = (row.keys ?? []).join(' | ')
      const clicks = String(row.clicks ?? 0).padStart(5)
      const impr = String(row.impressions ?? 0).padStart(7)
      const ctr = ((row.ctr ?? 0) * 100).toFixed(1).padStart(5)
      const pos = (row.position ?? 0).toFixed(1).padStart(5)
      console.log(`  ${clicks}c  ${impr}i  ${ctr}%ctr  pos ${pos}  ${key}`)
    })
  }
}

main().catch(e => { console.error(e); process.exit(1) })
