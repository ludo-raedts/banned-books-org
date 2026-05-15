import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  const { error } = await supabase.rpc('refresh_all_materialized_views')
  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
  console.log('✓ Materialized views refreshed (mv_ban_counts, mv_country_reason_counts, mv_top_books_rising, mv_top_authors_rising)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
