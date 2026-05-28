/**
 * One-shot: strip metadata-staarten uit 10 boektitels (PAREN_EDITION,
 * EDITION_SUFFIX, PAREN_YEAR, BY_AUTHOR_TAIL uit
 * `data/metadata-in-titles-review.md`).
 *
 * Per case is de transformatie expliciet gedefinieerd — geen generieke
 * regex die per ongeluk legitieme metadata wegslaat (bv. een legitieme
 * "(Spanish Edition)" disambiguator als er ook een Engelse versie bestaat).
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-title-metadata-suffixes.ts
 *   pnpm tsx --env-file=.env.local scripts/fix-title-metadata-suffixes.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

type Fix = { id: number; expected: string; newTitle: string; reason: string }

const FIXES: Fix[] = [
  // ── PAREN_EDITION ────────────────────────────────────────────────────
  {
    id: 2731,
    expected: 'El Libro de la Familia/The Family Book (Spanish Edition)',
    newTitle: 'El Libro de la Familia/The Family Book',
    reason: 'titel toont al beide talen via slash; (Spanish Edition) is redundant',
  },

  // ── PAREN_YEAR ───────────────────────────────────────────────────────
  {
    id: 6350,
    expected: 'Howl (1955)',
    newTitle: 'Howl',
    reason: 'Ginsberg-gedicht; jaartal hoort in first_published_year, niet in title',
  },
  {
    id: 7427,
    expected: 'Përbindëshi (The Monster) (1965)',
    newTitle: 'Përbindëshi (The Monster)',
    reason: 'behoud Engelse vertaling-paren, strip alleen het jaartal',
  },
  {
    id: 13872,
    expected: 'Cuadernos Nacionales N° 1 (1974)',
    newTitle: 'Cuadernos Nacionales N° 1',
    reason: 'jaartal hoort in first_published_year',
  },

  // ── EDITION_SUFFIX ──────────────────────────────────────────────────
  {
    id: 10064,
    expected: 'The Encyclopedia of Unsolved Crimes, 2nd Edition',
    newTitle: 'The Encyclopedia of Unsolved Crimes',
    reason: 'editie-info hoort niet in title-string',
  },

  // ── BY_AUTHOR_TAIL ──────────────────────────────────────────────────
  {
    id: 1294,
    expected: 'Gossip Girl: A Novel by Cecily von Ziegesar',
    newTitle: 'Gossip Girl: A Novel',
    reason: 'auteur staat al in book_authors',
  },
]

// Skip-met-reden — deze laten we staan en documenteren waarom
const SKIPPED: Array<{ id: number; reason: string }> = [
  { id: 5290, reason: 'Heartstopper 1 (Spanish Edition) — (Spanish Edition) kan een legitieme disambiguator zijn als er ook een English Heartstopper 1 bestaat; bron-check nodig' },
  { id: 10394, reason: 'Passion of Fire Unknown (Vol.1) — (Vol.1) is een legitieme volume-marker' },
  { id: 2792, reason: 'Foundations in Personal Finance, 2022, 4th Edition — onduidelijk of we ", 2022, 4th Edition" of alleen ", 4th Edition" moeten strippen; per-case beslissing' },
  { id: 7337, reason: 'Pentagon Papers — "A Study Prepared by the Department of Defense" is de officiële canonieke titel waaronder het werk werd uitgegeven; NIET strippen' },
]

async function main() {
  const sb = adminClient()
  console.log(`── fix-title-metadata-suffixes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  console.log(`── Skipped (${SKIPPED.length}) ──`)
  for (const s of SKIPPED) console.log(`  id=${s.id} — ${s.reason}`)
  console.log('')

  console.log(`── Fixes (${FIXES.length}) ──\n`)
  for (const f of FIXES) {
    const { data: book } = await sb.from('books').select('id, slug, title').eq('id', f.id).maybeSingle()
    if (!book) {
      console.log(`  ! id=${f.id} not found — skip`)
      continue
    }
    if (book.title !== f.expected) {
      console.log(`  ! id=${f.id} title-mismatch — verwacht ${JSON.stringify(f.expected)}, kreeg ${JSON.stringify(book.title)} — skip`)
      continue
    }
    console.log(`  id=${book.id} · ${book.slug}`)
    console.log(`    FROM: ${book.title}`)
    console.log(`    →     ${f.newTitle}`)
    console.log(`    why:  ${f.reason}`)
    if (APPLY) {
      const { error: ue } = await sb.from('books').update({ title: f.newTitle }).eq('id', f.id)
      if (ue) { console.error(`    ! ${ue.message}`); continue }
      console.log(`    ✓ updated`)
    }
    console.log('')
  }

  if (!APPLY) console.log(`── Dry-run. Re-run with --apply. ──`)
}

main().catch(err => { console.error(err); process.exit(1) })
