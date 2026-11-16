/** Read-only: fact pack per book for the redactie rewrite → data/redactie/packs/<slug>.json. Usage: --slugs=a,b | --top100 */
import { adminClient } from '../src/lib/supabase'
import { promises as fs } from 'node:fs'
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3)
async function main() {
  const db = adminClient()
  let slugs = arg('slugs')?.split(',').filter(Boolean) ?? []
  if (process.argv.includes('--top100')) slugs = JSON.parse(await fs.readFile('data/top100-check/dossier.json', 'utf8')).map((b: any) => b.slug)
  if (!slugs.length) throw new Error('--slugs=a,b or --top100')
  await fs.mkdir('data/redactie/packs', { recursive: true })
  let n = 0
  for (let i = 0; i < slugs.length; i += 20) {
    const r = await db.from('books').select('id,slug,title,first_published_year,censorship_context,censorship_context_status,censorship_context_sources,book_authors(authors(display_name))').in('slug', slugs.slice(i, i + 20))
    for (const b of (r.data ?? []) as any[]) {
      if (b.censorship_context_status !== 'source_verified') { console.log('skip (not source_verified):', b.slug, b.censorship_context_status); continue }
      const bans = (await db.from('bans').select('country_code,year_started,year_ended,status,confidence,institution,scope_id,description,countries(name_en)').eq('book_id', b.id).order('year_started', { ascending: true }).limit(300)).data ?? []
      const pack = {
        slug: b.slug, title: b.title, author: b.book_authors?.map((a: any) => a.authors?.display_name).filter(Boolean).join(', '), first_published_year: b.first_published_year,
        current_text: b.censorship_context, sources: b.censorship_context_sources,
        ban_rows: (bans as any[]).filter(x => !x.institution && x.confidence !== 'unverified' && !String(x.description ?? '').startsWith('Source needed')).slice(0, 40).map(x => ({ country: x.countries?.name_en, year: x.year_started, end: x.year_ended, status: x.status, confidence: x.confidence, scope: x.scope_id, note: x.description })),
        institution_rows: (bans as any[]).filter(x => x.institution).length,
      }
      await fs.writeFile(`data/redactie/packs/${b.slug}.json`, JSON.stringify(pack, null, 1)); n++
    }
  }
  console.log('packs written:', n)
}
main().catch(e => { console.error(e); process.exit(1) })
