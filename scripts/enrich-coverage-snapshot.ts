/**
 * enrich-coverage-snapshot.ts — read-only coverage snapshot across the three
 * per-book enrichment dimensions. The before/after measurement primitive for
 * enrich-all.ts (its Phase-1 parallel harvest is wrapped in two
 * captureCoverage() calls).
 *
 * Uses count(head:true) queries (NOT row fetches) so it is immune to the
 * Supabase 1000-row .select() cap (see memory: "Supabase plain .select() capped
 * at 1000 rows"). Per dimension it reports the populated count over its CORRECT
 * denominator:
 *   • isbn13       — over all books
 *   • cover_url    — over all books
 *   • description  — over all books (description OR description_book)
 *   • title_native — over NON-English originals only (English books need none)
 *
 * CourtListener is intentionally absent: it is a render-time live feed
 * (src/lib/courtlistener.ts), not a per-book column, so it carries no coverage %.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-coverage-snapshot.ts
 *   npx tsx --env-file=.env.local scripts/enrich-coverage-snapshot.ts --snapshot=data/enrich-run/foo/coverage-before.json
 */
import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { flagValue } from './lib/cli'

const db = adminClient()

async function count(filter: (q: any) => any): Promise<number> {
  const { count, error } = await filter(
    db.from('books').select('*', { count: 'exact', head: true }),
  )
  if (error) throw new Error(error.message)
  return count ?? 0
}

const pct = (n: number, d: number): number => (d === 0 ? 0 : (n / d) * 100)

export interface CoverageSnapshot {
  capturedAt: string
  total: number
  nonEnglish: number
  dims: Array<{ key: string; label: string; have: number; denom: number; gap: number }>
}

export async function captureCoverage(): Promise<CoverageSnapshot> {
  const total = await count((q) => q)
  const nonEnglish = await count((q) => q.neq('original_language', 'en'))

  const haveIsbn = await count((q) => q.not('isbn13', 'is', null))
  const haveCover = await count((q) => q.not('cover_url', 'is', null))
  const haveDesc = await count((q) =>
    q.or('description.not.is.null,description_book.not.is.null'),
  )
  const haveNative = await count((q) =>
    q.neq('original_language', 'en').not('title_native', 'is', null),
  )

  return {
    capturedAt: new Date().toISOString(),
    total,
    nonEnglish,
    dims: [
      { key: 'isbn13', label: 'ISBN13', have: haveIsbn, denom: total, gap: total - haveIsbn },
      { key: 'cover', label: 'Cover', have: haveCover, denom: total, gap: total - haveCover },
      { key: 'description', label: 'Description', have: haveDesc, denom: total, gap: total - haveDesc },
      { key: 'title_native', label: 'Native title (non-EN)', have: haveNative, denom: nonEnglish, gap: nonEnglish - haveNative },
    ],
  }
}

function print(s: CoverageSnapshot) {
  console.log(`\nCatalogue: ${s.total} books  (${s.nonEnglish} non-English originals)\n`)
  console.log('Dimension'.padEnd(24) + 'Have'.padStart(8) + 'Denom'.padStart(8) + 'Cov'.padStart(9) + 'Gap'.padStart(8))
  console.log('-'.repeat(57))
  for (const d of s.dims) {
    console.log(
      d.label.padEnd(24) +
        String(d.have).padStart(8) +
        String(d.denom).padStart(8) +
        (pct(d.have, d.denom).toFixed(1) + '%').padStart(9) +
        String(d.gap).padStart(8),
    )
  }
  console.log('\nCourtListener: live feed (render-time), not a per-book column — no coverage %.\n')
}

async function main() {
  const snapshot = await captureCoverage()
  print(snapshot)
  const out = flagValue('snapshot')
  if (out) {
    writeFileSync(out, JSON.stringify(snapshot, null, 2))
    console.log(`  snapshot → ${out}\n`)
  }
}

// Run as CLI unless imported.
if (process.argv[1] && process.argv[1].endsWith('enrich-coverage-snapshot.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
