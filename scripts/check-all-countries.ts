import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const { data: countries } = await supabase
    .from('countries').select('code, name_en, description, slug')
  
  // Get ban counts
  const counts: Record<string, number> = {}
  let offset = 0
  while (true) {
    const { data } = await supabase.from('bans').select('country_code').range(offset, offset + 999)
    if (!data || data.length === 0) break
    data.forEach(b => { counts[b.country_code] = (counts[b.country_code] ?? 0) + 1 })
    if (data.length < 1000) break
    offset += 1000
  }
  
  const sorted = (countries ?? [])
    .map(c => ({ ...c, banCount: counts[c.code] ?? 0 }))
    .sort((a, b) => b.banCount - a.banCount)
    .slice(0, 35)
  
  sorted.forEach(c => {
    const hasDesc = c.description ? '✓' : '✗'
    console.log(`${c.code.padEnd(4)} ${c.name_en.padEnd(30)} ${String(c.banCount).padStart(5)} bans  desc:${hasDesc}`)
  })
}
main().catch(console.error)
