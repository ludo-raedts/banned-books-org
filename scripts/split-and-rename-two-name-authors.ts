/**
 * Cleanup van de TWO_FULL_NAMES audit-categorie uit
 * `data/misc-comma-authors-review.md`. Twee subtypes:
 *
 *   A. Sorted-name met multi-word lastname — één persoon, RENAME.
 *      "Bidart Campos, Germán J." → "Germán J. Bidart Campos"
 *
 *   B. Twee echte namen ingestapeld — SPLIT.
 *      "Suroosh Alvi, Gavin Mclnnes" → 2 losse author rijen
 *
 * Voor splits: hergebruikt het patroon uit
 * `scripts/split-ampersand-smush-authors.ts` — controleer of de
 * onderdelen al als author bestaan (slug-match), maak ontbrekende aan,
 * relink book_authors, verwijder de smushed rij.
 *
 * Skip: id=7335 `Han Meng, Pan Sun` — Chinese namen, vereist bron-check.
 *
 *   pnpm tsx --env-file=.env.local scripts/split-and-rename-two-name-authors.ts
 *   pnpm tsx --env-file=.env.local scripts/split-and-rename-two-name-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

// ── Renames (sorted-name met multi-word lastname) ──────────────────────────

type Rename = {
  id: number
  newDisplayName: string
  clearBio?: true  // gebruik als de huidige bio over een andere persoon gaat
  clearDeathYear?: true
}

const RENAMES: Rename[] = [
  // id=3695 huidige bio gaat over Robert Seldon Duncanson (American
  // landscapist, d.1872) — niet over Joseph D. Ketner II (kunsthistoricus
  // die boek over Warhol schreef). Wis bio en death_year.
  { id: 3695, newDisplayName: 'Joseph D. Ketner II', clearBio: true, clearDeathYear: true },
  { id: 9133, newDisplayName: 'Germán J. Bidart Campos' },
  { id: 9284, newDisplayName: 'María Angélica Gallardo Klarc' },
]

// ── Splits (twee echte namen) ──────────────────────────────────────────────

type Split = {
  id: number
  parts: [string, string]
}

const SPLITS: Split[] = [
  // 2 organisaties — vallen later onder non-person cleanup
  { id: 7459, parts: ['Central Film Bureau', 'Shanghai Film Producers'] },
  // 2 VICE founders
  { id: 8395, parts: ['Suroosh Alvi', 'Gavin Mclnnes'] },
  // 2 Maleisische auteurs
  { id: 8512, parts: ['Al-Mustaqeem Mahmod Radhi', 'Khairul Anam Che Mentri'] },
]

async function main() {
  const sb = adminClient()
  console.log(`── split-and-rename-two-name-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // ── Renames ───────────────────────────────────────────────────────────
  console.log(`── Renames (${RENAMES.length}) ──\n`)
  for (const r of RENAMES) {
    const { data: row, error } = await sb.from('authors')
      .select('id, display_name, slug, bio, death_year')
      .eq('id', r.id)
      .maybeSingle()
    if (error || !row) {
      console.log(`  ! id=${r.id} not found`)
      continue
    }
    console.log(`  id=${r.id} slug=${row.slug}`)
    console.log(`    FROM: ${row.display_name}`)
    console.log(`    →     ${r.newDisplayName}`)
    if (r.clearBio && row.bio) console.log(`    also clear bio (${row.bio.length}c, currently about a different person)`)
    if (r.clearDeathYear && row.death_year) console.log(`    also clear death_year=${row.death_year}`)
    if (APPLY) {
      const update: Record<string, unknown> = { display_name: r.newDisplayName }
      if (r.clearBio) update.bio = null
      if (r.clearDeathYear) update.death_year = null
      const { error: ue } = await sb.from('authors').update(update).eq('id', r.id)
      if (ue) console.error(`    ! ${ue.message}`)
      else console.log(`    ✓ updated`)
    }
    console.log('')
  }

  // ── Splits ────────────────────────────────────────────────────────────
  console.log(`── Splits (${SPLITS.length}) ──\n`)
  for (const sp of SPLITS) {
    // Fetch smushed author
    const { data: row } = await sb.from('authors')
      .select('id, display_name, slug')
      .eq('id', sp.id)
      .maybeSingle()
    if (!row) {
      console.log(`  ! id=${sp.id} not found`)
      continue
    }
    console.log(`  id=${sp.id} slug=${row.slug}`)
    console.log(`    FROM: ${row.display_name}`)
    console.log(`    →     ${sp.parts.map(p => `"${p}"`).join(' + ')}`)

    // Fetch boeken gelinkt aan deze smushed author
    const { data: bookLinks } = await sb.from('book_authors')
      .select('book_id, role')
      .eq('author_id', sp.id)
    const links = (bookLinks ?? []) as Array<{ book_id: number; role: string | null }>
    console.log(`    boeken: ${links.length}`)

    // Per partee: zoek bestaande author, anders create
    const partAuthorIds: number[] = []
    for (const part of sp.parts) {
      const partSlug = slugify(part)
      const { data: existing } = await sb.from('authors')
        .select('id, display_name')
        .eq('slug', partSlug)
        .maybeSingle()
      if (existing) {
        console.log(`      \`${part}\` ✓ exists id=${existing.id}`)
        partAuthorIds.push(existing.id)
      } else {
        console.log(`      \`${part}\` ✗ → create (slug=${partSlug})`)
        if (APPLY) {
          const { data: created, error: ce } = await sb.from('authors')
            .insert({ display_name: part, slug: partSlug, is_placeholder: false })
            .select('id')
            .single()
          if (ce || !created) { console.error(`        ! create: ${ce?.message}`); continue }
          partAuthorIds.push(created.id)
          console.log(`        ✓ created id=${created.id}`)
        } else {
          partAuthorIds.push(-1)  // placeholder voor dry-run
        }
      }
    }

    if (!APPLY) {
      console.log('')
      continue
    }

    // Per boek: link nieuwe authors, dan unlink oude
    for (const link of links) {
      for (const newAuthorId of partAuthorIds) {
        // Check of book_authors al bestaat (om PK clash te vermijden)
        const { count } = await sb.from('book_authors')
          .select('book_id', { count: 'exact', head: true })
          .eq('book_id', link.book_id)
          .eq('author_id', newAuthorId)
        if ((count ?? 0) > 0) continue
        const { error: ie } = await sb.from('book_authors')
          .insert({ book_id: link.book_id, author_id: newAuthorId, role: link.role ?? 'author' })
        if (ie) console.error(`      ! link book=${link.book_id} author=${newAuthorId}: ${ie.message}`)
      }
    }
    // Unlink en delete de smushed author
    const { error: dle } = await sb.from('book_authors').delete().eq('author_id', sp.id)
    if (dle) { console.error(`    ! delete book_authors: ${dle.message}`); continue }
    const { error: dae } = await sb.from('authors').delete().eq('id', sp.id)
    if (dae) { console.error(`    ! delete author: ${dae.message}`); continue }
    console.log(`    ✓ split, smushed row id=${sp.id} deleted`)
    console.log('')
  }

  if (!APPLY) console.log(`── Dry-run. Re-run with --apply. ──`)
}

main().catch(err => { console.error(err); process.exit(1) })
