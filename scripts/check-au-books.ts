import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  const checks = [
    { q: 'Brave New World', year: 1932 },
    { q: 'Another Country', year: 1963 },
    { q: 'Anarchist Cookbook', year: 1985 },
    { q: 'Forever Amber', year: 1945 },
    { q: 'Borstal Boy', year: 1958 },
    { q: '120 Days of Sodom', year: 1957 },
    { q: 'Decameron', year: 1927 },
    { q: 'The Stud', year: 1969 },
    { q: 'The World Is Full of Married Men', year: 1968 },
  ]
  
  for (const { q, year } of checks) {
    const { data: books } = await supabase.from('books')
      .select('id, title, slug').ilike('title', `%${q}%`).limit(3)
    if (books?.length) {
      for (const b of books) {
        const { data: ban } = await supabase.from('bans')
          .select('id').eq('book_id', b.id).eq('country_code', 'AU').limit(1)
        console.log(`[AU] "${b.title}" (slug:${b.slug}): ${ban?.length ? 'HAS AU BAN' : `NO AU BAN — add ${year} ban`}`)
      }
    } else {
      console.log(`NOT IN DB: "${q}" — would add with ${year} AU ban`)
    }
  }
  
  // Also check Ireland
  const ieChecks = ['Borstal Boy', 'Country Girls', "The Dark McGahern", 'The Ginger Man']
  console.log('\n--- Ireland ---')
  for (const q of ieChecks) {
    const { data: books } = await supabase.from('books')
      .select('id, title, slug').ilike('title', `%${q.replace(/\s+\w+$/, '')}%`).limit(2)
    if (books?.length) {
      for (const b of books) {
        const { data: ban } = await supabase.from('bans')
          .select('id').eq('book_id', b.id).eq('country_code', 'IE').limit(1)
        console.log(`[IE] "${b.title}": ${ban?.length ? 'HAS IE BAN' : 'NO IE BAN'}`)
      }
    } else console.log(`NOT IN DB: "${q}"`)
  }
}
main().catch(console.error)
