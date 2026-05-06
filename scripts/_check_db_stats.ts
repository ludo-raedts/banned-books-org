import { adminClient } from '../src/lib/supabase'

function fmt(n: number) {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`
}

async function main() {
  const sb = adminClient()
  const { data, error } = await sb.rpc('admin_db_stats')
  if (error) {
    console.error('RPC error:', error.message)
    process.exit(1)
  }
  console.log('Raw:', data)
  const s = data as { db_size_bytes: number; pageviews_size_bytes: number; pageviews_rows: number }
  const limitGb = Number(process.env.SUPABASE_DB_LIMIT_GB ?? '8')
  const limitBytes = limitGb * 1024 * 1024 * 1024
  const pct = (s.db_size_bytes / limitBytes) * 100
  console.log(`DB size       : ${fmt(s.db_size_bytes)} / ${limitGb} GB  (${pct.toFixed(2)}%)`)
  console.log(`Pageviews size: ${fmt(s.pageviews_size_bytes)}`)
  console.log(`Pageviews rows: ${s.pageviews_rows.toLocaleString()}`)
}

main().catch(e => { console.error(e); process.exit(1) })
