import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  
  // Check ban_source_links structure
  const { data } = await s.from('ban_source_links').select('*').limit(3)
  console.log('ban_source_links:', JSON.stringify(data, null, 2))
  
  // Get Wikipedia URLs for the top 50 books via join
  // ban_source_links -> ban_sources -> books (via bans?)
  const { data: links } = await s.from('ban_source_links').select('*').limit(3)
  console.log('link columns:', Object.keys(links?.[0] ?? {}))
}

main().catch(console.error)
