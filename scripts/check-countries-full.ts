import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  const codes = ['JP', 'ID']
  for (const code of codes) {
    const { data } = await supabase.from('countries').select('description').eq('code', code).single()
    console.log(`\n=== ${code} ===`)
    console.log(data?.description ?? '(none)')
  }
}
main().catch(console.error)
