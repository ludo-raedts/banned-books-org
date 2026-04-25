import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const { data: books } = await s.from('books')
    .select('id, slug, title, first_published_year, original_language')
    .order('title')

  const { data: baRaw } = await s.from('book_authors').select('book_id, authors(display_name)')
  const authorMap = new Map<number, string>()
  for (const ba of (baRaw ?? []) as any[]) {
    if (ba.authors?.display_name) authorMap.set(ba.book_id, ba.authors.display_name)
  }

  const { data: bansRaw } = await s.from('bans').select('book_id, country_code')
  const banMap = new Map<number, string[]>()
  for (const b of bansRaw ?? []) {
    const list = banMap.get(b.book_id) ?? []
    list.push(b.country_code)
    banMap.set(b.book_id, list)
  }

  const allBooks = (books ?? []).map(b => ({
    ...b,
    author: authorMap.get(b.id) ?? '',
    countries: (banMap.get(b.id) ?? []).sort().join(','),
    // normalized title: strip leading "the ", "a ", "an "
    norm: b.title.toLowerCase()
      .replace(/^the\s+/, '')
      .replace(/^an?\s+/, '')
      .trim(),
  }))

  // Group by normalized title
  const byNorm = new Map<string, typeof allBooks>()
  for (const b of allBooks) {
    const list = byNorm.get(b.norm) ?? []
    list.push(b)
    byNorm.set(b.norm, list)
  }

  console.log('=== POTENTIAL DUPLICATES (same normalized title) ===\n')
  let found = 0
  for (const [norm, group] of byNorm) {
    if (group.length < 2) continue
    found++
    console.log(`"${norm}"`)
    for (const b of group) {
      console.log(`  [${b.id}] slug=${b.slug}`)
      console.log(`        title="${b.title}" year=${b.first_published_year} author="${b.author}"`)
      console.log(`        bans: ${b.countries || '(none)'}`)
    }
    console.log()
  }

  if (found === 0) console.log('No title-based duplicates found.')

  // Also check for very similar titles (one is substring of other)
  console.log('\n=== FUZZY MATCHES (title substring) ===\n')
  let fuzzy = 0
  for (let i = 0; i < allBooks.length; i++) {
    for (let j = i + 1; j < allBooks.length; j++) {
      const a = allBooks[i], b = allBooks[j]
      const la = a.norm, lb = b.norm
      if (la === lb) continue // already caught above
      if ((la.includes(lb) || lb.includes(la)) && Math.abs(la.length - lb.length) < 20) {
        fuzzy++
        console.log(`  "${a.title}" (${a.slug}) <-> "${b.title}" (${b.slug})`)
        console.log(`    authors: "${a.author}" / "${b.author}" | years: ${a.first_published_year} / ${b.first_published_year}`)
      }
    }
  }
  if (fuzzy === 0) console.log('No fuzzy matches found.')
}

main().catch(console.error)
