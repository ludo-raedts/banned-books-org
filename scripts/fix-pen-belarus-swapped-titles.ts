/**
 * Repair two books where the PEN-Belarus scraper put the publisher name
 * (extracted from the parenthesised "(City: Publisher, year)" tail) into
 * the title field, and shoved the real title onto the authors list.
 *
 *   id=13413  "Januškievič"  → rename to "Murder on Makajonka Street"
 *                              (author Klok Štučny, BY 2025; no clean dupe)
 *   id=13434  "Gutenberg"    → MERGE into id=13564 "Red Crosses"
 *                              (author Sasha Filipenko, BY 2025; the
 *                              "harmful-list" version of the same book
 *                              already exists; this record's extremist-list
 *                              ban moves over so both ban events end up on
 *                              the canonical book row)
 *
 * Note: PEN-Belarus source entry 92 had title="Gutenberg" + author="The
 * Elephant (Kraków" too — the same Sasha Filipenko / Sasha Filipenko slug
 * collision deduped it onto 13434. The "The Elephant" clean record (13563)
 * therefore doesn't pick up an extremist-list ban from this repair. If the
 * upstream scraper is fixed and re-imported that ban will be created then.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-pen-belarus-swapped-titles.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-pen-belarus-swapped-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

async function main() {
  const sb = adminClient()
  console.log(`── fix-pen-belarus-swapped-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // ── 13413 → rename to "Murder on Makajonka Street" ──────────────────────
  const NEW_TITLE_13413 = 'Murder on Makajonka Street'
  const NEW_SLUG_13413 = slugify(NEW_TITLE_13413)
  const { data: collide } = await sb.from('books').select('id, title').eq('slug', NEW_SLUG_13413).maybeSingle()
  if (collide && collide.id !== 13413) {
    console.log(`! slug "${NEW_SLUG_13413}" already used by book ${collide.id} "${collide.title}" — needs merge instead of rename`)
    process.exit(1)
  }
  console.log(`  RENAME id=13413  "Januškievič" → "${NEW_TITLE_13413}" (slug "${NEW_SLUG_13413}")`)

  // ── 13434 → merge into 13564 ────────────────────────────────────────────
  console.log(`  MERGE  id=13434  "Gutenberg" → into id=13564 "Red Crosses" (move ban + delete book)`)

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // Apply rename
  {
    const { error } = await sb.from('books')
      .update({ title: NEW_TITLE_13413, slug: NEW_SLUG_13413 })
      .eq('id', 13413)
    if (error) { console.error(`  ! rename: ${error.message}`); process.exit(1) }
    console.log(`  ✓ renamed 13413 → "${NEW_TITLE_13413}"`)
  }

  // Apply merge: 13434 and 13564 each have a 2025 BY ban with the same scope_id —
  // the bans_unique_per_scope constraint blocks moving 27046 to sit alongside 27200,
  // so combine the two descriptions on 27200 and drop 27046 before deleting book 13434.
  {
    const { data: srcBan } = await sb.from('bans').select('description').eq('id', 27046).single()
    const { data: dstBan } = await sb.from('bans').select('description').eq('id', 27200).single()
    const combined = [dstBan?.description ?? '', srcBan?.description ?? ''].filter(Boolean).join(' Also: ')
    const { error: ue } = await sb.from('bans').update({ description: combined }).eq('id', 27200)
    if (ue) { console.error(`  ! combine descriptions: ${ue.message}`); process.exit(1) }
    console.log(`  ✓ combined ban description onto 27200`)
    const { error: de } = await sb.from('bans').delete().eq('id', 27046)
    if (de) { console.error(`  ! delete ban 27046: ${de.message}`); process.exit(1) }
    console.log(`  ✓ deleted ban 27046`)
    // Drop the now-empty book row (book_authors and any remaining FKs cascade)
    const { error: del } = await sb.from('books').delete().eq('id', 13434)
    if (del) { console.error(`  ! delete book 13434: ${del.message}`); process.exit(1) }
    console.log(`  ✓ deleted book 13434`)
  }
  console.log(`\n  Done.`)
}

main().catch(err => { console.error(err); process.exit(1) })
