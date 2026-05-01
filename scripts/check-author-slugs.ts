import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { data } = await s.from('authors').select('display_name, slug').order('display_name')
  for (const a of data ?? []) {
    console.log(`${a.slug ?? '(no slug)'} — ${a.display_name}`)
  }
}
main()
