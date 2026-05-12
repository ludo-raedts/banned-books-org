/**
 * Filter the slug-audit output down to the NFD-bug subset.
 *
 * A discrepancy is classified as "NFD-bug" iff replaying the pre-Sprint-A
 * buggy `toSlug()` against the current source field reproduces the stored
 * slug exactly. That guarantees the only difference between stored and
 * expected is the missing NFD-normalisation step — i.e. accented or
 * ligature characters that collapsed into `[^a-z0-9]+` hyphens.
 *
 * Everything else (editorial truncation, hand-disambiguated suffixes,
 * apostrophe-handling drift, name-order swaps, initials styling) is
 * out of scope and left untouched.
 *
 * Usage:
 *   npx tsx scripts/filter-nfd-subset.ts /tmp/slug-audit.json > /tmp/nfd-subset.txt
 *   npx tsx scripts/filter-nfd-subset.ts /tmp/slug-audit.json --json > /tmp/nfd-subset.json
 */

import { readFileSync } from 'fs'

const JSON_OUT = process.argv.includes('--json')
const path = process.argv.find((a, i) => i >= 2 && !a.startsWith('-'))
if (!path) {
  console.error('usage: filter-nfd-subset.ts <audit-json-path> [--json]')
  process.exit(2)
}

// Pre-Sprint-A buggy toSlug — copied verbatim from the three import scripts
// (see git show b52cbfb -- scripts/import-pen.ts).
function buggySlug(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’‚‛'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type Discrepancy = {
  table: 'books' | 'authors'
  id: number
  source: string
  storedSlug: string
  expectedSlug: string
}

const text = readFileSync(path, 'utf8')
const subset: Discrepancy[] = []
const skipped: Discrepancy[] = []

for (const line of text.split('\n')) {
  if (!line.startsWith('{')) continue
  let obj: any
  try { obj = JSON.parse(line) } catch { continue }
  if (obj.summary) continue
  const d = obj as Discrepancy
  const replay = buggySlug(d.source)
  if (replay === d.storedSlug) subset.push(d)
  else skipped.push(d)
}

if (JSON_OUT) {
  for (const d of subset) console.log(JSON.stringify(d))
  console.error(`NFD subset: ${subset.length}  | out-of-scope: ${skipped.length}`)
} else {
  const books = subset.filter(d => d.table === 'books')
  const authors = subset.filter(d => d.table === 'authors')
  const print = (title: string, rows: Discrepancy[]) => {
    console.log(`\n=== ${title} (${rows.length}) ===`)
    if (rows.length === 0) { console.log('(none)'); return }
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
  print('Books NFD-bug subset', books)
  print('Authors NFD-bug subset', authors)
  console.log(`\nSummary: ${books.length} books + ${authors.length} authors (${subset.length} total) in NFD-bug subset.`)
  console.log(`Out-of-scope discrepancies (not NFD-bug, left untouched): ${skipped.length}`)
}
