#!/usr/bin/env tsx
/**
 * ONE-OFF — books-only cleanup of older Russia FSEM rows, after the full-list
 * import of 2026-11-09 (scripts/import-russia-fsem-full.ts).
 *
 * The full labelling of the official minjust export showed 40 older FSEM bans
 * (batch 1 / Wikipedia batch / deltas) whose list entry is not a book. Each was
 * re-read against the entry text in
 * data/source-research/russia-fsem-export-2026-11-09.csv:
 *
 *  A. DELETE_BOOKS — the work is out of scope (brochure, leaflet, magazine or
 *     journal issue, image, video, disc, internet text) or the entry is about
 *     something else than the linked book (#1170 is nine audio cassettes of
 *     Hubbard lectures, not "What is Scientology?"; #5027 is one image printed
 *     in a book). Guard: the book must carry exactly one ban, the expected one;
 *     otherwise only that ban is deleted. FK cascade removes bans, links, authors.
 *
 *  B. PLATONOV — five English rows from the Wikipedia batch (#16492–16496) cite
 *     FSEM #5076–5080, which minjust now lists as "Исключен", with a 2007 ban
 *     year. Oleg Platonov's books are really entries #5347–5351 (listed 2023)
 *     and already exist as Cyrillic rows #14358–14362 with correct bans. The
 *     English rows are empty duplicates: their slug becomes an alias of the
 *     Cyrillic row (old URLs 308), their title goes to title_english_meaningful,
 *     then they are deleted with their wrong ban. The genitive author
 *     "Платонова О.А" (#9642) folds into "Oleg Platonov" (#11789) + slug alias.
 *
 *  KEPT on purpose (real books, or decided case by case): #16468 Myth of the
 *  Twentieth Century (#2532 is a vol. 1 edition), #14343 Plokhy (#5447 is the
 *  book's translated text), #17094 «Настольная книга мусульманина» (#3222),
 *  #17346 Branham (#5069, 69 pp.), #23466 (#5503, hand-curated 2026-08-25).
 *
 * Writes a full backup to data/fsem-nonbooks-deleted-2026-11-09.json first.
 * One transaction under --apply.
 *
 *   pnpm tsx --env-file=.env.local scripts/_cleanup_fsem_nonbooks_2026_11_09.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_cleanup_fsem_nonbooks_2026_11_09.ts --apply
 */
import { writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const BACKUP = 'data/fsem-nonbooks-deleted-2026-11-09.json'

// book_id → [FSEM entry, what the entry really is]
const DELETE_BOOKS: Record<number, [number, string]> = {
  17308: [295, 'brochure text (16 A5 pages) posted online'],
  17307: [309, 'brochure'],
  17306: [310, 'brochure'],
  17270: [854, 'brochure'],
  17269: [858, 'brochure'],
  17267: [869, 'brochure'],
  17266: [874, 'brochure'],
  17265: [875, 'brochure'],
  17264: [876, 'brochure'],
  17263: [877, 'brochure'],
  17262: [878, 'brochure'],
  17261: [880, 'magazine issue (Al-Wa\'ie No. 266)'],
  17243: [1094, 'brochure'],
  16501: [1170, '9 audio cassettes + course book of Hubbard lectures — not "What is Scientology?"'],
  16476: [1204, 'brochure (Wagner essay)'],
  16481: [1494, 'brochure (Dal\' memorandum)'],
  16469: [2000, 'brochure (Feder pamphlet)'],
  17093: [3278, 'booklet, issue No. 5'],
  17092: [3286, 'brochure'],
  17091: [3305, 'images / photographed notice'],
  17078: [3440, 'image on VKontakte'],
  17420: [4092, 'image'],
  17419: [4093, 'image'],
  17404: [4298, 'printed disc'],
  17398: [4457, 'internet texts'],
  17356: [4968, 'video'],
  17351: [5027, 'one image on p. 153 of a book — the book itself is not listed'],
  14370: [5267, 'text post'],
  14365: [5335, 'scholarly journal issue (2016/5-6)'],
  14353: [5407, 'brochure'],
}

// English duplicate → Cyrillic keeper (Oleg Platonov)
const PLATONOV: [number, number][] = [
  [16492, 14362], // Russia and the World Evil → Россия и мировое зло (#5347)
  [16493, 14361], // Ritual Murders → Ритуальные убийства (#5348)
  [16494, 14360], // Crown of Thorns of Russia → Терновый венец России (#5349)
  [16495, 14359], // The Mystery of Lawlessness → Тайна беззакония (#5350)
  [16496, 14358], // Judaism and Freemasonry → Иудаизм и масонство (#5351)
]
const AUTHOR_DROP = 9642 // Платонова О.А (genitive)
const AUTHOR_KEEP = 11789 // Oleg Platonov

const CURATED_BOOK_TABLES = [
  'bbw_featured_selections', 'reading_club_classics', 'reading_club_currently_challenged',
  'reading_club_international', 'reading_club_theme_books', 'reading_club_young_readers',
]

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── _cleanup_fsem_nonbooks_2026_11_09 ── ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  const count = async () => (await pg.query(
    `select (select count(*) from books)::int books, (select count(*) from bans where country_code='RU')::int ru_bans,
            (select count(distinct book_id) from bans where country_code='RU')::int ru_books`)).rows[0]
  const before = await count()
  console.log(`  BEFORE: books=${before.books} RU bans=${before.ru_bans} RU books=${before.ru_books}`)

  const allIds = [...Object.keys(DELETE_BOOKS).map(Number), ...PLATONOV.map(([d]) => d)]
  for (const t of CURATED_BOOK_TABLES) {
    const hit = (await pg.query(`select book_id from ${t} where book_id = any($1)`, [allIds]).catch(() => ({ rows: [] }))).rows
    if (hit.length) throw new Error(`curated table ${t} holds ${hit.map((h: { book_id: number }) => h.book_id).join(',')} — aborting`)
  }

  // bigint columns come back as strings from pg
  const books = (await pg.query(`select * from books where id = any($1)`, [allIds])).rows.map((b) => ({ ...b, id: Number(b.id) }))
  const bans = (await pg.query(`select * from bans where book_id = any($1)`, [allIds])).rows.map((b) => ({ ...b, id: Number(b.id), book_id: Number(b.book_id) }))
  const authors = (await pg.query(`select * from book_authors where book_id = any($1)`, [allIds])).rows
  writeFileSync(BACKUP, `${JSON.stringify({ books, bans, book_authors: authors }, null, 2)}\n`)
  console.log(`  backup → ${BACKUP} (${books.length} books, ${bans.length} bans)`)

  let booksDeleted = 0
  let bansOnlyDeleted = 0
  try {
    if (APPLY) await pg.query('begin')

    for (const [idStr, [entry, what]] of Object.entries(DELETE_BOOKS)) {
      const id = Number(idStr)
      const own = bans.filter((b) => b.book_id === id)
      const fsem = own.filter((b) => new RegExp(`(#|No\\.?\\s*)${entry}\\b`).test(b.description ?? ''))
      const book = books.find((b) => b.id === id)
      if (!book) { console.log(`  gone   #${id}`); continue }
      if (fsem.length !== 1) throw new Error(`#${id}: expected one ban citing FSEM #${entry}, found ${fsem.length} — aborting`)
      if (own.length === 1) {
        console.log(`  DELETE book #${id} "${book.title.slice(0, 60)}" — FSEM #${entry}: ${what}`)
        if (APPLY) await pg.query(`delete from books where id=$1`, [id])
        booksDeleted++
      } else {
        console.log(`  DELETE ban ${fsem[0].id} only on #${id} "${book.title.slice(0, 60)}" (book has ${own.length} bans) — FSEM #${entry}`)
        if (APPLY) await pg.query(`delete from bans where id=$1`, [fsem[0].id])
        bansOnlyDeleted++
      }
    }

    for (const [dropId, keepId] of PLATONOV) {
      const drop = books.find((b) => b.id === dropId)
      if (!drop) { console.log(`  gone   #${dropId}`); continue }
      const own = bans.filter((b) => b.book_id === dropId)
      if (own.length !== 1 || !/FSEM \(#50(7[6-9]|80)\)/.test(own[0].description ?? '')) throw new Error(`#${dropId}: unexpected bans — aborting`)
      const keep = (await pg.query(`select id, title from books where id=$1`, [keepId])).rows[0]
      if (!keep) throw new Error(`keeper #${keepId} missing — aborting`)
      console.log(`  MERGE  #${dropId} "${drop.title}" → #${keepId} "${keep.title}" (alias ${drop.slug}, drop wrong ban ${own[0].id})`)
      if (APPLY) {
        await pg.query(`update book_slug_aliases set book_id=$1 where book_id=$2`, [keepId, dropId])
        await pg.query(`update books set title_english_meaningful=coalesce(title_english_meaningful,$1) where id=$2`, [drop.title, keepId])
        await pg.query(`delete from books where id=$1`, [dropId])
        await pg.query(`insert into book_slug_aliases(slug, book_id, source) values($1,$2,'merge') on conflict(slug) do nothing`, [drop.slug, keepId])
      }
    }

    const a = (await pg.query(`select id, slug, display_name from authors where id = any($1)`, [[AUTHOR_DROP, AUTHOR_KEEP]])).rows
    const ad = a.find((x: { id: string }) => Number(x.id) === AUTHOR_DROP)
    if (ad) {
      if (!a.find((x: { id: string }) => Number(x.id) === AUTHOR_KEEP)) throw new Error('author keeper missing — aborting')
      console.log(`  MERGE  author #${AUTHOR_DROP} "${ad.display_name}" → #${AUTHOR_KEEP} (alias ${ad.slug})`)
      if (APPLY) {
        await pg.query(
          `insert into book_authors(book_id, author_id) select book_id, $1 from book_authors where author_id=$2 on conflict do nothing`,
          [AUTHOR_KEEP, AUTHOR_DROP])
        await pg.query(`update author_slug_aliases set author_id=$1 where author_id=$2`, [AUTHOR_KEEP, AUTHOR_DROP])
        await pg.query(`delete from authors where id=$1`, [AUTHOR_DROP])
        await pg.query(`insert into author_slug_aliases(slug, author_id, source) values($1,$2,'merge') on conflict(slug) do nothing`, [ad.slug, AUTHOR_KEEP])
      }
    }

    if (APPLY) await pg.query('commit')
  } catch (e) {
    if (APPLY) await pg.query('rollback').catch(() => {})
    throw e
  }

  const after = await count()
  console.log(`\n  books deleted: ${booksDeleted} · bans-only deleted: ${bansOnlyDeleted} · Platonov merges: ${PLATONOV.length}`)
  console.log(`  ${APPLY ? 'AFTER' : 'unchanged (dry-run)'}: books=${after.books} (${after.books - before.books}) RU bans=${after.ru_bans} (${after.ru_bans - before.ru_bans}) RU books=${after.ru_books} (${after.ru_books - before.ru_books})`)
  await pg.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
