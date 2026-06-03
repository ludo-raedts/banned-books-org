#!/usr/bin/env tsx
/**
 * Audit `books.first_published_year` against OpenLibrary's first-publication
 * year. Read-only: produces a review artifact, never writes to the DB.
 *
 * Why: early imports frequently stamped a *reprint/edition* year (often a
 * recent one) into `first_published_year` instead of the work's true first
 * publication. E.g. Skeleton Crew (1985) stamped 2025, The Testaments stamped
 * 1985 (copied from The Handmaid's Tale).
 *
 * Method (high-confidence only):
 *   - Only books with BOTH first_published_year AND openlibrary_work_id are
 *     cross-checkable. We query the OL search API by title (+author) and trust
 *     the result ONLY when one of the returned docs' work key matches the
 *     book's own openlibrary_work_id. A title-search without a work-key match
 *     returns the wrong work too often to trust (e.g. "1984" → a 2003 edition).
 *   - OL's first_publish_year is a SIGNAL, not ground truth (e.g. Candide
 *     resolves to 1746 vs the true 1759). So everything lands in a review
 *     file; a human decides what to apply.
 *
 * Output:
 *   data/publication-year-audit.json  — full machine-readable rows
 *   data/publication-year-audit.md    — readable summary, flagged sorted by |Δ|
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-publication-years.ts            # threshold Δ≥3
 *   npx tsx --env-file=.env.local scripts/audit-publication-years.ts --threshold=5
 */

import { writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'

const THRESH = (() => {
  const a = process.argv.find(x => x.startsWith('--threshold='))
  return a ? parseInt(a.split('=')[1], 10) : 3
})()
const CONCURRENCY = 6

type Book = {
  id: number
  slug: string
  title: string
  first_published_year: number
  openlibrary_work_id: string
  author: string | null
}

type Row = Book & {
  ol_year: number | null
  matched_work: boolean
  diff: number | null
  status: 'flagged' | 'ok' | 'unverified'
}

async function olYear(b: Book): Promise<{ year: number | null; matched: boolean }> {
  const params = new URLSearchParams({ title: b.title, fields: 'key,first_publish_year', limit: '5' })
  if (b.author) params.set('author', b.author)
  try {
    const r = await fetch(`https://openlibrary.org/search.json?${params}`)
    if (!r.ok) return { year: null, matched: false }
    const j: any = await r.json()
    const docs: { key?: string; first_publish_year?: number }[] = j.docs ?? []
    const m = docs.find(d => (d.key ?? '').endsWith(b.openlibrary_work_id))
    if (m && typeof m.first_publish_year === 'number') return { year: m.first_publish_year, matched: true }
    return { year: null, matched: false }
  } catch {
    return { year: null, matched: false }
  }
}

async function fetchAll(): Promise<Book[]> {
  const sb = adminClient()
  const PAGE = 1000
  const out: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, first_published_year, openlibrary_work_id, book_authors(authors(display_name))')
      .not('first_published_year', 'is', null)
      .not('openlibrary_work_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const b of data as any[]) {
      out.push({
        id: b.id, slug: b.slug, title: b.title,
        first_published_year: b.first_published_year,
        openlibrary_work_id: b.openlibrary_work_id,
        author: b.book_authors?.[0]?.authors?.display_name ?? null,
      })
    }
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  console.log(`Loading cross-checkable books (year + ol_work)…`)
  const books = await fetchAll()
  console.log(`  ${books.length} books. Querying OpenLibrary (concurrency=${CONCURRENCY}, Δ≥${THRESH})…`)

  const rows: Row[] = []
  let done = 0
  for (let i = 0; i < books.length; i += CONCURRENCY) {
    const batch = books.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(async b => {
      const { year, matched } = await olYear(b)
      const diff = year != null ? b.first_published_year - year : null
      const status: Row['status'] =
        !matched || year == null ? 'unverified'
        : Math.abs(diff!) >= THRESH ? 'flagged'
        : 'ok'
      return { ...b, ol_year: year, matched_work: matched, diff, status }
    }))
    rows.push(...res)
    done += batch.length
    if (done % 300 === 0 || done === books.length) process.stdout.write(`\r  checked ${done}/${books.length}`)
  }
  process.stdout.write('\n')

  const flagged = rows.filter(r => r.status === 'flagged').sort((a, b) => Math.abs(b.diff!) - Math.abs(a.diff!))
  const ok = rows.filter(r => r.status === 'ok')
  const unverified = rows.filter(r => r.status === 'unverified')

  writeFileSync('data/publication-year-audit.json', JSON.stringify(rows, null, 2))

  const md: string[] = []
  md.push(`# Publication-year audit (vs OpenLibrary work-key match)`)
  md.push(``)
  md.push(`- Cross-checked: **${rows.length}** books (had both year + ol_work_id)`)
  md.push(`- Work-key matched & consistent (Δ<${THRESH}): **${ok.length}**`)
  md.push(`- **Flagged (Δ≥${THRESH}, work-key matched): ${flagged.length}**`)
  md.push(`- Unverified (no OL work-key match / no OL year): ${unverified.length}`)
  md.push(``)
  md.push(`OL first_publish_year is a signal, not ground truth — review before applying.`)
  md.push(``)
  md.push(`## Flagged — likely wrong DB year (sorted by |Δ|)`)
  md.push(``)
  md.push(`| id | slug | DB year | OL year | Δ | title | author |`)
  md.push(`|----|------|--------:|--------:|--:|-------|--------|`)
  for (const r of flagged) {
    md.push(`| ${r.id} | ${r.slug} | ${r.first_published_year} | ${r.ol_year} | ${r.diff} | ${r.title.replace(/\|/g, '\\|')} | ${(r.author ?? '').replace(/\|/g, '\\|')} |`)
  }
  writeFileSync('data/publication-year-audit.md', md.join('\n'))

  console.log(`\nSummary:`)
  console.log(`  cross-checked : ${rows.length}`)
  console.log(`  ok (Δ<${THRESH})    : ${ok.length}`)
  console.log(`  FLAGGED       : ${flagged.length}`)
  console.log(`  unverified    : ${unverified.length}`)
  console.log(`\nWrote data/publication-year-audit.json and .md`)
  console.log(`\nTop 15 flagged:`)
  for (const r of flagged.slice(0, 15)) {
    console.log(`  #${r.id} DB=${r.first_published_year} OL=${r.ol_year} (Δ${r.diff}) | ${r.title} — ${r.author ?? '?'}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
