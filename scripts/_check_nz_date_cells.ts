#!/usr/bin/env tsx
// Inspect what's in the NZ queue rows' "date" cell to understand why parseYear
// missed them. raw_input.cells preserves the per-cell wikitext capture so we
// can see exactly what the parser saw.
import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const rows: Array<{
    id: number
    source_slug: string
    raw_input: { cells?: string[]; section_heading?: string } | null
    agreement_details: { parsed_row?: { title?: string; year?: number | null }; quality_flags?: string[] } | null
  }> = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, source_slug, raw_input, agreement_details')
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

  const noYear = rows.filter(
    r => (r.agreement_details?.quality_flags ?? []).includes('incomplete_year')
  )
  console.log(`NZ pending with incomplete_year: ${noYear.length}\n`)
  console.log('First 15 — title + raw cells [date is col 0]:')
  for (const r of noYear.slice(0, 15)) {
    const title = r.agreement_details?.parsed_row?.title ?? '(no title)'
    const cells = r.raw_input?.cells ?? []
    const dateCell = cells[0] ?? '(no cell 0)'
    console.log(`  q#${r.id} "${title.slice(0, 35)}"`)
    console.log(`     date_cell raw: ${JSON.stringify(dateCell.slice(0, 100))}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
