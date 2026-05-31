/**
 * Scan the whole books table for impossible / suspicious first_published_year.
 *
 * Signals (joined via book_authors → authors.birth_year/death_year):
 *   - HARD  year > current year (future)
 *   - HARD  year < author birth_year            (published before born)
 *   - SOFT  year < birth_year + 8               (improbably young author)
 *   - SOFT  year > death_year + 60              (long-posthumous; often a wrong match)
 *
 * Authors with NULL birth_year (ancient/anonymous) can't be birth-checked.
 * Pure report to data/impossible-years-<date>.md. No DB writes.
 *
 * Usage: npx tsx --env-file=.env.local scripts/audit-impossible-years.ts
 */
import { adminClient } from '../src/lib/supabase'
import fs from 'node:fs'

const THIS_YEAR = 2026

type Row = {
  id: number; slug: string; title: string; first_published_year: number | null
  book_authors: { authors: { display_name: string; birth_year: number | null; death_year: number | null } | null }[]
}

async function main() {
  const supabase = adminClient()
  const PAGE = 1000
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, first_published_year, book_authors(authors(display_name, birth_year, death_year))')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as Row[]))
    if (data.length < PAGE) break
  }
  console.log(`Scanned ${rows.length} books.`)

  const hard: { slug: string; title: string; year: number; author: string; birth: number | null; death: number | null; why: string }[] = []
  const soft: typeof hard = []
  let noYear = 0

  for (const b of rows) {
    const y = b.first_published_year
    if (y == null) { noYear++; continue }
    const a = b.book_authors?.[0]?.authors ?? null
    const author = a?.display_name ?? '(no author)'
    const birth = a?.birth_year ?? null
    const death = a?.death_year ?? null

    if (y > THIS_YEAR) { hard.push({ slug: b.slug, title: b.title, year: y, author, birth, death, why: `future (>${THIS_YEAR})` }); continue }
    if (birth != null && y < birth) { hard.push({ slug: b.slug, title: b.title, year: y, author, birth, death, why: `before author birth (${birth})` }); continue }
    if (birth != null && y < birth + 8) { soft.push({ slug: b.slug, title: b.title, year: y, author, birth, death, why: `author only ${y - birth}y old` }); continue }
    if (death != null && y > death + 60) { soft.push({ slug: b.slug, title: b.title, year: y, author, birth, death, why: `${y - death}y after author death (${death})` }); continue }
  }

  hard.sort((a, z) => a.year - z.year)
  soft.sort((a, z) => a.author.localeCompare(z.author))

  const today = new Date().toISOString().slice(0, 10)
  const out = `data/impossible-years-${today}.md`
  const fmt = (r: typeof hard[number]) =>
    `| [${r.title}](https://banned-books.org/books/${r.slug}) | \`${r.slug}\` | ${r.year} | ${r.author} | ${r.birth ?? '?'}–${r.death ?? '?'} | ${r.why} |`
  const L = [`# Impossible / suspicious first_published_year — ${today}`, '',
    `Scanned ${rows.length} books · ${noYear} have no year set.`, '',
    `- 🔴 HARD (impossible): **${hard.length}**`, `- 🟡 SOFT (suspicious): **${soft.length}**`, '',
    `## 🔴 HARD (${hard.length})`, '',
    '| Book | slug | year | author | b–d | why |', '|------|------|------|--------|-----|-----|',
    ...hard.map(fmt), '',
    `## 🟡 SOFT (${soft.length})`, '',
    '| Book | slug | year | author | b–d | why |', '|------|------|------|--------|-----|-----|',
    ...soft.map(fmt), '']
  fs.writeFileSync(out, L.join('\n'))

  console.log(`\n🔴 HARD: ${hard.length}   🟡 SOFT: ${soft.length}   (no year: ${noYear})`)
  console.log(`Report: ${out}\n`)
  if (hard.length) { console.log('HARD hits:'); for (const r of hard) console.log(`  ${r.year}  ${r.title}  (${r.author} ${r.birth ?? '?'}–${r.death ?? '?'}) — ${r.why}`) }
}
main().catch(e => { console.error(e); process.exit(1) })
