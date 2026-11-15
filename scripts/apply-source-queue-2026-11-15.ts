/**
 * One-off 2026-11-15: apply the per-case source check of the 68 bans whose only source is the
 * Index on Censorship homepage (+ Singapore group). Evidence: data/source-queue/findings-*.json
 * and data/source-queue/LEDGER.md. Policy: never delete a ban; no verdict "UNSUPPORTED" is treated as
 * proof of falsity: the row stays, gets confidence='unverified' + a 'Source needed' note. Years/status are
 * changed only where an opened source supports it (Singapore group, Fanny Hill). Old values go to
 * data/source-queue/backup-2026-11-15.json before any write. Dry-run default.
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const APPLY = isApply()
const db = adminClient()
const DIR = path.join(process.cwd(), 'data', 'source-queue')
const TODAY = new Date().toISOString().slice(0, 10)
const NEED = 'Source needed: the only source cited is the Index on Censorship homepage, which does not record this ban.'
const UNSURE = ' The year and the nature of the measure are uncertain.'

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN')
  const find: any[] = []
  for (const i of [1, 2, 3, 4, 5]) find.push(...JSON.parse(await fs.readFile(path.join(DIR, `findings-${i}.json`), 'utf8')))
  const sg = JSON.parse(await fs.readFile(path.join(DIR, 'findings-singapore.json'), 'utf8'))
  void sg
  const SG_GROUP: number[] = []
  for (let i = 29212; i <= 29237; i++) if (i !== 29222) SG_GROUP.push(i)
  SG_GROUP.push(29817)
  const FANNY = 29238, HANGMAN = 990
  const SG_SINGLE_UNSUPPORTED = [694, 695, 696, 922]
  const queueIds = find.map(f => f.ban_id as number)
  const touch = [...new Set([...queueIds, ...SG_GROUP, FANNY, HANGMAN, ...SG_SINGLE_UNSUPPORTED])]
  const bans: any[] = []
  for (let i = 0; i < touch.length; i += 200) { const r = await db.from('bans').select('*').in('id', touch.slice(i, i + 200)); if (r.error) throw r.error; bans.push(...(r.data ?? [])) }
  const links: any[] = []
  for (let i = 0; i < touch.length; i += 200) { const r = await db.from('ban_source_links').select('*').in('ban_id', touch.slice(i, i + 200)); if (r.error) throw r.error; links.push(...(r.data ?? [])) }
  const byId = new Map(bans.map(b => [b.id, b]))
  console.log('rows', touch.length, 'found', bans.length)
  if (APPLY) await fs.writeFile(path.join(DIR, 'backup-2026-11-15.json'), JSON.stringify({ takenAt: new Date().toISOString(), bans, ban_source_links: links }, null, 1))

  const ledger: string[] = []
  const upd = async (id: number, patch: Record<string, unknown>, why: string) => {
    const b = byId.get(id); if (!b) { console.log('MISSING', id); return }
    const diff = Object.entries(patch).filter(([k, v]) => b[k] !== v).map(([k, v]) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(v)}`)
    ledger.push(`- ban ${id} (${why}): ${diff.join('; ') || 'no change'}`)
    if (APPLY && diff.length) { const r = await db.from('bans').update(patch).eq('id', id).select('id'); if (r.error) throw r.error }
  }
  async function source(name: string, url: string, type: string) {
    const f = await db.from('ban_sources').select('id').eq('source_url', url).limit(1)
    if (f.data?.length) return f.data[0].id as number
    if (!APPLY) return -1
    const r = await db.from('ban_sources').insert({ source_name: name, source_url: url, source_type: type, accessed_at: TODAY }).select('id').single()
    if (r.error) throw r.error
    return (r.data as any).id as number
  }
  async function link(banId: number, sid: number, locator: string) {
    if (!APPLY) return
    const r = await db.from('ban_source_links').upsert({ ban_id: banId, source_id: sid, locator }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true }); if (r.error) throw r.error
  }

  // 1. Supported three: add the specific source, short factual note.
  const sup: Record<number, [string, string, string, string, string]> = {
    811: ['Wikipedia: Epitaphios (Ritsos)', 'https://en.wikipedia.org/wiki/Epitaphios_(Ritsos)', 'wikipedia', 'History/publication section', 'Reported: the remaining copies of the 1936 edition were burned in Athens under the Metaxas regime (Wikipedia, citing a 1990 New York Times obituary of Ritsos). The measure was a burning, not a documented statute.'],
    906: ['Wikipedia: The Palace of Dreams', 'https://en.wikipedia.org/wiki/The_Palace_of_Dreams', 'wikipedia', 'Publication/censorship section', 'Reported condemned and withdrawn in early 1982, after publication in 1981 (Wikipedia). When or whether the ban was lifted is not documented here.'],
    671: ['Amnesty International EUR 44/74/90 (1990)', 'https://www.amnesty.org/ar/wp-content/uploads/2021/06/eur440741990en.pdf', 'ngo', 'paragraph 1', 'Reported confiscated on publication in February 1990; the author, Ismail Beşikçi, was charged on 12 March 1990 (Amnesty International).'],
  }
  for (const [k, v] of Object.entries(sup)) {
    const id = +k; const sid = await source(v[0], v[1], v[2]); await link(id, sid, v[3]); await upd(id, { description: v[4] }, 'SUPPORTED: specific source added')
  }
  // 2. Everyone else in the queue: marked unverified, never deleted.
  const done = new Set<number>(Object.keys(sup).map(Number))
  for (const f of find) {
    if (done.has(f.ban_id)) continue
    const b = byId.get(f.ban_id); if (!b) continue
    const doubt = f.verdict === 'PARTIAL' || f.verdict === 'CONTRADICTED'
    const note = NEED + (doubt ? UNSURE : '')
    // Existing notes: book blurbs on 691/692 are kept after the marker; the unsourced 693 date claim is replaced.
    const keep = b.description && [691, 692].includes(b.id) ? ' ' + b.description : ''
    await upd(b.id, { confidence: 'unverified', description: note + keep }, `${f.verdict}: marked unverified, not deleted`)
  }
  // 3. Singapore: the cited Wikipedia table gives no title-level year or lift date (SSO opened).
  const SGNOTE = "Wikipedia's list records this title as prohibited under Singapore's Internal Security (Prohibition of Publications) (Consolidation) Order (G.N. S 413/1950, extended to Singapore in 1963). The date the title was prohibited and any lifting could not be verified."
  for (const id of SG_GROUP) await upd(id, { year_started: null, year_ended: null, status: 'unclear', description: SGNOTE }, 'SG group: unsupported year/lift cleared, status unclear')
  await upd(FANNY, { year_started: 1966, description: 'Reported banned in Singapore in 1966 and among the 240 publications de-gazetted on 25 November 2015, under the Undesirable Publications regime (Global Voices and Straits Times coverage; not the Internal Security order).' }, 'Fanny Hill: 1948→1966 per secondary reports')
  await upd(HANGMAN, { status: 'unclear', description: "Reported: in July 2010 the retailer pulled the book after the media authority's intervention, which said it was not formally banned; the author, Alan Shadrake, was convicted of contempt in November 2010. No formal prohibition order was found." }, 'Hangman: reworded to what is reported')
  for (const id of SG_SINGLE_UNSUPPORTED) {
    const b = byId.get(id); const homepage = queueIds.includes(id)
    if (homepage) continue // already marked in step 2
    await upd(id, { confidence: 'unverified', description: 'Source needed: the page cited for this ban does not record it.' }, 'SG single: unsupported, marked unverified')
  }
  await fs.writeFile(path.join(DIR, 'LEDGER.md'), `# Source-queue ledger ${TODAY}\n\nGenerated by apply-source-queue-2026-11-15.ts (${APPLY ? 'applied' : 'dry run'}). Old values: backup-2026-11-15.json.\n\n${ledger.join('\n')}\n`)
  console.log(ledger.length, 'ledger lines')
  if (APPLY) {
    const slugs = new Set<string>()
    const ids = [...new Set(bans.map(b => b.book_id))]
    for (let i = 0; i < ids.length; i += 100) { const r = await db.from('books').select('slug').in('id', ids.slice(i, i + 100)); (r.data ?? []).forEach((x: any) => slugs.add(x.slug)) }
    console.log('busting', slugs.size, 'books')
    await bustPaths([...slugs].map(s => `/books/${s}`))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
