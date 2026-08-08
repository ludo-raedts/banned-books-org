#!/usr/bin/env tsx
/**
 * Apply the high-confidence publication-year corrections produced by
 * scripts/audit-publication-years.ts of scripts/_audit_pen_stamped_years.ts
 * (re-sliced into the high-conf JSON).
 * Sets books.first_published_year = OL first_publish_year for the flagged
 * "importer stamped a recent index/ban year" rows.
 *
 * Guards: exact-state (row must still hold the audited year), plausibility
 * range on ol_year. Before the first write a CSV backup of the current DB
 * state of every targeted row is written to data/ (rollback material).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-publication-year-fixes.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-publication-year-fixes.ts --apply    # (--write werkt nog als alias)
 *   npx tsx --env-file=.env.local scripts/apply-publication-year-fixes.ts --file=data/other-fixes.json --apply
 */
import { readFileSync, writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'
import { flagValue, isApply } from './lib/cli'

const WRITE = isApply()
const FILE = flagValue('file') ?? 'data/publication-year-fixes-highconf.json'

type Fix = { id: number; slug: string; title: string; first_published_year: number; ol_year: number }

async function main() {
  const fixes: Fix[] = JSON.parse(readFileSync(FILE, 'utf8'))
  console.log(`Loaded ${fixes.length} fixes from ${FILE}. Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)
  const sb = adminClient()

  if (WRITE && fixes.length > 0) {
    // CSV backup of the CURRENT DB state of every targeted row (rollback material).
    const rows: string[] = ['id,slug,first_published_year']
    for (let i = 0; i < fixes.length; i += 200) {
      const ids = fixes.slice(i, i + 200).map((f) => f.id)
      const { data, error } = await sb.from('books').select('id, slug, first_published_year').in('id', ids)
      if (error) throw new Error(`backup query failed: ${error.message}`)
      for (const r of data ?? []) rows.push(`${r.id},"${r.slug}",${r.first_published_year ?? ''}`)
    }
    const backupPath = `data/publication-year-fixes-backup-${new Date().toISOString().slice(0, 10)}.csv`
    writeFileSync(backupPath, rows.join('\n') + '\n')
    console.log(`Backup of ${rows.length - 1} current rows → ${backupPath}\n`)
  }

  let ok = 0, skip = 0, fail = 0
  for (const f of fixes) {
    if (typeof f.ol_year !== 'number' || f.ol_year < 1400 || f.ol_year > 2026) { skip++; console.log(`  skip #${f.id}: implausible ol_year ${f.ol_year}`); continue }
    if (!WRITE) { ok++; continue }
    // guard: only overwrite if the DB still holds the bogus recent year we recorded
    const { data: cur } = await sb.from('books').select('first_published_year').eq('id', f.id).maybeSingle()
    if (!cur) { fail++; console.log(`  FAIL #${f.id}: not found`); continue }
    if (cur.first_published_year !== f.first_published_year) { skip++; console.log(`  skip #${f.id}: year changed since audit (${cur.first_published_year})`); continue }
    const { error } = await sb.from('books').update({ first_published_year: f.ol_year }).eq('id', f.id)
    if (error) { fail++; console.log(`  FAIL #${f.id}: ${error.message}`); continue }
    ok++
  }
  console.log(`\n${WRITE ? 'Applied' : 'Would apply'}: ${ok}  Skipped: ${skip}  Failed: ${fail}`)
  if (!WRITE) console.log('Re-run with --apply to persist.')
}
main().catch(e => { console.error(e); process.exit(1) })
