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

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type DatasetClient = SupabaseClient
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
  /** Optional `column IN (values)` filter, e.g. the register lists we may redistribute. */
  inFilter?: { column: string; values: (string | number)[] },
): Promise<Row[]> {
  const cols = orderBy.split(',').map((c) => c.trim()).filter(Boolean)
  if (cols.length === 0) {
    throw new Error(`fetchAll(${table}): orderBy is required for stable pagination`)
  }
  const PAGE = pageSize
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const data = await fetchPageWithRetry(supabase, table, columns, cols, from, PAGE, inFilter)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

/** True for transient DB errors worth retrying — chiefly Postgres 57014
 *  ("canceling statement due to statement timeout"), which the build hits when
 *  it coincides with production read load (a crawler wave). Page reads are
 *  idempotent, so a retry after a short wait for the load to pass is safe. */
function isTransientError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '57014') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('statement timeout') || m.includes('timeout') || m.includes('fetch failed')
}

async function fetchPageWithRetry(
  supabase: DatasetClient,
  table: string,
  columns: string,
  cols: string[],
  from: number,
  PAGE: number,
  inFilter?: { column: string; values: (string | number)[] },
  // 7 attempts = 2+4+8+16+32+64 s ≈ 2 min of backoff. 5 attempts (~30 s) lost a
  // production deploy on 2026-10-26 when a batch script's UPDATE burst held the
  // DB past the statement timeout for longer than that.
  maxAttempts = 7,
): Promise<Row[] | null> {
  for (let attempt = 1; ; attempt++) {
    let q = supabase.from(table).select(columns)
    if (inFilter) q = q.in(inFilter.column, inFilter.values)
    for (const col of cols) q = q.order(col, { ascending: true })
    const { data, error } = await q.range(from, from + PAGE - 1)
    // `columns` is a runtime string, so supabase-js cannot infer the row shape.
    if (!error) return data as unknown as Row[]
    if (attempt >= maxAttempts || !isTransientError(error)) {
      throw new Error(`fetch ${table}: ${error.message}`)
    }
    // Exponential backoff (2s … 64s) to ride out the load spike.
    const waitMs = 1000 * 2 ** attempt
    console.log(
      `    ⚠ ${table} page @${from} timed out (attempt ${attempt}/${maxAttempts}); retrying in ${waitMs / 1000}s`,
    )
    await new Promise((r) => setTimeout(r, waitMs))
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function csvEscape(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return csvEscape(value.join('|'))
  const s = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Render rows to a CSV string (header + lines). Single source of truth so a
 *  hash of this output matches the file written by writeCsv byte-for-byte. */
export function toCsv(columns: readonly string[], rows: Row[]): string {
  const lines = [columns.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(','))
  }
  return lines.join('\n') + '\n'
}

export function writeCsv(
  dir: string,
  filename: string,
  columns: readonly string[],
  rows: Row[],
) {
  return writeFile(join(dir, filename), toCsv(columns, rows), 'utf8')
}

// ─── Register lists ──────────────────────────────────────────────────────────
// Very large official ban lists are kept as lean "register" entries instead of
// book records (src/lib/registers.ts). Both exports ship them as two separate
// files — never mixed into books.csv — so a user can tell "documented book"
// from "title on an official list".
//
// Only lists we may redistribute go in. A list is added here once its source
// terms are settled:
//  - index-1877: the 1877 Index Librorum Prohibitorum, public domain.
//  - sbz-1946 is NOT included yet: it follows Olaf Simons' transcription on
//    polunbi.de and waits for his answer on reuse.
export const DATASET_REGISTER_SLUGS = ['index-1877'] as const

export const REGISTER_LIST_COLUMNS = [
  'id', 'slug', 'title', 'title_en', 'issuer', 'country_code', 'year_start', 'year_end',
  'framing', 'source_name', 'source_url', 'licence_note',
] as const
export const REGISTER_ENTRY_COLUMNS = [
  'id', 'list_id', 'edition', 'kind', 'printed_author', 'author_display', 'title', 'imprint',
  'pub_year', 'ban_year', 'note', 'printed_page', 'locator', 'source_url', 'matched_book_id',
] as const

/** The redistributable register lists and all their entries. */
export async function fetchRegisters(supabase: DatasetClient): Promise<{ lists: Row[]; entries: Row[] }> {
  const lists = await fetchAll(supabase, 'register_lists', REGISTER_LIST_COLUMNS.join(','), 'id', 1000, {
    column: 'slug',
    values: [...DATASET_REGISTER_SLUGS],
  })
  if (lists.length === 0) return { lists, entries: [] }
  const entries = await fetchAll(supabase, 'register_entries', REGISTER_ENTRY_COLUMNS.join(','), 'id', 1000, {
    column: 'list_id',
    values: lists.map((l) => l.id as number),
  })
  return { lists, entries }
}

/** Book entries with no record in books.csv — the "further titles" figure the site shows. */
export function registerFurtherTitles(entries: Row[]): number {
  return entries.filter((e) => e.kind === 'book' && e.matched_book_id == null).length
}

/** README section shared by both exports. */
export function registerReadmeSection(lists: Row[], entries: Row[]): string {
  if (lists.length === 0) return ''
  const perList = lists
    .map((l) => {
      const mine = entries.filter((e) => e.list_id === l.id)
      return `- ${l.title_en ?? l.title} (${l.country_code}, ${l.year_start}${l.year_end && l.year_end !== l.year_start ? `–${l.year_end}` : ''}): ${mine.length.toLocaleString('en')} entries, ${registerFurtherTitles(mine).toLocaleString('en')} of them book titles without a record in books.csv`
    })
    .join('\n')
  return `## Register lists (register_lists.csv / register_entries.csv)

Some official ban lists are too large to document book by book. Their entries
are kept as a *register*: the title and author as printed, the edition, and a
pointer to the original source — no description, ISBN, cover or author record.

**Register entries are not books in this dataset and are not included in the
book, ban or country counts above. Do not add the two figures together.**

${perList}

- \`register_entries.kind\` is \`book\`, \`blanket\` (all works of an author),
  \`group\` (a whole category), \`periodical\` or \`rescission\` (a ban lifted).
- \`register_entries.matched_book_id\` (\`matched_book_slug\` in the open
  export) points at the book record when the same work is also documented as
  a book; empty otherwise.
- \`printed_author\` / \`title\` are as printed in the list (historical
  spelling, Latin forms, OCR); \`author_display\` is a normalised name where
  we have one.
- Lists whose source terms are not yet settled are browsable on the site
  (https://www.banned-books.org/registers) but not part of this file.
`
}
