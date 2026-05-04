import { adminClient } from '../src/lib/supabase'
async function main() {
  const supabase = adminClient()
  const checks = ['120 days', 'sade', 'jackie collins', 'Another Country', 'the stud', 'Forever Amber']
  for (const q of checks) {
    const { data } = await supabase.from('books').select('id, title, slug').ilike('title', `%${q}%`).limit(3)
    if (data?.length) console.log(`"${q}":`, data.map(b => `${b.slug}(${b.id})`).join(', '))
    else {
      // Try author search
      const { data: authors } = await supabase.from('authors').select('id, display_name').ilike('display_name', `%${q}%`).limit(2)
      if (authors?.length) console.log(`Author "${q}":`, authors.map(a => a.display_name).join(', '))
      else console.log(`NOT FOUND: "${q}"`)
    }
  }
}
main().catch(console.error)
