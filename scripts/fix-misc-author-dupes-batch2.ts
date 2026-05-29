/**
 * Repair another batch of author records flagged in the enrich log:
 *
 *   3 renames (scraper-artefact prefixes / suffixes):
 *     id=4476  "illus. by Chip Zdarsky"      → "Chip Zdarsky"
 *     id=4565  "illus. by Stevie Lewis"      → "Stevie Lewis"
 *     id=7404  "Hu Hwa ,Etc"                 → "Hu Hwa"
 *
 *   5 merges (typos / spelling variants / missing-space):
 *     id=1546  "Kit Fick"                    → into id=3285  "Kit Frick"  (typo)
 *     id=8247  "Jeff & AnnetteHarvey"        → into id=8248  "Jeff & Annette Harvey"  (missing space)
 *     id=8245  "Jeff Harvey & Annette Harvey"→ into id=8248  "Jeff & Annette Harvey"  (same duo, different rendering)
 *     id=7838  "Iza Sharizad"                → into id=7871  "Iza Shahrizad"  (Malay transliteration variant)
 *     id=7861  "Iza Sharizat"                → into id=7871  "Iza Shahrizad"  (Malay transliteration variant)
 *
 * NOT touched:
 *   id=8236  "Jeff Harvey & C. Pallaghy"  — different co-author than the others, NOT the same duo
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-misc-author-dupes-batch2.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-misc-author-dupes-batch2.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

const RENAMES: Array<{ id: number; cleanName: string; note: string }> = [
  { id: 4476, cleanName: 'Chip Zdarsky', note: 'strip "illus. by" prefix' },
  { id: 4565, cleanName: 'Stevie Lewis', note: 'strip "illus. by" prefix' },
  { id: 7404, cleanName: 'Hu Hwa',        note: 'strip ",Etc" suffix' },
]

const MERGES: Array<{ from: number; into: number; note: string }> = [
  { from: 1546, into: 3285, note: 'typo: "Kit Fick" → "Kit Frick"' },
  { from: 8247, into: 8248, note: 'missing space: "AnnetteHarvey" → "Annette Harvey"' },
  { from: 8245, into: 8248, note: 'same duo, "Jeff Harvey & Annette Harvey" rendering' },
  { from: 7838, into: 7871, note: 'Malay transliteration: "Sharizad" → "Shahrizad"' },
  { from: 7861, into: 7871, note: 'Malay transliteration: "Sharizat" → "Shahrizad"' },
]

async function moveLinksAndDelete(sb: ReturnType<typeof adminClient>, fromId: number, intoId: number): Promise<number> {
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
  console.log(`── fix-misc-author-dupes-batch2 ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  console.log(`Renames:`)
  for (const r of RENAMES) {
    const { data } = await sb.from('authors').select('display_name').eq('id', r.id).maybeSingle()
    console.log(`  id=${r.id}  "${data?.display_name ?? '(missing)'}" → "${r.cleanName}"  [${r.note}]`)
  }
  console.log(`\nMerges:`)
  for (const m of MERGES) {
    const [{ data: a }, { data: b }] = await Promise.all([
      sb.from('authors').select('display_name').eq('id', m.from).maybeSingle(),
      sb.from('authors').select('display_name').eq('id', m.into).maybeSingle(),
    ])
    console.log(`  ${m.from} "${a?.display_name ?? '?'}" → ${m.into} "${b?.display_name ?? '?'}"  [${m.note}]`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  let renamed = 0, merged = 0, movedLinks = 0, errors = 0
  for (const r of RENAMES) {
    const newSlug = slugify(r.cleanName)
    const { data: collide } = await sb.from('authors').select('id').eq('slug', newSlug).maybeSingle()
    if (collide && collide.id !== r.id) {
      console.error(`  ! id=${r.id}: slug "${newSlug}" already used by ${collide.id}; merge instead?`)
      errors++
      continue
    }
    const { error } = await sb.from('authors').update({ display_name: r.cleanName, slug: newSlug }).eq('id', r.id)
    if (error) { errors++; console.error(`  ! rename ${r.id}: ${error.message}`) }
    else { renamed++; console.log(`  ✓ renamed ${r.id} → "${r.cleanName}"`) }
  }
  for (const m of MERGES) {
    try {
      const moved = await moveLinksAndDelete(sb, m.from, m.into)
      merged++
      movedLinks += moved
      console.log(`  ✓ merged ${m.from} → ${m.into} (moved ${moved} link(s))`)
    } catch (err) {
      errors++
      console.error(`  ! merge ${m.from} → ${m.into}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.log(`\n  renamed: ${renamed}, merged: ${merged}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
