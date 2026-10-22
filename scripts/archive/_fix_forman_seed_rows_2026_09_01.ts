#!/usr/bin/env tsx
/**
 * Point-fix (found in the 2026-09-01 /botd-week pre-flight, Gayle Forman week):
 *
 *  1. books #484 "I Was Here" first_published_year 2001 → 2015.
 *     2001 came from OpenLibrary's contaminated work record for
 *     /works/OL19665940W: its first_publish_year is 2001, taken from a single
 *     mis-dated edition (ISBN 9781471124396, Simon & Schuster UK, OL
 *     publish_date "May 13, 2001"). The two real first editions in the same work
 *     are Viking + Listening Library, both "Jan 27, 2015", and en.wikipedia's
 *     Gayle Forman article dates the release to January 2015 in prose and lists
 *     "I Was Here (2015)".
 *
 *  2. Delete the two vague PEN roll-up seed rows on Forman's catalogue:
 *     ban #492 (book 484, US 2002) and ban #390 (book 382 "If I Stay", US 2010).
 *     Both are the ~2026-04-24 seed class handled by
 *     scripts/cleanup-vague-pen-rollups.ts: institution NULL, region NULL, sole
 *     source the generic https://pen.org/book-bans/ landing page. Their
 *     year_started is not sourced at all — it is first_published_year + 1
 *     (2001+1, 2009+1), a fabricated year (PEN's index only starts 2021-2022,
 *     so that page can support no 2002 or 2010 ban). They survived the June
 *     sweep only because its concrete-coverage test compares district years
 *     against that fabricated year within ±1: book+country coverage is in fact
 *     complete (6 concrete district rows for #484, 9 for #382, all 2021-2024).
 *
 * Same delete semantics as the sweep: ban_source_links + ban_reason_links
 * first, one transaction, JSON backup of every deleted row written before the
 * delete.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/_fix_forman_seed_rows_2026_09_01.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_fix_forman_seed_rows_2026_09_01.ts --apply
 */
import * as fs from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const GENERIC_URL = 'https://pen.org/book-bans/'

const BOOK_ID = 484
const OLD_YEAR = 2001
const NEW_YEAR = 2015
// seed ban id → the book it hangs on, for the exact-state guard
const SEED_BANS: { id: number; book_id: number; year_started: number }[] = [
  { id: 492, book_id: 484, year_started: 2002 },
  { id: 390, book_id: 382, year_started: 2010 },
]

async function snapshot(pg: any, label: string) {
  const { rows: books } = await pg.query(
    `select id, slug, title, first_published_year from books where id = any($1) order by id`,
    [[382, 484]],
  )
  const { rows: bans } = await pg.query(
    `select b.id, b.book_id, b.country_code, b.year_started, b.region, b.institution,
            (select count(*) from ban_source_links l where l.ban_id = b.id) as sources
     from bans b where b.book_id = any($1) order by b.book_id, b.id`,
    [[382, 484]],
  )
  const { rows: counts } = await pg.query(
    `select book_id, count(*) as n from bans where book_id = any($1) group by book_id order by book_id`,
    [[382, 484]],
  )
  const { rows: drift } = await pg.query(
    `select count(*) as n from bans b join books bk on bk.id = b.book_id
     where b.year_started is not null and bk.first_published_year is not null
       and b.year_started < bk.first_published_year`,
  )
  console.log(`\n── ${label} ──`)
  for (const b of books) console.log(`  book #${b.id} "${b.title}" pub=${b.first_published_year}`)
  for (const c of counts) console.log(`  book #${c.book_id}: ${c.n} bans`)
  const seeds = bans.filter((b: any) => b.region === null && b.institution === null)
  console.log(`  seed-shaped rows (region+institution NULL): ${seeds.length}` +
    (seeds.length ? ` → ${seeds.map((s: any) => `#${s.id} ${s.country_code} ${s.year_started}`).join(', ')}` : ''))
  console.log(`  DB-wide ban-before-publication rows: ${drift[0].n}`)
  return { bans: bans.length, drift: Number(drift[0].n) }
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
    const before = await snapshot(pg, 'BEFORE')

    // ── guard 1: the book still holds the audited wrong year ──
    const { rows: bk } = await pg.query(`select first_published_year from books where id = $1`, [BOOK_ID])
    if (!bk.length) throw new Error(`book ${BOOK_ID} not found`)
    const yearOk = bk[0].first_published_year === OLD_YEAR
    if (!yearOk) console.log(`\n  skip year fix: book ${BOOK_ID} now holds ${bk[0].first_published_year}, expected ${OLD_YEAR}`)

    // ── guard 2: each seed row is still the vague generic-source shape, and the
    //             book+country still has concrete district coverage ──
    const deletable: number[] = []
    for (const s of SEED_BANS) {
      const { rows } = await pg.query(
        `with gen as (select id from ban_sources where source_url = $1)
         select b.id, b.book_id, b.country_code, b.year_started, b.region, b.institution,
           (select count(*) from ban_source_links l where l.ban_id = b.id) as n_sources,
           exists (select 1 from ban_source_links l where l.ban_id = b.id and l.source_id = (select id from gen)) as has_generic,
           exists (select 1 from ban_source_links l where l.ban_id = b.id and l.source_id <> (select id from gen)) as has_extra,
           (select count(*) from bans c where c.book_id = b.book_id and c.country_code = b.country_code
              and c.institution is not null and c.id <> b.id) as concrete
         from bans b where b.id = $2`,
        [GENERIC_URL, s.id],
      )
      if (!rows.length) { console.log(`  skip ban #${s.id}: gone already`); continue }
      const r = rows[0]
      const reasons: string[] = []
      if (Number(r.book_id) !== s.book_id) reasons.push(`book_id ${r.book_id} != ${s.book_id}`)
      if (r.year_started !== s.year_started) reasons.push(`year ${r.year_started} != ${s.year_started}`)
      if (r.region !== null || r.institution !== null) reasons.push('no longer region+institution NULL')
      if (!r.has_generic) reasons.push('not linked to the generic pen.org page')
      if (r.has_extra) reasons.push('has an extra source — manual review, never delete')
      if (Number(r.concrete) < 1) reasons.push('no concrete district row for this book+country')
      if (reasons.length) { console.log(`  skip ban #${s.id}: ${reasons.join('; ')}`); continue }
      console.log(`  ban #${s.id} book ${r.book_id} ${r.country_code} ${r.year_started}: deletable ` +
        `(${r.n_sources} source=generic-only, ${r.concrete} concrete district rows cover it)`)
      deletable.push(s.id)
    }

    if (!APPLY) {
      console.log(`\nDRY-RUN — would set book ${BOOK_ID} first_published_year=${NEW_YEAR} (${yearOk ? 'yes' : 'SKIPPED'})` +
        ` and delete ${deletable.length} seed ban(s): ${deletable.join(', ') || '-'}`)
      console.log('Re-run with --apply to persist.')
      return
    }

    // ── backup (rollback material) before any write ──
    if (deletable.length) {
      const { rows: full } = await pg.query(`select * from bans where id = any($1)`, [deletable])
      const { rows: links } = await pg.query(`select * from ban_source_links where ban_id = any($1)`, [deletable])
      const { rows: reasons } = await pg.query(`select * from ban_reason_links where ban_id = any($1)`, [deletable])
      const file = `data/forman-seed-rows-backup-${new Date().toISOString().slice(0, 10)}.json`
      fs.writeFileSync(file, JSON.stringify({
        book_year_before: { id: BOOK_ID, first_published_year: bk[0].first_published_year },
        bans: full, source_links: links, reason_links: reasons,
      }, null, 1) + '\n')
      console.log(`\nbackup → ${file} (${full.length} bans, ${links.length} source links, ${reasons.length} reason links)`)
    }

    await pg.query('begin')
    let yearUpdated = 0
    if (yearOk) {
      const u = await pg.query(
        `update books set first_published_year = $1 where id = $2 and first_published_year = $3`,
        [NEW_YEAR, BOOK_ID, OLD_YEAR],
      )
      yearUpdated = u.rowCount ?? 0
    }
    let deleted = 0
    if (deletable.length) {
      await pg.query(`delete from ban_source_links where ban_id = any($1)`, [deletable])
      await pg.query(`delete from ban_reason_links where ban_id = any($1)`, [deletable])
      const d = await pg.query(`delete from bans where id = any($1)`, [deletable])
      deleted = d.rowCount ?? 0
    }
    await pg.query('commit')
    console.log(`\nbooks updated: ${yearUpdated}   bans deleted: ${deleted}`)

    const after = await snapshot(pg, 'AFTER')
    console.log(`\nbans on #382 + #484: ${before.bans} → ${after.bans}` +
      `   ban-before-publication: ${before.drift} → ${after.drift}`)
    console.log('\nNext: scripts/refresh-mv.ts, then bust /books/i-was-here /books/if-i-stay /authors/gayle-forman')
  } catch (e) {
    await pg.query('rollback').catch(() => {})
    throw e
  } finally {
    await pg.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
