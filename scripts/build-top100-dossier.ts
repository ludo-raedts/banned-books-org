/** Read-only: the /top-100-banned-books list (live page order) with every ban row, its sources and locators → data/top100-check/dossier.json */
import { adminClient } from '../src/lib/supabase'
import { promises as fs } from 'node:fs'
const db = adminClient()
async function main() {
  const html = await (await fetch('https://www.banned-books.org/top-100-banned-books', { headers: { 'User-Agent': 'dossier/1.0' } })).text()
  const slugs = [...new Set([...html.matchAll(/href="\/books\/([^"#?]+)"/g)].map(m => m[1]))].slice(0, 100)
  const books = (await db.from('books').select('id,slug,title,first_published_year').in('slug', slugs)).data ?? []
  const bk = new Map(books.map((b: any) => [b.id, b]))
  const bans: any[] = []
  for (let i = 0; i < books.length; i += 25) {
    const r = await db.from('bans').select('id,book_id,country_code,scope_id,year_started,year_ended,status,confidence,description').in('book_id', books.slice(i, i + 25).map((b: any) => b.id)).order('id').range(0, 4999)
    if (r.error) throw r.error; bans.push(...(r.data ?? []))
  }
  const ids = bans.map(b => b.id)
  const links: any[] = []
  for (let i = 0; i < ids.length; i += 300) { const r = await db.from('ban_source_links').select('ban_id,source_id,locator').in('ban_id', ids.slice(i, i + 300)); if (r.error) throw r.error; links.push(...(r.data ?? [])) }
  const srcs = new Map<number, any>()
  const sids = [...new Set(links.map(l => l.source_id))]
  for (let i = 0; i < sids.length; i += 300) { const r = await db.from('ban_sources').select('id,source_name,source_url').in('id', sids.slice(i, i + 300)); (r.data ?? []).forEach((s: any) => srcs.set(s.id, s)) }
  const out = slugs.map((slug, rank) => {
    const b: any = books.find((x: any) => x.slug === slug); if (!b) return null
    const bb = bans.filter(x => x.book_id === b.id).map(x => ({ ...x, sources: links.filter(l => l.ban_id === x.id).map(l => ({ url: srcs.get(l.source_id)?.source_url, name: srcs.get(l.source_id)?.source_name, locator: l.locator })) }))
    return { rank: rank + 1, slug, title: b.title, first_published_year: b.first_published_year, bans: bb }
  }).filter(Boolean)
  await fs.writeFile('data/top100-check/dossier.json', JSON.stringify(out, null, 1))
  console.log('books', out.length, 'bans', out.reduce((n: number, b: any) => n + b.bans.length, 0))
}
main().catch(e => { console.error(e); process.exit(1) })
