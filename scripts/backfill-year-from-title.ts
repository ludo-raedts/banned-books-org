#!/usr/bin/env tsx
// Backfill ParsedRow.year for queue rows where the wikitext parser couldn't
// resolve a year from a column, but the title cell carries a trailing
// `(YYYY)` or `(pub. YYYY)`. The parser already does this for new imports
// (see splitModel3Title in src/lib/wikipedia/parser.ts), but older queue
// rows were imported before the fallback existed AND/OR the parser's
// column-mapping for China/Iran has columns.year=null which used to leave
// year=null even when the title carried a year.
//
// For each `flag=incomplete_year` row, try (in order):
//   1. `(pub. YYYY)` anywhere in the title → year + strip from title
//   2. Trailing `(YYYY)` → year + strip from title
//
// On a hit: update `agreement_details.parsed_row.year` AND replace the
// stripped title in `agreement_details.parsed_row.title`. Drop the
// `incomplete_year` quality_flag.
//
// Title stripping matters because the canonical title (used for book.slug)
// shouldn't carry the year suffix — the parser strips it for fresh imports
// so existing-and-new books need to align.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-year-from-title.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/backfill-year-from-title.ts --write
import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

// Mirror src/lib/wikipedia/parser.ts exactly for the first two. Years
// restricted to 1500–2100 so arbitrary 4-digit substrings like "Room 1984"
// don't false-match (parens are required at end-of-string anyway).
const TRAILING_YEAR_PAREN = /\s*\((1[5-9]\d{2}|20\d{2}|2100)\)\s*$/
const PUB_YEAR_PAREN_ANYWHERE =
  /\s*\((?:pub\.?|published)\s+(1[5-9]\d{2}|20\d{2}|2100)\)\s*/i
// Extension only used here, not by the live parser: range/disjunction forms
// observed in China (manga serialization "(2003 – 2006)" and disputed-date
// rows "(2003 or 2008)") and Index Librorum ("(1797–1801)"). Take the FIRST
// year as the canonical publication year. Both en-dash (–) and ASCII hyphen
// (-) accepted as the range separator.
const TRAILING_YEAR_RANGE_PAREN =
  /\s*\((1[5-9]\d{2}|20\d{2}|2100)\s*(?:[–-]|or)\s*(?:1[5-9]\d{2}|20\d{2}|2100)\)\s*$/i

type ParsedRow = {
  title?: string
  year?: number | null
  [k: string]: unknown
}

type QueueRow = {
  id: number
  source_slug: string
  agreement_details: {
    parsed_row?: ParsedRow
    quality_flags?: string[]
    [k: string]: unknown
  } | null
}

function extractYear(rawTitle: string): { year: number; cleanedTitle: string } | null {
  // 1. "(pub. YYYY)" / "(published YYYY)" — Index Librorum convention,
  //    paren may sit anywhere in the title.
  const pubMatch = rawTitle.match(PUB_YEAR_PAREN_ANYWHERE)
  if (pubMatch) {
    const year = parseInt(pubMatch[1], 10)
    const cleaned = rawTitle.replace(PUB_YEAR_PAREN_ANYWHERE, ' ').replace(/\s+/g, ' ').trim()
    return { year, cleanedTitle: cleaned }
  }
  // 2. Trailing "(YYYY)" — common across China, Iran, banned-by-governments.
  const yearMatch = rawTitle.match(TRAILING_YEAR_PAREN)
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10)
    const cleaned = rawTitle.replace(TRAILING_YEAR_PAREN, '').trim()
    return { year, cleanedTitle: cleaned }
  }
  // 3. Trailing "(YYYY – YYYY)" / "(YYYY or YYYY)" — China manga / Index
  //    Librorum date ranges. First year wins.
  const rangeMatch = rawTitle.match(TRAILING_YEAR_RANGE_PAREN)
  if (rangeMatch) {
    const year = parseInt(rangeMatch[1], 10)
    const cleaned = rawTitle.replace(TRAILING_YEAR_RANGE_PAREN, '').trim()
    return { year, cleanedTitle: cleaned }
  }
  return null
}

async function loadIncompleteYearRows(s: ReturnType<typeof adminClient>): Promise<QueueRow[]> {
  const all: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, source_slug, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw new Error(`load queue: ${error.message}`)
    if (!data?.length) break
    all.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return all.filter(r => (r.agreement_details?.quality_flags ?? []).includes('incomplete_year'))
}

async function main() {
  const s = adminClient()
  const rows = await loadIncompleteYearRows(s)
  console.log(`Pending rows with incomplete_year: ${rows.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  let hits = 0
  let noTitle = 0
  let noYearInTitle = 0
  let errors = 0
  const bySource = new Map<string, number>()
  const samples: string[] = []

  for (const row of rows) {
    const ad = row.agreement_details ?? {}
    const parsed = ad.parsed_row ?? {}
    const title = parsed.title

    if (!title) {
      noTitle++
      continue
    }
    if (parsed.year != null) {
      // Sanity: row has incomplete_year flag but actually has a year.
      // Drop the stale flag and continue.
      const flags = (ad.quality_flags ?? []).filter(f => f !== 'incomplete_year')
      if (!WRITE) continue
      const { error } = await s
        .from('import_review_queue')
        .update({ agreement_details: { ...ad, quality_flags: flags } })
        .eq('id', row.id)
        .eq('status', 'pending_review')
      if (error) errors++
      continue
    }

    const result = extractYear(title)
    if (!result) {
      noYearInTitle++
      continue
    }

    hits++
    bySource.set(row.source_slug, (bySource.get(row.source_slug) ?? 0) + 1)
    if (samples.length < 10) {
      samples.push(`  q#${row.id} [${row.source_slug}] "${title.slice(0, 50)}" → year=${result.year}, title="${result.cleanedTitle.slice(0, 40)}"`)
    }

    if (!WRITE) continue

    const newParsedRow: ParsedRow = {
      ...parsed,
      title: result.cleanedTitle,
      year: result.year,
    }
    const newFlags = (ad.quality_flags ?? []).filter(f => f !== 'incomplete_year')
    const { error } = await s
      .from('import_review_queue')
      .update({
        agreement_details: {
          ...ad,
          parsed_row: newParsedRow,
          quality_flags: newFlags,
        },
      })
      .eq('id', row.id)
      .eq('status', 'pending_review')
    if (error) {
      console.log(`  ✗ q#${row.id}: ${error.message}`)
      errors++
    }
  }

  console.log('── 10 SAMPLES ──')
  for (const s of samples) console.log(s)

  console.log('\n── BY SOURCE ──')
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${src}`)
  }

  console.log('\n──────────── Summary ────────────')
  console.log(`Total inspected:           ${rows.length}`)
  console.log(`Year extracted from title: ${hits}`)
  console.log(`No year in title:          ${noYearInTitle}`)
  console.log(`Missing title (skipped):   ${noTitle}`)
  if (WRITE) console.log(`Update errors:             ${errors}`)
  if (!WRITE) console.log(`\n[DRY-RUN] Re-run with --write to apply.`)
}

main().catch(e => { console.error(e); process.exit(1) })
