#!/usr/bin/env tsx
// Merge the duplicate "Various" aggregate-author row into the canonical
// "Various Authors" placeholder.
//
// The Portugal Estado Novo import (import-portugal-estado-novo.ts) minted a new
// author "Various" (#7243, slug 'various') for collective/anthology rows instead
// of reusing the existing placeholder "Various Authors" (#455, slug
// 'various-authors'). Result: two aggregate authors holding the same kind of
// work (anthologies, compilations, periodicals), and #7243 was created as a
// normal author (is_placeholder=false) so its page emitted Person JSON-LD and
// even carried an enrichment-contaminated photo_url.
//
//   KEEP  #455  slug 'various-authors'  "Various Authors"  is_placeholder=true   (19 books)
//   DROP  #7243 slug 'various'          "Various"          is_placeholder=false  (68 books)
//
// KEEP = #455: the proper canonical placeholder. The dropped slug 'various' is
// preserved as an author_slug_aliases row so the old URL keeps resolving
// (308 → /authors/various-authors).
//
// Deviation from the standard author-merge doctrine (merge-vs-naipaul-authors.ts):
// this is an AGGREGATE placeholder, not a person. We deliberately copy NO
// person-identity fields from DROP — its photo_url is contamination on a
// "Various" bucket and just disappears when #7243 is deleted. KEEP is forced to
// is_placeholder=true defensively.
//
//   1. Re-point book_authors rows DROP → KEEP (delete DROP's row on PK clash).
//   2. Force KEEP.is_placeholder = true.
//   3. Insert author_slug_aliases(DROP.slug → KEEP) so the old URL resolves.
//   4. DELETE DROP — CASCADE cleans the rest. Idempotent: DROP gone = no-op.
//
//   pnpm tsx --env-file=.env.local scripts/merge-various-placeholder-authors.ts          # dry-run
//   pnpm tsx --env-file=.env.local scripts/merge-various-placeholder-authors.ts --apply  # write
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const WRITE = isApply()

const KEEP = 455 // 'various-authors' "Various Authors" — canonical placeholder
const DROP = 7243 // 'various'         "Various"         — folded in + kept as alias

async function main() {
  const sb = adminClient()
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}  (merge #${DROP} → #${KEEP})\n`)

  const { data: keep } = await sb.from('authors').select('*').eq('id', KEEP).maybeSingle()
  const { data: drop } = await sb.from('authors').select('*').eq('id', DROP).maybeSingle()
  if (!drop) { console.log(`∅ DROP #${DROP} already gone — no-op.`); return }
  if (!keep) { console.log(`✗ KEEP #${KEEP} missing — abort.`); process.exit(1) }
  console.log(`KEEP #${KEEP} ${keep.slug} "${keep.display_name}" placeholder=${keep.is_placeholder}`)
  console.log(`DROP #${DROP} ${drop.slug} "${drop.display_name}" placeholder=${drop.is_placeholder} photo=${drop.photo_url ? 'YES (dropped, not copied)' : 'null'}\n`)

  // 1. book_authors: re-point DROP → KEEP, deleting on PK collision.
  const { data: dropLinks } = await sb.from('book_authors').select('book_id, role').eq('author_id', DROP)
  const { data: keepLinks } = await sb.from('book_authors').select('book_id').eq('author_id', KEEP)
  const keepBooks = new Set((keepLinks ?? []).map(r => r.book_id))
  let repointed = 0, collided = 0
  for (const l of dropLinks ?? []) {
    if (keepBooks.has(l.book_id)) {
      collided++
      console.log(`  book ${l.book_id}: KEEP already linked → delete DROP row`)
      if (WRITE) await sb.from('book_authors').delete().eq('author_id', DROP).eq('book_id', l.book_id)
    } else {
      repointed++
      if (WRITE) {
        const { error } = await sb.from('book_authors').update({ author_id: KEEP }).eq('author_id', DROP).eq('book_id', l.book_id)
        if (error) console.log(`    ✗ book ${l.book_id}: ${error.message}`)
      }
    }
  }
  console.log(`  book_authors: ${repointed} re-pointed → KEEP, ${collided} duplicate(s) deleted`)

  // 2. force KEEP to placeholder (defensive — it should already be true).
  if (keep.is_placeholder !== true) {
    console.log(`  set KEEP.is_placeholder = true (was ${keep.is_placeholder})`)
    if (WRITE) { const { error } = await sb.from('authors').update({ is_placeholder: true }).eq('id', KEEP); if (error) console.log(`    ✗ ${error.message}`) }
  } else {
    console.log(`  KEEP.is_placeholder already true — no change`)
  }

  // 3. slug alias so DROP's old URL keeps resolving → KEEP.
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

  // 4. delete DROP — CASCADE removes its (now empty) book_authors etc.
  console.log(`  DELETE author #${DROP} (${drop.slug})`)
  if (WRITE) { const { error } = await sb.from('authors').delete().eq('id', DROP); if (error) console.log(`    ✗ ${error.message}`) }

  console.log(`\n${WRITE ? 'Applied.' : 'Dry-run — re-run with --apply.'}`)
}
main().catch(e => { console.error(e); process.exit(1) })
