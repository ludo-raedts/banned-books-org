import { adminClient } from '../src/lib/supabase'
const supabase = adminClient()
async function main() {
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  console.log('Reason slugs:', reasons?.map(r => r.slug).join(', '))
}
main().catch(console.error)
