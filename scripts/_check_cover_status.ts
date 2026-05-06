/**
 * Quick verification of the cover_status migration + enrich-covers-v2 writes.
 * Reports counts by cover_status and shows the 5 most recently checked rows.
 */

import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()

  const statuses = ['valid', 'rejected_placeholder', 'manual_override', 'null'] as const
  console.log('\n── cover_status counts ──')
  for (const s of statuses) {
    const q = supabase.from('books').select('id', { count: 'exact', head: true })
    const filtered = s === 'null' ? q.is('cover_status', null) : q.eq('cover_status', s)
    const { count, error } = await filtered
    if (error) { console.error(`  ${s}: ERROR ${error.message}`); continue }
    console.log(`  ${s.padEnd(22)} ${count ?? 0}`)
  }

  console.log('\n── 5 most recently checked rows ──')
  const { data, error } = await supabase
    .from('books')
    .select('id, slug, title, cover_status, cover_checked_at, cover_url')
    .not('cover_checked_at', 'is', null)
    .order('cover_checked_at', { ascending: false })
    .limit(5)

  if (error) { console.error(`Error: ${error.message}`); process.exit(1) }
  for (const b of data ?? []) {
    const url = b.cover_url ? b.cover_url.slice(0, 60) + '…' : '(null)'
    console.log(`  id=${b.id} status=${b.cover_status} checked=${b.cover_checked_at}`)
    console.log(`    ${b.title}`)
    console.log(`    url=${url}`)
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
