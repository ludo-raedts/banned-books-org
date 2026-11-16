/**
 * One-off 2026-11-16, round 2 of the top-100 check (data/top100-check/findings2-*.json; full-text
 * Wikipedia + other fetched pages). Same policy as round 1: nothing deleted; a fetched source is added as an
 * extra link; claims still without any evidence after two rounds get confidence='unverified' + a
 * 'Source needed' note (soft label, the row and its dossier stay). Backup first (never overwritten).
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const APPLY = isApply()
const db = adminClient()
const DIR = path.join(process.cwd(), 'data', 'top100-check')
const TODAY = new Date().toISOString().slice(0, 10)
const SRC_NEEDED = 'Source needed: no source found that records this ban in this country.'
const NOTE: Record<number, string> = {
  1139: 'Reported: Alice Walker refused to let the film be shown in apartheid South Africa (Wikipedia, citing the New York Times, 2012). A state ban on the book is not documented.',
}
const PATCH: Record<number, Record<string, unknown>> = {
  1208: { year_started: 1918 }, 1212: { year_started: 1940, year_ended: 1942 }, 1104: { year_started: 2009 },
}
const KEEP = new Set([628, 1127, 1128, 1129]) // not fully checked / already marked
const typeOf = (u: string) => /wikipedia\.org/.test(u) ? 'wikipedia' : /(thejc|vreme|qantara|bearr)/.test(u) ? 'news' : 'web'

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN')
  const F: any[] = []
  for (const i of [1, 2, 3, 4, 5]) F.push(...JSON.parse(await fs.readFile(path.join(DIR, `findings2-${i}.json`), 'utf8')))
  const ids = F.map(f => f.ban_id)
  const bans = (await db.from('bans').select('*').in('id', ids)).data ?? []
  const links = (await db.from('ban_source_links').select('*').in('ban_id', ids)).data ?? []
  const byId = new Map(bans.map((b: any) => [b.id, b]))
  const bk = path.join(DIR, 'backup-round2-2026-11-16.json')
  if (APPLY) { try { await fs.access(bk); throw new Error('backup exists, refusing to overwrite') } catch (e: any) { if (e.message.startsWith('backup exists')) throw e } await fs.writeFile(bk, JSON.stringify({ takenAt: new Date().toISOString(), bans, ban_source_links: links }, null, 1)) }
  const ledger: string[] = []
  for (const f of F) {
    const b: any = byId.get(f.ban_id); if (!b) { console.log('MISSING', f.ban_id); continue }
    const patch: Record<string, unknown> = { ...(PATCH[f.ban_id] ?? {}) }
    const v = f.verdict as string
    if (typeof f.source_url === 'string' && /index\.php\?title=([^&]+)&action=raw/.test(f.source_url)) f.source_url = 'https://en.wikipedia.org/wiki/' + f.source_url.match(/title=([^&]+)/)![1]
    let link = ''
    if ((v === 'SUPPORTED' || v === 'PARTIAL') && f.source_url) {
      const note = NOTE[f.ban_id] ?? (f.ban_id === 29817 ? null : f.suggested_note)
      if (note) patch.description = note
      if (v === 'PARTIAL' && ![1212].includes(f.ban_id)) patch.confidence = 'unverified'
      link = ` + source ${f.source_url}`
      if (APPLY) {
        const e = await db.from('ban_sources').select('id').eq('source_url', f.source_url).limit(1)
        let sid: number
        if (e.data?.length) sid = e.data[0].id
        else { const r = await db.from('ban_sources').insert({ source_name: f.source_name || f.source_url, source_url: f.source_url, source_type: typeOf(f.source_url), accessed_at: TODAY }).select('id').single(); if (r.error) throw r.error; sid = (r.data as any).id }
        const lr = await db.from('ban_source_links').upsert({ ban_id: f.ban_id, source_id: sid, locator: (f.locator || 'see page').slice(0, 250) }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true }); if (lr.error) throw lr.error
      }
    } else if (v === 'UNSUPPORTED' && !KEEP.has(f.ban_id)) { patch.confidence = 'unverified'; patch.description = SRC_NEEDED }
    const diff = Object.entries(patch).filter(([k, x]) => b[k] !== x).map(([k, x]) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(x)}`)
    ledger.push(`- ban ${f.ban_id} ${f.slug} / ${f.country} [${v}]: ${diff.join('; ') || 'no field change'}${link}`)
    if (APPLY && diff.length) { const r = await db.from('bans').update(patch).eq('id', f.ban_id).select('id'); if (r.error) throw r.error }
  }
  await fs.writeFile(path.join(DIR, 'LEDGER-round2.md'), `# Top-100 round 2 ledger ${TODAY} (${APPLY ? 'applied' : 'dry run'})\n\n${ledger.join('\n')}\n`)
  if (APPLY) {
    const slugs = (await db.from('books').select('slug').in('id', [...new Set(bans.map((b: any) => b.book_id))])).data?.map((x: any) => x.slug) ?? []
    await bustPaths(slugs.map((s: string) => `/books/${s}`)); console.log('busted', slugs.length)
  }
  console.log(ledger.length, 'rows')
}
main().catch(e => { console.error(e); process.exit(1) })
