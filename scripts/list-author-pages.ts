import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { data } = await s
    .from('book_authors')
    .select('book_id, authors(display_name, slug)')
    .limit(5000)

  const counts = new Map<string, { name: string; slug: string; books: number }>()
  for (const ba of (data ?? []) as any[]) {
    if (!ba.authors?.slug) continue
    const key = ba.authors.slug
    const ex = counts.get(key)
    if (ex) ex.books++
    else counts.set(key, { name: ba.authors.display_name, slug: ba.authors.slug, books: 1 })
  }

  const sorted = [...counts.values()]
    .filter(a => a.books > 1)
    .sort((a, b) => b.books - a.books)

  console.log(`${'Author'.padEnd(40)} Books  URL`)
  console.log('-'.repeat(70))
  for (const a of sorted) {
    console.log(`${a.name.padEnd(40)} ${String(a.books).padStart(4)}  /authors/${a.slug}`)
  }
  console.log(`\nTotal: ${sorted.length} authors with multiple books`)
}
main()
