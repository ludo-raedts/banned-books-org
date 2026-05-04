import { adminClient } from '../src/lib/supabase'
async function main() {
  const c = adminClient()
  const { data, error } = await c.from('countries').select('code, name_en').ilike('name_en', '%alaysia%')
  console.log('Malaysia:', JSON.stringify(data), 'error:', JSON.stringify(error))
}
main().catch(console.error)
