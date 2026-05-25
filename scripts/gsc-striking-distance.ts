/**
 * Striking-distance queries — queries Google already shows you for, but
 * not on page 1. These are the "add one paragraph, gain N clicks" wins.
 *
 * Pulls [query × page] aggregations from the GSC API, filters to current
 * position 5-20 with non-trivial impressions, and ranks by potential
 * clicks gained if the page moved to position 3 (a conservative target —
 * pos 1 would inflate the numbers and is rarely realistic).
 *
 * Usage:
 *   pnpm tsx scripts/gsc-striking-distance.ts
 *   pnpm tsx scripts/gsc-striking-distance.ts --days=90 --min-impr=50
 *   pnpm tsx scripts/gsc-striking-distance.ts --pos-min=4 --pos-max=15
 *   pnpm tsx scripts/gsc-striking-distance.ts --target-pos=2
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

// Industry-standard CTR-by-position curve (Advanced Web Ranking 2024). Approximate.
// Used to estimate potential clicks if a query were promoted to a higher position.
const CTR_BY_POS: number[] = [
  0,       // 0 = N/A
  0.275,   // pos 1
  0.155,   // pos 2
  0.105,   // pos 3
  0.075,   // pos 4
  0.055,   // pos 5
  0.040,   // pos 6
  0.030,   // pos 7
  0.025,   // pos 8
  0.020,   // pos 9
  0.018,   // pos 10
  0.012, 0.010, 0.008, 0.007, 0.006, 0.005, 0.004, 0.004, 0.003, 0.003,  // 11-20
]
function expectedCTR(pos: number): number {
  if (pos < 1) return 0
  if (pos >= CTR_BY_POS.length) return 0.002
  const lo = Math.floor(pos)
  const hi = Math.min(Math.ceil(pos), CTR_BY_POS.length - 1)
  if (lo === hi) return CTR_BY_POS[lo]
  return CTR_BY_POS[lo] + (CTR_BY_POS[hi] - CTR_BY_POS[lo]) * (pos - lo)
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
  const posMin = Number(arg('pos-min', '5'))
  const posMax = Number(arg('pos-max', '20'))
  const minImpr = Number(arg('min-impr', '100'))
  const targetPos = Number(arg('target-pos', '3'))
  const limit = Number(arg('limit', '25'))

  const auth = await authorize()
  const sc = google.searchconsole({ version: 'v1', auth })

  const endDate = isoDate(daysAgo(2))
  const startDate = isoDate(daysAgo(days + 2))
  console.log(`\n${site}  (${startDate} → ${endDate})`)
  console.log(`Striking distance: pos ${posMin}–${posMax}, ≥${minImpr} impr, target pos ${targetPos}\n`)

  // Pull [query × page] in pages of 5000 until exhausted or 25k rows.
  const allRows: { keys?: string[] | null; clicks?: number | null; impressions?: number | null; ctr?: number | null; position?: number | null }[] = []
  for (let startRow = 0; startRow < 25000; startRow += 5000) {
    const { data } = await sc.searchanalytics.query({
      siteUrl: site,
      requestBody: { startDate, endDate, dimensions: ['query', 'page'], rowLimit: 5000, startRow },
    })
    const rows = data.rows ?? []
    allRows.push(...rows)
    if (rows.length < 5000) break
  }
  console.log(`Pulled ${allRows.length} (query × page) rows`)

  const targetCtr = expectedCTR(targetPos)
  const candidates = allRows
    .map(r => {
      const pos = r.position ?? 0
      const impr = r.impressions ?? 0
      const clicks = r.clicks ?? 0
      const ctr = r.ctr ?? 0
      const projectedClicks = impr * targetCtr
      const gain = projectedClicks - clicks
      const ctrVsExpected = ctr - expectedCTR(pos)  // negative = under-performing for its position
      const [query, page] = r.keys ?? ['', '']
      return { query, page, pos, impr, clicks, ctr, gain, ctrVsExpected }
    })
    .filter(c => c.pos >= posMin && c.pos <= posMax && c.impr >= minImpr)
    .sort((a, b) => b.gain - a.gain)

  if (candidates.length === 0) {
    console.log('\n(no queries match — try lowering --min-impr or widening --pos-min/--pos-max)')
    return
  }

  console.log(`\nTop ${Math.min(limit, candidates.length)} of ${candidates.length} candidates, ranked by projected click gain at pos ${targetPos}:\n`)
  const w = { pos: 5, impr: 7, clicks: 5, ctr: 5, gain: 6 }
  console.log(
    `  ${'pos'.padStart(w.pos)} ${'impr'.padStart(w.impr)} ${'clk'.padStart(w.clicks)} ` +
    `${'ctr%'.padStart(w.ctr)} ${'+clk'.padStart(w.gain)}  query → page`,
  )
  console.log('  ' + '─'.repeat(80))
  for (const c of candidates.slice(0, limit)) {
    const pos = c.pos.toFixed(1).padStart(w.pos)
    const impr = String(c.impr).padStart(w.impr)
    const clicks = String(c.clicks).padStart(w.clicks)
    const ctr = (c.ctr * 100).toFixed(1).padStart(w.ctr)
    const gain = Math.round(c.gain).toString().padStart(w.gain)
    const pagePath = c.page.replace(/^https?:\/\/[^/]+/, '')
    const under = c.ctrVsExpected < -0.005 ? ' ⚠' : ''
    console.log(`  ${pos} ${impr} ${clicks} ${ctr} ${gain}  ${c.query}${under}`)
    console.log(`  ${' '.repeat(w.pos + w.impr + w.clicks + w.ctr + w.gain + 4)}↳ ${pagePath}`)
  }

  const totalGain = candidates.slice(0, limit).reduce((s, c) => s + c.gain, 0)
  console.log(`\n  ⚠ = current CTR ≥0.5pp below baseline for this position (snippet/title fix likely high-leverage)`)
  console.log(`\n  Total potential +clicks from top ${Math.min(limit, candidates.length)}: ~${Math.round(totalGain)} over ${days} days`)

  // Save full result set for follow-up
  const outDir = path.join(process.cwd(), 'data', 'gsc')
  await fs.mkdir(outDir, { recursive: true })
  const file = path.join(outDir, `striking-distance-${endDate}.json`)
  await fs.writeFile(file, JSON.stringify({ site, startDate, endDate, posMin, posMax, minImpr, targetPos, candidates }, null, 2))
  console.log(`\n  Full ranked list (${candidates.length} rows) → ${path.relative(process.cwd(), file)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
