/**
 * One-off 2026-11-16: ban-row follow-ups from the hand research of the last 28 top-100 books
 * (data/top100-check/hand/row_issues.json). Missing evidence is never treated as proof of falsity: such rows get
 * confidence='unverified' + a 'Source needed' note; only demonstrable misdescriptions are reworded. Backup first.
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'
import { promises as fs } from 'node:fs'
const APPLY = isApply(); const db = adminClient()
const NEED = 'Source needed: no source found that records this ban in this country.'
type Fix = { slug: string; country: string; patch: Record<string, unknown>; only?: (b: any) => boolean }
const FIXES: Fix[] = [
  { slug: 'beartown', country: 'Russia', patch: { description: 'Russian booksellers were fined for selling the book: the co-founder of the bookstore Vse Svobodny, Artem Faustov, was fined 50,000 rubles in early March 2026, and a Makhachkala court fined the Chitai-Gorod chain (The Insider; OC Media).' } },
  { slug: 'the-tin-drum', country: 'Germany', patch: { confidence: 'unverified', description: NEED } },
  { slug: 'the-tin-drum', country: 'United States', patch: { confidence: 'unverified', description: 'Source needed: the 1997 US case found concerned the film adaptation, not the novel.' } },
  { slug: 'the-tin-drum', country: 'Poland', patch: { confidence: 'unverified', description: NEED } },
  { slug: 'the-color-purple', country: 'Israel', patch: { confidence: 'unverified', description: 'Alice Walker declined publication of the book in Israel in 2012 as a boycott (Wikipedia); this was the author\'s decision, not a ban.' } },
  { slug: 'the-sorrows-of-young-werther', country: 'Austria', patch: { confidence: 'unverified', description: NEED } },
]
async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN'); const led: string[] = []; const backups: any[] = []; const slugs = new Set<string>()
  for (const f of FIXES) {
    const bk = (await db.from('books').select('id').eq('slug', f.slug).single()).data as any
    const rows = ((await db.from('bans').select('*,countries(name_en)').eq('book_id', bk.id)).data ?? []).filter((r: any) => r.countries?.name_en === f.country && !r.institution)
    if (!rows.length) { led.push(`- ${f.slug}/${f.country}: NO ROW`); continue }
    for (const r of rows) { backups.push(r); led.push(`- ban ${r.id} ${f.slug}/${f.country}: ${Object.entries(f.patch).filter(([k, v]) => r[k] !== v).map(([k, v]) => `${k}: ${JSON.stringify(r[k])} → ${JSON.stringify(v)}`).join('; ')}`); slugs.add(f.slug)
      if (APPLY) { const u = await db.from('bans').update(f.patch).eq('id', r.id).select('id'); if (u.error) throw u.error } }
  }
  if (APPLY) { await fs.writeFile('data/top100-check/hand/backup-row-fixes.json', JSON.stringify(backups, null, 1)); await bustPaths([...slugs].map(s => '/books/' + s)) }
  await fs.writeFile('data/top100-check/hand/LEDGER-row-fixes.md', `# Hand row fixes 2026-11-16 (${APPLY ? 'applied' : 'dry run'})\n\n${led.join('\n')}\n`)
  console.log(led.join('\n').slice(0, 1500))
}
main().catch(e => { console.error(e); process.exit(1) })
