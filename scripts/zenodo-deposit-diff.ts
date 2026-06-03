#!/usr/bin/env tsx
/**
 * Zenodo deposit diff — "is the OPEN core changed enough to warrant a new version?"
 *
 * Re-deposit is DELIBERATE, not automatic (see /admin/zenodo for the decision
 * rule). This tool quantifies how much the OPEN export changed since the last
 * deposit so you can decide — it does NOT fire on its own.
 *
 * It only ever looks at the open censorship core (the six CSVs). Commercial-only
 * enrichment (covers, ISBNs, descriptions, bios) isn't in that export, so this
 * tool is blind to it by design — which is exactly the point: a covers/ISBN
 * sweep should NOT nudge you toward a re-deposit.
 *
 * Baseline = docs/zenodo/deposited-manifest.json (committed). It's a COMPACT
 * snapshot: per-table row count + a content hash, the enum/taxonomy value-sets,
 * and the distinct book/country counts. No per-row data, so "changed" is
 * reported at table granularity (count delta + content-changed flag), not as an
 * exact changed-row count.
 *
 * Usage:
 *   pnpm tsx scripts/zenodo-deposit-diff.ts                    # diff current vs baseline
 *   pnpm tsx scripts/zenodo-deposit-diff.ts --mark-deposited   # set baseline = current (after a deposit)
 *   pnpm tsx scripts/zenodo-deposit-diff.ts --mark-deposited --note="France batch"
 *
 * Read-only against the DB. --mark-deposited writes the committed manifest only.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeAdminClient, toCsv, type Row } from './lib/dataset-io'
import { buildOpenTables, type OpenTable, type OpenExportMeta } from './build-zenodo-dataset'
import { ZENODO_CONCEPT_DOI } from '../src/lib/zenodo'

const MANIFEST_PATH = join(process.cwd(), 'docs', 'zenodo', 'deposited-manifest.json')
const MARK = process.argv.includes('--mark-deposited')
const NOTE = (process.argv.find((a) => a.startsWith('--note=')) ?? '').slice('--note='.length) || null

// ─── Thresholds for the recommendation (tune freely) ─────────────────────────
// A new version is recommended when the open core grows or its taxonomy shifts.
// Anything below these is "your call" rather than an automatic yes.
const NEW_BANS_THRESHOLD = 250        // net new ban events
const NEW_SOURCES_THRESHOLD = 100     // net new source citations
const NEW_BOOKS_WITH_BAN_THRESHOLD = 100

// ─── Manifest shape ──────────────────────────────────────────────────────────
type Manifest = {
  markedAt?: string
  note?: string | null
  conceptDoi?: string | null
  tables: Record<string, { rowCount: number; sha256: string }>
  enums: Record<string, string[]>
  bansCountries: string[]
  distinct: { booksWithBan: number; countriesWithBan: number }
}

function distinctSorted(rows: Row[], col: string, dropEmpty = false): string[] {
  const s = new Set<string>()
  for (const r of rows) {
    const v = r[col] == null ? '' : String(r[col])
    if (dropEmpty && v === '') continue
    s.add(v)
  }
  return [...s].sort()
}

function buildManifest(tables: OpenTable[], meta: OpenExportMeta): Manifest {
  const tableHashes: Manifest['tables'] = {}
  for (const t of tables) {
    tableHashes[t.name] = {
      rowCount: t.rows.length,
      sha256: createHash('sha256').update(toCsv(t.columns, t.rows)).digest('hex'),
    }
  }
  const bans = tables.find((t) => t.name === 'bans.csv')!.rows
  const reasons = tables.find((t) => t.name === 'ban_reasons.csv')!.rows
  return {
    conceptDoi: ZENODO_CONCEPT_DOI,
    tables: tableHashes,
    enums: {
      'bans.action_type': distinctSorted(bans, 'action_type'),
      'bans.status': distinctSorted(bans, 'status'),
      'bans.scope': distinctSorted(bans, 'scope', true),
      'ban_reasons.reason_slug': distinctSorted(reasons, 'reason_slug'),
    },
    bansCountries: distinctSorted(bans, 'country_code'),
    distinct: { booksWithBan: meta.distinctBooksWithBans, countriesWithBan: meta.distinctCountriesWithBans },
  }
}

function setDiff(prev: string[], cur: string[]) {
  const p = new Set(prev), c = new Set(cur)
  return {
    added: cur.filter((x) => !p.has(x)),
    removed: prev.filter((x) => !c.has(x)),
  }
}

async function main() {
  const supabase = makeAdminClient()
  console.log(`▸ Zenodo deposit diff${MARK ? ' (--mark-deposited)' : ''}`)
  console.log('  · Building current open export in-memory…')
  const { tables, meta } = await buildOpenTables(supabase)
  const current = buildManifest(tables, meta)

  // ── --mark-deposited: write baseline and stop ──────────────────────────────
  if (MARK) {
    const out: Manifest = { markedAt: new Date().toISOString().slice(0, 10), note: NOTE, ...current }
    writeFileSync(MANIFEST_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8')
    console.log(`\n✓ Baseline written → ${MANIFEST_PATH}`)
    console.log(`  marked ${out.markedAt}${NOTE ? ` · "${NOTE}"` : ''} · concept DOI ${current.conceptDoi ?? '(none)'}`)
    for (const [name, t] of Object.entries(current.tables)) {
      console.log(`    ${name.padEnd(18)} ${String(t.rowCount).padStart(8)}`)
    }
    console.log('\n  Commit this file so the next diff compares against it.')
    return
  }

  // ── Diff mode ───────────────────────────────────────────────────────────────
  if (!existsSync(MANIFEST_PATH)) {
    console.log('\n  ! No baseline manifest yet (docs/zenodo/deposited-manifest.json).')
    console.log('    Current open-export snapshot:')
    for (const [name, t] of Object.entries(current.tables)) {
      console.log(`      ${name.padEnd(18)} ${String(t.rowCount).padStart(8)}`)
    }
    console.log('\n    After your next Zenodo deposit, run with --mark-deposited to set the baseline.')
    return
  }

  const base: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  console.log(`  · Baseline: ${base.markedAt ?? '(unknown date)'}${base.note ? ` · "${base.note}"` : ''}\n`)

  // Per-table count + content-change report
  console.log('  Per-table change since last deposit:')
  console.log('    table              baseline   current      Δrows   content')
  for (const t of tables) {
    const b = base.tables[t.name]
    const cur = current.tables[t.name]
    const baseCount = b?.rowCount ?? 0
    const delta = cur.rowCount - baseCount
    const changed = !b || b.sha256 !== cur.sha256
    const deltaStr = (delta >= 0 ? '+' : '') + delta
    console.log(
      `    ${t.name.padEnd(18)} ${String(baseCount).padStart(8)} ${String(cur.rowCount).padStart(9)} ` +
      `${deltaStr.padStart(10)}   ${changed ? 'CHANGED' : 'same'}`,
    )
  }

  // Distinct entities
  const dBooks = current.distinct.booksWithBan - (base.distinct?.booksWithBan ?? 0)
  const dCountries = current.distinct.countriesWithBan - (base.distinct?.countriesWithBan ?? 0)
  console.log('\n  Distinct entities (the canonical metrics):')
  console.log(`    books with ≥1 ban       ${String(base.distinct?.booksWithBan ?? 0).padStart(7)} → ${String(current.distinct.booksWithBan).padStart(7)}  (${dBooks >= 0 ? '+' : ''}${dBooks})`)
  console.log(`    countries with ≥1 ban   ${String(base.distinct?.countriesWithBan ?? 0).padStart(7)} → ${String(current.distinct.countriesWithBan).padStart(7)}  (${dCountries >= 0 ? '+' : ''}${dCountries})`)

  // New / removed countries with bans
  const countryDiff = setDiff(base.bansCountries ?? [], current.bansCountries)
  if (countryDiff.added.length || countryDiff.removed.length) {
    console.log('\n  Countries with bans changed:')
    if (countryDiff.added.length) console.log(`    + added:   ${countryDiff.added.join(', ')}`)
    if (countryDiff.removed.length) console.log(`    − removed: ${countryDiff.removed.join(', ')}`)
  }

  // Enum / taxonomy changes
  const enumChanges: string[] = []
  for (const key of Object.keys(current.enums)) {
    const d = setDiff(base.enums?.[key] ?? [], current.enums[key])
    if (d.added.length || d.removed.length) {
      enumChanges.push(key)
      console.log(`\n  Taxonomy change — ${key}:`)
      if (d.added.length) console.log(`    + added:   ${d.added.join(', ')}`)
      if (d.removed.length) console.log(`    − removed: ${d.removed.join(', ')}`)
    }
  }

  // ── Recommendation ──────────────────────────────────────────────────────────
  const banDelta = (current.tables['bans.csv']?.rowCount ?? 0) - (base.tables['bans.csv']?.rowCount ?? 0)
  const sourceDelta = (current.tables['ban_sources.csv']?.rowCount ?? 0) - (base.tables['ban_sources.csv']?.rowCount ?? 0)

  const triggers: string[] = []
  if (countryDiff.added.length) triggers.push(`new countries with bans (${countryDiff.added.join(', ')})`)
  if (enumChanges.length) triggers.push(`taxonomy/enum change (${enumChanges.join(', ')})`)
  if (banDelta >= NEW_BANS_THRESHOLD) triggers.push(`+${banDelta} bans (≥ ${NEW_BANS_THRESHOLD})`)
  if (sourceDelta >= NEW_SOURCES_THRESHOLD) triggers.push(`+${sourceDelta} sources (≥ ${NEW_SOURCES_THRESHOLD})`)
  if (dBooks >= NEW_BOOKS_WITH_BAN_THRESHOLD) triggers.push(`+${dBooks} books-with-ban (≥ ${NEW_BOOKS_WITH_BAN_THRESHOLD})`)

  // Soft signal: open-field corrections (content changed without crossing a count threshold)
  const coreContentChanged = ['bans.csv', 'ban_reasons.csv', 'ban_sources.csv'].filter(
    (n) => base.tables[n]?.sha256 !== current.tables[n]?.sha256,
  )

  console.log('\n' + '─'.repeat(64))
  if (triggers.length) {
    console.log('  ▶ RECOMMENDATION: a new Zenodo version is warranted.')
    console.log('    Triggered by:')
    for (const t of triggers) console.log(`      • ${t}`)
    console.log('\n    Follow the checklist at /admin/zenodo, then re-run with --mark-deposited.')
  } else if (coreContentChanged.length) {
    console.log('  ◦ OPTIONAL: open-core content changed but below the size thresholds.')
    console.log(`    Changed tables: ${coreContentChanged.join(', ')} — likely in-place corrections to open fields.`)
    console.log('    Your call: batch with the next source-batch, or deposit now if the fixes matter.')
  } else {
    console.log('  ✓ No new version needed — open core unchanged (or only commercial enrichment changed).')
  }
  console.log('─'.repeat(64))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
