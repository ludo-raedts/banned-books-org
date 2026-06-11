#!/usr/bin/env tsx
/**
 * Apply the audit verdict from _audit_ban_vs_context_overlap.ts.
 *
 * Reads data/ban-vs-context-audit-<date>.csv and writes per row:
 *
 *   TEMPLATE_CONFIRMED  → censorship_context = NULL
 *                         censorship_context_status = 'insufficient_evidence'
 *   REDUCE_TO_BAN_ONLY  → censorship_context = NULL
 *                         censorship_context_status = 'insufficient_evidence'
 *   KEEP_NARRATIVE      → censorship_context_status = 'pending_review'
 *                         (text kept; v3 may later upgrade to 'narrative_curated')
 *   NO_CONTEXT          → censorship_context_status = 'pending_review'
 *                         (placeholder so v3 picks it up if grounding sources exist)
 *
 * Why mark KEEP_NARRATIVE / NO_CONTEXT as 'pending_review' explicitly:
 * the v3 grounded pipeline (task #14) will filter on this status. A NULL
 * status means "legacy, untouched by the 2026-05-29 audit" and is treated
 * the same as pending_review for now, but the marker lets us track which
 * books have been audited.
 *
 * Usage:
 *   npx tsx scripts/_apply_ban_vs_context_cleanup.ts [csv-path]
 *   npx tsx scripts/_apply_ban_vs_context_cleanup.ts [csv-path] --apply
 *
 * Default csv-path: data/ban-vs-context-audit-<today>.csv
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')
const csvArg = process.argv.find(a => !a.startsWith('-') && a.endsWith('.csv'))
const CSV_PATH = csvArg ?? `data/ban-vs-context-audit-${new Date().toISOString().slice(0, 10)}.csv`

type Row = { id: number; slug: string; bucket: string }

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n').filter(l => l.length > 0)
  const header = lines.shift()
  if (!header) throw new Error('empty CSV')
  const cols = header.split(',')
  const idIdx = cols.indexOf('id')
  const slugIdx = cols.indexOf('slug')
  const bucketIdx = cols.indexOf('bucket')
  if (idIdx < 0 || bucketIdx < 0) throw new Error('CSV missing id/bucket')
  const rows: Row[] = []
  for (const line of lines) {
    // Naive CSV parse: works because audit script CSV-escapes commas in
    // free-text columns (reasoning, title) with double-quotes.
    const fields: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQuote) {
        if (c === '"' && line[i+1] === '"') { cur += '"'; i++; continue }
        if (c === '"') { inQuote = false; continue }
        cur += c
      } else {
        if (c === '"') { inQuote = true; continue }
        if (c === ',') { fields.push(cur); cur = ''; continue }
        cur += c
      }
    }
    fields.push(cur)
    const id = parseInt(fields[idIdx], 10)
    if (!Number.isFinite(id)) continue
    rows.push({ id, slug: fields[slugIdx] ?? '', bucket: fields[bucketIdx] ?? '' })
  }
  return rows
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    console.error(`Run scripts/_audit_ban_vs_context_overlap.ts first.`)
    process.exit(1)
  }
  const rows = parseCsv(CSV_PATH)
  console.log(`# Apply ban-vs-context cleanup`)
  console.log(`# CSV:    ${CSV_PATH}`)
  console.log(`# Rows:   ${rows.length}`)
  console.log(`# Apply:  ${APPLY}\n`)

  const byBucket = new Map<string, Row[]>()
  for (const r of rows) {
    const arr = byBucket.get(r.bucket) ?? []
    arr.push(r)
    byBucket.set(r.bucket, arr)
  }
  for (const [k, v] of byBucket) {
    console.log(`  ${k.padEnd(22)} ${v.length}`)
  }
  console.log()

  if (!APPLY) {
    console.log(`[dry-run] re-run with --apply to write to DB.`)
    return
  }

  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  // Batch updates in chunks to stay within Supabase request limits.
  const CHUNK = 200
  async function batchUpdate(ids: number[], update: Record<string, unknown>, label: string): Promise<number> {
    let updated = 0
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { error, count } = await sb.from('books')
        .update(update, { count: 'exact' })
        .in('id', slice)
      if (error) { console.error(`! ${label} batch ${i}: ${error.message}`); continue }
      updated += count ?? 0
      process.stdout.write(`\r  ${label}: ${updated}/${ids.length}`)
    }
    process.stdout.write('\n')
    return updated
  }

  const now = new Date().toISOString()

  // TEMPLATE_CONFIRMED + REDUCE_TO_BAN_ONLY → wipe + insufficient_evidence
  const wipeIds = [
    ...(byBucket.get('TEMPLATE_CONFIRMED') ?? []),
    ...(byBucket.get('REDUCE_TO_BAN_ONLY') ?? []),
  ].map(r => r.id)
  if (wipeIds.length > 0) {
    const updated = await batchUpdate(
      wipeIds,
      { censorship_context: null, censorship_context_status: 'insufficient_evidence', data_quality_evaluated_at: now },
      'wipe + insufficient_evidence',
    )
    console.log(`✓ wiped censorship_context on ${updated} books`)
  }

  // KEEP_NARRATIVE → pending_review (text preserved)
  const keepIds = (byBucket.get('KEEP_NARRATIVE') ?? []).map(r => r.id)
  if (keepIds.length > 0) {
    const updated = await batchUpdate(
      keepIds,
      { censorship_context_status: 'pending_review' },
      'pending_review (keep)',
    )
    console.log(`✓ marked ${updated} KEEP_NARRATIVE rows as pending_review`)
  }

  // NO_CONTEXT → pending_review (so v3 picks them up if sources exist)
  const noContextIds = (byBucket.get('NO_CONTEXT') ?? []).map(r => r.id)
  if (noContextIds.length > 0) {
    const updated = await batchUpdate(
      noContextIds,
      { censorship_context_status: 'pending_review' },
      'pending_review (no context)',
    )
    console.log(`✓ marked ${updated} NO_CONTEXT rows as pending_review`)
  }

  console.log(`\nDone.`)
}

main().catch(e => { console.error(e); process.exit(1) })
