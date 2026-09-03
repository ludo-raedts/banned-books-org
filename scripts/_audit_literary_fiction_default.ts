/**
 * _audit_literary_fiction_default.ts — READ-ONLY. Why `literary-fiction` sits on
 * 40% of the catalogue, and which rows to re-grade.
 *
 * ROOT CAUSE (established 2026-09-03, reproduced below on live data).
 * scripts/import-pen.ts carried a `guessGenres(title, author)` title-regex ladder
 * that ended in an unconditional `return ['literary-fiction']`. Every PEN title
 * matching none of its patterns was stamped literary-fiction at import time.
 * Measured: 91.9% of PEN-sourced books carried EXACTLY what that ladder emits,
 * 6,469 of them via the fall-through. The ladder has been deleted (import-pen.ts
 * now writes `genres: []`), but the stamps it left are still in the DB.
 *
 * WHY THE STAMP IS WORSE THAN AN EMPTY VALUE. enrich-genres-gpt.ts targets
 * `genres = '{}'`. A non-empty stamp therefore excluded the row from the real
 * classifier permanently — the enrichment sweep has never seen these books. That
 * is the actual defect: an importer's regex output masquerading as a
 * classification, and blocking the thing that would have done it properly.
 *
 * The prompt is NOT the culprit. scripts/enrich-genres-gpt.ts already had an
 * explicit grounding rule ("an empty array IS the correct, expected answer") and
 * a two-model guard for rows without a description. It has since been hardened
 * further — an explicit "never use literary-fiction as a catch-all" rule, a
 * "form beats subject" rule for comics/verse, and the four vocabulary slugs it
 * was missing (poetry, drama, picture-book, middle-grade-fiction) — because a
 * poetry collection or a play had no honest slot and fell into literary-fiction.
 * This script re-runs the fingerprint so the claim stays checkable.
 *
 * This script writes NOTHING to the DB. With --write-worklist it writes
 * data/genre-requeue-ids.txt, which feeds the re-grade:
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --ids-file=data/genre-requeue-ids.txt
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --ids-file=data/genre-requeue-ids.txt --apply
 * (--ids-file implies --overwrite, and a row the model cannot place keeps its
 * current value rather than being blanked.)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_literary_fiction_default.ts
 *   npx tsx --env-file=.env.local scripts/_audit_literary_fiction_default.ts --write-worklist
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { hasFlag } from './lib/cli'

const PAGE = 1000
const WORKLIST = resolve(__dirname, '../data/genre-requeue-ids.txt')

/**
 * Verbatim copy of the guessGenres() ladder deleted from scripts/import-pen.ts on
 * 2026-09-03. Kept HERE, in a read-only audit, so the root-cause claim can be
 * re-verified against live data. Do not call this from anything that writes.
 */
function guessGenresLegacy(title: string, author: string): string[] {
  const t = title.toLowerCase()
  const a = author.toLowerCase()
  if (/memoir|diary|autobiography|my life|i am|boy|girl who/.test(t)) return ['memoir']
  if (/graphic novel|illustrated/.test(t)) return ['graphic-novel']
  if (/queer|transgender|gay|lesbian|bisexual|pride|lgbtq/.test(t)) return ['young-adult']
  if (/dragon|throne|court|kingdom|realm|crown|magic|fae|blood and/.test(t)) return ['fantasy']
  if (/dystopia|hunger|divergent|maze/.test(t)) return ['dystopian', 'young-adult']
  if (/murder|kill|dark|horror|dead|blood/.test(t)) return ['thriller']
  if (/history|war|slavery|civil rights|jim crow/.test(t)) return ['historical-fiction']
  if (/poems?|poetry|verse/.test(t)) return ['literary-fiction']
  if (/green|anderson|blume|hinton|crutcher|paulsen|lowry|pilkey|dahl|alexie/.test(a)) return ['young-adult']
  return ['literary-fiction']
}

type Row = {
  id: number
  slug: string
  title: string
  genres: string[]
  description_book: string | null
  book_authors: { authors: { display_name: string } | null }[]
}

async function pageAll<T>(run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

async function main() {
  const sb = adminClient()
  const write = hasFlag('write-worklist')

  const books = await pageAll<Row>((f, t) =>
    sb.from('books')
      .select('id, slug, title, genres, description_book, book_authors(authors(display_name))')
      .order('id').range(f, t) as never)

  // PEN-sourced books: ban_sources(source_url ~ pen.org) → ban_source_links → bans.book_id
  const penSources = await pageAll<{ id: number }>((f, t) =>
    sb.from('ban_sources').select('id').ilike('source_url', '%pen.org%').order('id').range(f, t) as never)
  const penSrcIds = penSources.map((s) => s.id)
  const links = await pageAll<{ ban_id: number }>((f, t) =>
    sb.from('ban_source_links').select('ban_id').in('source_id', penSrcIds).order('ban_id').range(f, t) as never)
  const penBanIds = new Set(links.map((l) => l.ban_id))
  const bans = await pageAll<{ id: number; book_id: number }>((f, t) =>
    sb.from('bans').select('id, book_id').order('id').range(f, t) as never)
  const penBookIds = new Set(bans.filter((b) => penBanIds.has(b.id)).map((b) => b.book_id))

  const authorOf = (b: Row) =>
    b.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', ') || 'unknown'
  const eq = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
  const pct = (n: number, of: number) => `${((100 * n) / Math.max(1, of)).toFixed(1)}%`

  // ── the fingerprint ────────────────────────────────────────────────────
  const pen = books.filter((b) => penBookIds.has(b.id))
  let exact = 0
  let viaFallThrough = 0
  let nonDefault = 0
  let nonDefaultExact = 0
  const tells: string[] = []
  for (const b of pen) {
    const guessed = guessGenresLegacy(b.title, authorOf(b))
    const isExact = eq(b.genres ?? [], guessed)
    if (isExact) exact++
    if (guessed.length === 1 && guessed[0] === 'literary-fiction') {
      if (isExact) viaFallThrough++
    } else {
      nonDefault++
      if (isExact) nonDefaultExact++
    }
  }
  // The branches that mislabel rather than merely under-label. These are the rows
  // where the ladder's output is a factual error on the page, not just vagueness.
  const MISLABEL_TELLS = new Set([1263, 423, 431, 411, 352, 324])
  for (const b of pen) {
    if (MISLABEL_TELLS.has(b.id)) tells.push(`    #${b.id} "${b.title.slice(0, 52)}" / ${authorOf(b).slice(0, 24)} → ${JSON.stringify(b.genres)}`)
  }

  console.log('\n══ literary-fiction root-cause audit (read-only) ══')
  console.log('\n── guessGenres() fingerprint over PEN-sourced books ──')
  console.log(`  PEN-sourced books:                        ${pen.length}`)
  console.log(`  genres EXACTLY == the deleted ladder:     ${exact}  (${pct(exact, pen.length)})`)
  console.log(`    … via the unconditional fall-through:   ${viaFallThrough}`)
  console.log(`  non-default regex branches:               ${nonDefault}, exact ${nonDefaultExact} (${pct(nonDefaultExact, nonDefault)})`)
  console.log('  A regex ladder reproducing the stored value on 9 in 10 rows — including')
  console.log('  its odd non-default branches — is a fingerprint no LLM would produce.')
  if (tells.length) {
    console.log('\n  branches that MISLABEL rather than under-label:')
    console.log(tells.join('\n'))
  }

  // ── the stamped population ─────────────────────────────────────────────
  const withGenres = books.filter((b) => (b.genres ?? []).length > 0)
  const solo = books.filter((b) => (b.genres ?? []).length === 1 && b.genres[0] === 'literary-fiction')
  const soloPen = solo.filter((b) => penBookIds.has(b.id))
  const gradeable = solo.filter((b) => (b.description_book ?? '').trim().length > 0)

  console.log('\n── the stamped population ──')
  console.log(`  classified books:                ${withGenres.length}`)
  console.log(`  EXACTLY ['literary-fiction']:    ${solo.length}  (${pct(solo.length, withGenres.length)})`)
  console.log(`    … PEN-sourced:                 ${soloPen.length}  (${pct(soloPen.length, solo.length)})`)
  console.log(`    … with a description_book:     ${gradeable.length}  ← re-gradeable now`)
  console.log(`    … without:                     ${solo.length - gradeable.length}  ← need a description first`)
  console.log('  These rows are invisible to enrich-genres-gpt.ts, which only targets')
  console.log("  `genres = '{}'` — the stamp is what blocks the classifier.")

  console.log('\n── requeue worklist ──')
  console.log(`  ${gradeable.length} book ids: solo literary-fiction WITH a description to ground the re-grade.`)
  console.log('  Rows without a description are left out on purpose: without grounding the')
  console.log('  classifier declines them anyway, and paying for that is waste. Fill their')
  console.log('  description_book first (enrich-descriptions-v2.ts), then re-run this.')
  if (write) {
    writeFileSync(WORKLIST, `${gradeable.map((b) => b.id).join('\n')}\n`, 'utf8')
    console.log(`\n  ✓ wrote ${gradeable.length} ids to data/genre-requeue-ids.txt`)
    console.log('    npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --ids-file=data/genre-requeue-ids.txt')
  } else {
    console.log('\n  (re-run with --write-worklist to emit data/genre-requeue-ids.txt)')
  }
  console.log('\nRead-only. The highest-yield slice of this population — comics and illustrated')
  console.log('adaptations — has its own detector: scripts/_audit_graphic_novel_mistags.ts')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
