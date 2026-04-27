import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const { data } = await s.from('books').select('title, slug, description_ban').not('description_ban', 'is', null).order('title')
  let count = 0
  for (const b of data ?? []) {
    if (b.description_ban?.includes('Source: Wikipedia')) {
      count++
      console.log(`---\n[${b.slug}]\n${b.description_ban}`)
    }
  }
  console.log(`\nTotal: ${count}`)
}
main()
