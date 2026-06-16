#!/usr/bin/env tsx
/**
 * Merge a cross-language (Spanish-edition) duplicate book row.
 *
 * A US school-ban import minted a fresh book keyed on the Spanish edition title
 * instead of matching the existing canonical English record:
 *
 *   DROP #5453 "Bajo La Misma Estrella"  (slug bajo-la-misma-estrella)
 *     → KEEP #232 "The Fault in Our Stars" (slug the-fault-in-our-stars)
 *
 * Both already point at the SAME author (John Green #126), so this is a
 * book-ONLY merge — no author merge. (Cf. the LaVey/Li cases in
 * scripts/merge-cross-language-dupes.ts, which also had author dupes.)
 *
 * Doctrine (memory "Cross-language (cross-script) dupes"): a foreign-language
 * DROP contributes ONLY its ban, its URL slug-alias, and language-NEUTRAL facts
 * the canonical row lacks. The title, original_language, description and the
 * edition ISBN/pub-year fields are NEVER copied — they describe the translation,
 * not the original work. Here KEEP is already fully populated (OL work + cover,
 * archive id, isbn13, first_published_year 2010), and every DROP scalar is
 * Spanish-edition-specific (isbn13 9788817076333, year 2012, Google cover,
 * archive id BajoLaMismaEstrella_*), so nothing is enriched.
 *
 * Ban dedup uses the FULL event key (country+scope+region+institution+year) —
 * NOT the coarse country|scope key in merge-cross-language-dupes.ts, which is
 * built for distinct-country bans and would wrongly collapse a US school ban
 * against an unrelated US district. DROP's only ban (North East ISD / Texas /
 * 2024) does not exactly match KEEP's North East ISD / Texas / 2025 entry, so
 * it is migrated as a distinct event.
 *
 * Whole run is ONE transaction under --apply. Idempotent: gone DROP = no-op.
 *
 *   pnpm tsx --env-file=.env.local scripts/merge-bajo-misma-estrella-dupe.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-bajo-misma-estrella-dupe.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const KEEP = 232   // The Fault in Our Stars (English canonical)
const DROP = 5453  // Bajo La Misma Estrella (Spanish edition)

const CURATED_BOOK_TABLES = [
  'bbw_featured_selections', 'reading_club_classics', 'reading_club_currently_challenged',
  'reading_club_international', 'reading_club_theme_books', 'reading_club_young_readers',
]

type Ban = {
  id: number; country_code: string; scope_id: number | null
  region: string | null; institution: string | null; year_started: number | null
}
// Full event identity — two school bans are the same only if all of these match.
const banKey = (b: Ban) =>
  `${b.country_code}|${b.scope_id ?? ''}|${b.region ?? ''}|${b.institution ?? ''}|${b.year_started ?? ''}`

async function main() {
  const pg = newPgClient()
  await pg.connect()
  console.log(`── merge-bajo-misma-estrella-dupe ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)
  try {
    if (APPLY) await pg.query('begin')

    const keepRow = (await pg.query(`select id, slug, title from books where id=$1`, [KEEP])).rows[0]
    const dropRow = (await pg.query(`select id, slug, title from books where id=$1`, [DROP])).rows[0]
    if (!dropRow) { console.log(`DROP #${DROP} already gone — no-op.`); if (APPLY) await pg.query('commit'); return }
    if (!keepRow) throw new Error(`KEEP #${KEEP} not found`)
    console.log(`\n[book] KEEP #${KEEP} "${keepRow.title}" ← DROP #${DROP} "${dropRow.title}"`)

    // Guard: never blindly CASCADE-delete a book sitting in a curated/editorial table.
    for (const t of CURATED_BOOK_TABLES) {
      const { rows } = await pg.query(`select 1 from ${t} where book_id=$1 limit 1`, [DROP])
      if (rows.length) throw new Error(`DROP #${DROP} referenced by curated table ${t} — abort.`)
    }

    // 1. Migrate bans (dedup on full event key). Links travel with the ban_id.
    const banCols = `id, country_code, scope_id, region, institution, year_started`
    const keepBans = (await pg.query<Ban>(`select ${banCols} from bans where book_id=$1`, [KEEP])).rows
    const dropBans = (await pg.query<Ban>(`select ${banCols} from bans where book_id=$1`, [DROP])).rows
    const keepKeys = new Map(keepBans.map(b => [banKey(b), b.id]))
    for (const b of dropBans) {
      const match = keepKeys.get(banKey(b))
      if (match != null) {
        console.log(`  ban ${b.id} [${banKey(b)}]: DUP of KEEP ban ${match} → union links, drop via cascade`)
        if (APPLY) {
          await pg.query(`insert into ban_source_links(ban_id,source_id,locator) select $1,source_id,locator from ban_source_links where ban_id=$2 on conflict do nothing`, [match, b.id])
          await pg.query(`insert into ban_reason_links(ban_id,reason_id) select $1,reason_id from ban_reason_links where ban_id=$2 on conflict do nothing`, [match, b.id])
        }
      } else {
        console.log(`  ban ${b.id} [${banKey(b)}]: MOVE → KEEP`)
        if (APPLY) await pg.query(`update bans set book_id=$1 where id=$2`, [KEEP, b.id])
        keepKeys.set(banKey(b), b.id)
      }
    }

    // 2. Slug aliases: re-point DROP's aliases, add the Spanish slug as a legacy alias
    //    so /books/bajo-la-misma-estrella 308-redirects to the canonical record.
    if (APPLY) await pg.query(`update book_slug_aliases set book_id=$1 where book_id=$2`, [KEEP, DROP])
    if (dropRow.slug && dropRow.slug !== keepRow.slug) {
      console.log(`  alias add legacy "${dropRow.slug}" → KEEP`)
      if (APPLY) await pg.query(`insert into book_slug_aliases(slug,book_id,source) values($1,$2,'legacy_slug') on conflict(slug) do nothing`, [dropRow.slug, KEEP])
    }

    // 3. No enrichment: KEEP is fully populated and every DROP scalar is
    //    Spanish-edition-specific (see header). Intentionally a no-op.

    // 4. Delete DROP (CASCADE: its shared book_authors row, description_search_attempts).
    console.log(`  DELETE book #${DROP} (CASCADE)`)
    if (APPLY) await pg.query(`delete from books where id=$1`, [DROP])

    if (APPLY) { await pg.query('commit'); console.log(`\nApplied (single transaction).`) }
    else console.log(`\nDry-run — re-run with --apply.`)
  } catch (err) {
    if (APPLY) { try { await pg.query('rollback'); console.error('Rolled back.') } catch { /* */ } }
    throw err
  } finally {
    await pg.end()
  }
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
