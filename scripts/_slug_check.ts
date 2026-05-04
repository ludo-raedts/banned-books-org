import { adminClient } from '../src/lib/supabase'
async function main() {
  const { data } = await adminClient().from('books').select('id, title, slug').ilike('title', '%origin%species%').limit(3)
  console.log(JSON.stringify(data, null, 2))
}
main().catch(console.error)
