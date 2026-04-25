import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function main() {
  const { data, error } = await supabase.from('bans').select('country_code')
  if (error) { console.error(error); return }
  const counts: Record<string,number> = {}
  for (const ban of (data || []) as any[]) {
    const code = ban.country_code || 'unknown'
    counts[code] = (counts[code] || 0) + 1
  }
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1])
  console.log('Top 30 countries by ban count:')
  sorted.slice(0,30).forEach(([c,n]) => console.log(`  ${c}: ${n}`))
  console.log('\nAll countries covered:', sorted.map(([c])=>c).join(', '))
  console.log('\nTotal bans:', Object.values(counts).reduce((a,b)=>a+b,0))
}
main().catch(console.error)
