#!/usr/bin/env tsx
/**
 * One-off: correct the degraded author names on the Liste Otto
 * "Toutes ses œuvres" blanket-works entries. Source gave initials /
 * Frenchified / misspelled names; we restore the canonical form.
 *
 *   - RENAME (13): author exists only via the blanket entry → update
 *     display_name + slug in place, and rewrite the blanket book's
 *     title/slug to match.
 *   - MERGE  (3):  a real author with the correct name already exists →
 *     re-point the blanket book to that canonical author and delete the
 *     orphan duplicate, so the blanket ban surfaces on the real page.
 *
 *   pnpm tsx --env-file=.env.local scripts/_fix_blanket_author_names.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_fix_blanket_author_names.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

// dupId → canonical author id + canonical name
const MERGES: Array<{ dupId: number; canonId: number; name: string }> = [
  { dupId: 11340, canonId: 62, name: 'Erich Maria Remarque' },
  { dupId: 10941, canonId: 4316, name: 'Lion Feuchtwanger' },
  { dupId: 11043, canonId: 483, name: 'Heinrich Heine' },
]

const RENAMES: Array<{ id: number; name: string }> = [
  { id: 11420, name: 'Arthur Schnitzler' },
  { id: 11016, name: 'Emil Julius Gumbel' },
  { id: 11112, name: 'Egon Erwin Kisch' },
  { id: 10697, name: 'Edvard Beneš' },
  { id: 10950, name: 'Friedrich Wilhelm Foerster' },
  { id: 11527, name: 'Jakob Wassermann' },
  { id: 11328, name: 'Hermann Rauschning' },
  { id: 11342, name: 'Ludwig Renn' },
  { id: 11205, name: 'Rosa Luxemburg' },
  { id: 11267, name: 'Willi Münzenberg' },
  { id: 11327, name: 'Walther Rathenau' },
  { id: 10725, name: 'Hayim Nahman Bialik' },
  { id: 11284, name: 'Ernst Erich Noth' },
]

const blanketTitle = (name: string) => `Toutes ses œuvres (${name})`

async function blanketBookFor(pg: any, authorId: number): Promise<{ id: number; title: string; slug: string } | null> {
  const r = await pg.query(
    `SELECT bk.id, bk.title, bk.slug
       FROM books bk JOIN book_authors ba ON ba.book_id = bk.id
      WHERE ba.author_id = $1 AND bk.is_blanket_works
      ORDER BY bk.id LIMIT 1`,
    [authorId],
  )
  return r.rows[0] ?? null
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    if (APPLY) await pg.query('BEGIN')

    console.log(`── fix-blanket-author-names (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

    console.log('RENAMES:')
    for (const { id, name } of RENAMES) {
      const slug = slugify(name)
      const bk = await blanketBookFor(pg, id)
      const newTitle = blanketTitle(name)
      const newBookSlug = slugify(newTitle)
      console.log(`  #${id} → "${name}" [${slug}]  book#${bk?.id} → "${newTitle}" [${newBookSlug}]`)
      if (APPLY) {
        await pg.query('UPDATE authors SET display_name=$2, slug=$3 WHERE id=$1', [id, name, slug])
        if (bk) await pg.query('UPDATE books SET title=$2, slug=$3 WHERE id=$1', [bk.id, newTitle, newBookSlug])
      }
    }

    console.log('\nMERGES:')
    for (const { dupId, canonId, name } of MERGES) {
      const bk = await blanketBookFor(pg, dupId)
      if (!bk) { console.log(`  #${dupId} → #${canonId}: no blanket book found, SKIP`); continue }
      // Guard: canonical author must not already be linked to this book.
      const dup = await pg.query(
        'SELECT 1 FROM book_authors WHERE book_id=$1 AND author_id=$2',
        [bk.id, canonId],
      )
      const newTitle = blanketTitle(name)
      const newBookSlug = slugify(newTitle)
      // Guard: dup author should have ONLY this blanket book.
      const others = await pg.query(
        'SELECT count(*)::int n FROM book_authors WHERE author_id=$1 AND book_id<>$2',
        [dupId, bk.id],
      )
      console.log(`  #${dupId} → #${canonId} "${name}": book#${bk.id} "${bk.title}" → "${newTitle}" [${newBookSlug}]` +
        ` (canon-already-linked=${dup.rowCount ? 'YES' : 'no'}, dup-other-books=${others.rows[0].n})`)
      if (APPLY) {
        if (dup.rowCount) {
          // Canonical already linked: just drop the dup link.
          await pg.query('DELETE FROM book_authors WHERE book_id=$1 AND author_id=$2', [bk.id, dupId])
        } else {
          await pg.query('UPDATE book_authors SET author_id=$3 WHERE book_id=$1 AND author_id=$2', [bk.id, dupId, canonId])
        }
        await pg.query('UPDATE books SET title=$2, slug=$3 WHERE id=$1', [bk.id, newTitle, newBookSlug])
        if (others.rows[0].n === 0) {
          await pg.query('DELETE FROM authors WHERE id=$1', [dupId])
        } else {
          console.log(`    ⚠ dup #${dupId} has other books — NOT deleting author`)
        }
      }
    }

    if (APPLY) { await pg.query('COMMIT'); console.log('\nCOMMIT ✓') }
    else console.log('\nDry-run. Re-run with --apply.')
  } catch (e) {
    if (APPLY) await pg.query('ROLLBACK')
    throw e
  } finally {
    await pg.end()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
