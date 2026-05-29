/**
 * Split the smushed author record
 *   id=8031  "1. William H.Masters 2.Virginia E. 3.Robert C.Kolodny"
 * into three separate authors and re-link them to the single book that
 * referenced 8031 — "On Sex and Human Loving" (book_id=12148), banned in
 * Malaysia 1992.
 *
 * Author 2 ("Virginia E.") is restored to the canonical "Virginia E. Johnson"
 * (Johnson being her surname, missing in the KDN gazette source row).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/split-masters-johnson-kolodny.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/split-masters-johnson-kolodny.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')
const SMUSHED_ID = 8031
const BOOK_ID = 12148

const TARGETS = [
  'William H. Masters',
  'Virginia E. Johnson',
  'Robert C. Kolodny',
] as const

async function findOrCreate(displayName: string, sb: ReturnType<typeof adminClient>): Promise<{ id: number; created: boolean }> {
  const slug = slugify(displayName)
  const { data: existing } = await sb.from('authors').select('id, display_name').eq('slug', slug).maybeSingle()
  if (existing) return { id: existing.id, created: false }
  if (!APPLY) {
    return { id: -1, created: true }
  }
  const { data: inserted, error } = await sb
    .from('authors')
    .insert({ display_name: displayName, slug })
    .select('id')
    .single()
  if (error) throw new Error(`Insert ${displayName}: ${error.message}`)
  return { id: inserted.id, created: true }
}

async function main() {
  const sb = adminClient()
  console.log(`── split-masters-johnson-kolodny ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const { data: oldAuthor } = await sb.from('authors').select('id, display_name').eq('id', SMUSHED_ID).maybeSingle()
  if (!oldAuthor) { console.log(`Author ${SMUSHED_ID} not found — nothing to do.`); return }
  console.log(`Smushed author: id=${oldAuthor.id} "${oldAuthor.display_name}"`)

  const { data: link } = await sb.from('book_authors').select('book_id, role').eq('author_id', SMUSHED_ID)
  console.log(`Existing book_authors links: ${(link ?? []).length}`)
  for (const l of link ?? []) console.log(`  book_id=${l.book_id} role=${l.role}`)

  // 1) Resolve or create the 3 target authors
  const ids: { name: string; id: number; created: boolean }[] = []
  for (const name of TARGETS) {
    const r = await findOrCreate(name, sb)
    ids.push({ name, ...r })
    console.log(`  ${r.created ? '+ create' : '~ exists'}: ${name} → id=${r.id} (slug=${slugify(name)})`)
  }

  if (!APPLY) {
    console.log(`\nDry-run plan:`)
    console.log(`  - create 3 authors (if not present)`)
    console.log(`  - insert book_authors(${BOOK_ID}, <new_id>) for each`)
    console.log(`  - delete book_authors(${BOOK_ID}, ${SMUSHED_ID})`)
    console.log(`  - delete authors id=${SMUSHED_ID}`)
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // 2) Insert book_authors links for the 3 new authors
  const newLinks = ids.map(({ id }) => ({ book_id: BOOK_ID, author_id: id, role: 'author' }))
  const { error: ie } = await sb.from('book_authors').upsert(newLinks, { onConflict: 'book_id,author_id' })
  if (ie) throw new Error(`Insert book_authors: ${ie.message}`)
  console.log(`\n+ book_authors: linked book ${BOOK_ID} to ${ids.length} new authors`)

  // 3) Remove the old smushed link
  const { error: de } = await sb.from('book_authors').delete().eq('book_id', BOOK_ID).eq('author_id', SMUSHED_ID)
  if (de) throw new Error(`Delete old book_authors: ${de.message}`)
  console.log(`- book_authors: removed link (book=${BOOK_ID}, author=${SMUSHED_ID})`)

  // 4) Delete the smushed author row
  const { error: ae } = await sb.from('authors').delete().eq('id', SMUSHED_ID)
  if (ae) throw new Error(`Delete author ${SMUSHED_ID}: ${ae.message}`)
  console.log(`- authors: deleted id=${SMUSHED_ID}`)

  console.log(`\n── Done. Re-run enrich-author-bios.ts to pick up bios for the 3 new authors. ──`)
}

main().catch(err => { console.error(err); process.exit(1) })
