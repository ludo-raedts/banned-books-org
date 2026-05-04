import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  // Full description
  const { data: country } = await supabase
    .from('countries').select('code, name_en, description').eq('code', 'IT').single()
  console.log('=== Italy description ===')
  console.log(country?.description ?? '(none)')
  
  // All IT bans with books
  const { data: bans } = await supabase
    .from('bans')
    .select('id, year_started, year_ended, action_type, status, institution, actor, books(id, title, slug)')
    .eq('country_code', 'IT')
  console.log('\n=== IT bans ===')
  bans?.forEach(b => {
    const book = b.books as any
    console.log(`${book?.title} (${b.year_started ?? '?'}) — ${b.action_type} ${b.institution ?? ''}`)
  })
}
main().catch(console.error)
