import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const queries = [
    // Italy
    { q: 'all quiet on the western front', countries: ['IT'] },
    // Japan
    { q: "lady chatterley", countries: ['JP'] },
    // Indonesia - Pramoedya
    { q: 'pramoedya', byAuthor: true, countries: ['ID'] },
    { q: 'this earth of mankind', countries: ['ID'] },
    { q: 'buru', countries: ['ID'] },
    // Turkey - Pamuk
    { q: 'pamuk', byAuthor: true, countries: ['TR'] },
    { q: 'snow pamuk', countries: ['TR'] },
    { q: 'my name is red', countries: ['TR'] },
    { q: 'silent house', countries: ['TR'] },
    // Spain
    { q: 'lorca', byAuthor: true, countries: ['ES'] },
    { q: 'for whom the bell', countries: ['ES'] },
    // Chile
    { q: 'neruda', byAuthor: true, countries: ['CL'] },
  ]
  
  for (const { q, byAuthor, countries } of queries) {
    let data: any[]
    if (byAuthor) {
      const { data: authors } = await supabase.from('authors')
        .select('id, slug, display_name').ilike('display_name', `%${q}%`)
      if (authors?.length) {
        for (const a of authors) {
          const { data: books } = await supabase.from('book_authors')
            .select('books(id, title, slug)').eq('author_id', a.id)
          const bs = books?.map((b: any) => b.books).filter(Boolean) ?? []
          for (const book of bs) {
            for (const cc of countries) {
              const { data: ban } = await supabase.from('bans')
                .select('id').eq('book_id', book.id).eq('country_code', cc).limit(1)
              const hasBan = ban && ban.length > 0
              console.log(`[${cc}] ${book.title} (by ${a.display_name}): ${hasBan ? 'HAS BAN' : 'NO BAN'}`)
            }
          }
        }
      } else { console.log(`Author not found: ${q}`) }
    } else {
      const { data: books } = await supabase.from('books')
        .select('id, title, slug').ilike('title', `%${q}%`).limit(3)
      if (books?.length) {
        for (const book of books) {
          for (const cc of countries) {
            const { data: ban } = await supabase.from('bans')
              .select('id').eq('book_id', book.id).eq('country_code', cc).limit(1)
            const hasBan = ban && ban.length > 0
            console.log(`[${cc}] "${book.title}": ${hasBan ? 'HAS BAN' : 'NO BAN'}`)
          }
        }
      } else { console.log(`Book not found: "${q}"`) }
    }
  }
}
main().catch(console.error)
