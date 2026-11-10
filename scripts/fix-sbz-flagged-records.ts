/**
 * Point fixes for three pre-existing records flagged during the SBZ register
 * import (2026-11-10). All three came in with the Berlin 1938 list import.
 *
 *   npx tsx --env-file=.env.local scripts/fix-sbz-flagged-records.ts           # dry-run (rolls back)
 *   npx tsx --env-file=.env.local scripts/fix-sbz-flagged-records.ts --apply
 *
 * 1. #21401 "Samtliche Schriften" (Bela Illes) is the 1938 list's "all works"
 *    entry, not a book with that title → "Béla Illés — All works",
 *    is_blanket_works, slug bela-illes-all-works (+ book_slug_aliases for the old slug).
 *    Author display name gets its diacritics (Béla Illés, 1895–1974).
 * 2. Author #13919 "Karl Salier" is an OCR misreading of Karl Saller (1902–1969),
 *    the anthropologist whose race-theory critiques the Nazis banned; the SBZ
 *    list prints "Saller". → display_name/slug karl-saller (+ author_slug_aliases).
 * 3. #21152 "Hauptmann Latour" is Karl Federn's novel (Hannover: Sponholtz, 1929;
 *    Projekt Gutenberg, FU Berlin Refubium), credited to Hubert Ernst Gilbert by
 *    the Berlin OCR row (the SBZ list and its 1948 rescission name Federn).
 *    → new author Karl Federn (1868–1943), first_published_year 1932 → 1929.
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

async function main() {
  const pg = newPgClient()
  await pg.connect()
  await pg.query('BEGIN')
  try {
    const one = async (sql: string, p: unknown[] = []) => (await pg.query(sql, p)).rows
    const show = async (label: string) =>
      console.log(
        label,
        JSON.stringify(
          await one(
            `select b.id, b.slug, b.title, b.is_blanket_works blanket, b.first_published_year fpy,
                    string_agg(a.id||':'||a.slug||':'||a.display_name, '; ') authors
               from books b left join book_authors ba on ba.book_id=b.id left join authors a on a.id=ba.author_id
              where b.id in (21401, 19685, 20490, 21152) group by b.id order by b.id`,
          ),
          null,
          1,
        ),
      )
    await show('BEFORE')

    // 1. Béla Illés — all works
    const [illes] = await one(`select slug from books where id=21401`)
    if (illes.slug === 'samtliche-schriften') {
      await one(`insert into book_slug_aliases (slug, book_id, source) values ('samtliche-schriften', 21401, 'fix-sbz-flagged-records') on conflict do nothing`)
      await one(`update books set title='Béla Illés — All works', slug='bela-illes-all-works', is_blanket_works=true where id=21401`)
      await one(`update authors set display_name='Béla Illés' where id=15635 and display_name='Bela Illes'`)
    }

    // 2. Karl Salier → Karl Saller
    const [sal] = await one(`select slug from authors where id=13919`)
    if (sal.slug === 'karl-salier') {
      const [clash] = await one(`select count(*)::int n from authors where slug='karl-saller'`)
      if (clash.n) throw new Error('karl-saller already exists — merge instead')
      await one(`insert into author_slug_aliases (slug, author_id, source) values ('karl-salier', 13919, 'fix-sbz-flagged-records') on conflict do nothing`)
      await one(`update authors set display_name='Karl Saller', slug='karl-saller', birth_year=1902, death_year=1969 where id=13919`)
    }

    // 3. Hauptmann Latour → Karl Federn
    const [lat] = await one(`select count(*)::int n from book_authors where book_id=21152 and author_id=13219`)
    if (lat.n) {
      let [fed] = await one(`select id from authors where slug='karl-federn'`)
      if (!fed) {
        ;[fed] = await one(
          `insert into authors (slug, display_name, birth_year, death_year) values ('karl-federn', 'Karl Federn', 1868, 1943) returning id`,
        )
      }
      await one(`update book_authors set author_id=$1 where book_id=21152 and author_id=13219`, [fed.id])
      await one(`update books set first_published_year=1929 where id=21152 and first_published_year=1932`)
    }

    await show('AFTER')
    await pg.query(APPLY ? 'COMMIT' : 'ROLLBACK')
    console.log(APPLY ? 'committed' : 'dry-run: rolled back (pass --apply)')
  } catch (e) {
    await pg.query('ROLLBACK')
    throw e
  } finally {
    await pg.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
