#!/usr/bin/env tsx
// Backfill ParsedRow.year for queue rows where neither a year column nor a
// trailing-year-paren in the title was available, but the notes_raw blob
// contains a 4-digit year in 1500-2100 range.
//
// Targets primarily wikipedia-nz, where:
//   - the wikitable's date cell holds e.g. "9 November 1942" wikitext but the
//     parser captured a null year (either column-map drift or pre-fallback
//     legacy queue rows); AND
//   - the notes blob narrates the ban year ("Banned in October 1940 for…",
//     "Found indecent in 1917 by a Magistrate's Court…").
//
// First-4-digit-year wins. In NZ sample analysis the first year in notes is
// reliably the ban year — secondary years like cited Act references
// ("under the Indecent Publications Act 1910") come AFTER the ban date in
// the source's typical phrasing.
//
// Filter: only updates rows that are still flagged `incomplete_year`, so a
// row whose year was filled by an earlier backfill pass is skipped.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-year-from-notes.ts                   # dry-run, all sources
//   npx tsx --env-file=.env.local scripts/backfill-year-from-notes.ts --source=wikipedia-nz
//   npx tsx --env-file=.env.local scripts/backfill-year-from-notes.ts --write
import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')
const sourceFlag = process.argv.find(a => a.startsWith('--source='))
const SOURCE_FILTER = sourceFlag ? sourceFlag.split('=')[1] : null

// Years 1500-2100 inclusive — wide enough for early-modern Index Librorum
// entries and tight enough to ignore stray 4-digit numbers like page counts.
const YEAR_IN_NOTES = /\b(1[5-9]\d{2}|20\d{2}|2100)\b/

type ParsedRow = {
  title?: string
  year?: number | null
  notes_raw?: string
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

async function main() {
  const s = adminClient()

  let queryBuilder = s
    .from('import_review_queue')
    .select('id, source_slug, agreement_details')
    .eq('status', 'pending_review')
  if (SOURCE_FILTER) queryBuilder = queryBuilder.eq('source_slug', SOURCE_FILTER)

  const rows: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await queryBuilder
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw new Error(`load queue: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  const flagged = rows.filter(r => (r.agreement_details?.quality_flags ?? []).includes('incomplete_year'))
  console.log(`Pending rows with incomplete_year${SOURCE_FILTER ? ` (source=${SOURCE_FILTER})` : ''}: ${flagged.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  let hits = 0
  let noYear = 0
  let emptyNotes = 0
  let errors = 0
  const bySource = new Map<string, number>()
  const samples: string[] = []

  for (const row of flagged) {
    const ad = row.agreement_details ?? {}
    const parsed = ad.parsed_row ?? {}
    const notes = (parsed.notes_raw ?? '').trim()
    if (parsed.year != null) continue  // sanity, shouldn't happen given flag filter

    if (!notes) {
      emptyNotes++
      continue
    }
    const match = notes.match(YEAR_IN_NOTES)
    if (!match) {
      noYear++
      continue
    }

    const year = parseInt(match[1], 10)
    hits++
    bySource.set(row.source_slug, (bySource.get(row.source_slug) ?? 0) + 1)
    if (samples.length < 15) {
      const title = parsed.title?.slice(0, 35) ?? '(no title)'
      samples.push(`  q#${row.id} [${row.source_slug}] "${title}" → year=${year}\n     notes: "${notes.slice(0, 120)}"`)
    }

    if (!WRITE) continue

    const newParsedRow: ParsedRow = { ...parsed, year }
    // Drop incomplete_year (the year is now set), but tag with
    // year_inferred_from_notes so the review UI surfaces that the value is a
    // best-guess from prose — e.g. "released in 1941" yields a year that's
    // the ban END not start. Bulk-auto-accept treats this as informational,
    // same as source_default_reason.
    const newFlags = (ad.quality_flags ?? [])
      .filter(f => f !== 'incomplete_year')
      .concat(
        (ad.quality_flags ?? []).includes('year_inferred_from_notes') ? [] : ['year_inferred_from_notes'],
      )
    const { error } = await s
      .from('import_review_queue')
      .update({
        agreement_details: { ...ad, parsed_row: newParsedRow, quality_flags: newFlags },
      })
      .eq('id', row.id)
      .eq('status', 'pending_review')
    if (error) {
      console.log(`  ✗ q#${row.id}: ${error.message}`)
      errors++
    }
  }

  console.log('── 15 SAMPLES ──')
  for (const s of samples) console.log(s)

  console.log('\n── BY SOURCE ──')
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${src}`)
  }

  console.log('\n──────────── Summary ────────────')
  console.log(`Total inspected:           ${flagged.length}`)
  console.log(`Year extracted from notes: ${hits}`)
  console.log(`No year in notes:          ${noYear}`)
  console.log(`Empty notes (skipped):     ${emptyNotes}`)
  if (WRITE) console.log(`Update errors:             ${errors}`)
  if (!WRITE) console.log(`\n[DRY-RUN] Re-run with --write to apply.`)
}

main().catch(e => { console.error(e); process.exit(1) })
