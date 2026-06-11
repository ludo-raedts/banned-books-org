#!/usr/bin/env tsx
/**
 * One-off: improve North Korea (KP) coverage.
 *
 * North Korea is a methodologically distinct case — the state keeps no public
 * banlist because the logic is inverted (everything not pre-approved is
 * effectively banned), so the country narrative carries most of the weight and
 * only a handful of individual titles are concretely documented.
 *
 * Three changes, all data-only (no schema change):
 *   1. Rewrite countries.description for KP — richer, dated, named: the
 *      pre-publication review layers, the 2020 Reactionary Thought law, and the
 *      defector/Daily NK/RFA/Ministry-of-Unification sourcing methodology.
 *   2. Add Bandi's "The Accusation" — the clearest individual documented case
 *      (dissident fiction written in secret 1989–1995, smuggled out, published
 *      abroad under a pseudonym). Created via the canonical commitParsedRow().
 *   3. Backfill the empty per-ban descriptions on the 3 existing KP bans
 *      (The Bible, Escape from Camp 14, The Girl with Seven Names) so they no
 *      longer render blank on the country page.
 *
 * Same prose style as the R1-R6 / France country descriptions: factual, dated,
 * named, no fluff.
 *
 *   pnpm tsx --env-file=.env.local scripts/_improve_north_korea.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_improve_north_korea.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'
import {
  commitParsedRow,
  commitNewBanForBook,
  type CommitInput,
  type AddBanInput,
} from '../src/lib/imports/review-commit'

const APPLY = process.argv.includes('--apply')

const NEW_DESCRIPTION = `North Korea operates the world's most comprehensive censorship regime, and its logic is inverted: rather than maintaining a public list of banned titles, the state requires every publication to clear multiple ideological review layers before printing, so that only works approved by the Workers' Party Propaganda and Agitation Department and the Korean Writers' Union may legally circulate. Domestic literary output is devoted almost entirely to propaganda glorifying the Kim dynasty; unauthorised possession of foreign media is a criminal offence, and virtually all foreign and South Korean literature is dangerous to own rather than enumerated on a list. After the 1967 Kapsan faction incident the regime destroyed foreign literature on a mass scale — books by Tolstoy, Gorky, and Dostoevsky were burned, works of Chinese, Greek, and German philosophy were eradicated, and citizens were forced to burn or surrender their own libraries, after which even Marx could be read only at designated libraries on stated grounds. Documented prohibition therefore rests on defector testimony, smuggled works, and South Korean government and human-rights reporting. The clearest individual case is Bandi's The Accusation, a collection of dissident short stories written in secret between 1989 and 1995, smuggled out of the country, and first published abroad in 2014 under a pseudonym the author still uses to avoid execution. The Bible has been banned since the state's founding in 1948 for its religious content and its challenge to the cult of the leadership. Since the 2020 Law on the Elimination of Reactionary Thought and Culture, possessing or distributing South Korean books, films, and media carries penalties up to and including execution. Defectors describe elaborate networks for smuggling banned books and USB drives across the Chinese border; ongoing reporting on confiscations and prosecutions comes from Daily NK, Radio Free Asia, and the South Korean Ministry of Unification's defector-based human-rights surveys.`

// Per-ban description backfill for the 3 existing KP bans (currently NULL).
// Keyed by book slug; only updates KP bans where description IS NULL.
const BAN_DESCRIPTIONS: Record<string, string> = {
  'the-bible': `Banned since the founding of the state in 1948. The regime treats the Bible's religious content and its claim to an authority above the leadership as a direct challenge to the cult of the Kim dynasty; possession is a serious criminal offence, and Christians caught with one have been imprisoned or executed.`,
  'escape-from-camp-14': `Blaine Harden's account of Shin Dong-hyuk, born and raised inside the Kaechon political prison camp (Camp 14) and one of the few known people to escape a total-control zone. The book exposes the regime's prison-camp system; possessing foreign accounts of North Korean human-rights abuses is a criminal offence.`,
  'the-girl-with-seven-names': `Hyeonseo Lee's defector memoir tracing her escape from North Korea and the years she spent concealing her identity in China. As a first-hand defector account that contradicts the official narrative, it is banned, and possessing or distributing such foreign literature carries severe penalties.`,
}

const ACCUSATION: CommitInput = {
  title: 'The Accusation',
  title_native: '고발',
  title_transliterated: 'Gobal',
  original_language: 'ko',
  authors: ['Bandi'],
  year: 2014,
  first_published_year: 2014,
  country_code: 'KP',
  scope_slug: 'government',
  action_type: 'banned',
  ban_status: 'active',
  reason_slug: 'political',
  description_ban: `Written in secret between 1989 and 1995 by a still-anonymous author using the pen name Bandi ("firefly"), these seven stories depict ordinary North Koreans suffering under the regime. The manuscript was smuggled out of the country and first published in South Korea in 2014, then internationally in 2017 as "The Accusation: Forbidden Stories from Inside North Korea". It was never legally publishable in North Korea; the author kept the pseudonym to avoid execution, and possession would carry severe penalties.`,
  inclusion_rationale: `The single clearest documented case of a literary work suppressed by North Korea: dissident fiction written in secret, smuggled out, and published abroad under a pseudonym to protect the author from execution. Widely covered by international press (The New Yorker, The Guardian) and championed by PEN International.`,
  source_url: 'https://en.wikipedia.org/wiki/The_Accusation_(book)',
  source_name: 'The Accusation (book) — Wikipedia',
  source_type: 'wikipedia',
}

const RED_YEARS: CommitInput = {
  title: 'The Red Years',
  title_native: '붉은 세월',
  original_language: 'ko',
  authors: ['Bandi'],
  year: 2018,
  first_published_year: 2018,
  country_code: 'KP',
  scope_slug: 'government',
  action_type: 'banned',
  ban_status: 'active',
  reason_slug: 'political',
  description_ban: `Bandi's collection of 51 dissident poems, written inside North Korea and smuggled out on the same coarse manuscript paper as his short-story collection The Accusation. Published in South Korea in 2018 and in English in 2019 as "The Red Years: Forbidden Poems from Inside North Korea" (translated by Heinz Insu Fenkl), the poems describe the brutality of life under Kim Il-sung and Kim Jong-il and the 1990s famine. It was never legally publishable in North Korea, and the author writes under a pseudonym to avoid execution.`,
  inclusion_rationale: `A second smuggled work by the pseudonymous dissident Bandi, distinct from The Accusation: a poetry collection written in secret inside North Korea and published abroad. Like The Accusation it could never appear domestically and the author's identity is concealed to protect him from execution.`,
  source_url: 'https://en.wikipedia.org/wiki/Bandi_(writer)',
  source_name: 'Bandi (writer) — Wikipedia',
  source_type: 'wikipedia',
}

const GONE_WITH_THE_WIND: CommitInput = {
  title: 'Gone with the Wind',
  original_language: 'en',
  authors: ['Margaret Mitchell'],
  year: 2018,
  first_published_year: 1936,
  country_code: 'KP',
  scope_slug: 'government',
  action_type: 'banned',
  ban_status: 'active',
  reason_slug: 'political',
  description_ban: `Foreign and American novels are officially banned in North Korea, with harsh punishments for their sale or possession. Radio Free Asia reported in 2018, citing sources inside the country, that Gone with the Wind was the American novel most in demand — circulating clandestinely at public-market book stalls despite the ban, while special police units continued to crack down on possession and sale.`,
  inclusion_rationale: `A rare title-level attestation in a country with no public banlist: Radio Free Asia (2018), citing in-country sources, names Gone with the Wind specifically as a banned American novel changing hands on the black market despite official prohibition and the threat of punishment for possession.`,
  source_url: 'https://www.rfa.org/english/news/korea/demand-05212018163718.html',
  source_name: 'Demand Grows in North Korea For US Novels, Movies as Summit Nears — Radio Free Asia (2018)',
  source_type: 'news',
}

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()
  console.log(`\n── improve-north-korea — ${APPLY ? 'APPLY' : 'DRY-RUN'} ──\n`)

  try {
    // 1. Country description ------------------------------------------------
    const cur = await pg.query<{ description: string | null }>(
      `select description from countries where code = 'KP'`,
    )
    if (cur.rows.length === 0) throw new Error('No KP row in countries — unexpected')
    const old = cur.rows[0].description ?? ''
    console.log(`[1] countries.KP.description: ${old.length} → ${NEW_DESCRIPTION.length} chars`)
    console.log(`    OLD: ${old.slice(0, 140)}…`)
    console.log(`    NEW: ${NEW_DESCRIPTION.slice(0, 140)}…\n`)

    // 2. Backfill empty per-ban descriptions --------------------------------
    console.log('[2] backfill per-ban descriptions (KP bans where description IS NULL):')
    const targets: Array<{ slug: string; banId: number; title: string }> = []
    for (const slug of Object.keys(BAN_DESCRIPTIONS)) {
      const r = await pg.query<{ id: number; title: string; description: string | null }>(
        `select b.id, bk.title, b.description
           from bans b join books bk on bk.id = b.book_id
          where b.country_code = 'KP' and bk.slug = $1`,
        [slug],
      )
      if (r.rows.length === 0) {
        console.log(`    ⚠ no KP ban found for slug '${slug}' — skipping`)
        continue
      }
      for (const row of r.rows) {
        if (row.description && row.description.trim().length > 0) {
          console.log(`    = ban_${row.id} "${row.title}" already has a description — leaving as-is`)
          continue
        }
        targets.push({ slug, banId: row.id, title: row.title })
        console.log(`    + ban_${row.id} "${row.title}" ← ${BAN_DESCRIPTIONS[slug].slice(0, 70)}…`)
      }
    }

    // 3. New Bandi titles ---------------------------------------------------
    const exists = await pg.query(`select id from books where slug = 'the-accusation'`)
    const accusationExists = exists.rows.length > 0
    console.log(
      `\n[3] The Accusation (Bandi): ${accusationExists ? `already exists (book_${exists.rows[0].id}) — skipping create` : 'will CREATE book + KP ban + author + source'}`,
    )
    const ryExists = await pg.query(`select id from books where slug = 'the-red-years'`)
    const redYearsExists = ryExists.rows.length > 0
    console.log(
      `[3] The Red Years (Bandi): ${redYearsExists ? `already exists (book_${ryExists.rows[0].id}) — skipping create` : 'will CREATE book + KP ban + author + source'}`,
    )
    // Gone with the Wind already exists in the DB (banned elsewhere), so we
    // ADD a KP ban to the existing book rather than creating a duplicate.
    const gwtwExists = await pg.query(`select id from books where slug = 'gone-with-the-wind'`)
    const gwtwBookId: number | null = gwtwExists.rows.length > 0 ? (gwtwExists.rows[0].id as number) : null
    const gwtwHasKp =
      gwtwBookId !== null &&
      (await pg.query(`select 1 from bans where book_id = $1 and country_code = 'KP'`, [gwtwBookId])).rows.length > 0
    console.log(
      `[3] Gone with the Wind (Mitchell): ${
        gwtwBookId === null
          ? 'will CREATE book + KP ban'
          : gwtwHasKp
            ? `book_${gwtwBookId} already has a KP ban — skipping`
            : `book_${gwtwBookId} exists — will ADD KP ban`
      }`,
    )

    if (!APPLY) {
      console.log('\nDry-run. Re-run with --apply to write to DB.')
      return
    }

    // APPLY -----------------------------------------------------------------
    await pg.query(`update countries set description = $1 where code = 'KP'`, [NEW_DESCRIPTION])
    console.log('\n✓ [1] KP description updated')

    for (const t of targets) {
      await pg.query(`update bans set description = $1 where id = $2`, [
        BAN_DESCRIPTIONS[t.slug],
        t.banId,
      ])
      console.log(`✓ [2] ban_${t.banId} "${t.title}" description set`)
    }

    if (!accusationExists) {
      const res = await commitParsedRow(ACCUSATION, pg)
      console.log(`✓ [3] created book_${res.book_id} + ban_${res.ban_ids[0]} (The Accusation)`)
    }
    if (!redYearsExists) {
      const res = await commitParsedRow(RED_YEARS, pg)
      console.log(`✓ [3] created book_${res.book_id} + ban_${res.ban_ids[0]} (The Red Years)`)
    }
    if (gwtwBookId === null) {
      const res = await commitParsedRow(GONE_WITH_THE_WIND, pg)
      console.log(`✓ [3] created book_${res.book_id} + ban_${res.ban_ids[0]} (Gone with the Wind)`)
    } else if (!gwtwHasKp) {
      const add: AddBanInput = {
        book_id: gwtwBookId,
        country_code: 'KP',
        scope_slug: GONE_WITH_THE_WIND.scope_slug,
        action_type: GONE_WITH_THE_WIND.action_type,
        ban_status: GONE_WITH_THE_WIND.ban_status,
        year: GONE_WITH_THE_WIND.year as number,
        reason_slug: GONE_WITH_THE_WIND.reason_slug,
        description_ban: GONE_WITH_THE_WIND.description_ban,
        source_url: GONE_WITH_THE_WIND.source_url,
        source_name: GONE_WITH_THE_WIND.source_name,
        source_type: GONE_WITH_THE_WIND.source_type,
      }
      const res = await commitNewBanForBook(add, pg)
      console.log(`✓ [3] ${res.created ? 'added' : 'reused'} ban_${res.ban_id} on book_${gwtwBookId} (Gone with the Wind, KP)`)
    }

    console.log('\nDone. Refresh /countries/KP on localhost to review.')
  } finally {
    await pg.end()
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
