/**
 * _fix_genre_vocabulary.ts — bring `books.genres` back onto the canonical
 * vocabulary (the GENRES map in src/components/genre-badge.tsx).
 *
 * Applies scripts/lib/genre-folds.ts to every row it changes anything on:
 *   • folds off-vocabulary slugs onto their canonical equivalent
 *     (young-adult-fiction → young-adult, essays → essay, nonfiction → non-fiction, …)
 *   • drops slugs that were never genres (bare `fiction`, `war`, `lgbtq`, `novella`, …)
 *   • repairs `non-fiction` + `political-fiction` → `political-non-fiction`
 *   • trims rows over the 1–3 slug cap the vocabulary allows
 *
 * A row left with NO slug is written as `genres = '{}'` on purpose: that is the
 * honest state for a book nobody classified, and it puts the row back into the
 * enrich-genres-gpt.ts candidate pool (which targets exactly `genres = '{}'`).
 *
 * Writes only rows whose value actually changes, batched by target value, so a
 * catalogue-wide sweep is a few dozen statements rather than a few hundred —
 * see the score-data-quality half-applied incident for why blind row-by-row
 * writes over thousands of rows trip statement_timeout 57014.
 *
 * Verify before/after with scripts/_audit_genre_vocabulary.ts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_fix_genre_vocabulary.ts
 *   npx tsx --env-file=.env.local scripts/_fix_genre_vocabulary.ts --verbose
 *   npx tsx --env-file=.env.local scripts/_fix_genre_vocabulary.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { isMappedGenre } from '../src/components/genre-badge'
import { hasFlag, isApply } from './lib/cli'
import { resolveGenres } from './lib/genre-folds'

const PAGE = 1000
const CHUNK = 200 // ids per UPDATE ... WHERE id IN (…)

type Row = { id: number; slug: string; title: string; genres: string[] }

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

async function loadBooks(sb: ReturnType<typeof adminClient>): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, genres')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

async function main() {
  const apply = isApply()
  const verbose = hasFlag('verbose')
  const sb = adminClient()

  const books = await loadBooks(sb)
  const changes = books
    .map((b) => ({ row: b, next: resolveGenres(b.genres ?? []) }))
    .filter((c) => !same(c.row.genres ?? [], c.next))

  console.log(`\n── _fix_genre_vocabulary (${apply ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`  books scanned:  ${books.length}`)
  console.log(`  rows to change: ${changes.length}`)

  // Refuse to write a slug the map does not know — a typo in genre-folds.ts must
  // not become 462 bad rows.
  const invalid = [...new Set(changes.flatMap((c) => c.next))].filter((g) => !isMappedGenre(g))
  if (invalid.length) throw new Error(`genre-folds.ts would write off-vocabulary slug(s): ${invalid.join(', ')}`)

  if (changes.length === 0) {
    console.log('  ✓ nothing to do — every row already resolves to itself.')
    return
  }

  // Group by target value so one statement covers every row heading to the same
  // array, and so the dry-run reads as a decision list rather than 462 lines.
  const byTarget = new Map<string, typeof changes>()
  for (const c of changes) {
    const k = JSON.stringify(c.next)
    byTarget.set(k, [...(byTarget.get(k) ?? []), c])
  }
  const groups = [...byTarget.entries()].sort((a, b) => b[1].length - a[1].length)

  console.log(`  distinct target values: ${groups.length}\n`)
  const emptied = changes.filter((c) => c.next.length === 0)
  const cap = verbose ? 40 : 3
  for (const [target, cs] of groups) {
    console.log(`  → ${target}  (${cs.length} row${cs.length === 1 ? '' : 's'})`)
    for (const c of cs.slice(0, cap)) {
      console.log(`       #${c.row.id} ${c.row.title.slice(0, 56)}  was ${JSON.stringify(c.row.genres)}`)
    }
    if (cs.length > cap) console.log(`       … +${cs.length - cap} more`)
  }
  console.log(`\n  rows going back to genres = '{}' (→ enrich-genres pool): ${emptied.length}`)

  if (!apply) {
    console.log('\nDRY-RUN — no writes. Re-run with --apply.')
    return
  }

  let written = 0
  let statements = 0
  for (const [target, cs] of groups) {
    const next = JSON.parse(target) as string[]
    for (let i = 0; i < cs.length; i += CHUNK) {
      const ids = cs.slice(i, i + CHUNK).map((c) => c.row.id)
      const { error } = await sb.from('books').update({ genres: next }).in('id', ids)
      if (error) throw new Error(`update ${target} (${ids.length} ids): ${error.message}`)
      written += ids.length
      statements++
    }
  }
  console.log(`\n  ✓ wrote ${written} rows in ${statements} statement(s).`)

  // Read back from the DB rather than trusting the write.
  const after = await loadBooks(sb)
  const afterById = new Map(after.map((b) => [b.id, b]))
  const mismatch = changes.filter((c) => !same(afterById.get(c.row.id)?.genres ?? [], c.next))
  const strayLeft = after.flatMap((b) => (b.genres ?? []).filter((g) => !isMappedGenre(g)))
  const overLeft = after.filter((b) => (b.genres ?? []).length > 3)

  console.log('\nVERIFY (re-read from DB):')
  console.log(`  rows not matching their target: ${mismatch.length}`)
  for (const m of mismatch.slice(0, 10)) console.log(`     #${m.row.id} expected ${JSON.stringify(m.next)} got ${JSON.stringify(afterById.get(m.row.id)?.genres)}`)
  console.log(`  off-vocabulary occurrences left: ${strayLeft.length}`)
  console.log(`  rows over the 3-slug cap left:   ${overLeft.length}`)
  if (mismatch.length || strayLeft.length || overLeft.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
