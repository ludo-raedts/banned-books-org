/**
 * Permanently mark a book's cover as a manual override:
 *   - Clears cover_url
 *   - Sets cover_status = 'manual_override'
 *   - Sets cover_checked_at = now()
 *
 * Once a book is in this state, enrich-covers-v2 will skip it on every run.
 * Pass --force to enrich-covers-v2 to bypass.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/mark-cover-override.ts <id-or-slug>
 *   npx tsx --env-file=.env.local scripts/mark-cover-override.ts <id-or-slug> --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const target = process.argv.slice(2).find(a => !a.startsWith('-'))

if (!target) {
  console.error('Usage: mark-cover-override.ts <book_id-or-slug> [--apply]')
  process.exit(1)
}

async function main() {
  const supabase = adminClient()
  const isNumeric = /^\d+$/.test(target!)
  const lookupCol = isNumeric ? 'id' : 'slug'
  const lookupVal: string | number = isNumeric ? parseInt(target!, 10) : target!

  const { data: book, error: selectErr } = await supabase
    .from('books')
    .select('id, slug, title, cover_url, cover_status, cover_checked_at')
    .eq(lookupCol, lookupVal)
    .maybeSingle()

  if (selectErr) {
    console.error(`DB error: ${selectErr.message}`)
    process.exit(1)
  }
  if (!book) {
    console.error(`No book found where ${lookupCol} = ${lookupVal}`)
    process.exit(1)
  }

  console.log(`\nBook: ${book.title}  (id=${book.id}, slug=${book.slug})`)
  console.log(`  current cover_url:        ${book.cover_url ?? '(null)'}`)
  console.log(`  current cover_status:     ${book.cover_status ?? '(null)'}`)
  console.log(`  current cover_checked_at: ${book.cover_checked_at ?? '(null)'}`)

  if (book.cover_status === 'manual_override') {
    console.log(`\nAlready cover_status='manual_override'. Nothing to do.`)
    return
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN. Would set:`)
    console.log(`  cover_url        → null`)
    console.log(`  cover_status     → manual_override`)
    console.log(`  cover_checked_at → now()`)
    console.log(`\nRe-run with --apply to write.\n`)
    return
  }

  const { error: updateErr } = await supabase
    .from('books')
    .update({
      cover_url: null,
      cover_status: 'manual_override',
      cover_checked_at: new Date().toISOString(),
    })
    .eq('id', book.id)

  if (updateErr) {
    console.error(`Update failed: ${updateErr.message}`)
    process.exit(1)
  }

  console.log(`\n✓ Marked id=${book.id} (${book.slug}) as manual_override.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
