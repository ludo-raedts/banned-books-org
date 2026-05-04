import { adminClient } from '../src/lib/supabase'
async function main() {
  const sb = adminClient()
  const [
    { count: totalBooks },
    { count: totalBans },
    { data: recent },
  ] = await Promise.all([
    sb.from('books').select('*', { count: 'exact', head: true }),
    sb.from('bans').select('*', { count: 'exact', head: true }),
    sb.from('books').select('id, title, created_at').order('created_at', { ascending: false }).limit(5) as any,
  ])
  console.log('Total books:', totalBooks)
  console.log('Total bans:', totalBans)
  console.log('Most recently added:')
  for (const b of recent ?? []) console.log(`  [${b.id}] ${b.title} — ${b.created_at}`)
}
main().catch(console.error)
