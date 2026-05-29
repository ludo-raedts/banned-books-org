/**
 * One-shot merge: 5 author-paren waarbij één rij initialen gebruikt en een
 * andere rij dezelfde persoon met volledige voornaam — handmatig
 * goedgekeurd uit `scripts/_audit_initials_vs_fullname_authors.ts`
 * (run 2026-05-27, rapport in data/initials-vs-fullname-authors-review.md).
 *
 * Plan (drop → keep):
 *
 *   HIGH (score=115)
 *     8204 "H.A.Fuad Said"               → 8632 "H. Ahmad Fuad Said"
 *           identieke bio (Fuad I, Sultan of Egypt), b.1868/d.1936
 *     7299 "M Gorky"                     →  106 "Maxim Gorky"
 *           identieke bio (Alexei Peshkov), b.1868/d.1936
 *
 *   MEDIUM — handmatig bevestigd als zelfde persoon
 *     7586 "W Whitman"                   →  558 "Walt Whitman"
 *           initials-rij heeft geen bio (alias-rij uit import)
 *
 *   MEDIUM — Mitin OCR-typo-cluster (3 drops → 1 keep)
 *     7303 "Mart. B. Mitin"              → 7372 "Mark B. Mitin"
 *     7580 "Merk B. Mitin"               → 7372 "Mark B. Mitin"
 *     7568 "M.B. Mitin"                  → 7372 "Mark B. Mitin"
 *
 *   N.B. Vicki O. Wittenstein → Vicki Oransky Wittenstein stond ook op de
 *   goedgekeurde lijst maar de KEEP-rij (id=2425) bleek vóór deze run al
 *   verdwenen (vermoedelijk door een parallelle enrichment-merge); pair is
 *   uit het script gehaald om verificatie-abort te voorkomen.
 *
 * Safety:
 *   - Vóór elke mutatie: re-fetch keep + drop, abort als display_name niet
 *     overeenkomt met de verwachte string (bescherming tegen
 *     race / per-ongeluk-gerename na de audit-run).
 *   - book_authors merge volgens hetzelfde patroon als
 *     scripts/merge-credential-suffix-authors.ts (re-link, dan delete).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/merge-initials-vs-fullname-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-initials-vs-fullname-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

type Plan = {
  keep: { id: number; expectedName: string }
  drops: { id: number; expectedName: string }[]
  label: string
}

const PLANS: Plan[] = [
  {
    label: 'HIGH — Fuad I, Sultan of Egypt',
    keep: { id: 8632, expectedName: 'H. Ahmad Fuad Said' },
    drops: [{ id: 8204, expectedName: 'H.A.Fuad Said' }],
  },
  {
    label: 'HIGH — Maxim Gorky',
    keep: { id: 106, expectedName: 'Maxim Gorky' },
    drops: [{ id: 7299, expectedName: 'M Gorky' }],
  },
  {
    label: 'MEDIUM — Walt Whitman',
    keep: { id: 558, expectedName: 'Walt Whitman' },
    drops: [{ id: 7586, expectedName: 'W Whitman' }],
  },
  {
    label: 'MEDIUM — Mark B. Mitin (OCR-typo cluster)',
    keep: { id: 7372, expectedName: 'Mark B. Mitin' },
    drops: [
      { id: 7303, expectedName: 'Mart. B. Mitin' },
      { id: 7580, expectedName: 'Merk B. Mitin' },
      { id: 7568, expectedName: 'M.B. Mitin' },
    ],
  },
]

type Row = { id: number; display_name: string }

async function fetchRow(sb: ReturnType<typeof adminClient>, id: number): Promise<Row | null> {
  const { data, error } = await sb.from('authors').select('id, display_name').eq('id', id).maybeSingle()
  if (error) throw new Error(`fetch author ${id}: ${error.message}`)
  return data as Row | null
}

async function verifyPlan(sb: ReturnType<typeof adminClient>, p: Plan): Promise<string | null> {
  const keep = await fetchRow(sb, p.keep.id)
  if (!keep) return `keep id=${p.keep.id} not found`
  if (keep.display_name !== p.keep.expectedName) {
    return `keep id=${p.keep.id} name='${keep.display_name}' ≠ expected '${p.keep.expectedName}'`
  }
  for (const d of p.drops) {
    const row = await fetchRow(sb, d.id)
    if (!row) return `drop id=${d.id} not found (already merged?)`
    if (row.display_name !== d.expectedName) {
      return `drop id=${d.id} name='${row.display_name}' ≠ expected '${d.expectedName}'`
    }
  }
  return null
}

async function mergeOne(
  sb: ReturnType<typeof adminClient>,
  keepId: number,
  dropId: number,
): Promise<{ moved: number }> {
  const { data: dropLinks, error: le } = await sb.from('book_authors').select('book_id, role').eq('author_id', dropId)
  if (le) throw new Error(`fetch links for ${dropId}: ${le.message}`)
  const { data: keepLinks, error: ke } = await sb.from('book_authors').select('book_id').eq('author_id', keepId)
  if (ke) throw new Error(`fetch links for ${keepId}: ${ke.message}`)
  const keepSet = new Set((keepLinks ?? []).map(r => r.book_id))
  const toLink = (dropLinks ?? []).filter(l => !keepSet.has(l.book_id))
  if (toLink.length > 0) {
    const payload = toLink.map(l => ({ book_id: l.book_id, author_id: keepId, role: l.role ?? 'author' }))
    const { error: ie } = await sb.from('book_authors').insert(payload)
    if (ie) throw new Error(`insert links into ${keepId}: ${ie.message}`)
  }
  const { error: de } = await sb.from('book_authors').delete().eq('author_id', dropId)
  if (de) throw new Error(`delete links for ${dropId}: ${de.message}`)
  const { error: ae } = await sb.from('authors').delete().eq('id', dropId)
  if (ae) throw new Error(`delete author ${dropId}: ${ae.message}`)
  return { moved: toLink.length }
}

async function main() {
  const sb = adminClient()
  console.log(`── merge-initials-vs-fullname-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // 1. Verify every plan still matches expected display_names
  let verifyErrors = 0
  for (const p of PLANS) {
    const err = await verifyPlan(sb, p)
    if (err) {
      console.error(`  ! ${p.label}: ${err}`)
      verifyErrors++
    } else {
      console.log(`  ✓ ${p.label}`)
      console.log(`      KEEP id=${p.keep.id} "${p.keep.expectedName}"`)
      for (const d of p.drops) {
        console.log(`      DROP id=${d.id} "${d.expectedName}"`)
      }
    }
  }
  if (verifyErrors > 0) {
    console.error(`\n${verifyErrors} verification error(s) — aborting (geen mutaties uitgevoerd).`)
    process.exit(1)
  }
  console.log(`\nAll ${PLANS.length} plans verified.`)

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // 2. Execute
  let mergedAuthors = 0, movedLinks = 0, errors = 0
  for (const p of PLANS) {
    for (const drop of p.drops) {
      try {
        const { moved } = await mergeOne(sb, p.keep.id, drop.id)
        mergedAuthors++
        movedLinks += moved
        console.log(`  ✓ merged ${drop.id} → ${p.keep.id} (moved ${moved} link(s))`)
      } catch (err) {
        errors++
        console.error(`  ! ${drop.id} → ${p.keep.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  console.log(`\n  authors merged: ${mergedAuthors}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
