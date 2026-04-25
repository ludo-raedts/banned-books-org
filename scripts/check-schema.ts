import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  // Get a sample ban to see its columns
  const { data, error } = await s.from('bans').select('*').limit(1)
  console.log('Ban columns:', Object.keys(data?.[0] ?? {}))
  const { data: book, error: be } = await s.from('books').select('*').limit(1)
  console.log('Book columns:', Object.keys(book?.[0] ?? {}))
  const { data: country } = await s.from('countries').select('*').limit(1)
  console.log('Country columns:', Object.keys(country?.[0] ?? {}))
}
main().catch(console.error)
