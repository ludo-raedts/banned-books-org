#!/usr/bin/env tsx
/**
 * Fixes from the Fellion & Inglis "Censored" (2017) cross-check, see
 * data/censored-fellion-inglis-check-2026-11-16.md. Only the clear-cut items:
 *   MERGE  duplicate ban rows (same event) — keeper keeps its sources, dup's
 *          source/reason links are moved over, dup deleted.
 *   UPDATE year/description of two rows the book dates differently.
 * NOT touched (review-only): Ulysses GB 1918–36, Lolita DK, Beijing Coma CN,
 * Hit Man AU, Satanic Verses rows — evidence is "chapter silent", not "chapter contradicts".
 * Every row is guarded on book_id/country/year so a re-run is a no-op.
 *   pnpm tsx --env-file=.env.local scripts/_fix_censored_book_check_2026_11_16.ts [--apply]
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
const APPLY = isApply()

const MERGES = [
  { book: 74, cc: 'GB', keep: 29811, drop: 82, why: 'Dorian Gray: both = WHSmith pulling the July 1890 Lippincott’s issue (p.147)' },
  { book: 761, cc: 'US', keep: 829, drop: 29124, why: 'Leaves of Grass: both = the 1882 Boston DA / NESSV episode (pp.108–109)',
    keepPatch: { year: 1882, institution: 'New England Society for the Suppression of Vice',
      desc: 'In 1882 the New England Society for the Suppression of Vice, citing a letter from Anthony Comstock, moved against the new Boston edition; District Attorney Oliver Stevens warned the publisher, James R. Osgood & Co., that prosecution was likely unless poems such as “To a Common Prostitute” and “A Woman Waits for Me” were cut. Whitman refused and the book was reissued in Philadelphia.' } },
  { book: 52, cc: 'GB', keep: 29132, drop: 1002, why: 'Ulysses: blank GB 1923 row duplicates the described 1923 seizure' },
]
const UPDATES = [
  { id: 13100, book: 577, cc: 'GB', fromYear: 1963, toYear: 1964, status: 'historical',
    desc: 'In 1964 police seized 171 copies of the Mayflower paperback of Fanny Hill from the Magic Shop in London’s Tottenham Court Road. Mayflower stopped distribution and asked to be prosecuted; the Director of Public Prosecutions declined, and a Bow Street magistrate ordered the copies destroyed without appeal. An unexpurgated Mayflower edition was released without action in 1970.' },
  { id: 59, book: 51, cc: 'GB', fromYear: 1955, toYear: 1956, yearEnded: 1959, status: 'historical',
    desc: 'In 1956 a Soho bookseller was convicted at Bow Street over the Olympia Press edition. No British edition appeared until after the Obscene Publications Act of July 1959, when Weidenfeld & Nicolson published it without prosecution.' },
]

async function main() {
  console.log(`\n── fix censored-book check ── ${APPLY ? 'APPLY' : 'DRY-RUN (no writes)'}`)
  const pg = newPgClient(); await pg.connect()
  let nMerge = 0, nUpd = 0
  try {
    if (APPLY) await pg.query('begin')
    for (const m of MERGES) {
      const rows = (await pg.query(`select id, book_id, country_code, year_started from bans where id = any($1)`, [[m.keep, m.drop]])).rows
      const k = rows.find(r => Number(r.id) === m.keep), d = rows.find(r => Number(r.id) === m.drop)
      if (!d) { console.log(`  skip (already gone) drop #${m.drop} — ${m.why}`); continue }
      if (!k || [k, d].some(r => Number(r.book_id) !== m.book || r.country_code !== m.cc)) throw new Error(`drift on merge ${m.keep}/${m.drop}`)
      const sl = (await pg.query(`select count(*) n from ban_source_links where ban_id=$1`, [m.drop])).rows[0].n
      const rl = (await pg.query(`select count(*) n from ban_reason_links where ban_id=$1`, [m.drop])).rows[0].n
      console.log(`  MERGE #${m.drop} (${d.year_started}) → #${m.keep} (${k.year_started}); moves ${sl} source link(s), ${rl} reason link(s) — ${m.why}`)
      if (m.keepPatch) console.log(`        keeper → year ${m.keepPatch.year}, institution "${m.keepPatch.institution}", new description (${m.keepPatch.desc.length} chars)`)
      if (APPLY) {
        await pg.query(`insert into ban_source_links (ban_id, source_id) select $1, source_id from ban_source_links where ban_id=$2 on conflict do nothing`, [m.keep, m.drop])
        await pg.query(`insert into ban_reason_links (ban_id, reason_id) select $1, reason_id from ban_reason_links where ban_id=$2 on conflict do nothing`, [m.keep, m.drop])
        if (m.keepPatch) await pg.query(`update bans set year_started=$2, institution=$3, description=$4 where id=$1`, [m.keep, m.keepPatch.year, m.keepPatch.institution, m.keepPatch.desc])
        await pg.query(`delete from bans where id=$1`, [m.drop])
      }
      nMerge++
    }
    for (const u of UPDATES) {
      const b = (await pg.query(`select book_id, country_code, year_started, year_ended, status from bans where id=$1`, [u.id])).rows[0]
      if (!b || Number(b.book_id) !== u.book || b.country_code !== u.cc) throw new Error(`drift on ban #${u.id}`)
      if (b.year_started === u.toYear) { console.log(`  skip (already ${u.toYear}) ban #${u.id}`); continue }
      if (b.year_started !== u.fromYear) throw new Error(`ban #${u.id} year is ${b.year_started}, expected ${u.fromYear}`)
      console.log(`  UPDATE ban #${u.id} book ${u.book} ${u.cc}: ${u.fromYear}→${u.toYear}, end ${b.year_ended}→${u.yearEnded ?? b.year_ended}, ${b.status}→${u.status}, description (${u.desc.length} chars)`)
      if (APPLY) await pg.query(`update bans set year_started=$2, year_ended=coalesce($3, year_ended), status=$4, description=$5 where id=$1`, [u.id, u.toYear, u.yearEnded ?? null, u.status, u.desc])
      nUpd++
    }
    if (APPLY) await pg.query('commit')
  } catch (e) { if (APPLY) { try { await pg.query('rollback') } catch {} } throw e }
  finally { await pg.end() }
  console.log(`\n  ${APPLY ? 'applied' : 'would apply'}: ${nMerge} merge(s), ${nUpd} update(s)\n`)
}
main().catch(e => { console.error(e); process.exit(1) })
