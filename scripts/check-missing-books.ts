import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const checks = [
    // NZ
    { title: 'Forever Amber', cc: 'NZ' },
    { title: 'Lolita', cc: 'NZ' },
    { title: 'Into the River', cc: 'NZ' },
    { title: 'All Quiet on the Western Front', cc: 'NZ' },
    // Malaysia
    { title: 'Origin of Species', cc: 'MY' },
    { title: 'Line of Beauty', cc: 'MY' },
    { title: 'Vagina Monologues', cc: 'MY' },
    // Vietnam
    { title: 'Sorrow of War', cc: 'VN' },
    // Indonesia
    { title: 'Hoa Kiau', cc: 'ID' },
    // IT additional
    { title: 'All Quiet on the Western Front', cc: 'IT' },
  ]
  
  for (const { title, cc } of checks) {
    const { data: books } = await supabase.from('books')
      .select('id, title, slug').ilike('title', `%${title}%`).limit(2)
    if (books?.length) {
      for (const b of books) {
        const { data: ban } = await supabase.from('bans')
          .select('id').eq('book_id', b.id).eq('country_code', cc).limit(1)
        console.log(`[${cc}] "${b.title}": ${ban?.length ? 'HAS BAN' : 'NO BAN'} (id:${b.id})`)
      }
    } else {
      console.log(`[${cc}] "${title}": BOOK NOT IN DB`)
    }
  }
}
main().catch(console.error)
