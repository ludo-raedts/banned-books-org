#!/usr/bin/env tsx
/**
 * Backfill ban_sources + ban_source_links for 21 historic AU/GB bans that
 * pre-date the Sprint A pipeline and were imported (via add-books-batchN.ts)
 * without any source attribution. Each entry points to the book's Wikipedia
 * article — those articles document the historical ban in their censorship /
 * publication-history sections.
 *
 * Inserts:
 *   - one ban_sources row per unique Wikipedia URL (upsert on source_url)
 *   - one ban_source_links row per (ban_id, source_id) pair
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-au-gb-sources.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-au-gb-sources.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'

type Backfill = {
  ban_id: number
  cc: 'AU' | 'GB'
  book_title: string
  wikipedia_slug: string
}

const ENTRIES: Backfill[] = [
  // Australia (13)
  { ban_id: 4729, cc: 'AU', book_title: 'Another Country',                  wikipedia_slug: 'Another_Country_(novel)' },
  { ban_id: 4727, cc: 'AU', book_title: 'Borstal Boy',                      wikipedia_slug: 'Borstal_Boy' },
  { ban_id: 1075, cc: 'AU', book_title: 'Brave New World',                  wikipedia_slug: 'Brave_New_World' },
  { ban_id: 4730, cc: 'AU', book_title: 'Forever Amber',                    wikipedia_slug: 'Forever_Amber' },
  { ban_id: 1004, cc: 'AU', book_title: "Lady Chatterley's Lover",          wikipedia_slug: "Lady_Chatterley's_Lover" },
  { ban_id: 1039, cc: 'AU', book_title: 'Lolita',                           wikipedia_slug: 'Lolita' },
  { ban_id:  600, cc: 'AU', book_title: 'Spycatcher',                       wikipedia_slug: 'Spycatcher' },
  { ban_id: 4732, cc: 'AU', book_title: 'The 120 Days of Sodom',            wikipedia_slug: 'The_120_Days_of_Sodom' },
  { ban_id: 4728, cc: 'AU', book_title: 'The Decameron',                    wikipedia_slug: 'The_Decameron' },
  { ban_id: 4734, cc: 'AU', book_title: 'The Stud',                         wikipedia_slug: 'The_Stud_(novel)' },
  { ban_id: 4733, cc: 'AU', book_title: 'The World Is Full of Married Men', wikipedia_slug: 'The_World_Is_Full_of_Married_Men' },
  { ban_id: 1071, cc: 'AU', book_title: 'Tropic of Cancer',                 wikipedia_slug: 'Tropic_of_Cancer_(novel)' },
  { ban_id: 1073, cc: 'AU', book_title: 'Tropic of Capricorn',              wikipedia_slug: 'Tropic_of_Capricorn_(novel)' },

  // United Kingdom (8)
  { ban_id:   59, cc: 'GB', book_title: 'Lolita',                           wikipedia_slug: 'Lolita' },
  { ban_id: 1036, cc: 'GB', book_title: 'Naked Lunch',                      wikipedia_slug: 'Naked_Lunch' },
  { ban_id:  599, cc: 'GB', book_title: 'Spycatcher',                       wikipedia_slug: 'Spycatcher' },
  { ban_id: 1038, cc: 'GB', book_title: 'The Social Contract',              wikipedia_slug: 'The_Social_Contract' },
  { ban_id: 1162, cc: 'GB', book_title: 'The Story of O',                   wikipedia_slug: 'Story_of_O' },
  { ban_id: 1072, cc: 'GB', book_title: 'Tropic of Cancer',                 wikipedia_slug: 'Tropic_of_Cancer_(novel)' },
  { ban_id: 1074, cc: 'GB', book_title: 'Tropic of Capricorn',              wikipedia_slug: 'Tropic_of_Capricorn_(novel)' },
  { ban_id: 1002, cc: 'GB', book_title: 'Ulysses',                          wikipedia_slug: 'Ulysses_(novel)' },
]

const APPLY = process.argv.includes('--apply')

// Wikipedia article URLs: encode ' as %27, leave _ and ASCII alphanumerics raw.
// encodeURIComponent is too aggressive — it would encode '(' ')' '_' too, and
// Wikipedia URLs canonicalise to underscores + raw parentheses.
function wikipediaUrl(slug: string): string {
  return `https://en.wikipedia.org/wiki/${slug.replace(/'/g, '%27')}`
}

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()

  try {
    // Pre-check: every ban_id must exist and have no existing source link.
    const ids = ENTRIES.map(e => e.ban_id)
    const checkRes = await pg.query<{ id: number; country_code: string; has_source: boolean }>(
      `select b.id, b.country_code,
              exists (select 1 from ban_source_links bsl where bsl.ban_id = b.id) as has_source
       from bans b
       where b.id = any($1::bigint[])`,
      [ids],
    )
    // pg returns bigint as string; coerce to Number so Set lookups work.
    const presentIds = new Set(checkRes.rows.map(r => Number(r.id)))
    const missing = ids.filter(id => !presentIds.has(id))
    const alreadySourced = checkRes.rows.filter(r => r.has_source).map(r => r.id)

    if (missing.length || alreadySourced.length) {
      console.error('Pre-check found issues:')
      if (missing.length) console.error(`  missing ban_ids: ${missing.join(', ')}`)
      if (alreadySourced.length) console.error(`  already-sourced ban_ids: ${alreadySourced.join(', ')}`)
      console.error('Aborting to avoid duplicate-source writes.')
      process.exit(1)
    }

    console.log(`\nBackfill plan: ${ENTRIES.length} entries — ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)
    for (const e of ENTRIES) {
      const url = wikipediaUrl(e.wikipedia_slug)
      console.log(`  [${e.cc}] ban ${String(e.ban_id).padStart(4)} | ${e.book_title.padEnd(34)} -> ${url}`)
    }

    if (!APPLY) {
      console.log(`\nDry-run complete. Verify the URLs above, then re-run with --apply.`)
      return
    }

    console.log(`\nApplying...\n`)
    let addedSources = 0
    let addedLinks = 0
    let reusedSources = 0

    for (const e of ENTRIES) {
      const url = wikipediaUrl(e.wikipedia_slug)
      const sourceName = `Wikipedia: ${e.book_title}`

      await pg.query('BEGIN')
      try {
        const sourceRes = await pg.query<{ id: number; inserted: boolean }>(
          `insert into ban_sources (source_name, source_url, source_type,
                                    verification_status, accessed_at)
           values ($1, $2, 'wikipedia', 'unverified', now())
           on conflict (source_url) do update
             set source_name = excluded.source_name,
                 accessed_at = now()
           returning id, (xmax = 0) as inserted`,
          [sourceName, url],
        )
        const sourceId = sourceRes.rows[0].id
        if (sourceRes.rows[0].inserted) addedSources++
        else reusedSources++

        const linkRes = await pg.query<{ ban_id: number }>(
          `insert into ban_source_links (ban_id, source_id) values ($1, $2)
           on conflict do nothing
           returning ban_id`,
          [e.ban_id, sourceId],
        )
        if (linkRes.rows.length > 0) addedLinks++

        await pg.query('COMMIT')
        console.log(`  ok   [${e.cc}] ban ${e.ban_id}: source_id=${sourceId}`)
      } catch (err) {
        await pg.query('ROLLBACK')
        throw err
      }
    }

    console.log(`\nWritten: ${addedSources} new ban_sources, ${reusedSources} reused, ${addedLinks} new ban_source_links.`)

    // Post-state verification
    const after = await pg.query<{ country_code: string; bans: string; w_src: string }>(
      `select b.country_code,
              count(*) as bans,
              count(*) filter (where exists (select 1 from ban_source_links bsl where bsl.ban_id = b.id)) as w_src
       from bans b
       where b.country_code in ('AU','GB')
       group by b.country_code
       order by b.country_code`,
    )
    console.log(`\nPost-state coverage:`)
    for (const r of after.rows) {
      console.log(`  ${r.country_code}: ${r.w_src}/${r.bans} bans with source`)
    }
  } finally {
    await pg.end()
  }
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
