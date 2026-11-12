/**
 * French ministerial denials 1990–2026 — books named in the Journal officiel (JORF).
 *
 * Source: DILA open-data dump of the JORF (echanges.dila.gouv.fr/OPENDATA/JORF,
 * Freemium_jorf_global_20261108). Arrêtés of the Minister of the Interior under
 * art. 14 of the law of 16 July 1949 (sale to minors) and art. 14 al. 2 / decree
 * 83-1025 (circulation of foreign-origin publications). Only arrêtés that NAME the
 * book in their text; later ones are anonymised ("d'un ouvrage") and not importable.
 * Periodicals ("revue"), abrogations and 'Notre combat' (facsimile of a periodical
 * issue) are excluded. Seed: data/fr-denials/stage0-2026-11-12.json, one row per
 * book × arrêté with the verbatim operative text in sources[].quote.
 *
 * Thin reader over the shared commit-lib (cf. import-fr-jorf-denials.ts):
 *   matchExistingBook → author check → attach | create
 *   - hit but row has no known author or authors disagree → HELD (namesake guard)
 *   - hit that already has an FR ban from this arrêté's source URL → SKIP
 *   - hit with other FR bans → ATTACH a new ban (year differs by construction)
 *
 *   npx tsx --env-file=.env.local scripts/import-fr-jorf-denials.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/import-fr-jorf-denials.ts --apply
 */
import { readFileSync } from 'node:fs'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { slugify } from '../src/lib/imports/slugify'
import { commitParsedRow, commitNewBanForBook, type AuthorInput } from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'

const APPLY = isApply()
const SEED = 'data/fr-denials/stage0-2026-11-12.json'

interface Source { url: string; name: string; type: string; quote: string }
interface Row {
  key: string
  country_code: string
  year: number
  year_ended: number | null
  scope_slug: string
  action_type: 'banned' | 'restricted'
  ban_status: 'active' | 'historical'
  author_known: boolean
  reason_slug: string
  title: string
  title_english_meaningful: string | null
  authors: AuthorInput[]
  first_published_year: number | null
  description_ban: string
  sources: Source[]
  book_id?: number
  force_create?: boolean
}

const tokens = (s: string) => new Set(slugify(s).split('-').filter(t => t.length > 2))

async function authorsAgree(pg: Client, bookId: number, row: Row): Promise<boolean> {
  const have = (
    await pg.query(`select a.display_name from book_authors ba join authors a on a.id=ba.author_id where ba.book_id=$1`, [bookId])
  ).rows
  for (const want of row.authors) {
    const w = tokens(want.display_name)
    for (const h of have) if ([...tokens(h.display_name)].some(t => w.has(t))) return true
  }
  return false
}

/** Link the 2nd..nth source and stamp the end year. Idempotent. */
async function finishBan(pg: Client, banId: number, row: Row) {
  for (const s of row.sources.slice(1)) {
    const src = await pg.query(
      `insert into ban_sources (source_name, source_url, source_type) values ($1,$2,$3)
       on conflict (source_url) do update set source_url = excluded.source_url returning id`,
      [s.name, s.url, s.type],
    )
    await pg.query(`insert into ban_source_links (ban_id, source_id) values ($1,$2) on conflict do nothing`, [banId, src.rows[0].id])
  }
  if (row.year_ended) await pg.query(`update bans set year_ended=$2 where id=$1 and year_ended is null`, [banId, row.year_ended])
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(SEED, 'utf8')).rows
  const pg: Client = newPgClient()
  await pg.connect()
  console.log(`── import-fr-jorf-denials ── ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${rows.length} rows`)
  const tally: Record<string, number> = {}
  const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1)
  try {
    for (const row of rows) {
      // one distinct source per URL; the first one goes through the commit-lib
      const seen = new Set<string>()
      row.sources = row.sources.filter(s => !seen.has(s.url) && seen.add(s.url))
      const first = row.sources[0]
      const existingName = (await pg.query(`select source_name from ban_sources where source_url=$1`, [first.url])).rows[0]?.source_name

      let hitId: number | null = row.force_create
        ? ((await pg.query(`select id from books where slug=$1`, [slugify(row.title)])).rows[0]?.id ?? null)
        : row.book_id ?? null
      let how = row.book_id ? 'pinned' : ''
      if (!hitId && !row.force_create) {
        const hit = await matchExistingBook({ title: row.title, englishTitle: row.title_english_meaningful ?? null })
        if (hit) { hitId = hit.id; how = hit.status }
      }

      if (hitId) {
        const t = (await pg.query(`select title from books where id=$1`, [hitId])).rows[0]?.title
        if (!row.book_id && (!row.author_known || !(await authorsAgree(pg, hitId, row)))) {
          bump('held (author mismatch)')
          console.log(`  HOLD   ${row.key}: "${row.title}" ~ #${hitId} "${t}" (${how}) — authors disagree`)
          continue
        }
        const prior = (await pg.query(`select b.id, b.year_started from bans b join ban_source_links l on l.ban_id=b.id join ban_sources s on s.id=l.source_id where b.book_id=$1 and b.country_code='FR' and s.source_url=$2`, [hitId, first.url])).rows
        if (prior.length) {
          bump('skip (already imported from this arrêté)')
          console.log(`  SKIP   ${row.key} → #${hitId} "${t}" — FR ban from this arrêté already exists (${prior[0].year_started})`)
          continue
        }
        bump('attach')
        console.log(`  ATTACH ${row.key} (${row.year}, ${row.action_type}) → #${hitId} "${t}" (${how})`)
        if (!APPLY) continue
        const res = await commitNewBanForBook(
          {
            book_id: hitId, country_code: 'FR', scope_slug: row.scope_slug, action_type: row.action_type,
            ban_status: row.ban_status, year: row.year, reason_slug: row.reason_slug, description_ban: row.description_ban,
            source_url: first.url, source_name: existingName ?? first.name, source_type: first.type,
          },
          pg,
        )
        await finishBan(pg, res.ban_id, row)
      } else {
        bump('create')
        console.log(`  CREATE ${row.key} (${row.year}, ${row.action_type}): "${row.title}" — ${row.authors.map(a => a.display_name).join(', ')}`)
        if (!APPLY) continue
        const res = await commitParsedRow(
          {
            title: row.title, title_english_meaningful: row.title_english_meaningful ?? null,
            authors: row.authors, year: row.year, first_published_year: row.first_published_year ?? null,
            country_code: 'FR', scope_slug: row.scope_slug, action_type: row.action_type, ban_status: row.ban_status,
            reason_slug: row.reason_slug, description_ban: row.description_ban, inclusion_rationale: row.description_ban,
            source_url: first.url, source_name: existingName ?? first.name, source_type: first.type,
          },
          pg,
        )
        for (const id of res.ban_ids) await finishBan(pg, id, row)
      }
    }
  } finally {
    await pg.end()
  }
  console.log('\n', tally)
  if (!APPLY) console.log('DRY-RUN — nothing written.')
}

main().catch(e => { console.error(e); process.exit(1) })
