/**
 * Shared plumbing for the dataset-export scripts.
 *
 * Two scripts produce exports from the same Supabase tables but with
 * deliberately different field selections:
 *
 *   - scripts/build-dataset.ts        → the paid commercial ZIP (full prose,
 *                                        convenience formats, enrichment)
 *   - scripts/build-zenodo-dataset.ts → the open CC-BY-4.0 censorship core
 *
 * The *query logic* (which columns, how rows are resolved into output) lives
 * in each script — that split is the whole point. What they share is the
 * generic plumbing below: env loading, a service-role client, paginated reads
 * with mandatory ordering, and CSV writing. Keep it here so both stay in sync.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type DatasetClient = ReturnType<typeof createClient>
export type Row = Record<string, unknown>

// ─── Env ─────────────────────────────────────────────────────────────────────

/**
 * `dotenv/config` doesn't auto-read `.env.local`; do it manually for a script
 * run. Existing env vars win, so a real shell environment overrides the file.
 */
export function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (process.env[key]) continue
    process.env[key] = trimmed.slice(eq + 1)
  }
}

export function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

/**
 * Build a service-role Supabase client for a standalone script run. Loads
 * `.env.local` first — we can't use `src/lib/supabase.ts`'s `adminClient()`
 * here because that module reads `process.env` at import time, before a script
 * has had the chance to populate it.
 */
export function makeAdminClient(): DatasetClient {
  loadEnvLocal()
  return createClient(
    mustEnv('NEXT_PUBLIC_SUPABASE_URL'),
    mustEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── Fetching ────────────────────────────────────────────────────────────────

/**
 * Read every row of a table in pages of 1000.
 *
 * `orderBy` is a comma-separated list of columns and is REQUIRED: stable
 * ordering is the only thing that keeps `.range()` from returning the same row
 * in two consecutive pages once a table grows past PAGE rows.
 *
 * `pageSize` defaults to 1000. Lower it for wide tables whose rows carry large
 * text columns (e.g. `books` with its prose fields): at ~14k rows a 1000-row
 * page took ~6s server-side, close enough to Supabase's statement_timeout that
 * it tipped over under the concurrent Promise.all in build-dataset. A 500-row
 * page is ~1s — comfortably under the limit.
 */
export async function fetchAll(
  supabase: DatasetClient,
  table: string,
  columns: string,
  orderBy: string,
  pageSize = 1000,
): Promise<Row[]> {
  const cols = orderBy.split(',').map((c) => c.trim()).filter(Boolean)
  if (cols.length === 0) {
    throw new Error(`fetchAll(${table}): orderBy is required for stable pagination`)
  }
  const PAGE = pageSize
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns)
    for (const col of cols) q = q.order(col, { ascending: true })
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(`fetch ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
  }
  return rows
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function csvEscape(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return csvEscape(value.join('|'))
  const s = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function writeCsv(
  dir: string,
  filename: string,
  columns: readonly string[],
  rows: Row[],
) {
  const lines = [columns.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(','))
  }
  return writeFile(join(dir, filename), lines.join('\n') + '\n', 'utf8')
}
