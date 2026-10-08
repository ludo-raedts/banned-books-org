/**
 * Google Search Console URL Inspection sampler — "why is Google not showing us?"
 *
 * Takes a stratified sample of URLs per site section (books top/tail, authors,
 * countries, reasons, hubs, years, reading-club, contexts), asks the URL
 * Inspection API how Google sees each one (indexed? crawled-not-indexed?
 * canonical overridden? robots?) and prints a per-section verdict table.
 * Read-only: no indexing requests are submitted.
 *
 * Usage:
 *   pnpm tsx scripts/gsc-index-check.ts --dry               # print the sample plan, 0 API calls
 *   pnpm tsx scripts/gsc-index-check.ts --limit=3           # smoke test: first 3 URLs only
 *   pnpm tsx scripts/gsc-index-check.ts                     # full run (default 12 per section)
 *   pnpm tsx scripts/gsc-index-check.ts --per=25            # bigger sample
 *   pnpm tsx scripts/gsc-index-check.ts --report            # re-print table from the checkpoint, 0 API calls
 *
 * Output: data/gsc/index-check.jsonl (checkpoint, one line per URL — reruns
 * skip URLs already inspected) and data/gsc/index-check-report.md.
 *
 * Quota: the API allows 2,000 inspections/day/property and 600/min. The
 * default plan is ~130 URLs; calls are sequential with a small delay and
 * retry on 429/5xx. Auth reuses the OAuth token from scripts/gsc-query.ts
 * (webmasters.readonly is enough for inspection).
 *
 * Reading the result: PASS + "Submitted and indexed" = fine. The interesting
 * rows are "Crawled - currently not indexed" (Google fetched it and declined —
 * a quality/duplication signal), "Discovered - currently not indexed" (never
 * even crawled — crawl-budget/authority) and "Duplicate, Google chose
 * different canonical".
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

const SITE = 'sc-domain:banned-books.org'
const ORIGIN = 'https://www.banned-books.org'
const OUT_DIR = path.join(process.cwd(), 'data', 'gsc')
const CHECKPOINT = path.join(OUT_DIR, 'index-check.jsonl')
const REPORT = path.join(OUT_DIR, 'index-check-report.md')
const CLIENT_FILE = path.join(os.homedir(), '.gcp', 'banned-books-gsc-oauth.json')
const TOKEN_FILE = path.join(os.homedir(), '.gcp', 'banned-books-gsc-token.json')

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => {
  const a = argv.find(x => x.startsWith(`--${n}=`))
  return a ? Number(a.split('=')[1]) : d
}

// Deterministic PRNG so the "random" tail sample is stable between runs and
// the checkpoint stays useful.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261008)
function pick<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

async function sitemapUrls(name: string): Promise<string[]> {
  const res = await fetch(`${ORIGIN}/sitemap-${name}.xml`, { headers: { 'User-Agent': 'index-check/1.0' } })
  if (!res.ok) throw new Error(`sitemap-${name}.xml → ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
}

type Plan = { section: string; url: string }[]

async function buildPlan(per: number): Promise<Plan> {
  const [books, authors, countries, reasons, statics] = await Promise.all([
    sitemapUrls('books'), sitemapUrls('authors'), sitemapUrls('countries'),
    sitemapUrls('reasons'), sitemapUrls('static'),
  ])
  const plan: Plan = []
  const add = (section: string, urls: string[]) => urls.forEach(url => plan.push({ section, url }))

  // "Head" = the most-banned books (the top-100 page links them in rank order);
  // "tail" = a random draw from the whole sitemap, i.e. what Google sees most of.
  const top100 = await (await fetch(`${ORIGIN}/top-100-banned-books`, { headers: { 'User-Agent': 'index-check/1.0' } })).text()
  const headBooks = [...new Set([...top100.matchAll(/href="(\/books\/[^"#?]+)"/g)].map(m => ORIGIN + m[1]))]
  add('books · head (top-100 most banned)', headBooks.slice(0, per))
  add('books · tail (random from sitemap)', pick(books.filter(u => !headBooks.includes(u)), per))
  add('authors (random)', pick(authors, per))
  add('countries (random)', pick(countries, per))
  add('reasons', reasons.slice(0, per))

  const hubs = statics.filter(u => !u.endsWith('.md') && !u.endsWith('.txt'))
  const has = (re: RegExp) => hubs.filter(u => re.test(u))
  add('hubs · lists & top pages', [ORIGIN, ...has(/\/(top-100|banned-classics|banned-childrens|trending|rising|most-banned|non-english|award-winning|dua-lipa|challenged-books|banned-books-week)/)].slice(0, per + 1))
  add('hubs · year pages', has(/\/banned-books\/\d{4}$/))
  add('hubs · editorial (essays/history/methodology)', has(/\/(essays|history|methodology|about|why-not-amazon|sources|data-quality|dataset|film|podcasts|news|stats)/).slice(0, per))
  add('reading-club', pick(has(/\/reading-club/), per))
  add('contexts', has(/\/contexts\//).slice(0, per))

  // de-dup (a URL can match two filters)
  const seen = new Set<string>()
  return plan.filter(p => (seen.has(p.url) ? false : (seen.add(p.url), true)))
}

async function authorize(): Promise<OAuth2Client> {
  const keys = JSON.parse(await fs.readFile(CLIENT_FILE, 'utf8'))
  const k = keys.installed ?? keys.web
  const creds = JSON.parse(await fs.readFile(TOKEN_FILE, 'utf8'))
  const client = new google.auth.OAuth2(k.client_id, k.client_secret, k.redirect_uris?.[0])
  client.setCredentials(creds)
  const at = await client.getAccessToken()
  if (!at.token) throw new Error('No access token; run scripts/gsc-query.ts once to refresh ~/.gcp/banned-books-gsc-token.json')
  return client
}

type Row = {
  section: string
  url: string
  verdict?: string
  coverageState?: string
  indexingState?: string
  robotsTxtState?: string
  pageFetchState?: string
  lastCrawlTime?: string
  googleCanonical?: string
  userCanonical?: string
  error?: string
}

async function loadCheckpoint(): Promise<Map<string, Row>> {
  const m = new Map<string, Row>()
  try {
    for (const line of (await fs.readFile(CHECKPOINT, 'utf8')).split('\n')) {
      if (!line.trim()) continue
      const r = JSON.parse(line) as Row
      if (!r.error) m.set(r.url, r)
    }
  } catch { /* first run */ }
  return m
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function inspect(sc: ReturnType<typeof google.searchconsole>, item: { section: string; url: string }): Promise<Row> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data } = await sc.urlInspection.index.inspect({
        requestBody: { inspectionUrl: item.url, siteUrl: SITE, languageCode: 'en-US' },
      })
      const r = data.inspectionResult?.indexStatusResult ?? {}
      return {
        ...item,
        verdict: r.verdict ?? undefined,
        coverageState: r.coverageState ?? undefined,
        indexingState: r.indexingState ?? undefined,
        robotsTxtState: r.robotsTxtState ?? undefined,
        pageFetchState: r.pageFetchState ?? undefined,
        lastCrawlTime: r.lastCrawlTime ?? undefined,
        googleCanonical: r.googleCanonical ?? undefined,
        userCanonical: r.userCanonical ?? undefined,
      }
    } catch (e) {
      const status = (e as { code?: number }).code
      if ((status === 429 || (status && status >= 500)) && attempt < 3) { await sleep(2000 * (attempt + 1)); continue }
      return { ...item, error: (e as Error).message.slice(0, 200) }
    }
  }
  return { ...item, error: 'exhausted retries' }
}

function summarise(rows: Row[]): string {
  const bySection = new Map<string, Row[]>()
  for (const r of rows) (bySection.get(r.section) ?? bySection.set(r.section, []).get(r.section)!).push(r)

  const label = (r: Row) => r.coverageState ?? r.verdict ?? r.error ?? 'unknown'
  const states = [...new Set(rows.map(label))].sort()
  const out: string[] = []
  out.push(`# Google index check — ${new Date().toISOString().slice(0, 10)}\n`)
  out.push(`${rows.length} URLs inspected via the URL Inspection API (property \`${SITE}\`).\n`)

  const indexed = (r: Row) => r.verdict === 'PASS'
  out.push('## Indexed share per section\n')
  out.push('| Section | Inspected | Indexed | % |')
  out.push('|---|---:|---:|---:|')
  for (const [s, rs] of bySection) {
    const n = rs.filter(indexed).length
    out.push(`| ${s} | ${rs.length} | ${n} | ${Math.round((n / rs.length) * 100)}% |`)
  }
  const total = rows.filter(indexed).length
  out.push(`| **All** | **${rows.length}** | **${total}** | **${Math.round((total / rows.length) * 100)}%** |\n`)

  out.push('## Coverage state per section\n')
  out.push(`| Section | ${states.join(' | ')} |`)
  out.push(`|---|${states.map(() => '---:').join('|')}|`)
  for (const [s, rs] of bySection) {
    out.push(`| ${s} | ${states.map(st => rs.filter(r => label(r) === st).length || '').join(' | ')} |`)
  }

  const overridden = rows.filter(r => r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical)
  out.push(`\n## Canonical overridden by Google (${overridden.length})\n`)
  for (const r of overridden.slice(0, 20)) out.push(`- ${r.url}\n  - ours: ${r.userCanonical}\n  - Google: ${r.googleCanonical}`)

  const notIndexed = rows.filter(r => !indexed(r))
  out.push(`\n## Not indexed — examples (${notIndexed.length})\n`)
  for (const r of notIndexed.slice(0, 40)) {
    out.push(`- [${label(r)}] ${r.url}${r.lastCrawlTime ? ` (last crawl ${r.lastCrawlTime.slice(0, 10)})` : ' (never crawled)'}`)
  }
  const errs = rows.filter(r => r.error)
  if (errs.length) out.push(`\n## API errors (${errs.length})\n${errs.slice(0, 5).map(e => `- ${e.url}: ${e.error}`).join('\n')}`)
  return out.join('\n') + '\n'
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  if (flag('report')) {
    const done = [...(await loadCheckpoint()).values()]
    if (!done.length) return console.log('No checkpoint yet — run without --report first.')
    const md = summarise(done)
    await fs.writeFile(REPORT, md)
    console.log(md)
    return
  }

  let plan = await buildPlan(num('per', 12))
  const limit = num('limit', 0)
  if (limit) plan = plan.slice(0, limit)

  const bySection = new Map<string, number>()
  plan.forEach(p => bySection.set(p.section, (bySection.get(p.section) ?? 0) + 1))
  console.log(`Plan: ${plan.length} URLs`)
  for (const [s, n] of bySection) console.log(`  ${String(n).padStart(3)}  ${s}`)
  if (flag('dry')) {
    plan.slice(0, 6).forEach(p => console.log(`  e.g. ${p.url}`))
    return console.log('\n--dry: no API calls made.')
  }

  const done = await loadCheckpoint()
  const todo = plan.filter(p => !done.has(p.url))
  console.log(`${done.size} already in checkpoint, ${todo.length} to inspect.\n`)

  const sc = google.searchconsole({ version: 'v1', auth: await authorize() })
  let i = 0
  for (const item of todo) {
    const row = await inspect(sc, item)
    await fs.appendFile(CHECKPOINT, JSON.stringify(row) + '\n')
    done.set(row.url, row)
    i++
    console.log(`${String(i).padStart(3)}/${todo.length}  ${(row.coverageState ?? row.verdict ?? 'ERR ' + row.error)?.padEnd(46)} ${row.url.replace(ORIGIN, '')}`)
    if (row.error?.includes('quota') || row.error?.includes('Quota')) { console.log('Quota hit — stop; rerun tomorrow, the checkpoint resumes.'); break }
    await sleep(300)
  }

  const md = summarise(plan.map(p => done.get(p.url)).filter((r): r is Row => !!r))
  await fs.writeFile(REPORT, md)
  console.log('\n' + md)
  console.log(`Report → ${path.relative(process.cwd(), REPORT)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
