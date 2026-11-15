/**
 * Probe: how many core book pages does Google know ("Crawled - currently not indexed")?
 * Read-only URL Inspection of two samples of the live core sitemap (seeded, checkpointed):
 *   head  = the 350 most-banned books (by distinct bans), random  = 350 other core books.
 * Excludes the 108 baseline URLs and the frozen trial panel. Output: data/gsc/cni-pool-<date>.jsonl
 *   pnpm tsx --env-file=.env.local scripts/gsc-cni-pool.ts            # inspect (resumes)
 *   pnpm tsx --env-file=.env.local scripts/gsc-cni-pool.ts --report   # summary
 */
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { google } from 'googleapis'

const ORIGIN = 'https://www.banned-books.org', SITE = 'sc-domain:banned-books.org'
const OUT = path.join(process.cwd(), 'data', 'gsc', 'cni-pool-2026-11-15.jsonl')
const N = 350
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const read = async () => { try { return (await fs.readFile(OUT, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l)) } catch { return [] } }

async function plan() {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const xml = await (await fetch(`${ORIGIN}/sitemap-books.xml`)).text()
  const core = [...xml.matchAll(/\/books\/([^<]+)<\/loc>/g)].map(m => m[1])
  const excl = new Set<string>((await fs.readFile('data/gsc/index-check.jsonl', 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l).url))
  for (const p of JSON.parse(await fs.readFile('docs/experiments/source-pilot-2026-11/panel.json', 'utf8')).panel) excl.add(p.url)
  const books: { id: number; slug: string }[] = []
  for (let i = 0; ; i += 1000) { const r = await c.from('books').select('id,slug').order('id').range(i, i + 999); books.push(...r.data!); if (r.data!.length < 1000) break }
  const idOf = new Map(books.map(b => [b.slug, b.id]))
  const cnt: any[] = []
  for (let i = 0; ; i += 1000) { const r = await c.from('v_book_ban_counts').select('entity_id,total_bans').order('entity_id').range(i, i + 999); cnt.push(...r.data!); if (r.data!.length < 1000) break }
  const bans = new Map(cnt.map(x => [x.entity_id, x.total_bans]))
  const cand = core.filter(s => !excl.has(`${ORIGIN}/books/${s}`))
  const ranked = [...cand].sort((a, b) => (bans.get(idOf.get(b)!) ?? 0) - (bans.get(idOf.get(a)!) ?? 0) || a.localeCompare(b))
  const head = ranked.slice(0, N)
  const R = rng(20261115); const rest = ranked.slice(N)
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]] }
  return [...head.map(s => ({ stratum: 'head', slug: s })), ...rest.slice(0, N).map(s => ({ stratum: 'random', slug: s }))]
}

async function main() {
  if (process.argv.includes('--report')) return report()
  const keys = JSON.parse(await fs.readFile(path.join(os.homedir(), '.gcp', 'banned-books-gsc-oauth.json'), 'utf8')); const k = keys.installed ?? keys.web
  const cl = new google.auth.OAuth2(k.client_id, k.client_secret, k.redirect_uris?.[0])
  cl.setCredentials(JSON.parse(await fs.readFile(path.join(os.homedir(), '.gcp', 'banned-books-gsc-token.json'), 'utf8')))
  const sc = google.searchconsole({ version: 'v1', auth: cl })
  const done = new Set((await read()).filter(r => !r.error).map(r => r.slug))
  const todo = (await plan()).filter(p => !done.has(p.slug)); console.log('to inspect', todo.length)
  let i = 0
  for (const p of todo) {
    let row: any = { ...p, url: `${ORIGIN}/books/${p.slug}` }
    try { const { data } = await sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: row.url, siteUrl: SITE, languageCode: 'en-US' } }); const r = data.inspectionResult?.indexStatusResult ?? {}; row = { ...row, verdict: r.verdict, coverageState: r.coverageState, lastCrawlTime: r.lastCrawlTime } } catch (e) { row.error = (e as Error).message.slice(0, 120) }
    await fs.appendFile(OUT, JSON.stringify(row) + '\n'); if (++i % 50 === 0) console.log(i)
    await sleep(250)
  }
}
async function report() {
  const rows = (await read()).filter(r => !r.error); const now = Date.parse('2026-11-15T16:00:00Z')
  for (const s of ['head', 'random']) {
    const rs = rows.filter(r => r.stratum === s); const st: Record<string, number> = {}; for (const r of rs) st[r.coverageState ?? '?'] = (st[r.coverageState ?? '?'] ?? 0) + 1
    const cni = rs.filter(r => r.coverageState === 'Crawled - currently not indexed')
    const age = (d: number) => cni.filter(r => now - Date.parse(r.lastCrawlTime) <= d * 864e5).length
    console.log(s, 'n=' + rs.length, st, '| CNI crawled within 14d', age(14), '30d', age(30), '60d', age(60), '120d', age(120), '>120d', cni.length - age(120))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
