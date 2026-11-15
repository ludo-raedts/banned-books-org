/**
 * Read-only: queue of bans whose only source(s) are the Index on Censorship homepage.
 * Writes data/source-queue/index-homepage-queue.json (+ .md). Core flag = same rule as the Google core.
 */
import { adminClient } from '../src/lib/supabase'
import { promises as fs } from 'node:fs'
const db = adminClient()
async function all<T>(build: (f: number, t: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = []
  for (let f = 0; ; f += 1000) { const r = await build(f, f + 999); if (r.error) throw new Error(r.error.message); out.push(...(r.data ?? [])); if ((r.data ?? []).length < 1000) break }
  return out
}
async function main() {
  const srcs = await all<{ id: number; source_url: string }>((f, t) => db.from('ban_sources').select('id,source_url').order('id').range(f, t))
  const home = new Set(srcs.filter(s => /^https?:\/\/(www\.)?indexoncensorship\.org\/?$/.test(s.source_url)).map(s => s.id))
  const links = await all<{ ban_id: number; source_id: number }>((f, t) => db.from('ban_source_links').select('ban_id,source_id').order('ban_id').order('source_id').range(f, t))
  const byBan = new Map<number, number[]>()
  for (const l of links) byBan.set(l.ban_id, [...(byBan.get(l.ban_id) ?? []), l.source_id])
  const homeBans = [...byBan].filter(([, s]) => s.some(x => home.has(x)))
  const onlyHome = homeBans.filter(([, s]) => s.every(x => home.has(x))).map(([b]) => b)
  console.log('homepage source ids', [...home], 'bans citing', homeBans.length, 'only-homepage', onlyHome.length)
  const bans = await all<any>((f, t) => db.from('bans').select('id,book_id,year_started,year_ended,status,confidence,description,countries(name_en,code),books(slug,title,description_book,cover_url)').in('id', onlyHome).order('id').range(f, t))
  const bookIds = [...new Set(bans.map(b => b.book_id))]
  const allBans = await all<any>((f, t) => db.from('bans').select('id,book_id').in('book_id', bookIds).order('id').range(f, t))
  const perBook = new Map<number, number[]>()
  for (const b of allBans) perBook.set(b.book_id, [...(perBook.get(b.book_id) ?? []), b.id])
  const rows = bans.map(b => {
    const siblings = perBook.get(b.book_id) ?? []
    const otherSourced = siblings.filter(id => id !== b.id && !onlyHome.includes(id))
    const core = siblings.length >= 2 || (!!b.books?.description_book && !!b.books?.cover_url)
    return { ban_id: b.id, book_id: b.book_id, slug: b.books?.slug, title: b.books?.title, country: b.countries?.name_en, year: b.year_started, status: b.status, confidence: b.confidence, note: b.description, book_bans: siblings.length, other_bans_with_specific_source: otherSourced.length, in_core: core, no_specific_source_for_any_ban: otherSourced.length === 0 }
  })
  rows.sort((a, b) => Number(b.in_core && b.no_specific_source_for_any_ban) - Number(a.in_core && a.no_specific_source_for_any_ban) || a.ban_id - b.ban_id)
  await fs.writeFile('data/source-queue/index-homepage-queue.json', JSON.stringify(rows, null, 1))
  console.log('rows', rows.length, 'priority(core & no specific source)', rows.filter(r => r.in_core && r.no_specific_source_for_any_ban).length, 'books', new Set(rows.map(r => r.slug)).size)
  for (const r of rows) console.log(r.ban_id, r.slug, '|', r.country, r.year, r.status, r.in_core ? 'CORE' : '-', r.no_specific_source_for_any_ban ? 'P1' : 'P2', '|', (r.note ?? '').slice(0, 90))
}
main().catch(e => { console.error(e); process.exit(1) })
