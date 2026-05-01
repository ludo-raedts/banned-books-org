import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { data, error } = await s.from('authors').select('*').limit(1)
  if (error) { console.error(error); return }
  console.log('Columns:', Object.keys(data?.[0] ?? {}))
}
main()
