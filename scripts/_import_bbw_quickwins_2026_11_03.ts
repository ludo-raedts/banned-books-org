/**
 * Post-BBW 2026 source deltas — Belarus, Hong Kong, Alberta (one-off).
 *
 * Seed: data/bbw-quickwins-2026-11-03.json (stage-0, one row per book × ban event)
 *   - BY: PEN Belarus lists, entries added since the May 2026 import
 *         (extremist #106–126, harmful #242–271; 4 non-book entries skipped in the seed)
 *   - HK: zh-yue Wikipedia 香港被禁書刊一覽 rows not yet in the DB (2020–2026);
 *         periodicals, publisher-level and author-blanket rows left out
 *   - CA: Alberta school removals under the provincial "explicit visual depiction"
 *         order — Edmonton Public Schools list (14 Apr 2026) + Parkland SD (6 titles)
 *
 * Thin reader over the shared commit-lib (scripts/README.md §1):
 *   native-title lookup → matchExistingBook → author check → attach | create.
 *   - hit with no author overlap               → HELD (namesake guard, e.g. "Dead Souls")
 *   - hit that already has a ban in that country → SKIP (already covered; for CA only
 *     when it is an Alberta school ban from 2025+)
 *   - attach/create → then stamp region/institution on the ban (commit-lib has no fields)
 *   - reused ban from another institution (same book/year/scope) → note the second
 *     institution in the description instead of a second ban
 * Existing ban_sources keep their source_name (the commit-lib upserts name by URL).
 *
 *   npx tsx --env-file=.env.local scripts/_import_bbw_quickwins_2026_11_03.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/_import_bbw_quickwins_2026_11_03.ts --apply
 */
import { readFileSync } from 'node:fs'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { slugify } from '../src/lib/imports/slugify'
import { commitParsedRow, commitNewBanForBook, type AuthorInput } from '../src/lib/imports/review-commit'
import { isApply } from './lib/cli'

const APPLY = isApply()
const SEED = 'data/bbw-quickwins-2026-11-03.json'

interface Row {
  key: string
  country_code: string
  year: number
  scope_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  ban_status: 'active' | 'historical'
  reason_slug: string
  title: string
  title_native?: string | null
  title_english_meaningful?: string | null
  authors: AuthorInput[]
  description_ban: string
  source_url: string
  source_name?: string
  source_type: string
  region: string | null
  institution: string | null
  author_check: boolean
  book_id?: number
  force_create?: boolean
}

const tokens = (s: string) => new Set(slugify(s).split('-').filter(t => t.length > 1))

async function authorsAgree(pg: Client, bookId: number, row: Row): Promise<boolean> {
  const have = (
    await pg.query(
      `select a.display_name, a.name_native from book_authors ba join authors a on a.id=ba.author_id where ba.book_id=$1`,
      [bookId],
    )
  ).rows
  if (!have.length) return false
  for (const want of row.authors) {
    const w = tokens(want.display_name)
    for (const h of have) {
      if (want.name_native && h.name_native && h.name_native === want.name_native) return true
      const ht = tokens(h.display_name)
      // surname-level overlap; Chinese names: require every token (given names are short)
      const overlap = [...w].filter(t => ht.has(t))
      if (row.country_code === 'HK' ? overlap.length === w.size && w.size > 0 : overlap.some(t => t.length > 2)) return true
    }
  }
  return false
}

async function nativeLookup(pg: Client, native: string | null | undefined): Promise<number | null> {
  if (!native) return null
  const main = native.split(/[:：=]/)[0].trim()
  if (main.length < 2) return null
  const r = await pg.query(
    `select id from books where title_native = $1 or title_native like $2 or title_native like $3 order by id limit 2`,
    [native, `${main} :%`, `${main}:%`],
  )
  return r.rows.length === 1 ? Number(r.rows[0].id) : null
}

async function stampBan(pg: Client, banId: number, row: Row, created: boolean) {
  const cur = (await pg.query(`select region, institution, description from bans where id=$1`, [banId])).rows[0]
  if (created) {
    await pg.query(`update bans set region=$2, institution=$3 where id=$1`, [banId, row.region, row.institution])
  } else if (row.institution && cur.institution && cur.institution !== row.institution) {
    const note = ` Also removed by ${row.institution}.`
    if (!String(cur.description ?? '').includes(note.trim()))
      await pg.query(`update bans set description = coalesce(description,'') || $2 where id=$1`, [banId, note])
  }
}

async function main() {
  const seed = JSON.parse(readFileSync(SEED, 'utf8'))
  const rows: Row[] = seed.rows
  const pg: Client = newPgClient()
  await pg.connect()
  console.log(`── _import_bbw_quickwins_2026_11_03 ── ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${rows.length} rows`)

  const tally: Record<string, number> = {}
  const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1)
  try {
    for (const row of rows) {
      const existingName = (await pg.query(`select source_name from ban_sources where source_url=$1`, [row.source_url])).rows[0]?.source_name
      const source_name = existingName ?? row.source_name ?? row.source_url

      // book_id in the seed = match confirmed by hand during the dry-run review
      // (series/volume records and HK rows whose stored title format differs)
      // force_create = reviewed as a distinct work despite a fuzzy title hit
      // (an exact-slug hit still counts, so a re-run stays idempotent)
      let hitId = row.force_create
        ? ((await pg.query(`select id from books where slug=$1`, [slugify(row.title)])).rows[0]?.id ?? null)
        : row.book_id ?? (await nativeLookup(pg, row.title_native))
      let how = row.book_id ? 'pinned' : hitId ? 'native' : ''
      if (!hitId && !row.force_create) {
        const hit = await matchExistingBook({ title: row.title, englishTitle: row.title_english_meaningful ?? null })
        if (hit) { hitId = hit.id; how = hit.status }
      }

      if (hitId) {
        if (row.author_check && !(await authorsAgree(pg, hitId, row))) {
          bump(`${row.country_code} held (author mismatch)`)
          const t = (await pg.query(`select title from books where id=$1`, [hitId])).rows[0]?.title
          console.log(`  HOLD   ${row.key}: "${row.title}" ~ #${hitId} "${t}" (${how}) — authors disagree`)
          continue
        }
        const prior = (
          await pg.query(
            `select id from bans where book_id=$1 and country_code=$2 and ($2 <> 'CA' or (region='Alberta' and year_started >= 2025))`,
            [hitId, row.country_code],
          )
        ).rows
        if (prior.length && !(row.country_code === 'CA' && row.institution)) {
          bump(`${row.country_code} skip (already banned there)`)
          continue
        }
        if (prior.length && row.country_code === 'CA') {
          const same = (await pg.query(`select 1 from bans where book_id=$1 and country_code='CA' and institution=$2`, [hitId, row.institution])).rows
          if (same.length) { bump(`CA skip (already listed for ${row.institution})`); continue }
        }
        bump(`${row.country_code} attach`)
        console.log(`  ATTACH ${row.key} → #${hitId} (${how})`)
        if (!APPLY) continue
        const res = await commitNewBanForBook(
          {
            book_id: hitId, country_code: row.country_code, scope_slug: row.scope_slug, action_type: row.action_type,
            ban_status: row.ban_status, year: row.year, reason_slug: row.reason_slug, description_ban: row.description_ban,
            source_url: row.source_url, source_name, source_type: row.source_type,
          },
          pg,
        )
        await stampBan(pg, res.ban_id, row, res.created)
      } else {
        bump(`${row.country_code} create`)
        console.log(`  CREATE ${row.key}: "${row.title}"`)
        if (!APPLY) continue
        const res = await commitParsedRow(
          {
            title: row.title, title_native: row.title_native ?? null, title_english_meaningful: row.title_english_meaningful ?? null,
            authors: row.authors, year: row.year, country_code: row.country_code, scope_slug: row.scope_slug,
            action_type: row.action_type, ban_status: row.ban_status, reason_slug: row.reason_slug,
            description_ban: row.description_ban, inclusion_rationale: row.description_ban,
            source_url: row.source_url, source_name, source_type: row.source_type,
          },
          pg,
        )
        for (const id of res.ban_ids) await stampBan(pg, id, row, true)
      }
    }
  } finally {
    await pg.end()
  }
  console.log('\n', tally)
  if (!APPLY) console.log('DRY-RUN — nothing written.')
}

main().catch(e => { console.error(e); process.exit(1) })
