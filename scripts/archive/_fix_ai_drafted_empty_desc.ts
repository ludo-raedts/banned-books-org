/**
 * One-shot fix: reset ai_drafted = false on books where description_book
 * is null or empty. Cleanup-agent wiped hallucinated AI descriptions but
 * left ai_drafted = true, causing score-data-quality to flag those books
 * as `ai-drafted-empty-desc` (~2460 records).
 *
 * They are NOT ai-drafted anymore — the description is gone — so the flag
 * is misleading. After this fix they fall back to `default` (or stay flagged
 * if they have other hard problems like cover-placeholder / only-placeholder-authors).
 *
 *   npx tsx --env-file=.env.local scripts/_fix_ai_drafted_empty_desc.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/_fix_ai_drafted_empty_desc.ts --apply  # write
 */
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const supabase = adminClient()

async function fetchTargetIds(): Promise<number[]> {
  const ids: number[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, description_book')
      .eq('ai_drafted', true)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      const d = (row.description_book ?? '').trim()
      if (d.length === 0) ids.push(row.id)
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return ids
}

async function main() {
  console.log('Scanning books with ai_drafted=true and empty description_book...')
  const targetIds = await fetchTargetIds()
  console.log(`Found ${targetIds.length} books to reset.`)

  if (!APPLY) {
    console.log('\nDry run — pass --apply to write.')
    console.log('Sample first 10 IDs:', targetIds.slice(0, 10))
    return
  }

  console.log('\nApplying ai_drafted=false in batches of 500...')
  let done = 0
  const BATCH = 500
  for (let i = 0; i < targetIds.length; i += BATCH) {
    const chunk = targetIds.slice(i, i + BATCH)
    const { error } = await supabase
      .from('books')
      .update({ ai_drafted: false })
      .in('id', chunk)
    if (error) {
      console.error('Update failed at offset', i, error)
      throw error
    }
    done += chunk.length
    console.log(`  ${done}/${targetIds.length}`)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
