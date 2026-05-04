import { adminClient } from '../src/lib/supabase'
async function main() {
  const supabase = adminClient()
  const { error } = await supabase.rpc('refresh_mv_ban_counts' as any)
  if (error) {
    // Try direct SQL
    const { error: e2 } = await (supabase as any).rpc('exec_sql', { sql: 'REFRESH MATERIALIZED VIEW mv_ban_counts;' })
    if (e2) console.error('Error:', e2.message)
    else console.log('✓ mv_ban_counts refreshed via exec_sql')
  } else {
    console.log('✓ mv_ban_counts refreshed')
  }
}
main().catch(console.error)
