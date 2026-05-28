/**
 * One-shot: consolidate 3 Lenin author-rijen tot één canonical "Vladimir Lenin".
 *
 *   KEEP  id=7416  `Lenin`                (19 books, bio=1345c, b.1870 d.1924)
 *   DROP  id=9342  `Lenin, Vladimir, I.`  (14 books, identieke bio, identieke years)
 *   DROP  id=7558  `V.K. Lenin`           (1 book, geen bio, geen years)
 *
 * Ook: rename KEEP display_name `Lenin` → `Vladimir Lenin`. Slug blijft
 * `lenin` (geen URL-change, geen SEO-impact).
 *
 * Achtergrond: deze 3 rijen zijn alle drie Vladimir Ilyich Lenin (1870-1924).
 * id=9342 ontstond uit de "Lastname, Firstname, I." parse-bug in een
 * Spaanstalige import (vandaar 14 boeken met spaanse titels). id=7558 is een
 * typo (V.K. ipv V.I.) — het ene boek is "Proletaria Revolution and the
 * Renegade Kautsky", exact zelfde werk als id=7416's "Proletariat Revolution
 * & Kanstoky: Rebel of Revolution".
 *
 * Niet aangeraakt: id=7329 `Marx, Stalin, Lenin` — dat is een MULTI_COMMA
 * smush met 3 personen, valt onder een aparte cleanup.
 *
 *   pnpm tsx --env-file=.env.local scripts/merge-lenin-dupes.ts         # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-lenin-dupes.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const KEEP_ID = 7416
const DROP_IDS = [9342, 7558]
const NEW_DISPLAY_NAME = 'Vladimir Lenin'

async function main() {
  const sb = adminClient()
  console.log(`── merge-lenin-dupes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // 1. Verify current state
  const { data: keepRow, error: ke } = await sb.from('authors')
    .select('id, display_name, slug, bio, birth_year, death_year')
    .eq('id', KEEP_ID)
    .maybeSingle()
  if (ke || !keepRow) throw ke ?? new Error(`KEEP id=${KEEP_ID} not found`)
  console.log(`KEEP id=${keepRow.id} slug=${keepRow.slug} name='${keepRow.display_name}' → '${NEW_DISPLAY_NAME}'`)

  for (const dropId of DROP_IDS) {
    const { data: dropRow } = await sb.from('authors')
      .select('id, display_name, slug')
      .eq('id', dropId)
      .maybeSingle()
    if (!dropRow) {
      console.log(`  DROP id=${dropId} not found — skip`)
      continue
    }
    console.log(`DROP id=${dropRow.id} slug=${dropRow.slug} name='${dropRow.display_name}'`)
  }
  console.log('')

  // 2. Get keep's existing book_ids (om duplicaten te skippen)
  const { data: keepLinks, error: kle } = await sb.from('book_authors')
    .select('book_id')
    .eq('author_id', KEEP_ID)
  if (kle) throw kle
  const keepBookIds = new Set((keepLinks ?? []).map(r => r.book_id))
  console.log(`KEEP currently has ${keepBookIds.size} book(s) linked.\n`)

  // 3. Plan per drop
  type DropPlan = { dropId: number; toMove: Array<{ book_id: number; role: string | null }>; alreadyOnKeep: number[] }
  const plans: DropPlan[] = []
  for (const dropId of DROP_IDS) {
    const { data: dropLinks } = await sb.from('book_authors')
      .select('book_id, role')
      .eq('author_id', dropId)
    const links = (dropLinks ?? []) as Array<{ book_id: number; role: string | null }>
    const toMove = links.filter(l => !keepBookIds.has(l.book_id))
    const alreadyOnKeep = links.filter(l => keepBookIds.has(l.book_id)).map(l => l.book_id)
    plans.push({ dropId, toMove, alreadyOnKeep })
    console.log(`DROP id=${dropId}: ${links.length} link(s) — ${toMove.length} to move, ${alreadyOnKeep.length} already on KEEP`)
    if (alreadyOnKeep.length > 0) console.log(`  already-on-keep book_ids: ${alreadyOnKeep.join(', ')}`)
  }
  console.log('')

  if (!APPLY) {
    console.log(`── Dry-run complete. Re-run with --apply om door te voeren. ──\n`)
    return
  }

  // 4. Rename KEEP
  console.log(`Renaming KEEP id=${KEEP_ID} display_name → '${NEW_DISPLAY_NAME}'`)
  const { error: re } = await sb.from('authors')
    .update({ display_name: NEW_DISPLAY_NAME })
    .eq('id', KEEP_ID)
  if (re) throw re

  // 5. For each drop: move links, delete old links, delete author row
  let movedLinks = 0
  for (const p of plans) {
    if (p.toMove.length > 0) {
      const payload = p.toMove.map(l => ({ book_id: l.book_id, author_id: KEEP_ID, role: l.role ?? 'author' }))
      const { error: ie } = await sb.from('book_authors').insert(payload)
      if (ie) throw ie
      movedLinks += p.toMove.length
    }
    const { error: de } = await sb.from('book_authors').delete().eq('author_id', p.dropId)
    if (de) throw de
    const { error: ae } = await sb.from('authors').delete().eq('id', p.dropId)
    if (ae) throw ae
    console.log(`  ✓ merged drop=${p.dropId} → keep=${KEEP_ID} (moved ${p.toMove.length} link(s), dropped ${p.alreadyOnKeep.length} duplicate-link(s))`)
  }

  console.log(`\n  ✓ canonical KEEP id=${KEEP_ID} now has ${keepBookIds.size + movedLinks} book(s) linked.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
