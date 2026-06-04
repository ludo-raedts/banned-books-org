// _fix_orphan_author_books.ts — one-off remediation for the 37 books that
// audit-integrity.ts flagged as "book with zero linked authors".
//
// Root cause: the APM-Córdoba (Argentina 1976) PDF import and a handful of
// KDN/PEN/Wikipedia imports created book rows whose only attribution was a
// publisher / editorial / committee / title-fragment, so the importer never
// linked an author. A book with no book_authors row breaks detail/author
// rendering, so this is an INVARIANT (threshold 0).
//
// Resolution per book (see the response that authored this script for the
// reasoning behind each bucket):
//   - PERSON   → link the real author row (Codovilla #9190).
//   - VARIOUS  → link #455 "Various Authors" (anthologies, encyclopedias,
//                reference works, compiled/collective works).
//   - ANON     → link #33 "Anonymous" (single corporate / party / government /
//                publisher-only works with no identifiable author).
//   - RENAME   → fix a title truncated by a PDF column break, then link Anonymous.
//   - REMOVE   → delete a junk fragment / out-of-scope periodical (CASCADE-style:
//                delete ban_source_links → bans → book_authors → book).
//
// Dry-run by default. Pass --apply to write.
//
// Run: pnpm tsx --env-file=.env.local scripts/_fix_orphan_author_books.ts [--apply]

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')
const db = adminClient()

const ANONYMOUS = 33
const VARIOUS = 455
const CODOVILLA = 9190

// book_id → author_id (role 'author')
const LINK_VARIOUS = [5441, 6574, 10447, 10597, 10757, 10762, 10980, 11797, 12494, 13662, 13695, 13787, 13821, 13840, 13857, 13859, 13861]
const LINK_ANON = [5547, 9102, 11790, 13687, 13785, 13786, 13788, 13789, 13804, 13818, 13819, 13820, 13858, 14098, 14168, 14209, 14210]
const LINK_PERSON: Array<[number, number]> = [[13856, CODOVILLA]]

// book_id → corrected title (PDF column-break repairs); slug recomputed from title
const RENAME: Array<[number, string]> = [
  [14168, 'Resoluciones y declaraciones del Partido Comunista de la Argentina'],
  [13804, 'Revista Nueva Era N° 4. La séptima conferencia nacional del Partido Comunista'],
]

// books to delete entirely (junk fragment / out-of-scope periodical)
const REMOVE = [14169, 6495]

async function linkAuthor(bookId: number, authorId: number) {
  // idempotent: skip if already linked
  const { data: existing } = await db.from('book_authors').select('book_id').eq('book_id', bookId).eq('author_id', authorId)
  if (existing && existing.length) { console.log(`   · #${bookId} already linked to author #${authorId}`); return }
  console.log(`   → link book #${bookId} → author #${authorId}`)
  if (APPLY) {
    const { error } = await db.from('book_authors').insert({ book_id: bookId, author_id: authorId, role: 'author' })
    if (error) throw new Error(`link #${bookId}→#${authorId}: ${error.message}`)
  }
}

async function renameBook(bookId: number, title: string) {
  const slug = slugify(title)
  // guard against slug collision with a different book
  const { data: clash } = await db.from('books').select('id').eq('slug', slug).neq('id', bookId)
  if (clash && clash.length) throw new Error(`slug "${slug}" already used by book #${clash[0].id}`)
  console.log(`   → rename book #${bookId} → "${title}"  (slug: ${slug})`)
  if (APPLY) {
    const { error } = await db.from('books').update({ title, slug }).eq('id', bookId)
    if (error) throw new Error(`rename #${bookId}: ${error.message}`)
  }
}

async function removeBook(bookId: number) {
  const { data: book } = await db.from('books').select('slug, title').eq('id', bookId).single()
  const { data: bans } = await db.from('bans').select('id').eq('book_id', bookId)
  const banIds = (bans ?? []).map((b) => b.id)
  console.log(`   → REMOVE book #${bookId} "${book?.title}" (slug ${book?.slug}); bans=[${banIds.join(',')}]`)
  if (APPLY) {
    if (banIds.length) {
      const { error: e1 } = await db.from('ban_source_links').delete().in('ban_id', banIds)
      if (e1) throw new Error(`del ban_source_links book #${bookId}: ${e1.message}`)
      const { error: e2 } = await db.from('bans').delete().eq('book_id', bookId)
      if (e2) throw new Error(`del bans book #${bookId}: ${e2.message}`)
    }
    const { error: e3 } = await db.from('book_authors').delete().eq('book_id', bookId)
    if (e3) throw new Error(`del book_authors book #${bookId}: ${e3.message}`)
    const { error: e4 } = await db.from('books').delete().eq('id', bookId)
    if (e4) throw new Error(`del book #${bookId}: ${e4.message}`)
  }
}

async function main() {
  console.log(`=== _fix_orphan_author_books ${APPLY ? '(APPLY)' : '(dry-run)'} ===\n`)

  console.log('RENAME (repair PDF column-break titles):')
  for (const [id, title] of RENAME) await renameBook(id, title)

  console.log('\nLINK person author:')
  for (const [bookId, authorId] of LINK_PERSON) await linkAuthor(bookId, authorId)

  console.log('\nLINK "Various Authors" (#455):')
  for (const id of LINK_VARIOUS) await linkAuthor(id, VARIOUS)

  console.log('\nLINK "Anonymous" (#33):')
  for (const id of LINK_ANON) await linkAuthor(id, ANONYMOUS)

  console.log('\nREMOVE junk / out-of-scope:')
  for (const id of REMOVE) await removeBook(id)

  const touched = RENAME.length // titles
  const links = LINK_PERSON.length + LINK_VARIOUS.length + LINK_ANON.length
  console.log(`\n— ${links} author links, ${touched} title repairs, ${REMOVE.length} removals.`)
  console.log(APPLY ? 'WROTE changes.' : 'Dry-run only. Re-run with --apply to write.')
}

main().catch((e) => { console.error(e); process.exit(1) })
