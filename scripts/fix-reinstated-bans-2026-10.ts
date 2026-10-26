/**
 * Marks documented mass reinstatements as rescinded (2026-10-26).
 *
 * PEN America and the Magnusson database record removals; they rarely follow
 * up when a district or agency puts the books back. Four batches where a
 * fetched source documents the reversal (research pass for
 * src/lib/institution-contexts.ts):
 *
 *   - U.S. Naval Academy (Nimitz Library), 2025 — 381 books pulled in April
 *     2025 on the Defense Secretary's office's DEI directive; AP (21 May 2025):
 *     "all but a few" back on the shelves. The ~20 still under review were
 *     never named (and include titles outside the original 381), so the whole
 *     batch is rescinded; the institution context says some remain under review.
 *   - Nevada Community School District (Iowa), 2023 'restricted' rows — PEN's
 *     "banned pending investigation". The district's final SF 496 list (Ames
 *     Tribune, 8 Dec 2023) has 65 titles; "many of the initial titles were then
 *     returned to circulation". Rows whose book is on the 65-title list stay
 *     active (matched by title: 65/66 'banned' rows match, 1 'restricted' does).
 *   - Clear Creek-Amana CSD (Iowa), 2024 — Des Moines Register (6 Jun 2024):
 *     "After the injunction, Clear Creek-Amana returned nearly all the removed
 *     books to the shelves."
 *   - Central York School District (Pennsylvania), 2021 — the frozen diversity
 *     resource list, unanimously reinstated by the board in September 2021
 *     (PEN America; CNN).
 *
 * For each batch: status → 'rescinded', year_ended set, and the reversal source
 * linked to the ban (ban_source_links) so the status has visible provenance.
 * Idempotent: rows already rescinded are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-reinstated-bans-2026-10.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/fix-reinstated-bans-2026-10.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const ACCESSED_AT = '2026-10-26'

type Source = { source_name: string; source_url: string; source_type: string }
type Batch = {
  label: string
  institution: string
  region: string
  yearStarted: number
  actionType?: string
  yearEnded: number
  source: Source
  /** Titles that stay active (normalised substring match on books.title). */
  keepTitles?: string[]
}

// Nevada CSD final SF 496 removal list (Ames Tribune, 8 Dec 2023), 65 titles.
const NEVADA_FINAL_LIST = [
  '1984', 'Absolutely True Diary of a Part-Time Indian', 'Across the Universe', 'Animal Farm', 'Blood & Honey',
  'Bluest Eye', 'Brave New World', 'Chocolate War', 'City of Ashes', 'Color Purple', 'Court of Frost and Starlight',
  'Court of Mist and Fury', 'Court of Wings and Ruin', 'Empire of Storms', 'Everything, Everything', 'Firefly Lane',
  'First Part Last', 'Girl In Pieces', 'Girl with the Dragon Tattoo', 'Gods & Monsters', 'Going Bovine',
  "Handmaid's Tale", 'Heart Bones', 'House of Earth and Blood', 'I Am Not Your Perfect Mexican Daughter',
  'I Know Why the Caged Bird Sings', 'Identical', 'If I Stay', 'Infinite Moment of Us', 'Introducing Teddy',
  'Isla and the Happily Ever After', 'It Ends With Us', 'It Starts With Us', 'Jack of Hearts', 'Just One Day',
  'Just One Year', 'Kingdom of Ash', 'Looking for Alaska', 'Love and Lies of Rukhsana Ali', 'Lovely Bones',
  'Me and Earl and the Dying Girl', 'More Happy Than Not', 'Muted', 'Online Pornography', 'Paper Towns',
  'Perks of Being a Wallflower', 'Poet X', 'Rape of Nanking', 'Reminders of Him', 'Round House', 'September Girls',
  'Serpent & Dove', 'Sky Is Everywhere', 'Slaughterhouse-Five', 'Sold', 'Stolen Life', 'Sula', 'This Girl', 'Tilt',
  'Tower of Dawn', 'Tricks', 'Violet Made of Thorns', 'Where The Crawdads Sing', 'Without Merit',
]

const BATCHES: Batch[] = [
  {
    label: 'Naval Academy 2025',
    institution: 'U.S. Naval Academy (Nimitz Library)',
    region: 'Maryland',
    yearStarted: 2025,
    yearEnded: 2025,
    source: {
      source_name: 'Associated Press — Most books pulled from Naval Academy library are back on the shelves (21 May 2025)',
      source_url: 'https://www.news4jax.com/news/politics/2025/05/21/most-books-pulled-from-naval-academy-library-are-back-on-the-shelves-in-latest-dei-turn/',
      source_type: 'news',
    },
  },
  {
    label: 'Nevada CSD 2023 pending-investigation',
    institution: 'Nevada Community School District',
    region: 'Iowa',
    yearStarted: 2023,
    actionType: 'restricted',
    yearEnded: 2023,
    keepTitles: NEVADA_FINAL_LIST,
    source: {
      source_name: 'Ames Tribune — Senate File 496 forces Nevada CSD to remove 65 books (8 Dec 2023)',
      source_url: 'https://www.yahoo.com/news/65-books-removed-nevada-csd-120235199.html',
      source_type: 'news',
    },
  },
  {
    label: 'Clear Creek-Amana 2024',
    institution: 'Clear Creek-Amana Community School District',
    region: 'Iowa',
    yearStarted: 2024,
    yearEnded: 2024,
    source: {
      source_name: 'Des Moines Register — An investigation of the 3,400 books pulled in Iowa (6 Jun 2024)',
      source_url: 'https://www.usatoday.com/story/news/education/2024/06/06/captain-underpants-among-banned-books-under-iowa-law/73996406007/',
      source_type: 'news',
    },
  },
  {
    label: 'Central York 2021 diversity list',
    institution: 'Central York School District',
    region: 'Pennsylvania',
    yearStarted: 2021,
    yearEnded: 2021,
    source: {
      source_name: 'CNN — Pennsylvania school district reverses ban on books by authors of color (Sep 2021)',
      source_url: 'https://ktvz.com/news/national-world/cnn-national/2021/09/25/pennsylvania-school-district-reverses-ban-on-books-by-authors-of-color-after-students-fought-back/',
      source_type: 'news',
    },
  },
]

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── fix-reinstated-bans-2026-10 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)
  try {
    if (APPLY) await pg.query('begin')
    let total = 0
    for (const batch of BATCHES) {
      const rows = (await pg.query(
        `select b.id, b.status, k.title from bans b join books k on k.id=b.book_id
         where b.institution=$1 and b.region=$2 and b.year_started=$3
           and ($4::text is null or b.action_type=$4)`,
        [batch.institution, batch.region, batch.yearStarted, batch.actionType ?? null],
      )).rows as { id: number; status: string; title: string }[]

      const keepKeys = (batch.keepTitles ?? []).map(norm)
      const kept = rows.filter(r => keepKeys.some(k => norm(r.title).includes(k)))
      const target = rows.filter(r => !kept.includes(r) && r.status !== 'rescinded')
      console.log(`  ${batch.label}: ${rows.length} rows · keep active ${kept.length}${kept.length ? ` (${kept.map(r => r.title).join('; ')})` : ''} · already rescinded ${rows.filter(r => r.status === 'rescinded').length} · → rescind ${target.length}`)
      total += target.length
      if (!APPLY || target.length === 0) continue

      const ids = target.map(r => r.id)
      await pg.query(
        `update bans set status='rescinded', year_ended=$2 where id = any($1::bigint[])`,
        [ids, batch.yearEnded],
      )
      const s = batch.source
      const sourceId = (await pg.query(
        `insert into ban_sources(source_name, source_url, source_type, accessed_at, verification_status)
         values($1,$2,$3,$4,'verified')
         on conflict (source_url) do update set source_name=excluded.source_name
         returning id`,
        [s.source_name, s.source_url, s.source_type, ACCESSED_AT],
      )).rows[0].id
      await pg.query(
        `insert into ban_source_links(ban_id, source_id, locator)
         select unnest($1::bigint[]), $2, 'reinstatement'
         on conflict do nothing`,
        [ids, sourceId],
      )
    }
    if (APPLY) await pg.query('commit')
    console.log(`\n${APPLY ? 'Rescinded' : 'Would rescind'}: ${total} bans`)
    if (!APPLY) console.log('DRY-RUN — add --apply to write.')
  } catch (e) {
    if (APPLY) await pg.query('rollback')
    throw e
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
