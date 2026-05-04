import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const codes = ['IT', 'JP', 'CN', 'ES', 'CL', 'TR', 'ID']
  
  for (const code of codes) {
    const { data: country } = await supabase
      .from('countries').select('code, name_en, description').eq('code', code).single()
    const { count } = await supabase
      .from('bans').select('id', { count: 'exact', head: true }).eq('country_code', code)
    console.log(`${code} (${country?.name_en}): ${count} bans, desc: ${country?.description ? country.description.slice(0, 80) + '...' : 'NONE'}`)
  }
}
main().catch(console.error)
