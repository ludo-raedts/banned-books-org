#!/usr/bin/env tsx
/**
 * Clear ban years that the cited source does not support (UX review, 2026-11-11).
 *
 * WHY: the external reviewer checked two book pages against their linked
 * sources and both stated a year the source does not give.
 *
 * 1. Wikipedia "List of most commonly challenged books in the United States"
 *    (ban_sources.id 825). That list has a "published" column and no year of
 *    challenge; the import put the PUBLICATION year into bans.year_started.
 *    Julie of the Wolves showed "earliest in 1972" — its publication year —
 *    and 95 of the source's 124 bans carry a year equal to the book's
 *    first_published_year. Those years become NULL (unknown).
 *      - One row is left alone: clearing its year would collide with an
 *        existing year-less ban of the same book (bans_unique_per_scope).
 *      - Rows of this source whose year differs from the stored publication
 *        year (27) are NOT touched here: most look like the same mistake with a
 *        wrong or missing first_published_year, but that needs a per-row look.
 *
 * 2. Algemene Staatsleer (R. Kranenburg), ban 29738, source Leiden4045
 *    (https://www.leiden4045.nl/verboden-boeken/). The source says the book
 *    was put on the list "al vrij vroeg (exacte datum helaas niet vermeld)" as
 *    number 65; "januari 1942" is the date of ANOTHER Kranenburg title in the
 *    next sentence. It gives no reason either.
 *      - bans.year_started 1942 → NULL
 *      - the 'political' reason link becomes basis='inferred' (our reading of
 *        the book, not something the source records)
 *      - bans.description is replaced by what the source does say
 *      - books.description_ban (generated, asserts 1942 and "due to its
 *        political content") → NULL, so the page shows the recorded note
 *
 * Idempotent. Writes a backup of every touched value to data/ on --apply.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-unsupported-ban-years-2026-11.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-unsupported-ban-years-2026-11.ts --apply
 */
import { writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const WIKI_SOURCE_ID = 825
const KRANENBURG_BAN_ID = 29738
const KRANENBURG_NOTE =
  "Placed on the German occupation's list of prohibited publications in the Netherlands as number 65. " +
  'The source says this happened early in the occupation and gives no exact date and no reason.'

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    // A dry-run must not be able to write; --apply runs in one transaction.
    await pg.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY')

    // ── 1. Wikipedia commonly-challenged list ────────────────────────────────
    const { rows: wiki } = await pg.query<{ id: number; title: string; year_started: number; collides: boolean }>(
      `select bn.id, b.title, bn.year_started,
              exists (select 1 from bans o
                       where o.id <> bn.id and o.book_id = bn.book_id and o.country_code = bn.country_code
                         and o.scope_id = bn.scope_id and o.year_started is null
                         and o.region is not distinct from bn.region
                         and o.institution is not distinct from bn.institution) as collides
         from bans bn
         join books b on b.id = bn.book_id
         join ban_source_links l on l.ban_id = bn.id and l.source_id = $1
        where bn.year_started is not null and bn.year_started = b.first_published_year
        order by bn.id`,
      [WIKI_SOURCE_ID],
    )
    const toClear = wiki.filter(r => !r.collides)
    const skipped = wiki.filter(r => r.collides)
    console.log(`Wikipedia list (source ${WIKI_SOURCE_ID}): ${wiki.length} bans with year = publication year`)
    console.log(`  → clear year: ${toClear.length}`)
    for (const r of skipped) console.log(`  → SKIP (would collide with a year-less ban): #${r.id} ${r.title} (${r.year_started})`)

    // ── 2. Algemene Staatsleer ───────────────────────────────────────────────
    const { rows: kr } = await pg.query<{
      id: number; book_id: number; year_started: number | null; description: string | null
      description_ban: string | null; description_ban_status: string | null
    }>(
      `select bn.id, bn.book_id, bn.year_started, bn.description, b.description_ban, b.description_ban_status
         from bans bn join books b on b.id = bn.book_id where bn.id = $1 and b.slug = 'algemene-staatsleer'`,
      [KRANENBURG_BAN_ID],
    )
    const { rows: krReasons } = await pg.query<{ reason_id: number; slug: string; basis: string | null }>(
      `select l.reason_id, r.slug, l.basis from ban_reason_links l join reasons r on r.id = l.reason_id where l.ban_id = $1`,
      [KRANENBURG_BAN_ID],
    )
    if (kr.length !== 1) throw new Error(`expected exactly one Algemene Staatsleer ban #${KRANENBURG_BAN_ID}, found ${kr.length}`)
    const k = kr[0]
    const krNeedsYear = k.year_started !== null
    const krNeedsNote = k.description !== KRANENBURG_NOTE
    const krNeedsText = k.description_ban !== null
    const krReasonsToInfer = krReasons.filter(r => r.basis !== 'inferred')
    console.log(`Algemene Staatsleer (ban ${k.id}): year ${k.year_started ?? 'NULL'}${krNeedsYear ? ' → NULL' : ' (already NULL)'}`)
    console.log(`  note ${krNeedsNote ? 'replaced' : 'already replaced'}; generated ban text ${krNeedsText ? '→ NULL' : 'already NULL'}; reasons → inferred: ${krReasonsToInfer.map(r => r.slug).join(', ') || 'none'}`)

    if (!APPLY) {
      await pg.query('ROLLBACK')
      console.log('\nDry-run: nothing written. Re-run with --apply.')
      return
    }

    const backup = {
      at: new Date().toISOString(),
      wikipediaYears: toClear.map(r => ({ ban_id: r.id, year_started: r.year_started })),
      kranenburg: { ban: k, reasons: krReasons },
    }
    const backupPath = `data/fix-unsupported-ban-years-backup-${backup.at.slice(0, 19).replace(/[:T]/g, '-')}.json`
    writeFileSync(backupPath, JSON.stringify(backup, null, 2))

    const cleared = await pg.query(`update bans set year_started = null where id = any($1::bigint[]) and year_started is not null`, [toClear.map(r => r.id)])
    const krBan = await pg.query(
      `update bans set year_started = null, description = $2 where id = $1 and (year_started is not null or description is distinct from $2)`,
      [KRANENBURG_BAN_ID, KRANENBURG_NOTE],
    )
    const krBasis = await pg.query(`update ban_reason_links set basis = 'inferred' where ban_id = $1 and basis is distinct from 'inferred'`, [KRANENBURG_BAN_ID])
    const krText = await pg.query(`update books set description_ban = null, description_ban_status = null where id = $1 and description_ban is not null`, [k.book_id])
    await pg.query('COMMIT')
    console.log(`\nApplied: ${cleared.rowCount} Wikipedia years cleared; Algemene Staatsleer: ${krBan.rowCount} ban row, ${krBasis.rowCount} reason link, ${krText.rowCount} book text.`)
    console.log(`Backup: ${backupPath}`)
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await pg.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
