import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()

  const { data: allBooks } = await s.from('books').select('id, slug, title, cover_url, description')
  const { data: bansRaw } = await s.from('bans').select('book_id, country_code')
  const { data: baRaw } = await s.from('book_authors').select('book_id, authors(display_name)')

  const authorMap = new Map<number, string>()
  for (const ba of (baRaw ?? []) as any[]) {
    if (ba.authors?.display_name) authorMap.set(ba.book_id, ba.authors.display_name)
  }

  const total = allBooks?.length ?? 0
  const noCover = (allBooks ?? []).filter(b => !b.cover_url).length
  const noDesc  = (allBooks ?? []).filter(b => !b.description).length

  console.log(`Total books: ${total}`)
  console.log(`No cover:    ${noCover} (${(noCover/total*100).toFixed(0)}%)`)
  console.log(`No description: ${noDesc} (${(noDesc/total*100).toFixed(0)}%)`)

  // Books with no cover
  const noCoverBooks = (allBooks ?? []).filter(b => !b.cover_url).sort((a,b) => a.title.localeCompare(b.title)).slice(0,60)
  console.log('\n── No cover (first 60) ──')
  noCoverBooks.forEach(b => console.log(`  ${b.slug}  "${b.title}" by ${authorMap.get(b.id) ?? '?'}`))

  // Books with no description
  const noDescBooks = (allBooks ?? []).filter(b => !b.description).sort((a,b) => a.title.localeCompare(b.title)).slice(0,80)
  console.log('\n── No description (first 80) ──')
  noDescBooks.forEach(b => console.log(`  ${b.slug}  "${b.title}" by ${authorMap.get(b.id) ?? '?'}`))

  // Top countries
  const cc = new Map<string, number>()
  for (const b of bansRaw ?? []) cc.set(b.country_code, (cc.get(b.country_code) ?? 0) + 1)
  console.log('\n── Top countries ──')
  ;[...cc.entries()].sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([c,n]) => console.log(`  ${c}: ${n}`))

  // Most-banned books
  const bc = new Map<number, number>()
  for (const b of bansRaw ?? []) bc.set(b.book_id, (bc.get(b.book_id) ?? 0) + 1)
  const top20 = [...bc.entries()].sort((a,b) => b[1]-a[1]).slice(0,20)
  console.log('\n── Most-banned books (top 20) ──')
  for (const [id, n] of top20) {
    const book = (allBooks ?? []).find(b => b.id === id)
    console.log(`  ${n} bans — ${book?.slug}  "${book?.title}"`)
  }

  // Orphaned books (no bans)
  const banned = new Set((bansRaw ?? []).map(b => b.book_id))
  const orphans = (allBooks ?? []).filter(b => !banned.has(b.id))
  console.log(`\n── Orphaned books (no bans): ${orphans.length} ──`)
  orphans.slice(0, 30).forEach(b => console.log(`  ${b.slug}  "${b.title}"`))
}

main().catch(console.error)
