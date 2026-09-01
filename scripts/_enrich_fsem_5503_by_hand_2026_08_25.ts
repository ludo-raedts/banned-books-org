#!/usr/bin/env tsx
/**
 * Hand-enrichment of book #23466 — «Последний набор людей к Иегове. Из всех
 * сатанинских вер и народов» (FSEM entry #5503, imported 2026-08-25).
 *
 * WHY BY HAND: one row. A full enrich-all sweep for a single obscure Russian
 * brochure is disproportionate, and the automatic description pipelines have no
 * grounding to work from here — no ISBN, no OpenLibrary/Google Books record, no
 * Wikipedia article. Ungrounded LLM description generation on rows like this is
 * exactly what produced the 2026-05-28 confabulation cleanup, so the text below
 * is written from two cited sources and stamped description_source_type='manual'
 * (the v2 pipeline only targets description_book IS NULL, so it will not be
 * overwritten).
 *
 * GROUNDING — two independent sources, both read 2026-08-25:
 *   1. Минюст, Федеральный список экстремистских материалов, entry #5503:
 *      https://minjust.gov.ru/ru/extremist-materials/ (page 55)
 *      → title, "also circulated online", решение Томского областного суда от
 *        30.04.2026, inclusion date 10 July 2026. No author, publisher, ISBN or
 *        year of publication is given.
 *   2. SOVA Center, "Еще одна брошюра еговистов-ильинцев внесена в список
 *      экстремистских материалов":
 *      https://www.sova-center.ru/misuse/news/persecution/2026/07/d54132/
 *      → the brochure belongs to the еговисты-ильинцы (Yehovists-Ilyinites), a
 *        movement that arose in the 1840s in the Urals around Nikolai Ilyin,
 *        drawing on elements of Jewish and Christian tradition; AND that the
 *        text of the ruling was never published, so the grounds are not
 *        publicly known (SOVA only speculates about religious-superiority
 *        propaganda — recorded here as speculation, not as fact).
 *
 * NOTE — NOT Jehovah's Witnesses. "Еговисты-ильинцы" (Yehovists-Ilyinites) is a
 * separate 19th-century Russian movement, unrelated to Свидетели Иеговы, whose
 * literature dominates the religious entries on this list. A web-search summary
 * asserted the Jehovah's-Witnesses attribution; the SOVA headline contradicts
 * it. Do not "correct" this back.
 *
 * COVER: left NULL deliberately. No cover image for this brochure exists on any
 * host in ALLOWED_IMAGE_HOSTS, and attaching a look-alike would be exactly the
 * namesake/placeholder failure the cover audits exist to catch.
 *
 *   pnpm tsx --env-file=.env.local scripts/_enrich_fsem_5503_by_hand_2026_08_25.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_enrich_fsem_5503_by_hand_2026_08_25.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const BOOK_ID = 23466
const BAN_ID = 40638
const EXPECT_TITLE = 'Последний набор людей к Иегове. Из всех сатанинских вер и народов'

const SOVA_URL = 'https://www.sova-center.ru/misuse/news/persecution/2026/07/d54132/'
const SOVA_NAME =
  'SOVA Center for Information and Analysis — "Еще одна брошюра еговистов-ильинцев внесена в список экстремистских материалов"'

const DESCRIPTION_BOOK =
  'A short religious tract of the Yehovists-Ilyinites (еговисты-ильинцы), a movement that ' +
  'emerged in the Urals in the 1840s around the preacher Nikolai Ilyin and drew on elements of ' +
  'both Jewish and Christian tradition — a group distinct from the Jehovah’s Witnesses, whose ' +
  'literature makes up most of the religious entries on Russia’s extremist-materials list. The ' +
  'title announces a final calling-out of believers to Jehovah from every other faith, which it ' +
  'casts as satanic. Nothing further is recorded about the edition: the federal list that carries ' +
  'the brochure names no author, publisher, ISBN or year of publication, and notes only that it ' +
  'circulates in print and online. A Russian court declared it extremist material in April 2026; ' +
  'the ruling was never published, so the grounds are not publicly known.'

const DESCRIPTION_BAN =
  'Listed on Russia’s Federal List of Extremist Materials (Минюст) as entry #5503 — a brochure ' +
  'of the еговисты-ильинцы (Yehovists-Ilyinites), also circulated online. Declared extremist by ' +
  'решение Томского областного суда от 30.04.2026 and added to the list on 2026-07-10. The text of ' +
  'the ruling was not published, so the specific grounds are not publicly known; the SOVA Center ' +
  'notes the likely basis was the assertion of one religion’s superiority over others. ' +
  'Producing, storing or distributing material on the federal list is an offence in Russia.'

async function main() {
  console.log(`\n── _enrich_fsem_5503_by_hand ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`)

  const pg: Client = newPgClient()
  await pg.connect()

  try {
    if (APPLY) await pg.query('begin')

    // Guard: the row must still be the one this script was written for.
    const book = (await pg.query(
      `select id, title, description_book, title_native_script, cover_url from books where id=$1`,
      [BOOK_ID],
    )).rows[0]
    if (!book) throw new Error(`book #${BOOK_ID} not found — aborting`)
    if (book.title !== EXPECT_TITLE) {
      throw new Error(`book #${BOOK_ID} title drift — expected "${EXPECT_TITLE}", got "${book.title}" — aborting`)
    }
    if (book.description_book) {
      console.log(`  book #${BOOK_ID} already has a description — leaving it alone:`)
      console.log(`    "${String(book.description_book).slice(0, 120)}…"`)
    } else {
      console.log(`  SET  description_book (${DESCRIPTION_BOOK.length} chars), source_type='manual', source_url=SOVA`)
      console.log(`  SET  title_native_script = 'cyrillic' (was ${JSON.stringify(book.title_native_script)})`)
      if (APPLY) {
        await pg.query(
          `update books
             set description_book = $2,
                 description_source_url = $3,
                 description_source_type = 'manual',
                 title_native_script = 'cyrillic',
                 updated_at = now()
           where id = $1`,
          [BOOK_ID, DESCRIPTION_BOOK, SOVA_URL],
        )
      }
    }
    console.log(`  cover_url stays ${JSON.stringify(book.cover_url)} — no allowlisted image exists for this brochure`)

    // Ban description: replace the transcription placeholder + editor flag with
    // the sourced version, and raise confidence now that a second, independent
    // source corroborates the listing.
    const ban = (await pg.query(`select id, book_id, description, confidence from bans where id=$1`, [BAN_ID])).rows[0]
    if (!ban) throw new Error(`ban #${BAN_ID} not found — aborting`)
    // node-postgres returns int8 as a string — compare numerically.
    if (Number(ban.book_id) !== BOOK_ID) {
      throw new Error(`ban #${BAN_ID} points at book #${ban.book_id}, not #${BOOK_ID} — aborting`)
    }
    console.log(`  SET  ban #${BAN_ID} description (${DESCRIPTION_BAN.length} chars), drops the editor-review flag`)
    console.log(`  SET  ban #${BAN_ID} confidence '${ban.confidence}' → 'verified' (two independent sources)`)
    if (APPLY) {
      await pg.query(`update bans set description = $2, confidence = 'verified' where id = $1`, [BAN_ID, DESCRIPTION_BAN])
    }

    // Second citation: SOVA alongside the Минюст list itself. Read-only in
    // dry-run — the upsert must never fire outside --apply.
    if (APPLY) {
      const src = (await pg.query(
        `insert into ban_sources (source_name, source_url, source_type, verification_status, accessed_at)
         values ($1, $2, 'ngo', 'verified', now())
         on conflict (source_url) do update
           set source_name = excluded.source_name, accessed_at = now()
         returning id`,
        [SOVA_NAME, SOVA_URL],
      )).rows[0]
      await pg.query(
        `insert into ban_source_links (ban_id, source_id) values ($1, $2) on conflict do nothing`,
        [BAN_ID, src.id],
      )
      console.log(`  LINK ban #${BAN_ID} → ban_sources #${src.id} (SOVA Center)`)
    } else {
      const existing = (await pg.query(`select id from ban_sources where source_url = $1`, [SOVA_URL])).rows[0]
      console.log(
        `  LINK ban #${BAN_ID} → SOVA Center source ` +
          `(${existing ? `would reuse ban_sources #${existing.id}` : 'would insert a new ban_sources row'})`,
      )
    }

    if (APPLY) {
      await pg.query('commit')
      console.log('\n  Applied (single transaction).\n')
    } else {
      console.log('\n  DRY-RUN — nothing written. Re-run with --apply.\n')
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
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
