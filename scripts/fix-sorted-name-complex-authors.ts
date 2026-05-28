/**
 * One-shot: per-case fix voor de 12 SORTED_NAME_COMPLEX author-rijen uit
 * `data/misc-comma-authors-review.md`. Elke transformatie is expliciet
 * gespecificeerd — geen generiek script omdat de cases divers zijn:
 * sommige zijn personen met multi-word lastname, sommige zijn organisaties
 * met locatie-suffix, één heeft een translator-marker, één heeft een
 * (rol)-suffix, en drie hebben verkeerd attached bios van een totaal
 * andere persoon.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-sorted-name-complex-authors.ts
 *   pnpm tsx --env-file=.env.local scripts/fix-sorted-name-complex-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

type Fix = {
  id: number
  expected: string
  newDisplayName: string
  reason: string
  clearBio?: true
  clearBirthYear?: true
  clearDeathYear?: true
}

const FIXES: Fix[] = [
  // ── Personen met multi-word lastname / suffix ────────────────────────
  {
    id: 9441,
    expected: 'Perón, María E. M. de',
    newDisplayName: 'Eva Perón',
    reason: 'María Eva Duarte de Perón — bekend als Eva Perón; canonieke korte vorm',
  },
  {
    id: 3182,
    expected: 'Jennifer Ann / Mann, J. Albert Mann',
    newDisplayName: 'J. Albert Mann',
    reason: '"Jennifer Ann /" is import-artefact; auteur van "The Degenerates" is J. Albert Mann',
    clearBio: true, // bio gaat over Tracy Mann, een andere persoon
  },
  {
    id: 8200,
    expected: 'Paul Tan Chee Ing, D.J.',
    newDisplayName: 'Paul Tan Chee Ing',
    reason: '"D.J." is geen deel van de naam; vrijwel zeker afkorting van rol/titel',
    clearBio: true,        // bio gaat over Lee Kuan Yew
    clearBirthYear: true,  // 1923 = LKY's birth year
    clearDeathYear: true,  // 2015 = LKY's death year
  },
  {
    id: 8349,
    expected: 'Arthur E.Cundall BA, BD',
    newDisplayName: 'Arthur E. Cundall',
    reason: 'BA en BD zijn academic degrees, geen deel van naam',
  },
  {
    id: 8447,
    expected: 'Penterjemah - Sudarmaji.,S.Pd@Gruphermes.Mlg',
    newDisplayName: 'Sudarmaji',
    reason: '"Penterjemah" (Maleis voor vertaler) + e-mail-adres zijn metadata, geen deel van naam',
  },
  {
    id: 9070,
    expected: 'Alvarez del Real, María E. (directora)',
    newDisplayName: 'María E. Álvarez del Real',
    reason: '"(directora)" is rol-marker; sorted naar normale volgorde',
  },
  {
    id: 9500,
    expected: 'Ruiz de los Llanos, Gabriel',
    newDisplayName: 'Gabriel Ruiz de los Llanos',
    reason: 'sorted naar normale volgorde',
    clearBio: true, // bio gaat over José María Queipo de Llano, een andere persoon
  },
  {
    id: 9555,
    expected: 'Collins y Meripe, Carole',
    newDisplayName: 'Carole Collins y Meripe',
    reason: 'sorted naar normale volgorde (Spaanse double surname met "y")',
  },

  // ── Organisaties met locatie- of adres-suffix ───────────────────────
  {
    id: 7268,
    expected: 'The General Political Department of the People Liberation Army,China',
    newDisplayName: "The General Political Department of the People's Liberation Army",
    reason: ',China is locatie-suffix; voegen toe People\'s apostrof',
  },
  {
    id: 7624,
    expected: 'Memorial Service Committee For Former Revolutionary Warriors,Singapore',
    newDisplayName: 'Memorial Service Committee For Former Revolutionary Warriors',
    reason: ',Singapore is locatie-suffix',
  },
  {
    id: 7648,
    expected: 'Harbin Railway Workers, Union',
    newDisplayName: "Harbin Railway Workers' Union",
    reason: 'komma was een import-artefact; voegen apostrof toe (Workers\' Union)',
  },
  {
    id: 8593,
    expected: 'Lantern Books A Division of Booklight Inc. Lantern Books A Division of 128 Second Place Brooklyn, NY 11231',
    newDisplayName: 'Lantern Books',
    reason: 'volledige naam is uitgever-adres-blob; canonical naam is gewoon "Lantern Books"',
  },
]

async function main() {
  const sb = adminClient()
  console.log(`── fix-sorted-name-complex-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)
  console.log(`${FIXES.length} fixes total.\n`)

  for (const f of FIXES) {
    const { data: row } = await sb.from('authors')
      .select('id, display_name, slug, bio, birth_year, death_year')
      .eq('id', f.id)
      .maybeSingle()
    if (!row) {
      console.log(`  ! id=${f.id} not found — skip`)
      continue
    }
    if (row.display_name !== f.expected) {
      console.log(`  ! id=${f.id} display-mismatch:`)
      console.log(`      verwacht: ${JSON.stringify(f.expected)}`)
      console.log(`      kreeg:    ${JSON.stringify(row.display_name)}`)
      console.log(`      skip`)
      continue
    }
    console.log(`  id=${f.id} slug=${row.slug}`)
    console.log(`    FROM: ${row.display_name}`)
    console.log(`    →     ${f.newDisplayName}`)
    if (f.clearBio && row.bio) console.log(`    also clear bio (${row.bio.length}c)`)
    if (f.clearBirthYear && row.birth_year) console.log(`    also clear birth_year=${row.birth_year}`)
    if (f.clearDeathYear && row.death_year) console.log(`    also clear death_year=${row.death_year}`)
    console.log(`    why:  ${f.reason}`)

    if (APPLY) {
      const update: Record<string, unknown> = { display_name: f.newDisplayName }
      if (f.clearBio) update.bio = null
      if (f.clearBirthYear) update.birth_year = null
      if (f.clearDeathYear) update.death_year = null
      const { error: ue } = await sb.from('authors').update(update).eq('id', f.id)
      if (ue) { console.error(`    ! ${ue.message}`); continue }
      console.log(`    ✓ updated`)
    }
    console.log('')
  }

  if (!APPLY) console.log(`── Dry-run. Re-run with --apply. ──`)
}

main().catch(err => { console.error(err); process.exit(1) })
