// One-off data-quality fix: correct two import-corrupted titles found while
// checking PEN America's 2024-2025 disability-representation list.
//
//   #4771  "The Invisible Life of Ivan lsaenko"  (lowercase L → capital I)
//   #2774  "The Magical Misfits"                  (series is "The Magic Misfits")
//   #2775  "The Magical Misfits: The Minor Third"
//   #2776  "The Magical Misfits: The Second Story"
//
// For each: fix books.title, regenerate the slug via canonical slugify(), and
// preserve the old (wrong) slug as a 308 redirect in book_slug_aliases so no
// URL 404s. Idempotent + dry-run by default.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/_fix_magic_isaenko_titles_2026_07_09.ts
//   npx tsx --env-file=.env.local scripts/_fix_magic_isaenko_titles_2026_07_09.ts --apply
import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { isApply } from './lib/cli'

const FIXES: { id: number; title: string }[] = [
  { id: 4771, title: 'The Invisible Life of Ivan Isaenko' },
  { id: 2774, title: 'The Magic Misfits' },
  { id: 2775, title: 'The Magic Misfits: The Minor Third' },
  { id: 2776, title: 'The Magic Misfits: The Second Story' },
]

async function main() {
  const WRITE = isApply()
  const s = adminClient()
  console.log(WRITE ? '== APPLY ==' : '== DRY-RUN (pass --apply to write) ==')

  for (const fix of FIXES) {
    const { data: book, error } = await s.from('books').select('id,title,slug').eq('id', fix.id).single()
    if (error || !book) { console.log(`#${fix.id}: NOT FOUND (${error?.message})`); continue }
    const b = book as { id: number; title: string; slug: string }
    const newSlug = slugify(fix.title)

    if (b.title === fix.title && b.slug === newSlug) {
      console.log(`#${b.id}: already correct ("${b.title}") — skip`)
      continue
    }

    // Collision guard: make sure the new slug isn't already taken by another book.
    const { data: clash } = await s.from('books').select('id').eq('slug', newSlug).neq('id', b.id).maybeSingle()
    if (clash) { console.log(`#${b.id}: ⚠️  new slug "${newSlug}" already used by book #${(clash as any).id} — SKIP`); continue }

    console.log(`#${b.id}: title "${b.title}" → "${fix.title}"`)
    console.log(`        slug  "${b.slug}" → "${newSlug}"`)

    if (!WRITE) continue

    const { error: uErr } = await s.from('books').update({ title: fix.title, slug: newSlug }).eq('id', b.id)
    if (uErr) { console.log(`        ✗ update failed: ${uErr.message}`); continue }

    if (b.slug && b.slug !== newSlug) {
      const { error: aErr } = await s.from('book_slug_aliases').insert({ slug: b.slug, book_id: b.id, source: 'legacy_slug' })
      if (aErr && !/duplicate|unique/i.test(aErr.message)) console.log(`        ✗ alias insert failed: ${aErr.message}`)
      else console.log(`        ✓ alias "${b.slug}" → #${b.id}`)
    }
    console.log('        ✓ applied')
  }
}
main().then(() => process.exit(0))
