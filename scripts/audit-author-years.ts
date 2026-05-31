/**
 * Scan the authors table for impossible / suspicious birth_year & death_year.
 *
 * Signals:
 *   HARD  birth_year > death_year                (born after died)
 *   HARD  birth_year > THIS_YEAR or death > THIS_YEAR   (future)
 *   HARD  birth_year > earliest book year         (born after own first book)
 *   SOFT  death_year - birth_year > 115           (implausible lifespan)
 *   SOFT  death_year - birth_year < 0 ... covered by HARD
 *
 * The "born after own first book" check ties directly to the 24 remaining HARD
 * impossible-year books whose root cause is a bad author birth_year.
 *
 * Pure report → data/author-years-<date>.md. No DB writes.
 *
 * Usage: npx tsx --env-file=.env.local scripts/audit-author-years.ts
 */
import { adminClient } from '../src/lib/supabase'
import fs from 'node:fs'

const THIS_YEAR = 2026

type AuthorRow = { id: number; slug: string | null; display_name: string; birth_year: number | null; death_year: number | null }

async function main() {
  const supabase = adminClient()
  const PAGE = 1000

  // 1. all authors
  const authors: AuthorRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('authors')
      .select('id, slug, display_name, birth_year, death_year')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    authors.push(...data)
    if (data.length < PAGE) break
  }

  // 2. earliest book year per author (via book_authors → books)
  const earliest = new Map<number, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('book_authors')
      .select('author_id, books(first_published_year)')
      .order('author_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    for (const r of data as unknown as { author_id: number; books: { first_published_year: number | null } | null }[]) {
      const y = r.books?.first_published_year
      if (y == null) continue
      const cur = earliest.get(r.author_id)
      if (cur == null || y < cur) earliest.set(r.author_id, y)
    }
    if (data.length < PAGE) break
  }

  console.log(`Authors: ${authors.length}  ·  with a dated book: ${earliest.size}`)

  type Hit = { a: AuthorRow; earliest: number | null; why: string }
  const hard: Hit[] = []
  const soft: Hit[] = []

  for (const a of authors) {
    const b = a.birth_year, d = a.death_year
    const e = earliest.get(a.id) ?? null
    if (b != null && d != null && b > d) { hard.push({ a, earliest: e, why: `birth ${b} > death ${d}` }); continue }
    if ((b != null && b > THIS_YEAR) || (d != null && d > THIS_YEAR)) { hard.push({ a, earliest: e, why: `future year (b=${b ?? '?'}, d=${d ?? '?'})` }); continue }
    if (b != null && e != null && b > e) { hard.push({ a, earliest: e, why: `born ${b} after earliest book ${e}` }); continue }
    if (b != null && d != null && d - b > 115) { soft.push({ a, earliest: e, why: `lifespan ${d - b}y (${b}–${d})` }); continue }
    if (b != null && e != null && e - b < 8 && e - b >= 0) { soft.push({ a, earliest: e, why: `first book at age ${e - b}` }); continue }
  }

  hard.sort((x, y) => x.a.display_name.localeCompare(y.a.display_name))
  soft.sort((x, y) => x.a.display_name.localeCompare(y.a.display_name))

  const today = new Date().toISOString().slice(0, 10)
  const out = `data/author-years-${today}.md`
  const fmt = (h: Hit) => `| ${h.a.display_name} | \`${h.a.slug ?? h.a.id}\` | ${h.a.birth_year ?? '?'} | ${h.a.death_year ?? '?'} | ${h.earliest ?? '—'} | ${h.why} |`
  const L = [`# Author birth/death-year audit — ${today}`, '',
    `Authors: ${authors.length} · with a dated book: ${earliest.size}`, '',
    `- 🔴 HARD (impossible): **${hard.length}**`, `- 🟡 SOFT (suspicious): **${soft.length}**`, '',
    `## 🔴 HARD (${hard.length})`, '',
    '| Author | slug | birth | death | earliest book | why |', '|--------|------|-------|-------|---------------|-----|',
    ...hard.map(fmt), '',
    `## 🟡 SOFT (${soft.length})`, '',
    '| Author | slug | birth | death | earliest book | why |', '|--------|------|-------|-------|---------------|-----|',
    ...soft.map(fmt), '']
  fs.writeFileSync(out, L.join('\n'))

  console.log(`\n🔴 HARD: ${hard.length}   🟡 SOFT: ${soft.length}`)
  console.log(`Report: ${out}\n`)
  if (hard.length) { console.log('HARD:'); for (const h of hard) console.log(`  ${h.a.display_name}  (b=${h.a.birth_year ?? '?'} d=${h.a.death_year ?? '?'}, 1st book ${h.earliest ?? '—'}) — ${h.why}`) }
}
main().catch(e => { console.error(e); process.exit(1) })
