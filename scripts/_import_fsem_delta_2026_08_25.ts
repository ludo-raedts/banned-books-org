#!/usr/bin/env tsx
/**
 * Russia — FSEM (Федеральный список экстремистских материалов) delta, 2026-08-25.
 *
 * WHY: /source-watch found the minjust list grown from entry #5499 (our snapshot
 * in data/russia-minjust-batch1.json, fetched 2026-05-28) to #5509. Of the ten
 * new entries #5500–5509, eight are audio recordings / music compositions and
 * fall outside the books-only scope gate (src/lib/imports/extraction-prompt.ts).
 * Two are publications and are imported here.
 *
 * This is a 3-row delta, not a batch: too small for the full §1 stage-0 route,
 * so it is a thin reader with the rows inline, feeding the shared commit-lib
 * (commitParsedRow / commitNewBanForBook) — never a bespoke INSERT.
 *
 * IN SCOPE (transcribed from https://minjust.gov.ru/ru/extremist-materials/?page=55,
 * read 2026-08-25):
 *   #5503  брошюра «Последний набор людей к Иегове. Из всех сатанинских вер и
 *          народов» — Tomsk Oblast Court 2026-04-30, listed 2026-07-10.
 *          NEW book. Brochure: consistent with the 20 брошюра entries already
 *          imported in batch 1 for this source (364 книга / 56 печатное издание /
 *          20 брошюра / 19 информационный материал / 0 audio).
 *   #5509  книга «Правильный путь понимания единобожия», Мухаммад ибн Хусейн
 *          аль-Кахтани, изд. Хикма 2021, 384 с., ISBN 978-5-6044661-4-8 —
 *          Saratov Oblast Court 2026-05-29, listed 2026-08-14.
 *          BAN-ONLY: the work is already book #17105, carrying FSEM #2858 (the
 *          Мир 2009 edition, ban year 2020). A different edition of the same
 *          work gets a ban row, not a second book.
 *
 * OUT OF SCOPE, deliberately skipped (audio/music): #5500 #5501 #5502 #5504
 * #5505 #5506 #5507 #5508.
 *
 * Conventions inherited from import-russia-bans.ts / batch 1:
 *   - ban year = the year of the FSEM *inclusion* date, not the court decision.
 *   - first_published_year only when the source states it (PT rule).
 *   - Cyrillic titles slugify to '' — supply title_transliterated so
 *     pickSlugSource lands on the transliteration (cf. #17105's slug).
 *   - minjust rows carry an editor-review flag in the ban description.
 *   - Anonymous works attach to the existing "Anonymous" author (id 33).
 *
 *   pnpm tsx --env-file=.env.local scripts/_import_fsem_delta_2026_08_25.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_import_fsem_delta_2026_08_25.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { matchExistingBook } from '../src/lib/imports/verifier'
import {
  commitParsedRow,
  commitNewBanForBook,
  type CommitInput,
  type AddBanInput,
} from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'

const APPLY = isApply()

const SOURCE_URL = 'https://minjust.gov.ru/ru/extremist-materials/'
const SOURCE_NAME = 'Russian Ministry of Justice — Federal List of Extremist Materials'
const SOURCE_TYPE = 'government'
const EDITOR_FLAG =
  '[Editor review needed — transcribed from the Минюст list, bibliographic fields may be incomplete.]'

/** A new book + its FSEM ban. */
type NewBookRow = {
  entry: number
  title: string
  title_transliterated: string
  title_english_meaningful: string
  authors: string[]
  first_published_year: number | null
  year: number
  reason_slug: string
  description_ban: string
  inclusion_rationale: string
}

/** A ban on a book we already carry (different edition of the same work). */
type BanOnlyRow = {
  entry: number
  book_id: number
  expect_title: string
  year: number
  reason_slug: string
  description_ban: string
}

const NEW_BOOKS: NewBookRow[] = [
  {
    entry: 5503,
    title: 'Последний набор людей к Иегове. Из всех сатанинских вер и народов',
    title_transliterated: 'Posledniy nabor lyudey k Iegove. Iz vsekh sataninskikh ver i narodov',
    title_english_meaningful:
      'The Last Gathering of People to Jehovah. Out of All Satanic Faiths and Peoples',
    authors: ['Anonymous'],
    first_published_year: null,
    year: 2026,
    reason_slug: 'religious',
    description_ban:
      'Listed on Russia’s Federal List of Extremist Materials (Минюст) as entry #5503, ' +
      'a brochure also circulated online. Court decision: решение Томского областного суда от 30.04.2026. ' +
      `Added to list: 2026-07-10. ${EDITOR_FLAG}`,
    inclusion_rationale:
      'Entry #5503 on the Russian Ministry of Justice Federal List of Extremist Materials — ' +
      'a religious brochure banned nationwide by court order; distribution is a criminal offence.',
  },
]

const BAN_ONLY: BanOnlyRow[] = [
  {
    entry: 5509,
    book_id: 17105,
    expect_title: 'Правильный путь понимания единобожия',
    year: 2026,
    reason_slug: 'religious',
    description_ban:
      'Listed on Russia’s Federal List of Extremist Materials (Минюст) as entry #5509, ' +
      'in the Хикма 2021 edition (384 pp., ISBN 978-5-6044661-4-8) by Мухаммад ибн Хусейн аль-Кахтани, ' +
      'with commentary by Салих ибн Абд аль-Азиз Аль аш-Шейх. ' +
      'Court decision: решение Саратовского областного суда от 29.05.2026. ' +
      `Added to list: 2026-08-14. ${EDITOR_FLAG}`,
  },
]

const SKIPPED_AUDIO = [5500, 5501, 5502, 5504, 5505, 5506, 5507, 5508]

async function main() {
  console.log(`\n── _import_fsem_delta_2026_08_25 ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`)
  console.log(`  new FSEM entries since #5499: ${NEW_BOOKS.length + BAN_ONLY.length + SKIPPED_AUDIO.length}`)
  console.log(`  out of scope (audio/music), skipped: ${SKIPPED_AUDIO.join(', ')}\n`)

  const pg: Client = newPgClient()
  await pg.connect()

  let created = 0
  let attached = 0
  let skipped = 0

  try {
    if (APPLY) await pg.query('begin')

    // --- ban-only rows: assert the target book, then attach ---
    for (const r of BAN_ONLY) {
      const book = (await pg.query(`select id, title from books where id=$1`, [r.book_id])).rows[0]
      if (!book) throw new Error(`FSEM #${r.entry}: book #${r.book_id} not found — aborting`)
      if (book.title !== r.expect_title) {
        throw new Error(
          `FSEM #${r.entry}: book #${r.book_id} title drift — expected "${r.expect_title}", got "${book.title}" — aborting`,
        )
      }
      const dupe = (await pg.query(
        `select id from bans where book_id=$1 and country_code='RU' and year_started=$2 and scope_id=4 limit 1`,
        [r.book_id, r.year],
      )).rows[0]
      if (dupe) {
        skipped++
        console.log(`  SKIP   #${r.entry} → book #${r.book_id} already has a ${r.year} RU government ban (${dupe.id})`)
        continue
      }
      console.log(`  ATTACH #${r.entry} → existing book #${r.book_id} "${book.title}" [${r.year}]`)
      if (APPLY) {
        const add: AddBanInput = {
          book_id: r.book_id,
          country_code: 'RU',
          scope_slug: 'government',
          action_type: 'banned',
          ban_status: 'active',
          year: r.year,
          reason_slug: r.reason_slug,
          description_ban: r.description_ban,
          source_url: SOURCE_URL,
          source_name: SOURCE_NAME,
          source_type: SOURCE_TYPE,
        }
        await commitNewBanForBook(add, pg)
      }
      attached++
    }

    // --- new books: match-before-create is mandatory ---
    for (const r of NEW_BOOKS) {
      const hit = await matchExistingBook({
        title: r.title,
        englishTitle: r.title_english_meaningful,
      })
      if (hit) {
        skipped++
        const existing = (await pg.query(`select title from books where id=$1`, [hit.id])).rows[0]
        console.log(
          `  HELD   #${r.entry} "${r.title}" — matchExistingBook returned #${hit.id} ` +
            `"${existing?.title ?? '?'}" (${hit.status}, confidence ${hit.confidence ?? 'n/a'}). ` +
            'Not creating; resolve by hand (attach vs. create).',
        )
        continue
      }
      console.log(`  CREATE #${r.entry} "${r.title}" → slug from translit "${r.title_transliterated}" [${r.year}]`)
      if (APPLY) {
        const input: CommitInput = {
          title: r.title,
          title_native: r.title,
          title_transliterated: r.title_transliterated,
          title_english_meaningful: r.title_english_meaningful,
          original_language: 'ru',
          authors: r.authors,
          year: r.year,
          first_published_year: r.first_published_year,
          country_code: 'RU',
          scope_slug: 'government',
          action_type: 'banned',
          ban_status: 'active',
          reason_slug: r.reason_slug,
          description_ban: r.description_ban,
          inclusion_rationale: r.inclusion_rationale,
          source_url: SOURCE_URL,
          source_name: SOURCE_NAME,
          source_type: SOURCE_TYPE,
        }
        await commitParsedRow(input, pg)
      }
      created++
    }

    if (APPLY) {
      await pg.query('commit')
      console.log('\n  Applied (single transaction).')
    }
  } catch (err) {
    if (APPLY) {
      try {
        await pg.query('rollback')
        console.error('  Rolled back.')
      } catch {
        /* ignore */
      }
    }
    throw err
  } finally {
    await pg.end()
  }

  console.log(`\n  ── ${APPLY ? 'DONE' : 'DRY-RUN'} ──`)
  console.log(`  ${APPLY ? 'books created' : 'would-create books'} : ${created}`)
  console.log(`  ${APPLY ? 'bans attached' : 'would-attach bans'} : ${attached}`)
  console.log(`  skipped/held                                     : ${skipped}`)
  console.log(`  audio/music left out of scope                    : ${SKIPPED_AUDIO.length}\n`)
  if (!APPLY) console.log('  DRY-RUN — nothing written. Re-run with --apply to write.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
