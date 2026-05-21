/**
 * Split the 7 "* X * Y" author records into proper individual authors.
 *
 * Source records are Wikipedia parser artefacts where a "*"-bulleted name list
 * was captured as a single author. Each is linked to exactly one book.
 *
 * For each source row:
 *   1. Resolve target authors (reuse existing where slug or display_name matches,
 *      otherwise mint a new placeholder author row with no bio/photo).
 *   2. Re-point book_authors from source → targets.
 *   3. Delete the source author row.
 *
 * Translator cases (Lo Duca / Sacher-Masoch books) keep only the primary author;
 * translators don't become authors per the project's data-integrity rule.
 *
 * Bios/photos on the source rows are Wikipedia-disambig junk and are discarded.
 * Newly minted authors will be picked up by enrich-author-bios.ts in a follow-up
 * step (it selects WHERE bio IS NULL).
 *
 * Usage:
 *   npx tsx scripts/split-asterisk-authors.ts            # dry-run
 *   npx tsx scripts/split-asterisk-authors.ts --apply    # write
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (process.env[key]) continue
    process.env[key] = trimmed.slice(eq + 1)
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')

type Plan = {
  sourceId: number
  bookId: number
  bookTitle: string
  targets: { name: string; slugHint: string }[]
}

const PLANS: Plan[] = [
  { sourceId: 4582, bookId: 6499, bookTitle: 'Candy',
    targets: [
      { name: 'Terry Southern',     slugHint: 'terry-southern' },
      { name: 'Mason Hoffenberg',   slugHint: 'mason-hoffenberg' },
    ] },
  { sourceId: 4591, bookId: 6508, bookTitle: 'Hello Sex',
    targets: [
      { name: 'Anders Jorgens',     slugHint: 'anders-jorgens' },
      { name: 'Gunilla Jorgens',    slugHint: 'gunilla-jorgens' },
    ] },
  { sourceId: 5562, bookId: 7258, bookTitle: 'XYZ Comics',
    targets: [
      { name: 'Rand Holmes',        slugHint: 'rand-holmes' },
      { name: 'Jim Jones',          slugHint: 'jim-jones' },
    ] },
  { sourceId: 5566, bookId: 7262, bookTitle: 'The Screw Reader',
    targets: [
      { name: 'Jim Buckley',        slugHint: 'jim-buckley' },
      { name: 'Al Goldstein',       slugHint: 'al-goldstein' },
    ] },
  // Translator case: keep only primary author
  { sourceId: 5584, bookId: 7279, bookTitle: 'A History of Eroticism',
    targets: [
      { name: 'Joseph-Marie Lo Duca', slugHint: 'joseph-marie-lo-duca' },
    ] },
  // Translator case: keep only primary author (already exists)
  { sourceId: 5602, bookId: 7296, bookTitle: 'Black Czarina',
    targets: [
      { name: 'Leopold von Sacher-Masoch', slugHint: 'leopold-von-sacher-masoch' },
    ] },
  { sourceId: 5611, bookId: 7304, bookTitle: 'Sex Marchers',
    targets: [
      { name: 'Jefferson Poland',   slugHint: 'jefferson-poland' },
      { name: 'Sam Sloan',          slugHint: 'sam-sloan' },
    ] },
]

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  console.log(`\n── split-asterisk-authors (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const newlyCreatedIds: number[] = []

  for (const plan of PLANS) {
    console.log(`\n→ source #${plan.sourceId} → book #${plan.bookId} "${plan.bookTitle}"`)

    // Verify source still exists and is linked
    const { data: src } = await sb
      .from('authors')
      .select('id, slug, display_name')
      .eq('id', plan.sourceId)
      .maybeSingle()
    if (!src) {
      console.log(`  source author #${plan.sourceId} not found — skipping`)
      continue
    }
    console.log(`  source display='${src.display_name}'`)

    // Resolve targets
    const targetIds: number[] = []
    for (const t of plan.targets) {
      // Existing-author lookup: prefer slug match, then exact display_name
      const { data: bySlug } = await sb
        .from('authors')
        .select('id, slug, display_name, bio, photo_url')
        .eq('slug', t.slugHint)
        .maybeSingle()
      let existing = bySlug
      if (!existing) {
        const { data: byName } = await sb
          .from('authors')
          .select('id, slug, display_name, bio, photo_url')
          .eq('display_name', t.name)
          .maybeSingle()
        existing = byName ?? null
      }

      if (existing) {
        console.log(`  target '${t.name}' → REUSE id=${existing.id} slug='${existing.slug}'`)
        targetIds.push(existing.id)
      } else {
        if (APPLY) {
          const { data: created, error: insertErr } = await sb
            .from('authors')
            .insert({
              slug: t.slugHint,
              display_name: t.name,
              is_placeholder: true,
            })
            .select('id, slug, display_name')
            .single()
          if (insertErr || !created) {
            console.error(`  ! failed to insert '${t.name}':`, insertErr?.message)
            continue
          }
          console.log(`  target '${t.name}' → CREATED id=${created.id} slug='${created.slug}'`)
          targetIds.push(created.id)
          newlyCreatedIds.push(created.id)
        } else {
          console.log(`  target '${t.name}' → WOULD CREATE slug='${t.slugHint}'`)
        }
      }
    }

    // Re-link book_authors: insert targets first, then delete the source link.
    // book_authors has composite PK (book_id, author_id) — duplicate inserts
    // would error, so use upsert with onConflict.
    if (APPLY) {
      for (const aid of targetIds) {
        const { error: linkErr } = await sb
          .from('book_authors')
          .upsert({ book_id: plan.bookId, author_id: aid, role: 'author' }, { onConflict: 'book_id,author_id' })
        if (linkErr) {
          console.error(`  ! failed to link author ${aid} to book ${plan.bookId}:`, linkErr.message)
        } else {
          console.log(`  linked book ${plan.bookId} ↔ author ${aid}`)
        }
      }
      // Delete the original (source) book_authors link
      const { error: delLinkErr } = await sb
        .from('book_authors')
        .delete()
        .eq('book_id', plan.bookId)
        .eq('author_id', plan.sourceId)
      if (delLinkErr) {
        console.error(`  ! failed to delete source link:`, delLinkErr.message)
      } else {
        console.log(`  unlinked book ${plan.bookId} ↔ source author ${plan.sourceId}`)
      }
      // Delete the source author row (it's now orphaned)
      const { error: delAuthorErr } = await sb
        .from('authors')
        .delete()
        .eq('id', plan.sourceId)
      if (delAuthorErr) {
        console.error(`  ! failed to delete source author:`, delAuthorErr.message)
      } else {
        console.log(`  deleted source author ${plan.sourceId}`)
      }
    } else {
      console.log(`  would re-link book #${plan.bookId} from source #${plan.sourceId} to [${targetIds.length || plan.targets.length} target(s)]`)
      console.log(`  would delete source author #${plan.sourceId}`)
    }
  }

  if (APPLY && newlyCreatedIds.length > 0) {
    console.log(`\nNewly created author IDs (need bio/photo enrichment): ${newlyCreatedIds.join(', ')}`)
  }
  console.log(`\n── done (${APPLY ? 'applied' : 'dry-run'}) ──\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
