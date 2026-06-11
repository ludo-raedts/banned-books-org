#!/usr/bin/env tsx
/**
 * Apply the verdict from _audit_keep_narrative_groundedness.ts.
 *
 * Reads data/keep-narrative-groundedness-<date>.csv. Default scope wipes
 * the rows most clearly without value:
 *
 *   HALLUCINATED              (any)  → wipe — LLM padding with no grounded anchor
 *   THIN + cross_book_dup            → wipe — no anchor AND copy-pasted across books
 *
 * Kept (untouched):
 *   GROUNDED (any)                   → has at least one verifiable anchor;
 *                                      cross-book dup among these is addressed
 *                                      later by de-duplicating the boilerplate
 *                                      paragraph specifically, not by wiping
 *                                      the row whole.
 *   THIN without cross_book_dup      → no anchor, no duplicate. Could be a
 *                                      narrow but real case the audit missed
 *                                      (e.g. named-person challengers,
 *                                      specific school boards not in our
 *                                      regex). Keep for human review.
 *
 * On wipe:
 *   censorship_context              → NULL
 *   censorship_context_status       → 'insufficient_evidence'
 *   data_quality_evaluated_at       → now()
 *
 * Usage:
 *   npx tsx scripts/_apply_keep_narrative_groundedness.ts                     # dry-run
 *   npx tsx scripts/_apply_keep_narrative_groundedness.ts --apply             # write
 *   npx tsx scripts/_apply_keep_narrative_groundedness.ts --csv=path.csv      # explicit input
 *   npx tsx scripts/_apply_keep_narrative_groundedness.ts --aggressive        # also wipe THIN-unique
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
const AGGRESSIVE = process.argv.includes('--aggressive')

function arg(name: string): string | undefined {
  const a = process.argv.find(x => x.startsWith(`--${name}=`))
  return a ? a.slice(name.length + 3) : undefined
}
function pickCsv(): string {
  const explicit = arg('csv')
  if (explicit) return explicit
  const files = readdirSync('data')
    .filter(f => /^keep-narrative-groundedness-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
    .sort()
  if (files.length === 0) throw new Error('no keep-narrative-groundedness-*.csv in data/ — run audit first')
  return join('data', files[files.length - 1])
}
const CSV_PATH = pickCsv()

type Row = { id: number; slug: string; bucket: string; cross_book_dup: number }
function parseCsv(path: string): Row[] {
  const lines = readFileSync(path, 'utf8').split('\n').filter(l => l.length > 0)
  const header = lines.shift()!.split(',')
  const idIdx = header.indexOf('id')
  const slugIdx = header.indexOf('slug')
  const bucketIdx = header.indexOf('bucket')
  const dupIdx = header.indexOf('cross_book_dup')
  const out: Row[] = []
  for (const line of lines) {
    const f: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (q) {
        if (c === '"' && line[i+1] === '"') { cur += '"'; i++; continue }
        if (c === '"') { q = false; continue }
        cur += c
      } else {
        if (c === '"') { q = true; continue }
        if (c === ',') { f.push(cur); cur = ''; continue }
        cur += c
      }
    }
    f.push(cur)
    const id = parseInt(f[idIdx], 10)
    if (!Number.isFinite(id)) continue
    out.push({
      id,
      slug: f[slugIdx] ?? '',
      bucket: f[bucketIdx] ?? '',
      cross_book_dup: parseInt(f[dupIdx], 10) || 0,
    })
  }
  return out
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    process.exit(1)
  }
  const rows = parseCsv(CSV_PATH)
  console.log(`# Apply keep-narrative groundedness cleanup`)
  console.log(`# CSV:        ${CSV_PATH}`)
  console.log(`# Rows:       ${rows.length}`)
  console.log(`# Apply:      ${APPLY}`)
  console.log(`# Aggressive: ${AGGRESSIVE}\n`)

  const wipeIds: number[] = []
  const wipeReason: Record<number, string> = {}
  const keptByReason: Record<string, number> = {}
  for (const r of rows) {
    if (r.bucket === 'HALLUCINATED') {
      wipeIds.push(r.id); wipeReason[r.id] = 'hallucinated'
    } else if (r.bucket === 'THIN' && r.cross_book_dup === 1) {
      wipeIds.push(r.id); wipeReason[r.id] = 'thin+dup'
    } else if (r.bucket === 'THIN' && AGGRESSIVE) {
      wipeIds.push(r.id); wipeReason[r.id] = 'thin (aggressive)'
    } else {
      const key = `${r.bucket}${r.cross_book_dup ? '+dup' : ''}`
      keptByReason[key] = (keptByReason[key] ?? 0) + 1
    }
  }

  // Summary by wipe reason
  const wipeByReason: Record<string, number> = {}
  for (const id of wipeIds) {
    const k = wipeReason[id]
    wipeByReason[k] = (wipeByReason[k] ?? 0) + 1
  }
  console.log(`# To wipe (${wipeIds.length}):`)
  for (const [k, v] of Object.entries(wipeByReason)) console.log(`    ${k.padEnd(20)} ${v}`)
  console.log(`# To keep (${rows.length - wipeIds.length}):`)
  for (const [k, v] of Object.entries(keptByReason)) console.log(`    ${k.padEnd(20)} ${v}`)
  console.log()

  if (!APPLY) {
    console.log(`[dry-run] re-run with --apply to write to DB.`)
    return
  }

  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  const CHUNK = 200
  const now = new Date().toISOString()
  let updated = 0
  for (let i = 0; i < wipeIds.length; i += CHUNK) {
    const slice = wipeIds.slice(i, i + CHUNK)
    const { error, count } = await sb.from('books')
      .update(
        { censorship_context: null, censorship_context_status: 'insufficient_evidence', data_quality_evaluated_at: now },
        { count: 'exact' },
      )
      .in('id', slice)
    if (error) { console.error(`! batch ${i}: ${error.message}`); continue }
    updated += count ?? 0
    process.stdout.write(`\r  wiping: ${updated}/${wipeIds.length}`)
  }
  process.stdout.write('\n')
  console.log(`✓ wiped censorship_context on ${updated} books`)
}

main().catch(e => { console.error(e); process.exit(1) })
