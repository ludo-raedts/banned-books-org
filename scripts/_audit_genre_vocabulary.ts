/**
 * _audit_genre_vocabulary.ts — READ-ONLY audit of `books.genres` against the
 * canonical vocabulary, catalogue-wide.
 *
 * Two problems, one detector:
 *
 *  1. VOCABULARY DRIFT. The canonical vocabulary is the GENRES map in
 *     src/components/genre-badge.tsx (gate with isMappedGenre()). Slugs outside
 *     it render as the grey fallback badge, are dropped from the /discover genre
 *     wizard, and are missed by every query that spells slugs out. This lists
 *     every stray slug with its count, a sample, and what
 *     scripts/lib/genre-folds.ts would turn it into. Also flags rows carrying
 *     more than the 3 slugs the vocabulary allows.
 *
 *  2. `literary-fiction` AS A DE-FACTO DEFAULT. It is not a classification when
 *     it sits on half the catalogue. Reports the solo-['literary-fiction']
 *     population and how much of it is gradeable today (has a description_book),
 *     plus the guessGenres() fingerprint that proves where it came from — see
 *     the header of _audit_literary_fiction_default.ts for that analysis.
 *
 * Writes NOTHING. Pair with:
 *   scripts/_fix_genre_vocabulary.ts        (applies the fold table)
 *   scripts/_audit_graphic_novel_mistags.ts (the highest-yield literary-fiction sub-case)
 *
 * The off-vocabulary count is also a hard INVARIANT in scripts/audit-integrity.ts,
 * so drift cannot come back silently after this sweep.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_genre_vocabulary.ts
 *   npx tsx --env-file=.env.local scripts/_audit_genre_vocabulary.ts --verbose
 */
import { adminClient } from '../src/lib/supabase'
import { isMappedGenre } from '../src/components/genre-badge'
import { hasFlag } from './lib/cli'
import { DROP, FOLD, CONTEXTUAL_FOLD, isHandledStray, resolveGenres } from './lib/genre-folds'

const PAGE = 1000
const VERBOSE = hasFlag('verbose')
const SAMPLES = VERBOSE ? 40 : 6

type Row = {
  id: number
  slug: string
  title: string
  genres: string[]
  description_book: string | null
  is_blanket_works: boolean
}

async function loadBooks(): Promise<Row[]> {
  const sb = adminClient()
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    // .order() is mandatory — without it .range() duplicates rows past PAGE.
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, genres, description_book, is_blanket_works')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

function main() {
  return loadBooks().then((books) => {
    const withGenres = books.filter((b) => (b.genres ?? []).length > 0)
    const empty = books.length - withGenres.length

    console.log('\n══ genre-vocabulary audit (read-only) ══')
    console.log(`  books:                 ${books.length}`)
    console.log(`  with >=1 genre slug:   ${withGenres.length}`)
    console.log(`  genres = '{}' (pool):  ${empty}`)

    // ── 1. vocabulary drift ───────────────────────────────────────────────
    const counts = new Map<string, Row[]>()
    for (const b of books) {
      for (const g of b.genres ?? []) {
        const arr = counts.get(g) ?? []
        arr.push(b)
        counts.set(g, arr)
      }
    }
    const strays = [...counts.entries()]
      .filter(([slug]) => !isMappedGenre(slug))
      .sort((a, b) => b[1].length - a[1].length)

    const strayRows = new Set(strays.flatMap(([, rs]) => rs.map((r) => r.id)))
    const strayOccurrences = strays.reduce((n, [, rs]) => n + rs.length, 0)

    console.log(`\n── 1. OFF-VOCABULARY SLUGS ──`)
    console.log(`  distinct slugs in DB:  ${counts.size}`)
    console.log(`  off-vocabulary slugs:  ${strays.length}`)
    console.log(`  stray occurrences:     ${strayOccurrences} on ${strayRows.size} books`)
    if (strays.length === 0) console.log('  ✓ clean — every slug is in the canonical map.')

    for (const [slug, rows] of strays) {
      let verdict: string
      if (slug in DROP) verdict = `DROP — ${DROP[slug]}`
      else if (slug in FOLD) verdict = `FOLD → ${FOLD[slug]}`
      else if (slug in CONTEXTUAL_FOLD)
        verdict = `FOLD → ${CONTEXTUAL_FOLD[slug].fiction} (fiction) / ${CONTEXTUAL_FOLD[slug].nonFiction} (non-fiction)`
      else verdict = '⚠ UNHANDLED — decide: add to the map, or add to genre-folds.ts'
      console.log(`\n  ${slug}  (${rows.length})  ${verdict}`)
      for (const r of rows.slice(0, SAMPLES)) {
        console.log(`      #${r.id} ${r.title.slice(0, 62)} ${JSON.stringify(r.genres)} → ${JSON.stringify(resolveGenres(r.genres))}`)
      }
      if (rows.length > SAMPLES) console.log(`      … +${rows.length - SAMPLES} more`)
    }

    const unhandled = strays.filter(([slug]) => !isHandledStray(slug))
    if (unhandled.length) {
      console.log(`\n  ⚠ ${unhandled.length} stray slug(s) have no entry in genre-folds.ts: ${unhandled.map(([s]) => s).join(', ')}`)
    }

    // rows that would end up empty → back into the enrichment candidate pool
    const wouldEmpty = books.filter((b) => (b.genres ?? []).length > 0 && resolveGenres(b.genres).length === 0)
    if (wouldEmpty.length) {
      console.log(`\n  rows the fold leaves with NO slug (→ back into the enrich-genres pool): ${wouldEmpty.length}`)
      for (const r of wouldEmpty.slice(0, SAMPLES)) console.log(`      #${r.id} ${r.title.slice(0, 62)} ${JSON.stringify(r.genres)}`)
      if (wouldEmpty.length > SAMPLES) console.log(`      … +${wouldEmpty.length - SAMPLES} more`)
    }

    // ── 2. more than 3 slugs (vocabulary says 1–3) ─────────────────────────
    const over = books.filter((b) => (b.genres ?? []).length > 3)
    console.log(`\n── 2. ROWS OVER THE 3-SLUG CAP ──`)
    console.log(`  count: ${over.length}`)
    for (const r of over.slice(0, SAMPLES)) console.log(`      #${r.id} ${r.title.slice(0, 52)} ${JSON.stringify(r.genres)} → ${JSON.stringify(resolveGenres(r.genres))}`)
    if (over.length > SAMPLES) console.log(`      … +${over.length - SAMPLES} more`)

    // ── 3. in-vocabulary slugs used on the wrong KIND of book ─────────────
    // These slugs are all in the map, so they are not "drift" — they are
    // misclassification. Only the political one is mechanically repairable.
    const has = (b: Row, g: string) => (b.genres ?? []).includes(g)
    const pfRepair = books.filter((b) => has(b, 'non-fiction') && has(b, 'political-fiction'))
    const hfResidue = books.filter((b) => has(b, 'non-fiction') && has(b, 'historical-fiction'))
    const otherResidue = books.filter(
      (b) =>
        has(b, 'non-fiction') &&
        ['literary-fiction', 'fantasy', 'dystopian', 'science-fiction', 'romance', 'magical-realism', 'horror'].some((g) => has(b, g)),
    )

    console.log(`\n── 3. IN-VOCABULARY SLUGS ON THE WRONG KIND OF BOOK ──`)
    console.log(`  non-fiction + political-fiction: ${pfRepair.length}  REPAIRED → political-non-fiction`)
    for (const r of pfRepair.slice(0, SAMPLES)) console.log(`      #${r.id} ${r.title.slice(0, 56)} ${JSON.stringify(r.genres)} → ${JSON.stringify(resolveGenres(r.genres))}`)
    if (pfRepair.length > SAMPLES) console.log(`      … +${pfRepair.length - SAMPLES} more`)
    console.log(`\n  RESIDUE — not repaired, which slug is wrong varies per row:`)
    console.log(`    non-fiction + historical-fiction:   ${hfResidue.length}  (#147 Tombstone wants non-fiction; #1653 Black Beauty wants historical-fiction)`)
    console.log(`    non-fiction + another fiction slug: ${otherResidue.length}  (many are non-book media — see project scope note)`)
    for (const r of hfResidue.slice(0, SAMPLES)) console.log(`      #${r.id} ${r.title.slice(0, 56)} ${JSON.stringify(r.genres)}`)

    // ── 4. literary-fiction as a de-facto default ─────────────────────────
    const lf = books.filter((b) => (b.genres ?? []).includes('literary-fiction'))
    const solo = lf.filter((b) => b.genres.length === 1)
    const soloGradeable = solo.filter((b) => (b.description_book ?? '').trim().length > 0)
    const pct = (n: number, of: number) => `${((100 * n) / Math.max(1, of)).toFixed(1)}%`

    console.log(`\n── 4. literary-fiction CONCENTRATION ──`)
    console.log(`  carries literary-fiction:        ${lf.length}  (${pct(lf.length, withGenres.length)} of classified books)`)
    console.log(`  EXACTLY ['literary-fiction']:    ${solo.length}  (${pct(solo.length, withGenres.length)})`)
    console.log(`    … with a description_book:     ${soloGradeable.length}  ← re-gradeable today`)
    console.log(`    … without:                     ${solo.length - soloGradeable.length}  ← need a description first`)
    if (solo.length > withGenres.length * 0.1) {
      console.log(`  ⚠ a single slug on ${pct(solo.length, withGenres.length)} of classified books is a default, not a classification.`)
      console.log(`    Root cause + requeue worklist: scripts/_audit_literary_fiction_default.ts`)
    }

    // ── summary ───────────────────────────────────────────────────────────
    console.log(`\n══ summary ══`)
    const changed = books.filter((b) => {
      const next = resolveGenres(b.genres ?? [])
      const cur = b.genres ?? []
      return next.length !== cur.length || next.some((g, i) => g !== cur[i])
    })
    console.log(`  off-vocabulary occurrences: ${strayOccurrences}  (target 0)`)
    console.log(`  rows over the 3-slug cap:   ${over.length}  (target 0)`)
    console.log(`  rows the fold would change: ${changed.length}`)
    console.log(`  solo literary-fiction:      ${solo.length}`)
    console.log('\nRead-only. Apply the fold with scripts/_fix_genre_vocabulary.ts --apply.')
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
