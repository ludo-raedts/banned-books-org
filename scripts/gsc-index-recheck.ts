/**
 * Re-inspect EXACTLY the URLs of an earlier gsc-index-check run (same 108 URLs,
 * no re-sampling) and compare per URL: index status, reason (coverageState),
 * last crawl. Read-only: the URL Inspection API never submits anything.
 *
 *   pnpm tsx scripts/gsc-index-recheck.ts                  # inspect + report
 *   pnpm tsx scripts/gsc-index-recheck.ts --report         # re-print from the checkpoint, 0 API calls
 *
 * Baseline : data/gsc/index-check.jsonl                 (2026-10-25, never overwritten)
 * Re-check : data/gsc/index-check-<stamp>.jsonl + index-recheck-<stamp>.md
 * Why not just rerun gsc-index-check.ts: that script rebuilds its sample from
 * the CURRENT sitemaps (random seed + a sitemap that is now core-only), so it
 * would silently measure a different set of URLs.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { google } from 'googleapis'

const SITE = 'sc-domain:banned-books.org'
const ORIGIN = 'https://www.banned-books.org'
const DIR = path.join(process.cwd(), 'data', 'gsc')
const BASELINE = path.join(DIR, 'index-check.jsonl')
const STAMP = new Date().toISOString().slice(0, 10)
const CHECKPOINT = path.join(DIR, `index-check-${STAMP}.jsonl`)
const REPORT = path.join(DIR, `index-recheck-${STAMP}.md`)
// Cut-offs for "re-crawled since": the day of the baseline run, and the day the
// vetted-ban-text gate (1b3a641) and the AI-label work shipped.
const SINCE_BASELINE = '2026-10-25T17:27:00Z'
const SINCE_NOV11 = '2026-11-11T00:00:00Z'

type Row = {
  section: string; url: string; verdict?: string; coverageState?: string
  lastCrawlTime?: string; googleCanonical?: string; userCanonical?: string
  pageFetchState?: string; indexingState?: string; error?: string
}

const readJsonl = async (f: string): Promise<Row[]> => {
  try {
    return (await fs.readFile(f, 'utf8')).split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as Row)
  } catch { return [] }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const indexed = (r: Row) => r.verdict === 'PASS'
const day = (s?: string) => (s ? s.slice(0, 10) : 'never')

async function sitemapSet(name: string): Promise<Set<string>> {
  const res = await fetch(`${ORIGIN}/sitemap-${name}.xml`, { headers: { 'User-Agent': 'index-recheck/1.0' } })
  if (!res.ok) throw new Error(`sitemap-${name}.xml → ${res.status}`)
  return new Set([...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]))
}

async function inspect(sc: ReturnType<typeof google.searchconsole>, base: Row): Promise<Row> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data } = await sc.urlInspection.index.inspect({
        requestBody: { inspectionUrl: base.url, siteUrl: SITE, languageCode: 'en-US' },
      })
      const r = data.inspectionResult?.indexStatusResult ?? {}
      return {
        section: base.section, url: base.url,
        verdict: r.verdict ?? undefined, coverageState: r.coverageState ?? undefined,
        indexingState: r.indexingState ?? undefined, pageFetchState: r.pageFetchState ?? undefined,
        lastCrawlTime: r.lastCrawlTime ?? undefined,
        googleCanonical: r.googleCanonical ?? undefined, userCanonical: r.userCanonical ?? undefined,
      }
    } catch (e) {
      const status = (e as { code?: number }).code
      if ((status === 429 || (status && status >= 500)) && attempt < 3) { await sleep(2000 * (attempt + 1)); continue }
      return { section: base.section, url: base.url, error: (e as Error).message.slice(0, 200) }
    }
  }
  return { section: base.section, url: base.url, error: 'exhausted retries' }
}

async function authorize() {
  const keys = JSON.parse(await fs.readFile(path.join(os.homedir(), '.gcp', 'banned-books-gsc-oauth.json'), 'utf8'))
  const k = keys.installed ?? keys.web
  const client = new google.auth.OAuth2(k.client_id, k.client_secret, k.redirect_uris?.[0])
  client.setCredentials(JSON.parse(await fs.readFile(path.join(os.homedir(), '.gcp', 'banned-books-gsc-token.json'), 'utf8')))
  if (!(await client.getAccessToken()).token) throw new Error('No access token; run scripts/gsc-query.ts once')
  return client
}

async function report(base: Row[], now: Map<string, Row>): Promise<string> {
  const [books, authors] = await Promise.all([sitemapSet('books'), sitemapSet('authors')])
  const inGoogleSitemap = (u: string) => (u.includes('/books/') ? books.has(u) : u.includes('/authors/') ? authors.has(u) : null)
  const o: string[] = []
  const pairs = base.map(b => ({ b, n: now.get(b.url) })).filter((p): p is { b: Row; n: Row } => !!p.n && !p.n.error)
  const cnt = (f: (p: { b: Row; n: Row }) => boolean) => pairs.filter(f).length
  const ts = (s?: string) => (s ? Date.parse(s) : 0)

  o.push(`# Index re-check ${STAMP} vs 2026-10-25 (same ${base.length} URLs)\n`)
  o.push(`Inspected now: ${pairs.length}/${base.length}. Baseline: data/gsc/index-check.jsonl.\n`)
  o.push('## Headline\n')
  o.push('| | 2026-10-25 | now |\n|---|---:|---:|')
  o.push(`| Indexed (verdict PASS) | ${cnt(p => indexed(p.b))} | ${cnt(p => indexed(p.n))} |`)
  const states = [...new Set(pairs.flatMap(p => [p.b.coverageState ?? '(none)', p.n.coverageState ?? '(none)']))]
  for (const s of states) o.push(`| ${s} | ${cnt(p => (p.b.coverageState ?? '(none)') === s)} | ${cnt(p => (p.n.coverageState ?? '(none)') === s)} |`)
  o.push('\n## Re-crawls\n')
  o.push('| | URLs |\n|---|---:|')
  o.push(`| Last crawl after the baseline run (${SINCE_BASELINE.slice(0, 10)}) | ${cnt(p => ts(p.n.lastCrawlTime) > ts(SINCE_BASELINE))} |`)
  o.push(`| Last crawl on/after 2026-11-11 | ${cnt(p => ts(p.n.lastCrawlTime) >= ts(SINCE_NOV11))} |`)
  o.push(`| Last crawl newer than the baseline's last crawl (any date) | ${cnt(p => ts(p.n.lastCrawlTime) > ts(p.b.lastCrawlTime))} |`)
  o.push(`| Never crawled (before and now) | ${cnt(p => !p.b.lastCrawlTime && !p.n.lastCrawlTime)} |`)
  o.push(`| Never crawled before, crawled now | ${cnt(p => !p.b.lastCrawlTime && !!p.n.lastCrawlTime)} |`)

  o.push('\n## Transitions (reason before → reason now)\n')
  const trans = new Map<string, number>()
  for (const p of pairs) {
    const k = `${p.b.coverageState ?? '(none)'} → ${p.n.coverageState ?? '(none)'}`
    trans.set(k, (trans.get(k) ?? 0) + 1)
  }
  for (const [k, v] of [...trans].sort((a, b) => b[1] - a[1])) o.push(`- ${v}× ${k}`)

  o.push('\n## Per section\n')
  o.push('| Section | n | indexed before | indexed now | re-crawled since 25 Oct | since 11 Nov |\n|---|---:|---:|---:|---:|---:|')
  const secs = [...new Set(base.map(b => b.section))]
  for (const s of secs) {
    const ps = pairs.filter(p => p.b.section === s)
    const c = (f: (p: { b: Row; n: Row }) => boolean) => ps.filter(f).length
    o.push(`| ${s} | ${ps.length} | ${c(p => indexed(p.b))} | ${c(p => indexed(p.n))} | ${c(p => ts(p.n.lastCrawlTime) > ts(SINCE_BASELINE))} | ${c(p => ts(p.n.lastCrawlTime) >= ts(SINCE_NOV11))} |`)
  }

  o.push('\n## Books/authors: are they in the Google (core) sitemap now?\n')
  o.push('Sampled before the pilot, so some of these URLs are `googlebot noindex` now. Crawl → noindex is not a quality verdict.\n')
  for (const kind of ['/books/', '/authors/']) {
    const ps = pairs.filter(p => p.b.url.includes(kind))
    const core = ps.filter(p => inGoogleSitemap(p.b.url))
    o.push(`- ${kind}: ${ps.length} URLs, ${core.length} in the core sitemap now, ${ps.length - core.length} Google-noindex now; indexed now: core ${core.filter(p => indexed(p.n)).length}, non-core ${ps.filter(p => !inGoogleSitemap(p.b.url)).filter(p => indexed(p.n)).length}`)
  }

  o.push('\n## Per URL\n')
  o.push('| URL | core now | before: state (last crawl) | now: state (last crawl) |\n|---|:-:|---|---|')
  for (const p of pairs) {
    const c = inGoogleSitemap(p.b.url)
    o.push(`| ${p.b.url.replace(ORIGIN, '') || '/'} | ${c === null ? '–' : c ? 'yes' : 'no'} | ${p.b.coverageState ?? '(none)'} (${day(p.b.lastCrawlTime)}) | ${p.n.coverageState ?? '(none)'} (${day(p.n.lastCrawlTime)}) |`)
  }
  const errs = [...now.values()].filter(r => r.error)
  if (errs.length) o.push(`\n## API errors (${errs.length})\n${errs.slice(0, 5).map(e => `- ${e.url}: ${e.error}`).join('\n')}`)
  return o.join('\n') + '\n'
}

async function main() {
  const base = await readJsonl(BASELINE)
  if (!base.length) throw new Error('No baseline checkpoint')
  const now = new Map((await readJsonl(CHECKPOINT)).filter(r => !r.error).map(r => [r.url, r]))
  if (!process.argv.includes('--report')) {
    const sc = google.searchconsole({ version: 'v1', auth: await authorize() })
    const todo = base.filter(b => !now.has(b.url))
    console.log(`${base.length} baseline URLs, ${now.size} already re-inspected, ${todo.length} to go`)
    let i = 0
    for (const b of todo) {
      const row = await inspect(sc, b)
      await fs.appendFile(CHECKPOINT, JSON.stringify(row) + '\n')
      if (!row.error) now.set(row.url, row)
      console.log(`${String(++i).padStart(3)}/${todo.length}  ${(row.coverageState ?? 'ERR ' + row.error)?.padEnd(46)} ${row.url.replace(ORIGIN, '')}`)
      if (/quota/i.test(row.error ?? '')) { console.log('Quota hit; rerun tomorrow, the checkpoint resumes.'); break }
      await sleep(300)
    }
  }
  const md = await report(base, now)
  await fs.writeFile(REPORT, md)
  console.log(md)
}

main().catch(e => { console.error(e); process.exit(1) })
