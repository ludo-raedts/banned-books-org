import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  // Check if specific books are in DB
  const titles = [
    'all quiet on the western front',
    'mein kampf',
    'the metamorphosis',
    'the trial',
    'ulysses',
    'lady chatterley',
    'the well of loneliness',
    'fiesta',
    'farewell to arms',
  ]
  
  for (const t of titles) {
    const { data } = await supabase.from('books')
      .select('id, title, slug')
      .ilike('title', `%${t}%`)
      .limit(3)
    if (data?.length) {
      console.log(`FOUND "${t}":`, data.map(b => `${b.slug}`).join(', '))
      // Check if IT ban exists
      for (const book of data) {
        const { data: itBan } = await supabase.from('bans')
          .select('id').eq('book_id', book.id).eq('country_code', 'IT').limit(1)
        if (itBan?.length) console.log(`  → already has IT ban`)
        else console.log(`  → NO IT ban`)
      }
    } else {
      console.log(`NOT FOUND: "${t}"`)
    }
  }
}
main().catch(console.error)
