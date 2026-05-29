/**
 * Fix 13 author records produced by the PEN-Belarus scraper bug (2026-05-27
 * 10:21–10:23 import window). The scraper concatenated list-section headers
 * ("Sui Ishida (Japan) 24.01.2025 (30 items):") into the first item's
 * author field, plus three records where book title and publisher got
 * swapped onto the author field.
 *
 * Per-record plan (manual mapping; each case is a unique scraping artefact):
 *
 *   id=7960   "(Hamidin bin Kasim) Pak Wa"                    → RENAME "Pak Wa"
 *   id=8796   "Partisans of the USSR…(Vilnius"                → DELETE (book has co-author Sergei Zakharevich)
 *   id=8800   "Murder on Makajonka Street (Warsaw"            → DELETE (book has co-author Klok Štučny)
 *   id=8811   "Red Crosses (Kraków"                           → DELETE (book has co-author Sasha Filipenko)
 *   id=8830   "Sui Ishida (Japan) 24.01.2025 (30 items):"     → RENAME "Sui Ishida" (merge if slug exists)
 *   id=8849   "Casey McQuiston (USA) 01.04.2025 (27 items):"  → MERGE into id=224 (existing "Casey McQuiston")
 *   id=8859   "Kristina Dvoinykh (Russia) 29.05.2025 …"       → RENAME "Kristina Dvoinykh"
 *   id=8885   "All Shades of Fall – Ivan Belov"               → RENAME "Ivan Belov" (merge if slug exists)
 *   id=8890   "ed. by V. Korkunov (Russia) 30.09.2025 …"      → RENAME "V. Korkunov" (merge if slug exists)
 *   id=8906   ") – Ryū Murakami (Japan) 29.12.2025 …"         → MERGE into id=8857 (existing "Ryu Murakami")
 *   id=8949   "Ann Shulgin (USA) 26.02.2026 (16 items):"      → RENAME "Ann Shulgin" (merge if slug exists)
 *   id=8951   "Translations — Vladimir Khoroshko"             → RENAME "Vladimir Khoroshko" (merge if slug exists)
 *   id=8959   "Legs McNeil (USA)"                             → RENAME "Legs McNeil" (merge if slug exists)
 *
 * The 3 DELETE cases also drop the book_authors link to the malformed
 * author; the books retain their real co-author and stay intact.
 *
 * Source-side note: data/pen-belarus-batch1.json contains the same
 * malformed strings as `authors` array entries (incl. "(Vilnius",
 * "(Warsaw", etc.). The PEN scraper that produced it needs a guard against
 * section-header concatenation before any re-import.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-malformed-pen-belarus-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-malformed-pen-belarus-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

type Action =
  | { kind: 'rename'; id: number; cleanName: string }
  | { kind: 'merge';  id: number; intoId: number }
  | { kind: 'delete'; id: number }

const PLAN: Action[] = [
  { kind: 'rename', id: 7960, cleanName: 'Pak Wa' },
  { kind: 'delete', id: 8796 },
  { kind: 'delete', id: 8800 },
  { kind: 'delete', id: 8811 },
  { kind: 'rename', id: 8830, cleanName: 'Sui Ishida' },
  { kind: 'merge',  id: 8849, intoId: 224 },
  { kind: 'rename', id: 8859, cleanName: 'Kristina Dvoinykh' },
  { kind: 'rename', id: 8885, cleanName: 'Ivan Belov' },
  { kind: 'rename', id: 8890, cleanName: 'V. Korkunov' },
  { kind: 'merge',  id: 8906, intoId: 8857 },
  { kind: 'rename', id: 8949, cleanName: 'Ann Shulgin' },
  { kind: 'rename', id: 8951, cleanName: 'Vladimir Khoroshko' },
  { kind: 'rename', id: 8959, cleanName: 'Legs McNeil' },
]

async function moveLinksAndDelete(sb: ReturnType<typeof adminClient>, fromId: number, intoId: number) {
  const { data: fromLinks } = await sb.from('book_authors').select('book_id, role').eq('author_id', fromId)
  const { data: keepLinks } = await sb.from('book_authors').select('book_id').eq('author_id', intoId)
  const keepSet = new Set((keepLinks ?? []).map(r => r.book_id))
  const toLink = (fromLinks ?? []).filter(l => !keepSet.has(l.book_id))
  if (toLink.length > 0) {
    const payload = toLink.map(l => ({ book_id: l.book_id, author_id: intoId, role: l.role ?? 'author' }))
    const { error } = await sb.from('book_authors').insert(payload)
    if (error) throw new Error(`insert links into ${intoId}: ${error.message}`)
  }
  const { error: de } = await sb.from('book_authors').delete().eq('author_id', fromId)
  if (de) throw new Error(`delete links for ${fromId}: ${de.message}`)
  const { error: ae } = await sb.from('authors').delete().eq('id', fromId)
  if (ae) throw new Error(`delete author ${fromId}: ${ae.message}`)
  return toLink.length
}

async function main() {
  const sb = adminClient()
  console.log(`\n── fix-malformed-pen-belarus-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Resolve renames that may need to become merges (slug collision)
  const resolved: Array<Action & { effectiveKind: 'rename' | 'merge' | 'delete'; targetSlug?: string; targetId?: number }> = []
  for (const a of PLAN) {
    if (a.kind === 'rename') {
      const newSlug = slugify(a.cleanName)
      const { data: hit } = await sb.from('authors').select('id, display_name').eq('slug', newSlug).maybeSingle()
      if (hit && hit.id !== a.id) {
        resolved.push({ ...a, effectiveKind: 'merge', targetSlug: newSlug, targetId: hit.id })
      } else {
        resolved.push({ ...a, effectiveKind: 'rename', targetSlug: newSlug })
      }
    } else if (a.kind === 'merge') {
      resolved.push({ ...a, effectiveKind: 'merge', targetId: a.intoId })
    } else {
      resolved.push({ ...a, effectiveKind: 'delete' })
    }
  }

  // Print plan
  for (const a of resolved) {
    const { data: cur } = await sb.from('authors').select('display_name').eq('id', a.id).maybeSingle()
    const curName = cur?.display_name ?? '(missing)'
    if (a.effectiveKind === 'rename' && a.kind === 'rename') {
      console.log(`  RENAME ${a.id} "${curName}" → "${a.cleanName}" (slug "${a.targetSlug}")`)
    } else if (a.effectiveKind === 'merge') {
      const intoId = a.targetId
      const { data: into } = intoId ? await sb.from('authors').select('display_name').eq('id', intoId).maybeSingle() : { data: null }
      const intoName = into?.display_name ?? '?'
      console.log(`  MERGE  ${a.id} "${curName}" → into ${intoId} "${intoName}"`)
    } else {
      console.log(`  DELETE ${a.id} "${curName}" (book_authors link dropped; co-author stays on book)`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // Execute
  let renamed = 0, merged = 0, deleted = 0, movedLinks = 0, errors = 0
  for (const a of resolved) {
    try {
      if (a.effectiveKind === 'rename' && a.kind === 'rename') {
        const { error } = await sb.from('authors')
          .update({ display_name: a.cleanName, slug: a.targetSlug ?? slugify(a.cleanName) })
          .eq('id', a.id)
        if (error) throw new Error(error.message)
        renamed++
        console.log(`  ✓ renamed ${a.id} → "${a.cleanName}"`)
      } else if (a.effectiveKind === 'merge') {
        const intoId = a.targetId
        if (!intoId) throw new Error(`no target id for merge of ${a.id}`)
        const moved = await moveLinksAndDelete(sb, a.id, intoId)
        merged++
        movedLinks += moved
        console.log(`  ✓ merged ${a.id} → ${intoId} (moved ${moved} link(s))`)
      } else {
        // delete: drop links, then drop row
        const { error: de } = await sb.from('book_authors').delete().eq('author_id', a.id)
        if (de) throw new Error(de.message)
        const { error: ae } = await sb.from('authors').delete().eq('id', a.id)
        if (ae) throw new Error(ae.message)
        deleted++
        console.log(`  ✓ deleted ${a.id}`)
      }
    } catch (err) {
      errors++
      console.error(`  ! ${a.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.log(`\n  renamed: ${renamed}, merged: ${merged}, deleted: ${deleted}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
