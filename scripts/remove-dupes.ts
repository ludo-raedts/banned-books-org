import { adminClient } from '../src/lib/supabase'

// Remove incorrect duplicate records (wrong years, added in an earlier batch)
// The correct records (hey-kiddo, breathless-niven, crank-hopkins) already have the US bans.

const supabase = adminClient()

async function deleteBook(slug: string) {
  const { data: book } = await supabase.from('books').select('id, title').eq('slug', slug).single()
  if (!book) { console.log(`  [not found] ${slug}`); return }
  
  // Delete in order: ban_source_links, ban_reason_links, bans, book_authors, books
  const { data: bans } = await supabase.from('bans').select('id').eq('book_id', book.id)
  for (const ban of bans ?? []) {
    await supabase.from('ban_source_links').delete().eq('ban_id', ban.id)
    await supabase.from('ban_reason_links').delete().eq('ban_id', ban.id)
    await supabase.from('bans').delete().eq('id', ban.id)
  }
  await supabase.from('book_authors').delete().eq('book_id', book.id)
  const { error } = await supabase.from('books').delete().eq('id', book.id)
  if (error) {
    console.error(`  [error] ${slug}: ${error.message}`)
  } else {
    console.log(`  Deleted "${book.title}" (${slug})`)
  }
}

async function main() {
  await deleteBook('hey-kiddo-how-i-lost-my-mother-found-my-father-and-dealt-with-family-addiction')
  await deleteBook('breathless-jn')
  await deleteBook('crank-crank-series')
  
  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nTotal books: ${count}`)
}

main().catch(console.error)
