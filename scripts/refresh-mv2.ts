import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' } }
  )
  
  // Use raw SQL via the REST API
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_refresh`, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  
  if (!res.ok) {
    // Try through supabase admin
    const { error } = await supabase.from('mv_ban_counts').select('*').limit(1)
    console.log('MV accessible:', !error)
    console.log('Cannot refresh directly - run: supabase db execute "REFRESH MATERIALIZED VIEW mv_ban_counts;"')
  } else {
    console.log('✓ refreshed')
  }
}
main().catch(console.error)
