/**
 * Source-pilot trial panel (see docs/experiments/source-pilot-2026-11/PREREGISTRATION.md).
 *
 *   pnpm tsx --env-file=.env.local scripts/trial-panel.ts select          # draw + freeze panel.json (refuses to overwrite)
 *   pnpm tsx --env-file=.env.local scripts/trial-panel.ts inspect <label> # URL Inspection of the frozen panel -> inspections-<label>.jsonl
 *   pnpm tsx --env-file=.env.local scripts/trial-panel.ts report <label>  # per-arm summary of that measurement
 *
 * Read-only against the DB and Search Console. Never submits an indexing
 * request and never runs a live test: the API call below reads Google's
 * *indexed* record only.
 */
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { google } from 'googleapis'

const DIR = path.join(process.cwd(), 'docs', 'experiments', 'source-pilot-2026-11')
const PANEL = path.join(DIR, 'panel.json')
const ORIGIN = 'https://www.banned-books.org'
const SITE = 'sc-domain:banned-books.org'
const SEED = 20261116
const PER_ARM = 60
// Families where a per-case locator is currently NULL but obtainable from a public list.
const FAMILIES: [string, RegExp][] = [
  ['berlin-1938', /Berlin\.de/],
  ['liste-otto', /Liste Otto/],
  ['estado-novo', /Brandão/],
]
// Known data problems found in the 2026-11-15 sample: never in the panel.
const EXCLUDE_SLUGS = new Set(['lenin-charasch', 'gaibeus', 'the-da-vinci-code'])

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type P = { slug: string; url: string; id: number; arm: 'treatment' | 'control'; block: string; family: string; route: string; nBans: number; descType: string | null; createdAt: string }

async function all(c: ReturnType<typeof createClient>, tbl: string, sel: string, f?: (q: any) => any, ord = 'id') {
  const o: any[] = []
  for (let i = 0; ; i += 1000) {
    let q: any = c.from(tbl).select(sel).order(ord).range(i, i + 999)
    if (f) q = f(q)
    const r = await q
    if (r.error) throw new Error(tbl + ': ' + r.error.message)
    o.push(...r.data)
    if (r.data.length < 1000) break
  }
  return o
}

async function select() {
  try { await fs.access(PANEL); throw new Error('panel.json exists: the panel is frozen, refusing to overwrite') } catch (e) { if ((e as Error).message.startsWith('panel.json')) throw e }
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const xml = await (await fetch(`${ORIGIN}/sitemap-books.xml`)).text()
  const core = new Set([...xml.matchAll(/\/books\/([^<]+)<\/loc>/g)].map(m => m[1]))
  const baseline108 = new Set((await fs.readFile(path.join(process.cwd(), 'data/gsc/index-check.jsonl'), 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l).url))
  const books = await all(c, 'books', 'id,slug,created_at,description_book,description_source_type,cover_url', q => q.eq('is_gated', false).eq('is_blanket_works', false).not('slug', 'is', null))
  const bans = await all(c, 'bans', 'id,book_id')
  const links = await all(c, 'ban_source_links', 'ban_id,source_id,locator', undefined, 'ban_id')
  const srcs = new Map((await all(c, 'ban_sources', 'id,source_name')).map(s => [s.id, s.source_name as string]))
  const homepage = new Set(links.filter(l => l.source_id === 564).map(l => l.ban_id))
  const linksByBan = new Map<number, any[]>(); for (const l of links) (linksByBan.get(l.ban_id) ?? linksByBan.set(l.ban_id, []).get(l.ban_id)!).push(l)
  const bansByBook = new Map<number, any[]>(); for (const b of bans) (bansByBook.get(b.book_id) ?? bansByBook.set(b.book_id, []).get(b.book_id)!).push(b)

  const pool = new Map<string, P[]>()
  for (const b of books) {
    if (!core.has(b.slug) || EXCLUDE_SLUGS.has(b.slug) || baseline108.has(`${ORIGIN}/books/${b.slug}`)) continue
    const bs = bansByBook.get(b.id) ?? []
    if (!bs.length) continue
    const ls = bs.flatMap(x => linksByBan.get(x.id) ?? [])
    if (bs.some(x => homepage.has(x.id))) continue
    // single-family dossier: every ban's every source is from ONE family and has no locator yet
    const fams = new Set<string>(); let ok = true
    for (const l of ls) { const f = FAMILIES.find(([, re]) => re.test(srcs.get(l.source_id) ?? ''))?.[0]; if (!f || l.locator) ok = false; else fams.add(f) }
    if (!ok || fams.size !== 1) continue
    const family = [...fams][0]
    const dc = !!b.description_book?.trim() && !!b.cover_url
    const route = bs.length >= 2 ? 'bans>=2' : dc ? 'desc+cover' : 'other'
    if (route === 'other') continue
    const block = `${family}|${route}`
    ;(pool.get(block) ?? pool.set(block, []).get(block)!).push({ slug: b.slug, url: `${ORIGIN}/books/${b.slug}`, id: b.id, arm: 'control', block, family, route, nBans: bs.length, descType: b.description_source_type, createdAt: b.created_at })
  }
  const sizes = Object.fromEntries([...pool].map(([k, v]) => [k, v.length])); console.log('eligible pool per block', sizes)
  const R = rng(SEED)
  const total = PER_ARM * 2, poolN = [...pool.values()].reduce((a, v) => a + v.length, 0)
  const panel: P[] = []
  for (const [block, arr] of [...pool].sort()) {
    const want = Math.min(arr.length - (arr.length % 2), Math.max(2, 2 * Math.round((total / 2) * arr.length / poolN)))
    const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    const take = a.slice(0, want)
    for (let i = 0; i < take.length; i += 2) { const t = R() < 0.5; take[i].arm = t ? 'treatment' : 'control'; take[i + 1].arm = t ? 'control' : 'treatment' } // matched pairs inside the block
    panel.push(...take)
  }
  await fs.mkdir(DIR, { recursive: true })
  await fs.writeFile(PANEL, JSON.stringify({ frozenAt: new Date().toISOString(), seed: SEED, perArmTarget: PER_ARM, eligiblePoolPerBlock: sizes, panel: panel.sort((x, y) => x.block.localeCompare(y.block) || x.slug.localeCompare(y.slug)) }, null, 1))
  const n = (arm: string) => panel.filter(p => p.arm === arm).length
  console.log(`frozen: ${panel.length} pages (${n('treatment')} treatment / ${n('control')} control)`)
}

async function authorize() {
  const keys = JSON.parse(await fs.readFile(path.join(os.homedir(), '.gcp', 'banned-books-gsc-oauth.json'), 'utf8')); const k = keys.installed ?? keys.web
  const cl = new google.auth.OAuth2(k.client_id, k.client_secret, k.redirect_uris?.[0])
  cl.setCredentials(JSON.parse(await fs.readFile(path.join(os.homedir(), '.gcp', 'banned-books-gsc-token.json'), 'utf8')))
  if (!(await cl.getAccessToken()).token) throw new Error('no GSC token'); return cl
}

async function inspect(label: string) {
  const { panel } = JSON.parse(await fs.readFile(PANEL, 'utf8')) as { panel: P[] }
  const out = path.join(DIR, `inspections-${label}.jsonl`)
  const done = new Set<string>(); try { for (const l of (await fs.readFile(out, 'utf8')).split('\n').filter(Boolean)) { const r = JSON.parse(l); if (!r.error) done.add(r.url) } } catch { /* first run */ }
  const sc = google.searchconsole({ version: 'v1', auth: await authorize() })
  let i = 0
  for (const p of panel.filter(p => !done.has(p.url))) {
    let row: Record<string, unknown> = { url: p.url, slug: p.slug, arm: p.arm, block: p.block, measuredAt: new Date().toISOString() }
    try {
      const { data } = await sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: p.url, siteUrl: SITE, languageCode: 'en-US' } })
      const r = data.inspectionResult?.indexStatusResult ?? {}
      row = { ...row, verdict: r.verdict, coverageState: r.coverageState, lastCrawlTime: r.lastCrawlTime, googleCanonical: r.googleCanonical, userCanonical: r.userCanonical, pageFetchState: r.pageFetchState }
    } catch (e) { row.error = (e as Error).message.slice(0, 160) }
    await fs.appendFile(out, JSON.stringify(row) + '\n'); i++
    if (i % 20 === 0) console.log(`${i} inspected`)
    await sleep(300)
  }
  console.log('done ->', path.relative(process.cwd(), out))
}

async function report(label: string) {
  const { panel } = JSON.parse(await fs.readFile(PANEL, 'utf8')) as { panel: P[] }
  const rows = (await fs.readFile(path.join(DIR, `inspections-${label}.jsonl`), 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l))
  const by = new Map(rows.map(r => [r.url, r]))
  for (const arm of ['treatment', 'control']) {
    const ps = panel.filter(p => p.arm === arm); const rs = ps.map(p => by.get(p.url)).filter(Boolean)
    const st: Record<string, number> = {}; for (const r of rs) st[r.coverageState ?? 'ERR'] = (st[r.coverageState ?? 'ERR'] ?? 0) + 1
    const crawled = rs.filter(r => r.lastCrawlTime).length
    const mean = ps.reduce((a, p) => a + p.nBans, 0) / ps.length
    console.log(arm, `n=${ps.length}`, 'indexed', rs.filter(r => r.verdict === 'PASS').length, 'ever-crawled', crawled, 'mean bans', mean.toFixed(2), st)
  }
}

const [cmd, arg] = process.argv.slice(2)
;(cmd === 'select' ? select() : cmd === 'inspect' ? inspect(arg ?? 'baseline') : cmd === 'report' ? report(arg ?? 'baseline') : Promise.reject(new Error('usage: select | inspect <label> | report <label>')))
  .catch(e => { console.error(e.message); process.exit(1) })
