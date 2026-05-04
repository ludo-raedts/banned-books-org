import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const searches = [
    { q: 'memed my hawk', cc: 'TR' },
    { q: 'yasar kemal', isAuthor: true, cc: 'TR' },
    { q: 'pamuk', isAuthor: true, cc: 'TR' },
    { q: 'el señor presidente', cc: 'ES' },
    { q: 'don quixote', cc: 'ES' },
    { q: 'Noli Me Tangere', cc: null },
    { q: 'to kill a mockingbird', cc: 'ID' },
    { q: 'la casa de bernarda', cc: 'ES' },
  ]
  
  for (const { q, isAuthor, cc } of searches) {
    if (isAuthor) {
      const { data: authors } = await supabase.from('authors')
        .select('id, display_name').ilike('display_name', `%${q}%`)
      console.log(`Author "${q}": ${authors?.map(a => a.display_name).join(', ') ?? 'NOT FOUND'}`)
    } else {
      const { data: books } = await supabase.from('books')
        .select('id, title, slug').ilike('title', `%${q}%`).limit(3)
      if (books?.length) {
        for (const b of books) {
          if (cc) {
            const { data: ban } = await supabase.from('bans')
              .select('id').eq('book_id', b.id).eq('country_code', cc).limit(1)
            console.log(`"${b.title}" [${cc}]: ${ban?.length ? 'HAS BAN' : 'NO BAN'}`)
          } else {
            const { data: bans } = await supabase.from('bans')
              .select('country_code').eq('book_id', b.id)
            console.log(`"${b.title}": bans in ${bans?.map(b => b.country_code).join(', ') || 'none'}`)
          }
        }
      } else { console.log(`Book "${q}": NOT FOUND`) }
    }
  }
}
main().catch(console.error)
