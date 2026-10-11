#!/usr/bin/env tsx
// Null first_published_year where the book's own bans prove it wrong: a US
// school/public-library ban (2021+) dated two or more years before the stored
// publication year. See src/lib/enrich/pub-year-guard.ts for the ceiling rule;
// a gap of exactly one year is left alone (school-year dating can explain it).
//
// NULL = "unknown", which beats a known-wrong year (PT rule). These are mostly
// reprint/edition years stamped at import (Assassination Classroom vols on
// 2025, English release 2014–18) that the OL/LLM year sweeps could not resolve.
// enrich-ol-harvest refuses to write a year above the ceiling, so a nulled year
// is not stamped back.
//
// Re-runnable. Writes a CSV backup (data/pub-year-null-backup-<date>.csv) before
// changing anything.
//
// Usage: npx tsx --env-file=.env.local scripts/fix-provably-wrong-pub-years.ts [--apply]
import { writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { PUB_YEAR_CEILING_SQL } from '../src/lib/enrich/pub-year-guard'
import { isApply } from './lib/cli'

const APPLY = isApply()

async function main() {
  const pg = newPgClient(); await pg.connect()
  const rows = (await pg.query(`
    with c as (${PUB_YEAR_CEILING_SQL})
    select b.id, b.slug, b.title, b.first_published_year as pub, c.ceiling - 1 as first_ban
    from books b join c on c.book_id = b.id
    where b.first_published_year > c.ceiling
    order by b.id`)).rows
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'}: ${rows.length} books with a publication year ≥2 years after their first US school/library ban`)
  for (const r of rows.slice(0, 25)) console.log(`  #${r.id} ${r.title}: pub ${r.pub}, first banned ${r.first_ban}`)
  if (rows.length > 25) console.log(`  … +${rows.length - 25} more`)
  if (APPLY && rows.length) {
    const stamp = new Date().toISOString().slice(0, 10)
    const csv = ['id,slug,first_published_year,first_ban',
      ...rows.map(r => `${r.id},${r.slug},${r.pub},${r.first_ban}`)].join('\n')
    writeFileSync(`data/pub-year-null-backup-${stamp}.csv`, csv + '\n')
    const res = await pg.query(`update books set first_published_year = null where id = any($1::bigint[])`, [rows.map(r => r.id)])
    console.log(`nulled ${res.rowCount} (backup: data/pub-year-null-backup-${stamp}.csv)`)
  }
  await pg.end()
}
main().catch(e => { console.error(e); process.exit(1) })
