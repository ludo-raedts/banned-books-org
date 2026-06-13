#!/usr/bin/env tsx
// Merge the duplicate V. S. Naipaul author rows into one canonical author.
//
// Found while writing literary-award tags (both rows independently got the
// 2001 Nobel tag) — see data/award-overlap.md. Same person, two author rows,
// each with one distinct banned title linked:
//   KEEP  #172  slug 'vs-naipaul'   display "V. S. Naipaul"  → An Area of Darkness
//   DROP  #8048 slug 'v-s-naipaul'  display "V.S.Naipaul"    → Among the Believers
//
// KEEP = #172: properly-spaced display_name and the older row (created
// 2026-04-24 vs 2026-05-27), so its 'vs-naipaul' URL is the more established
// one. The dropped slug 'v-s-naipaul' is preserved as an author_slug_aliases
// row so the old URL keeps resolving (308 → /authors/vs-naipaul).
//
// Follows the merge doctrine (scripts/merge-honorific-author-dupes.ts):
//   1. Re-point book_authors rows DROP → KEEP (delete DROP's row on PK clash).
//   2. Merge awards JSONB: union of both arrays, deduped on (award,category,year).
//   3. Enrich KEEP's NULL scalar fields from DROP (KEEP-set wins).
//   4. Insert author_slug_aliases(DROP.slug → KEEP) so the old URL resolves.
//   5. DELETE DROP — CASCADE cleans the rest. Idempotent: DROP gone = no-op.
//
//   pnpm tsx --env-file=.env.local scripts/merge-vs-naipaul-authors.ts          # dry-run
//   pnpm tsx --env-file=.env.local scripts/merge-vs-naipaul-authors.ts --apply  # write
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const WRITE = isApply()

const KEEP = 172 // 'vs-naipaul'  — canonical survivor
const DROP = 8048 // 'v-s-naipaul' — folded in + kept as alias

const ENRICH_FIELDS = ['bio', 'birth_year', 'death_year', 'birth_country', 'photo_url',
  'name_native', 'name_transliterated', 'name_english', 'original_language',
  'openlibrary_author_id'] as const

type Award = { award: string; category?: string; year: number }
const awardKey = (a: Award) => `${a.award}|${a.category ?? ''}|${a.year}`
function mergeAwards(keep: unknown, drop: unknown): { merged: Award[]; changed: boolean } {
  const arr = (x: unknown): Award[] => (Array.isArray(x) ? (x as Award[]) : [])
  const seen = new Set<string>()
  const merged: Award[] = []
  for (const a of [...arr(keep), ...arr(drop)]) {
    if (!a || typeof a.award !== 'string' || typeof a.year !== 'number') continue
    const k = awardKey(a)
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(a)
  }
  merged.sort((a, b) => a.year - b.year)
  const changed = JSON.stringify(arr(keep)) !== JSON.stringify(merged)
  return { merged, changed }
}

async function main() {
  const sb = adminClient()
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}  (merge #${DROP} → #${KEEP})\n`)

  const { data: keep } = await sb.from('authors').select('*').eq('id', KEEP).maybeSingle()
  const { data: drop } = await sb.from('authors').select('*').eq('id', DROP).maybeSingle()
  if (!drop) { console.log(`∅ DROP #${DROP} already gone — no-op.`); return }
  if (!keep) { console.log(`✗ KEEP #${KEEP} missing — abort.`); process.exit(1) }
  console.log(`KEEP #${KEEP} ${keep.slug} "${keep.display_name}"`)
  console.log(`DROP #${DROP} ${drop.slug} "${drop.display_name}"\n`)

  // 1. book_authors: re-point DROP → KEEP, deleting on PK collision.
  const { data: dropLinks } = await sb.from('book_authors').select('book_id, role').eq('author_id', DROP)
  const { data: keepLinks } = await sb.from('book_authors').select('book_id').eq('author_id', KEEP)
  const keepBooks = new Set((keepLinks ?? []).map(r => r.book_id))
  for (const l of dropLinks ?? []) {
    if (keepBooks.has(l.book_id)) {
      console.log(`  book ${l.book_id}: KEEP already linked → delete DROP row`)
      if (WRITE) await sb.from('book_authors').delete().eq('author_id', DROP).eq('book_id', l.book_id)
    } else {
      console.log(`  book ${l.book_id}: re-point → KEEP (role=${l.role})`)
      if (WRITE) {
        const { error } = await sb.from('book_authors').update({ author_id: KEEP }).eq('author_id', DROP).eq('book_id', l.book_id)
        if (error) console.log(`    ✗ ${error.message}`)
      }
    }
  }

  // 2. awards JSONB — union + dedup on (award,category,year).
  const { merged, changed } = mergeAwards((keep as any).awards, (drop as any).awards)
  if (changed) {
    console.log(`  awards: merge → ${JSON.stringify(merged)}`)
    if (WRITE) { const { error } = await sb.from('authors').update({ awards: merged }).eq('id', KEEP); if (error) console.log(`    ✗ ${error.message}`) }
  } else {
    console.log(`  awards: already equal (${JSON.stringify(merged)}) — no change`)
  }

  // 3. enrich KEEP's NULL scalar fields from DROP (KEEP-set wins).
  const enrich: Record<string, unknown> = {}
  for (const f of ENRICH_FIELDS) {
    if ((keep as any)[f] == null && (drop as any)[f] != null) enrich[f] = (drop as any)[f]
  }
  if (Object.keys(enrich).length) {
    console.log(`  enrich KEEP nulls: ${Object.keys(enrich).join(', ')}`)
    if (WRITE) { const { error } = await sb.from('authors').update(enrich).eq('id', KEEP); if (error) console.log(`    ✗ ${error.message}`) }
  } else {
    console.log(`  enrich KEEP: nothing to copy (KEEP already complete)`)
  }

  // 4. slug alias so DROP's old URL keeps resolving → KEEP.
  //    Guard: the alias slug must not collide with any live authors.slug.
  if (drop.slug && drop.slug !== keep.slug) {
    const { data: clash } = await sb.from('authors').select('id').eq('slug', drop.slug).neq('id', DROP).maybeSingle()
    if (clash) {
      console.log(`  alias: SKIP — slug '${drop.slug}' already owned by author #${clash.id}`)
    } else {
      console.log(`  alias: '${drop.slug}' → KEEP #${KEEP} (source=merge)`)
      if (WRITE) {
        const { error } = await sb.from('author_slug_aliases')
          .upsert({ slug: drop.slug, author_id: KEEP, source: 'merge' }, { onConflict: 'slug' })
        if (error) console.log(`    ✗ ${error.message}`)
      }
    }
  }

  // 5. delete DROP — CASCADE removes its (now empty) book_authors etc.
  console.log(`  DELETE author #${DROP} (${drop.slug})`)
  if (WRITE) { const { error } = await sb.from('authors').delete().eq('id', DROP); if (error) console.log(`    ✗ ${error.message}`) }

  console.log(`\n${WRITE ? 'Applied.' : 'Dry-run — re-run with --apply.'}`)
}
main().catch(e => { console.error(e); process.exit(1) })
