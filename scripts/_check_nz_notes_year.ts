#!/usr/bin/env tsx
// Look at NZ pending+incomplete_year rows: how often does notes_raw contain
// a year? What's the distribution of patterns?
import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const rows: Array<{
    id: number
    agreement_details: { parsed_row?: { title?: string; year?: number | null; notes_raw?: string }; quality_flags?: string[] } | null
  }> = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, agreement_details')
      .eq('status', 'pending_review')
      .eq('source_slug', 'wikipedia-nz')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as typeof rows))
    if (data.length < 1000) break
    offset += 1000
  }

  const flagged = rows.filter(r => (r.agreement_details?.quality_flags ?? []).includes('incomplete_year'))
  console.log(`NZ pending with incomplete_year: ${flagged.length}\n`)

  let withYearInNotes = 0
  let withoutAnyYear = 0
  const yearRegex = /\b(1[89]\d{2}|20\d{2})\b/
  const samplesWithYear: string[] = []
  const samplesWithoutYear: string[] = []

  for (const r of flagged) {
    const notes = (r.agreement_details?.parsed_row?.notes_raw ?? '').trim()
    const title = r.agreement_details?.parsed_row?.title ?? ''
    const m = notes.match(yearRegex)
    if (m) {
      withYearInNotes++
      if (samplesWithYear.length < 15) {
        samplesWithYear.push(`  q#${r.id} "${title.slice(0, 35)}" → notes: "${notes.slice(0, 120)}" → year=${m[1]}`)
      }
    } else {
      withoutAnyYear++
      if (samplesWithoutYear.length < 10) {
        samplesWithoutYear.push(`  q#${r.id} "${title.slice(0, 35)}" → notes: "${notes.slice(0, 120) || '(empty)'}"`)
      }
    }
  }

  console.log(`With year in notes:    ${withYearInNotes}`)
  console.log(`No year anywhere:      ${withoutAnyYear}`)
  console.log('\n── SAMPLES WITH YEAR IN NOTES ──')
  for (const s of samplesWithYear) console.log(s)
  console.log('\n── SAMPLES WITHOUT YEAR ──')
  for (const s of samplesWithoutYear) console.log(s)
}

main().catch(e => { console.error(e); process.exit(1) })
