/**
 * One-off 2026-11-16: apply the opened-source check of 104 Wikipedia-sourced ban rows of the top-100 books
 * (data/top100-check/findings-*.json; ledger LEDGER.md; backup backup-2026-11-16.json).
 * Policy (owner: do not dismiss Wikipedia too quickly):
 *  - SUPPORTED/PARTIAL: ADD the specific opened page as an extra source link (the old link stays); replace the
 *    note with what that source records; change a year only where the opened source states a different year.
 *  - Row is about another work/measure (film, restriction, prosecution): confidence 'unverified' + factual note.
 *  - CONTRADICTED / implausible: confidence 'unverified', status 'unclear' where the claim is a current ban.
 *  - UNSUPPORTED: left untouched (listed in README for review) except the few implausible ones below.
 * Nothing is deleted. Dry-run default.
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

const YEAR: Record<number, number> = { 956: 1989, 5048: 1989, 5046: 1988, 575: 2006, 58: 1956, 5019: 1969, 655: 2025, 654: 2015, 5016: 1968, 4770: 1935, 1135: 2006 }
// Rows whose cited page shows another work or a milder measure than a "ban" of this book:
const OTHER_MEASURE = new Set([1135, 13127, 1094, 1093, 862, 12929, 885, 619, 624, 114])
const CONTRA = new Set([565])   // 1984 / China
const IMPLAUSIBLE = new Set([1105, 1127, 1128, 1129])  // Animal Farm Libya 1945; Jewel of Medina SA/QA/MY
const SKIP_NOTE = new Set([5041, 1161, 5061]) // no useful suggested note
const SRC_NEEDED = 'Source needed: the cited list does not record this ban.'

const typeOf = (u: string) => /wikipedia\.org/.test(u) ? 'wikipedia' : /gazette\./.test(u) ? 'government' : /(thestar|malaymail|dawn|globalvoices|thenationalnews|nytimes)/.test(u) ? 'news' : 'web'

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN')
  const F: any[] = []
  for (const i of [1, 2, 3, 4, 5, 6]) F.push(...JSON.parse(await fs.readFile(path.join(DIR, `findings-${i}.json`), 'utf8')))
  const ids = F.map(f => f.ban_id)
  const bans = (await db.from('bans').select('*').in('id', ids)).data ?? []
  const links = (await db.from('ban_source_links').select('*').in('ban_id', ids)).data ?? []
  const byId = new Map(bans.map((b: any) => [b.id, b]))
  if (APPLY) await fs.writeFile(path.join(DIR, 'backup-2026-11-16.json'), JSON.stringify({ takenAt: new Date().toISOString(), bans, ban_source_links: links }, null, 1))
  const ledger: string[] = []
  for (const f of F) {
    const b: any = byId.get(f.ban_id); if (!b) { console.log('MISSING (merged/deleted?)', f.ban_id); ledger.push(`- ban ${f.ban_id}: merged into duplicate 25495 (Fifty Shades / Malaysia, KDN P.U.(A) 37, 2015) and deleted; old row in backup-ban-654-merge.json`); continue }
    const patch: Record<string, unknown> = {}
    const v = f.verdict as string
    const good = (v === 'SUPPORTED' || v === 'PARTIAL') && f.source_url && !SKIP_NOTE.has(f.ban_id)
    if (YEAR[f.ban_id]) patch.year_started = YEAR[f.ban_id]
    if (good && f.suggested_note) patch.description = f.suggested_note
    if (OTHER_MEASURE.has(f.ban_id)) patch.confidence = 'unverified'
    if (CONTRA.has(f.ban_id)) { patch.confidence = 'unverified'; patch.status = 'unclear'; patch.description = 'Reported: a restricted-circulation Chinese edition appeared in 1985 and the book was made publicly available in 1988 (Wikipedia, Nineteen Eighty-Four). A current ban is not documented.' }
    if (IMPLAUSIBLE.has(f.ban_id)) { patch.confidence = 'unverified'; patch.description = SRC_NEEDED }
    if (f.ban_id === 1134) { patch.confidence = 'unverified' } // Da Vinci Code / Qatar: already 'Source needed' note
    const diff = Object.entries(patch).filter(([k, x]) => b[k] !== x).map(([k, x]) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(x)}`)
    // specific source link (opened page) for SUPPORTED/PARTIAL
    let linkTxt = ''
    if (good) {
      linkTxt = ` + source ${f.source_url} [${f.locator ?? ''}]`
      if (APPLY) {
        let sid: number
        const e = await db.from('ban_sources').select('id').eq('source_url', f.source_url).limit(1)
        if (e.data?.length) sid = e.data[0].id
        else { const r = await db.from('ban_sources').insert({ source_name: f.source_name || f.source_url, source_url: f.source_url, source_type: typeOf(f.source_url), accessed_at: TODAY }).select('id').single(); if (r.error) throw r.error; sid = (r.data as any).id }
        const lr = await db.from('ban_source_links').upsert({ ban_id: f.ban_id, source_id: sid, locator: (f.locator || 'see page').slice(0, 250) }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true }); if (lr.error) throw lr.error
      }
    }
    ledger.push(`- ban ${f.ban_id} ${f.slug} / ${f.country} [${v}]: ${diff.join('; ') || 'no field change'}${linkTxt}`)
    if (APPLY && diff.length) { const r = await db.from('bans').update(patch).eq('id', f.ban_id).select('id'); if (r.error) throw r.error }
  }
  await fs.writeFile(path.join(DIR, 'LEDGER.md'), `# Top-100 source check ledger ${TODAY} (${APPLY ? 'applied' : 'dry run'})\n\n${ledger.join('\n')}\n`)
  if (APPLY) {
    const bookIds = [...new Set(bans.map((b: any) => b.book_id))]
    const slugs = (await db.from('books').select('slug').in('id', bookIds)).data?.map((x: any) => x.slug) ?? []
    await bustPaths(slugs.map((s: string) => `/books/${s}`))
    console.log('busted', slugs.length)
  }
  console.log(ledger.length, 'rows')
}
main().catch(e => { console.error(e); process.exit(1) })
