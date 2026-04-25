import { adminClient } from '../src/lib/supabase'
const supabase = adminClient()
async function main() {
  const { data } = await supabase.from('countries').select('code, name_en, description').not('description','is',null)
  for(const c of (data||[]) as any[]) {
    console.log(`\n${c.code} (${c.name_en}):\n${c.description}`)
  }
}
main().catch(console.error)
