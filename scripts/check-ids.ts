import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  // Get book IDs for books that need new bans
  const { data: aqwf } = await supabase.from('books').select('id, title, slug')
    .ilike('title', '%all quiet on the western front%').limit(1)
  const { data: lcl } = await supabase.from('books').select('id, title, slug')
    .eq('slug', 'lady-chatterleys-lover').limit(1)
  
  console.log('All Quiet:', JSON.stringify(aqwf))
  console.log('Lady Chatterley (original):', JSON.stringify(lcl))
  
  // Get scope IDs
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  console.log('Scopes:', scopes?.map(s => `${s.id}=${s.slug}`).join(', '))
  
  // Reason IDs
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  console.log('Reasons:', reasons?.map(r => `${r.id}=${r.slug}`).join(', '))
  
  // Check existing IT bans structure
  const { data: itBans } = await supabase.from('bans')
    .select('id, scope_id, action_type, status, year_started, actor, institution, ban_reason_links(reason_id)')
    .eq('country_code', 'IT').limit(3)
  console.log('Sample IT bans:', JSON.stringify(itBans, null, 2))
}
main().catch(console.error)
