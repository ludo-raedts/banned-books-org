#!/usr/bin/env tsx
import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const rows: Array<{ id: number; source_slug: string; agreement_details: { parsed_row?: { title?: string }; quality_flags?: string[] } | null }> = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, source_slug, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as typeof rows))
    if (data.length < 1000) break
    offset += 1000
  }

  const flagged = rows.filter(r => (r.agreement_details?.quality_flags ?? []).includes('incomplete_year'))
  const trailingYear = /\((1[5-9]\d{2}|20\d{2}|2100)\)\s*$/
  const pubYear = /\((?:pub\.?|published)\s+(1[5-9]\d{2}|20\d{2}|2100)\)/i
  const noYearInTitle = flagged.filter(r => {
    const t = r.agreement_details?.parsed_row?.title ?? ''
    return !trailingYear.test(t) && !pubYear.test(t)
  })

  const bySource = new Map<string, number>()
  for (const r of noYearInTitle) bySource.set(r.source_slug, (bySource.get(r.source_slug) ?? 0) + 1)
  console.log('No-year-in-title by source:')
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${src}`)
  }

  console.log('\n20 samples (grouped by source):')
  for (const [src] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    const sourceRows = noYearInTitle.filter(r => r.source_slug === src).slice(0, 5)
    console.log(`\n  [${src}]`)
    for (const r of sourceRows) {
      console.log(`    q#${r.id} "${r.agreement_details?.parsed_row?.title?.slice(0, 80)}"`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
