import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const { data: country } = await supabase
    .from('countries').select('code, name_en, description').eq('code', 'IT').single()
  console.log('Italy description:', country?.description?.slice(0, 300) ?? '(none)')
  
  const { count } = await supabase
    .from('bans').select('id', { count: 'exact', head: true }).eq('country_code', 'IT')
  console.log(`\nIT bans in DB: ${count}`)
  
  const { data: scopes } = await supabase.from('scopes').select('id, slug, label_en')
  console.log('\nScopes:', scopes?.map(s => `${s.id}=${s.slug}`).join(', '))
  
  const { data: reasons } = await supabase.from('reasons').select('id, slug, label_en')
  console.log('\nReasons:', reasons?.map(r => `${r.id}=${r.slug}`).join(', '))
}
main().catch(console.error)
