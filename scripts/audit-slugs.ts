/**
 * Audit existing book + author slugs against what the corrected `slugify()`
 * helper would produce from the current title / display_name.
 *
 * Read-only — reports discrepancies, does not modify the database.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-slugs.ts
 *   npx tsx --env-file=.env.local scripts/audit-slugs.ts --json
 *
 * Output (default): aligned table to stdout.
 * Output (--json):  one JSON line per discrepancy, plus a summary line.
 *
 * Background: prior to Sprint A, three import scripts shared a `toSlug()`
 * that dropped accents instead of normalising them (see
 * docs/sprint-a/step-0-findings.md §1). This audit surfaces every row whose
 * stored slug disagrees with the corrected helper so a human can decide
 * per-row whether to update — many existing slugs were authored by hand and
 * may be deliberately different from a mechanical rederivation.
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const JSON_OUT = process.argv.includes('--json')
const PAGE = 1000

async function fetchAllBooks() {
  const db = adminClient()
  const rows: Array<{ id: number; slug: string; title: string }> = []
  let offset = 0
  for (;;) {
    const { data, error } = await db
      .from('books')
      .select('id, slug, title')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`books fetch failed: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return rows
}

async function fetchAllAuthors() {
  const db = adminClient()
  const rows: Array<{ id: number; slug: string; display_name: string }> = []
  let offset = 0
  for (;;) {
    const { data, error } = await db
      .from('authors')
      .select('id, slug, display_name')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`authors fetch failed: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return rows
}

type Discrepancy = {
  table: 'books' | 'authors'
  id: number
  source: string
  storedSlug: string
  expectedSlug: string
}

function diff(rows: Array<{ id: number; slug: string }>, table: 'books' | 'authors', sourceField: (r: any) => string): Discrepancy[] {
  const out: Discrepancy[] = []
  for (const r of rows as any[]) {
    const source = sourceField(r) ?? ''
    const expected = slugify(source)
    if (expected === '') continue // non-Latin scripts: slug must come from transliteration; skip
    if (expected !== r.slug) {
      out.push({ table, id: r.id, source, storedSlug: r.slug, expectedSlug: expected })
    }
  }
  return out
}

function printTable(title: string, rows: Discrepancy[]) {
  console.log(`\n=== ${title} (${rows.length}) ===`)
  if (rows.length === 0) {
    console.log('(none)')
    return
  }
  const idW = Math.max(2, ...rows.map(r => String(r.id).length))
  const srcW = Math.min(60, Math.max(6, ...rows.map(r => r.source.length)))
  const storedW = Math.max(11, ...rows.map(r => r.storedSlug.length))
  const expW = Math.max(13, ...rows.map(r => r.expectedSlug.length))
  console.log(`${'id'.padEnd(idW)} | ${'source'.padEnd(srcW)} | ${'stored slug'.padEnd(storedW)} | ${'expected slug'.padEnd(expW)}`)
  console.log(`${'-'.repeat(idW)}-+-${'-'.repeat(srcW)}-+-${'-'.repeat(storedW)}-+-${'-'.repeat(expW)}`)
  for (const r of rows) {
    const src = r.source.length > srcW ? r.source.slice(0, srcW - 1) + '…' : r.source
    console.log(`${String(r.id).padEnd(idW)} | ${src.padEnd(srcW)} | ${r.storedSlug.padEnd(storedW)} | ${r.expectedSlug.padEnd(expW)}`)
  }
}

async function main() {
  console.log('Fetching books and authors…')
  const [books, authors] = await Promise.all([fetchAllBooks(), fetchAllAuthors()])
  console.log(`Loaded ${books.length} books, ${authors.length} authors.`)

  const bookDiscs = diff(books, 'books', (r) => r.title)
  const authorDiscs = diff(authors, 'authors', (r) => r.display_name)

  if (JSON_OUT) {
    for (const d of [...bookDiscs, ...authorDiscs]) console.log(JSON.stringify(d))
    console.log(JSON.stringify({ summary: true, books_checked: books.length, authors_checked: authors.length, book_discrepancies: bookDiscs.length, author_discrepancies: authorDiscs.length }))
  } else {
    printTable('Books with slug ≠ slugify(title)', bookDiscs)
    printTable('Authors with slug ≠ slugify(display_name)', authorDiscs)
    console.log(`\nSummary: ${bookDiscs.length} book + ${authorDiscs.length} author discrepancies (of ${books.length} books, ${authors.length} authors).`)
    console.log('Note: only rows whose corrected slug is non-empty are reported.')
    console.log('No database changes were made.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
