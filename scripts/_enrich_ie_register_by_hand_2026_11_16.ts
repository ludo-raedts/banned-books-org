#!/usr/bin/env tsx
/**
 * Hand-enrichment of the Irish Register of Prohibited Publications rows added
 * 2026-11-16 (#33477 Book of Love, #33478 The Love Diseases, #33479 The Complete
 * Guide to Sex) + attaches the missing IE ban to #7274 Make it Happy.
 *
 * WHY BY HAND: four rows, no ISBN/OL record to ground on, so the automatic
 * description pipelines have nothing to work from (ungrounded generation =
 * the 2026-05-28 confabulation class). Texts are written from the cited
 * sources and stamped description_source_type='manual'.
 *
 * GROUNDING (search-result excerpts read 2026-11-16, not full-page reads):
 *   - Register of Prohibited Publications (correct to 31 Dec 2016), gov.ie —
 *     title/author/publisher/Iris Oifigiúil date; Part II = "indecent or obscene
 *     and/or advocating abortion"; ground per book NOT stated.
 *   - Abortion Rights Campaign, "Day 4: 8 Censored Books" — Book of Love blurb.
 *   - The Spectator, 17 Nov 1979 "Low Life" — The Love Diseases (subtitle, STDs).
 *   - TheJournal.ie (May 2012) / Joe.ie — books banned since early 1980s.
 *
 * DELIBERATELY NOT SET: covers (no allowlisted image), first_published_year
 * (Book of Love 1974 is attested only for a differently titled edition; Love
 * Diseases ≤1979 from a review date), description_book for #33479 (no author,
 * no edition info anywhere — nothing to ground on).
 *
 *   pnpm tsx --env-file=.env.local scripts/_enrich_ie_register_by_hand_2026_11_16.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_enrich_ie_register_by_hand_2026_11_16.ts --apply
 */
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook } from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'

const APPLY = isApply()
const REGISTER_URL = 'https://assets.gov.ie/static/documents/register-of-prohibited-publications-2016-pdf-135kb.pdf'
const REGISTER_NAME =
  'Irish Censorship of Publications Board — Register of Prohibited Publications (correct to 31 Dec 2016), Department of Justice'

const BAN_NOTE_TAIL =
  ' The Register lists it in Part II (books banned as indecent or obscene and/or for advocating abortion) and does not ' +
  'state which ground applied to this title; press and campaign accounts link the surviving sex-guide bans to the ' +
  'abortion-information provisions. Part II bans do not lapse after 12 years, so it was still in force on 31 December 2016.'

interface Item {
  id: number
  expectTitle: string
  description_book: string | null
  source_url: string | null
  ban_description: string
}

const ITEMS: Item[] = [
  {
    id: 33477,
    expectTitle: 'Book of Love',
    description_book:
      'A popular guide to sex and relationships by the British doctor David Delvin, covering safe sex, family planning ' +
      'and sexually transmitted infections. It was placed on the Irish Register of Prohibited Publications in December 1983; ' +
      'the edition named in the Register is the New English Library paperback, banned in all editions.',
    source_url: 'https://abortionrightscampaign.ie/day-4-8-censored-books-8-days-to-repeal-the-8th',
    ban_description:
      'Prohibited by the Irish Censorship of Publications Board (Dr David Delvin, The New English Library; all editions), ' +
      'order published in the Iris Oifigiúil on 16 December 1983.' + BAN_NOTE_TAIL,
  },
  {
    id: 33478,
    expectTitle: 'The Love Diseases',
    description_book:
      'A guide to sexually transmitted diseases by Paul Redfern, subtitled “A Guide to Some of the Complications of Love and ' +
      'Sex”. It was reviewed in The Spectator in 1979 as a book that treats the subject plainly. The Macmillan edition was ' +
      'placed on the Irish Register of Prohibited Publications in September 1983 and banned in all editions.',
    source_url: 'https://archive.spectator.co.uk/article/17th-november-1979/31/low-life',
    ban_description:
      'Prohibited by the Irish Censorship of Publications Board (Paul Redfern, The Macmillan Press; all editions), order ' +
      'published in the Iris Oifigiúil on 30 September 1983.' + BAN_NOTE_TAIL,
  },
  {
    id: 33479,
    expectTitle: 'The Complete Guide to Sex',
    description_book: null,
    source_url: null,
    ban_description:
      'Prohibited by the Irish Censorship of Publications Board, order published in the Iris Oifigiúil on 27 July 1990. ' +
      'The Register gives no author, publisher or edition for this title (hence the placeholder author), so the book ' +
      'cannot be identified further; one campaign write-up speculates it may be a shortened reference to David Delvin’s ' +
      '“The Complete Guide to Sex and Loving”, which is unconfirmed.' + BAN_NOTE_TAIL,
  },
]

async function main() {
  console.log(`\n── _enrich_ie_register_by_hand ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'}`)
  const pg: Client = newPgClient()
  await pg.connect()
  try {
    if (APPLY) await pg.query('begin')

    // 1. Missing IE ban on #7274 Make it Happy (same book: Jane Cousins, Penguin)
    const mih = (await pg.query(`select id, title from books where id = 7274`)).rows[0]
    if (!mih || !/^Make it Happy/i.test(mih.title)) throw new Error('book #7274 drift — aborting')
    const hasIe = (await pg.query(`select 1 from bans where book_id=7274 and country_code='IE'`)).rows.length > 0
    if (hasIe) console.log('  #7274 already has an IE ban — skipping attach')
    else {
      console.log('  ATTACH IE ban 1983 (active) → #7274 Make it Happy: What Sex is all About')
      if (APPLY) {
        await commitNewBanForBook(
          {
            book_id: 7274,
            country_code: 'IE',
            scope_slug: 'government',
            action_type: 'banned',
            ban_status: 'active',
            year: 1983,
            reason_slug: 'obscenity',
            description_ban:
              'Prohibited by the Irish Censorship of Publications Board (Jane Cousins, Penguin Books; all editions), order ' +
              'published in the Iris Oifigiúil on 30 September 1983.' + BAN_NOTE_TAIL,
            source_url: REGISTER_URL,
            source_name: REGISTER_NAME,
            source_type: 'government',
          },
          pg,
        )
      }
    }

    // 2. Hand enrichment of the three new rows
    for (const it of ITEMS) {
      const b = (await pg.query(`select id, title, description_book from books where id=$1`, [it.id])).rows[0]
      if (!b || b.title !== it.expectTitle) throw new Error(`book #${it.id} drift (got ${b?.title}) — aborting`)
      if (it.description_book && !b.description_book) {
        console.log(`  SET  #${it.id} description_book (${it.description_book.length} chars, manual) — ${it.source_url}`)
        if (APPLY) {
          await pg.query(
            `update books set description_book=$2, description_source_url=$3, description_source_type='manual', updated_at=now() where id=$1`,
            [it.id, it.description_book, it.source_url],
          )
        }
      } else console.log(`  #${it.id} description_book left as is (${b.description_book ? 'already set' : 'nothing groundable'})`)

      const ban = (await pg.query(`select id from bans where book_id=$1 and country_code='IE'`, [it.id])).rows[0]
      if (!ban) throw new Error(`no IE ban for #${it.id}`)
      console.log(`  SET  ban #${ban.id} description (${it.ban_description.length} chars)`)
      if (APPLY) await pg.query(`update bans set description=$2 where id=$1`, [ban.id, it.ban_description])
    }

    if (APPLY) { await pg.query('commit'); console.log('\n  Applied (single transaction).\n') }
    else console.log('\n  DRY-RUN — nothing written. Re-run with --apply.\n')
  } catch (e) {
    if (APPLY) { try { await pg.query('rollback') } catch {} }
    throw e
  } finally { await pg.end() }
}
main().catch(e => { console.error(e); process.exit(1) })
