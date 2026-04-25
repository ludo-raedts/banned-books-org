import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  
  // Check HK books we added in batch22
  const slugs = [
    'hong-kong-nationalism',
    'the-future-of-the-rule-of-law-in-hong-kong',
    'on-the-hong-kong-city-state',
  ]
  for (const slug of slugs) {
    const { data } = await s.from('books').select('id, slug, title, description').eq('slug', slug).single()
    const { data: ba } = await s.from('book_authors').select('authors(display_name, slug)').eq('book_id', data?.id ?? 0)
    console.log(`${slug}: title="${data?.title}" author=${JSON.stringify((ba as any)?.[0]?.authors?.display_name)}`)
  }
  
  // Check which well-known books have no description
  const { data: books } = await s.from('books').select('slug, title, description').is('description', null).order('title')
  console.log(`\nBooks with no description: ${books?.length}`)
  // Print first 30
  books?.slice(0, 30).forEach(b => console.log(`  ${b.slug}`))
}
main().catch(console.error)
