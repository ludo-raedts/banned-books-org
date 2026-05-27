/**
 * One-shot merge: 4 author-rijen die allemaal Mao Zedong betreffen.
 * Allemaal met identieke Mao-bio, maar verschillende Romanizations + één
 * rij met een bogus "excerpted from the works of …" prefix uit een oude
 * import. De variant-merger pakt ze niet omdat de token-sets verschillen
 * (Wade-Giles "Tse Tung" / "Tze Tung" vs. pinyin "Zedong").
 *
 * Follow-up uit opruim-sessie 2026-05-27 (na het splitsen van 58
 * ampersand-smush authors en het draaien van de variant-merger).
 *
 * Plan (drop → keep):
 *
 *   KEEP  4318 "Mao Zedong"                                   — canonieke pinyin
 *   DROP  7300 "Mao Tze Tung"                                 — Wade-Giles variant
 *   DROP  7350 "Mao Tse Tung"                                 — Wade-Giles variant
 *   DROP  4330 "excerpted from the works of Mao Zedong"       — bogus import-prefix
 *
 * Safety:
 *   - Vóór elke mutatie: re-fetch keep + drops, abort als display_name niet
 *     overeenkomt met de verwachte string (race / per-ongeluk-gerename).
 *   - book_authors merge volgens hetzelfde patroon als
 *     scripts/merge-initials-vs-fullname-authors.ts (re-link, dan delete).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/merge-mao-zedong-dupes.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-mao-zedong-dupes.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

type Plan = {
  keep: { id: number; expectedName: string }
  drops: { id: number; expectedName: string }[]
  label: string
}

const PLAN: Plan = {
  label: 'Mao Zedong — Wade-Giles variants + bogus import-prefix',
  keep: { id: 4318, expectedName: 'Mao Zedong' },
  drops: [
    { id: 7300, expectedName: 'Mao Tze Tung' },
    { id: 7350, expectedName: 'Mao Tse Tung' },
    { id: 4330, expectedName: 'excerpted from the works of Mao Zedong' },
  ],
}

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
  console.log(`── merge-mao-zedong-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const err = await verifyPlan(sb, PLAN)
  if (err) {
    console.error(`  ! ${PLAN.label}: ${err}`)
    console.error(`\nVerification error — aborting (geen mutaties uitgevoerd).`)
    process.exit(1)
  }
  console.log(`  ✓ ${PLAN.label}`)
  console.log(`      KEEP id=${PLAN.keep.id} "${PLAN.keep.expectedName}"`)
  for (const d of PLAN.drops) {
    console.log(`      DROP id=${d.id} "${d.expectedName}"`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  let mergedAuthors = 0, movedLinks = 0, errors = 0
  for (const drop of PLAN.drops) {
    try {
      const { moved } = await mergeOne(sb, PLAN.keep.id, drop.id)
      mergedAuthors++
      movedLinks += moved
      console.log(`  ✓ merged ${drop.id} → ${PLAN.keep.id} (moved ${moved} link(s))`)
    } catch (err) {
      errors++
      console.error(`  ! ${drop.id} → ${PLAN.keep.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.log(`\n  authors merged: ${mergedAuthors}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
