// delete-kdn-periodicals.ts — ONE-OFF. Finish the periodical purge started
// 2026-06-03 (data/kdn-malaysia-periodicals-review.md deleted the first 17;
// these high-confidence rows were reviewed but never removed). Books-only scope
// → periodicals/newspapers are out of scope and get deleted, not kept.
//
// Poetry Magazine (#11008) is intentionally EXCLUDED — reviewed as a poetry
// collection (dichtbundel), a real book.
//
// FK cascade (baseline): deleting a book cascades to bans, book_authors,
// ban_reason_links, ban_source_links. One DELETE cleans everything.
//
// Writes a full pre-delete backup (rows + bans) to data/ before touching
// anything. Dry-run by default; --apply to delete.
//
// Run: pnpm tsx --env-file=.env.local scripts/delete-kdn-periodicals.ts
//      pnpm tsx --env-file=.env.local scripts/delete-kdn-periodicals.ts --apply

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const db = adminClient()
const APPLY = isApply()

// 15 high-confidence magazines + 1 newspaper (Causeway). Poetry Magazine #11008
// deliberately omitted.
const IDS = [
  11584, // Artist Magazine
  11463, // Blue Cover Mystery Magazine
  12108, // Cerita Ganjil Yang Menarik Dalam Siri Majalah Manusia Ganjil
  11766, // Green Cover Mystery Magazine
  13099, // Hard Magazine
  11836, // James Bond Magazine
  12133, // Joan Chan Dalam Majalah Penthouse
  7520,  // Marc Dorcel Magazine
  11834, // More Magazine
  11629, // Pictorial Magazine On The Death of Chairman Mao Tse-tung
  13084, // SENSASI - majalah lelaki millennium
  11767, // The Discovery Magazine
  11764, // The Fantasies Magazine
  11806, // Untuk Mereka Yang Berkorban... Majalah Tanda Penghargaan
  12107, // Yang Ganjil Sekali Dalam Siri Majalah Manusia Ganjil
  11585, // Causeway (newspaper)
]

const BACKUP = 'data/kdn-periodicals-deleted-2026-07-01.json'

async function main() {
  const { data: books, error } = await db
    .from('books')
    .select('id, slug, title, isbn13, first_published_year')
    .in('id', IDS)
  if (error) throw error

  const { data: bans } = await db
    .from('bans')
    .select('id, book_id, country_code, year_started, action_type')
    .in('book_id', IDS)

  const banCountByBook = new Map<number, number>()
  for (const b of (bans ?? []) as { book_id: number }[]) {
    banCountByBook.set(b.book_id, (banCountByBook.get(b.book_id) ?? 0) + 1)
  }

  console.log(`Target books found: ${books?.length ?? 0} / ${IDS.length}`)
  console.log(`Dependent bans (cascade): ${bans?.length ?? 0}\n`)
  for (const b of (books ?? []) as { id: number; title: string; slug: string }[]) {
    console.log(`  #${b.id} ${b.title} (${b.slug}) — ${banCountByBook.get(b.id) ?? 0} bans`)
  }

  const missing = IDS.filter((id) => !(books ?? []).some((b: { id: number }) => b.id === id))
  if (missing.length) console.log(`\n⚠ not found (already gone?): ${missing.join(', ')}`)

  // Always write the backup so a dry run leaves a restorable snapshot too.
  writeFileSync(BACKUP, JSON.stringify({ deletedAt: '2026-07-01', books, bans }, null, 2))
  console.log(`\nBackup written: ${BACKUP} (${books?.length ?? 0} books, ${bans?.length ?? 0} bans)`)

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to delete.')
    return
  }

  const { error: delErr, count } = await db
    .from('books')
    .delete({ count: 'exact' })
    .in('id', IDS)
  if (delErr) throw delErr
  console.log(`\nDeleted ${count} books (bans/book_authors/links cascaded).`)

  // Verify gone.
  const { data: still } = await db.from('books').select('id').in('id', IDS)
  console.log(`Remaining of targets: ${still?.length ?? 0} (expect 0).`)
}

main().then(() => process.exit(0))
