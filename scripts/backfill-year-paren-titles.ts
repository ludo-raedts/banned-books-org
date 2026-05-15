#!/usr/bin/env tsx
/**
 * Phase 0c backfill: for books whose title still ends in "(YYYY)" (legacy
 * imports from the Wikipedia master aggregator before the parser splitter
 * landed), strip the year from the title and — if first_published_year is
 * currently NULL — set it to the extracted year. Slugs are left untouched
 * to preserve existing URLs; Phase 3 aliases handle URL flexibility.
 *
 * Skip rules:
 *   - The stripped title would collide with another existing book's title
 *     (ilike-equality, excluding self). In that case we'd be creating two
 *     identically-titled books in the public UI, which is worse than the
 *     "(YYYY)" disambiguation. Editor merges these manually.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-year-paren-titles.ts        # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-year-paren-titles.ts --apply
 */
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const TRAILING_YEAR_PAREN = /\s*\((1[5-9]\d{2}|20\d{2}|2100)\)\s*$/

async function main() {
  const sb = adminClient()
  console.log(`\n── backfill-year-paren-titles (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const { data: all, error } = await sb
    .from('books')
    .select('id, title, first_published_year')
  if (error) throw error
  const candidates = (all ?? []).filter(b =>
    TRAILING_YEAR_PAREN.test(b.title as string),
  )

  let updated = 0
  let skippedCollision = 0
  let skippedNoChange = 0
  for (const c of candidates) {
    const oldTitle = c.title as string
    const m = oldTitle.match(TRAILING_YEAR_PAREN)
    if (!m) continue
    const year = parseInt(m[1], 10)
    const newTitle = oldTitle.replace(TRAILING_YEAR_PAREN, '').trim()
    if (newTitle === oldTitle) { skippedNoChange++; continue }

    // Collision check
    const { data: collisions } = await sb
      .from('books')
      .select('id')
      .ilike('title', newTitle)
      .neq('id', c.id)
    if (collisions && collisions.length > 0) {
      console.log(`  [${c.id}] SKIP (collides with id=${collisions[0].id}): '${oldTitle}'`)
      skippedCollision++
      continue
    }

    const fpyAction =
      c.first_published_year === null
        ? `+ first_published_year=${year}`
        : `(keep first_published_year=${c.first_published_year})`
    console.log(`  [${c.id}] '${oldTitle}' → '${newTitle}' ${fpyAction}`)

    if (APPLY) {
      const update: { title: string; first_published_year?: number } = { title: newTitle }
      if (c.first_published_year === null) update.first_published_year = year
      const { error: upErr } = await sb.from('books').update(update).eq('id', c.id)
      if (upErr) {
        console.error(`    ✗ ${upErr.message}`)
        continue
      }
      updated++
    }
  }

  console.log()
  console.log(`Candidates:        ${candidates.length}`)
  console.log(`Skipped collision: ${skippedCollision}`)
  console.log(`Skipped no-change: ${skippedNoChange}`)
  console.log(`${APPLY ? `Updated:           ${updated}` : 'Pass --apply to write.'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
