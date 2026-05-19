#!/usr/bin/env tsx
/**
 * Import 12 South African apartheid-era ban records from The Literature Police
 * (https://theliteraturepolice.com/documents/), Prof. Peter D. McDonald's
 * curated collection of censor reports from the Western Cape Provincial
 * Archives.
 *
 * The full collection has 22 PDFs. This script imports only the 12 that
 * document an actual ban or restriction:
 *   - 10 books that were banned and stayed banned through apartheid
 *      (ban_status='historical')
 *   - 2 books that were banned and then overturned on appeal within months
 *      (ban_status='rescinded', year_ended set)
 *
 * The other 10 PDFs document books that the censors REVIEWED but PASSED
 * (e.g. Coetzee, Mphahlele, Breytenbach's Seisoen). Those don't belong in
 * the bans table — they're historical context about apartheid's literary
 * apparatus, not ban events.
 *
 * Special case (existing data): Brink's *A Dry White Season* already has
 * book row (id=877) and ban row (id=961) from a prior Wikipedia import.
 * For this entry we ADD the censor-report PDF as an extra source and
 * UPDATE the existing ban to status='rescinded', year_ended=1979.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-literature-police.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-literature-police.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitParsedRow, type CommitInput } from '../src/lib/imports/review-commit'

type BannedEntry = {
  filename: string  // PDF basename at theliteraturepolice.com/wp-content/uploads/2018/07/
  title: string
  authors: string[]
  publication_year: number | null
  year_started: number
  year_ended: number | null         // null for still-historical, set for rescinded
  ban_status: 'historical' | 'rescinded'
  reason_slug: 'political' | 'racial' | 'obscenity' | 'moral' | 'sexual' | 'religious'
  description_ban: string
  // If this book already has a ZA ban from a prior import, point to it here
  // and we add a source + update the existing ban instead of creating new.
  existing_ban_id?: number
  existing_book_id?: number
}

const PDF_BASE = 'https://theliteraturepolice.com/wp-content/uploads/2018/07/'
const SOURCE_BASE = 'Censors\' Report (Western Cape Provincial Archives, via P.D. McDonald, The Literature Police)'

const ENTRIES: BannedEntry[] = [
  {
    filename: 'censors-report-on-modisanes-blame-me-on-history-1963.pdf',
    title: 'Blame Me on History',
    authors: ['Bloke Modisane'],
    publication_year: 1963,
    year_started: 1963,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned by the Publications Control Board in 1963: import and distribution prohibited by the Minister of the Interior. Reader cited anti-white statements, intimate descriptions, and propaganda inciting resistance.',
  },
  {
    filename: 'censors-report-on-gordimers-strangers-1958-and-1961.pdf',
    title: 'A World of Strangers',
    authors: ['Nadine Gordimer'],
    publication_year: 1958,
    year_started: 1961,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'racial',
    description_ban: 'Passed by the pre-1963 Board of Censors in 1958, then re-examined and banned in 1961-62: four readers unanimously rejected, citing a "false and misleading impression" of South Africa, offensive intermingling, suggested mixed-race relationships, and offensive depictions of Afrikaners.',
  },
  {
    filename: 'censors-report-on-smiths-when-the-lion-feeds-1964.pdf',
    title: 'When the Lion Feeds',
    authors: ['Wilbur A. Smith'],
    publication_year: 1964,
    year_started: 1964,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'obscenity',
    description_ban: 'Banned on 6 August 1964 by the Publications Control Board under s. 5.2(a) and (c) of Act 26 of 1963: "indecent, obscene, offensive and harmful to public morals" and "blasphemous and offensive to religious convictions". (Famously overturned by the Appellate Division in 1965; that decision is not documented in this source.)',
  },
  {
    filename: 'censors-report-on-rives-emergency-1964.pdf',
    title: 'Emergency',
    authors: ['Richard Rive'],
    publication_year: 1964,
    year_started: 1964,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned in October 1964 by the Publications Control Board: novel about Sharpeville, Langa, and the 1960 pass-law unrest. Readers cited "promiscuous relations" across the colour line and an "exaggerated view of the unrest of those years".',
  },
  {
    filename: 'censors-report-on-gordimers-bourgeios-world-1966.pdf',
    title: 'The Late Bourgeois World',
    authors: ['Nadine Gordimer'],
    publication_year: 1966,
    year_started: 1966,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Declared UNDESIRABLE by the Publications Control Board on 17 June 1966 (Section 8 Statement No. 25/66). Readers cited rejection of the South African order, suggested sexual race-mixing, insinuations against the judiciary, and casual acceptance of underground activities and sabotage.',
  },
  {
    filename: 'censors-report-on-la-gumas-stone-country-1970.pdf',
    title: 'The Stone Country',
    authors: ['Alex La Guma'],
    publication_year: 1967,
    year_started: 1970,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned 5 May 1970 by the Publications Control Board: all six readers unanimously rejected. La Guma was already a listed (banned) person under suppression-of-communism laws; the cover dedication, "About the Author" note, and exaggerated portrayal of South African prisons were cited.',
  },
  {
    filename: 'censors-report-on-feinbergs-poets-to-the-people-1975.pdf',
    title: 'Poets to the People: South African Freedom Poems',
    authors: ['Barry Feinberg'],
    publication_year: 1974,
    year_started: 1975,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned 11 December 1975 under sections 47(2)(a), (d) and (e) of the Publications Act 1974: dedicated to the ANC, raised funds for the International Defence and Aid Fund, contained poems by listed communists (Brutus, Lewin), and was held prejudicial to State security and to white-black relations.',
  },
  {
    filename: 'censors-report-on-sepamlas-soweto-i-love-1977.pdf',
    title: 'The Soweto I Love',
    authors: ['Sipho Sepamla'],
    publication_year: 1977,
    year_started: 1977,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned 12 October 1977 under section 47(2)(e) of the Publications Act 1974 as prejudicial to State security and good order. Seven of the 35 poems were singled out — including "A Child dies", "At the Dawn of another Day", "How a Brother died", and "Bullets" — depicting post-Soweto-uprising suffering.',
  },
  {
    filename: 'censors-report-on-matthewss-pass-me-a-meatball-1978.pdf',
    title: 'Pass Me a Meatball, Jones',
    authors: ['James Matthews'],
    publication_year: 1977,
    year_started: 1978,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned 19 April 1978 under section 47(2)(e) of the Publications Act 1974. Most prison poems were tolerated, but the poem "their wailing was" (p. 10), describing subterranean torture chambers in South African prisons, was held to be the kind of poem "readily adopted by underground resistance anthologies".',
  },
  {
    filename: 'censors-report-on-madingoanes-africa-1979.pdf',
    title: 'Africa My Beginning',
    authors: ['Ingoapele Madingoane'],
    publication_year: 1979,
    year_started: 1979,
    year_ended: null,
    ban_status: 'historical',
    reason_slug: 'political',
    description_ban: 'Banned 9 May 1979 under section 47(2)(e) of the Publications Act 1974 as prejudicial to State security and good order: the 22-poem collection invoked Sharpeville and Soweto, called on ancestors for liberation, and praised declared communists (Neto, Mugabe).',
  },
  {
    // Special: existing book + ban from prior Wikipedia import.
    // We add the PDF as a second source and update the ban to rescinded.
    filename: 'from-committee-to-appeal-the-dry-white-season-case-1979.pdf',
    title: 'A Dry White Season',
    authors: ['André Brink'],
    publication_year: 1979,
    year_started: 1979,
    year_ended: 1979,
    ban_status: 'rescinded',
    reason_slug: 'political',
    description_ban: 'Banned 12 September 1979 by the Committee of Publications under section 47(2)(e) of the Publications Act 1974: held to cast a "very serious reflection" on the Security Police (allegations of torture, victimisation, and a Security-Police murder in the closing pages). Overturned by the Publications Appeal Board on 23 November 1979 — banned for approximately ten weeks.',
    existing_book_id: 877,
    existing_ban_id: 961,
  },
  {
    filename: 'initial-censors-report-on-mutloatses-forced-landing-1980.pdf',
    title: 'Forced Landing: Africa South — Contemporary Writings',
    authors: ['Mothobi Mutloatse'],
    publication_year: 1980,
    year_started: 1980,
    year_ended: 1980,
    ban_status: 'rescinded',
    reason_slug: 'political',
    description_ban: 'Banned 18 April 1980 (Government Notice 859) under section 47(2)(e) of the Publications Act 1974, primarily because of Herman Toivo ja Toivo\'s contribution "Here I Stand" (his court statement as a SWAPO accused) — held to "discredit the State in the eyes of the black man". Overturned on appeal 12 September 1980 — banned for approximately five months.',
  },
]

const APPLY = process.argv.includes('--apply')

function pdfUrl(filename: string): string {
  return PDF_BASE + filename
}

function sourceName(authors: string[], title: string, year: number): string {
  const author = authors[0] ?? 'unknown'
  return `Censors' Report on ${author}'s ${title} ${year} (Western Cape Provincial Archives, via P.D. McDonald, The Literature Police)`
}

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()

  try {
    console.log(`\nThe Literature Police import — ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${ENTRIES.length} entries\n`)
    for (const e of ENTRIES) {
      const tag = e.existing_ban_id ? `add-source-to-ban-${e.existing_ban_id}` : 'new-book+ban'
      const status = e.ban_status === 'rescinded' ? `rescinded(${e.year_started}-${e.year_ended})` : `banned(${e.year_started})`
      console.log(`  ${tag.padEnd(28)} | ${status.padEnd(28)} | ${e.authors[0]} — ${e.title}`)
      console.log(`    -> ${pdfUrl(e.filename)}`)
    }

    if (!APPLY) {
      console.log(`\nDry-run complete. Re-run with --apply.`)
      return
    }

    console.log(`\nApplying...\n`)
    let created = 0
    let addedToExisting = 0
    let rescindedUpdates = 0

    for (const e of ENTRIES) {
      const url = pdfUrl(e.filename)
      const name = sourceName(e.authors, e.title, e.year_started)

      if (e.existing_ban_id) {
        // Path: add source + link, then update ban to rescinded
        await pg.query('BEGIN')
        try {
          const sourceRes = await pg.query<{ id: number }>(
            `insert into ban_sources (source_name, source_url, source_type,
                                      verification_status, accessed_at)
             values ($1, $2, 'government', 'unverified', now())
             on conflict (source_url) do update
               set source_name = excluded.source_name,
                   accessed_at = now()
             returning id`,
            [name, url],
          )
          const sourceId = sourceRes.rows[0].id

          await pg.query(
            `insert into ban_source_links (ban_id, source_id) values ($1, $2)
             on conflict do nothing`,
            [e.existing_ban_id, sourceId],
          )

          // Update existing ban: rescinded + year_ended + description (only set if currently NULL).
          await pg.query(
            `update bans
             set status = $2,
                 year_ended = $3,
                 description = coalesce(nullif(description, ''), $4)
             where id = $1`,
            [e.existing_ban_id, e.ban_status, e.year_ended, e.description_ban],
          )
          addedToExisting++
          rescindedUpdates++

          await pg.query('COMMIT')
          console.log(`  ok  +source on ban_${e.existing_ban_id} (${e.title})`)
        } catch (err) {
          await pg.query('ROLLBACK')
          throw err
        }
        continue
      }

      // Path: new book + ban via commitParsedRow, then post-update if rescinded
      const input: CommitInput = {
        title: e.title,
        authors: e.authors,
        year: e.year_started,
        first_published_year: e.publication_year,
        country_code: 'ZA',
        scope_slug: 'government',
        action_type: 'banned',
        ban_status: 'historical', // CommitInput type doesn't accept 'rescinded'; post-update if needed
        reason_slug: e.reason_slug,
        description_ban: e.description_ban,
        inclusion_rationale: `The Literature Police (theliteraturepolice.com) — censor report curated by P.D. McDonald from the Western Cape Provincial Archives.`,
        source_url: url,
        source_name: name,
        source_type: 'government',
        original_language: 'en',
      }

      const result = await commitParsedRow(input, pg)
      created++

      if (e.ban_status === 'rescinded') {
        for (const banId of result.ban_ids) {
          await pg.query(
            `update bans set status = 'rescinded', year_ended = $2 where id = $1`,
            [banId, e.year_ended],
          )
        }
        rescindedUpdates++
        console.log(`  ok  new book_${result.book_id} + ban_${result.ban_ids[0]} (RESCINDED) (${e.title})`)
      } else {
        console.log(`  ok  new book_${result.book_id} + ban_${result.ban_ids[0]} (${e.title})`)
      }
    }

    console.log(`\nWritten: ${created} new book+ban tuples, ${addedToExisting} sources added to existing bans, ${rescindedUpdates} rescinded-status updates.`)

    // Post-state for ZA
    const after = await pg.query<{ bans: string; w_src: string; historical: string; rescinded: string }>(
      `select
         count(*)::text as bans,
         count(*) filter (where exists (select 1 from ban_source_links bsl where bsl.ban_id = b.id))::text as w_src,
         count(*) filter (where status = 'historical')::text as historical,
         count(*) filter (where status = 'rescinded')::text as rescinded
       from bans b
       where country_code = 'ZA'`,
    )
    const r = after.rows[0]
    console.log(`\nZA post-state: ${r.bans} bans total, ${r.w_src} with source, ${r.historical} historical, ${r.rescinded} rescinded`)
  } finally {
    await pg.end()
  }
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
