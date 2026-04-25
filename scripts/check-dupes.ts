import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const slugsToCheck = ['hey-kiddo', 'hey-kiddo-how-i-lost-my-mother-found-my-father-and-dealt-with-family-addiction', 'breathless-niven', 'breathless-jn', 'crank-hopkins', 'crank-crank-series']
  for (const slug of slugsToCheck) {
    const { data: book } = await s.from('books').select('id, slug, title, first_published_year').eq('slug', slug).single()
    if (book) {
      const { data: bans } = await s.from('bans').select('country_code, year_started').eq('book_id', book.id)
      const { data: ba } = await s.from('book_authors').select('authors(display_name)').eq('book_id', book.id)
      const author = (ba as any)?.[0]?.authors?.display_name
      console.log(`${slug}: "${book.title}" (${book.first_published_year}) by ${author} — bans: ${(bans ?? []).map(b => b.country_code).join(', ')}`)
    } else {
      console.log(`${slug}: NOT FOUND`)
    }
  }
}
main().catch(console.error)
