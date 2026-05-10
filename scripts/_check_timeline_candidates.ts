import { adminClient } from '../src/lib/supabase'

async function main() {
  const sb = adminClient()
  // Pull all (book_id, country_code, year_started, year_ended, action_type) rows
  // and aggregate locally — Supabase JS doesn't expose raw GROUP BY.
  const PAGE = 1000
  let from = 0
  type Row = { book_id: number; country_code: string }
  const rows: Row[] = []
  for (;;) {
    const { data, error } = await sb
      .from('bans')
      .select('book_id, country_code')
      .order('book_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  const banCount = new Map<number, number>()
  const countryCount = new Map<number, Set<string>>()
  for (const r of rows) {
    banCount.set(r.book_id, (banCount.get(r.book_id) ?? 0) + 1)
    if (!countryCount.has(r.book_id)) countryCount.set(r.book_id, new Set())
    countryCount.get(r.book_id)!.add(r.country_code)
  }

  const total = banCount.size
  const ge2 = [...banCount.values()].filter(n => n >= 2).length
  const ge3 = [...banCount.values()].filter(n => n >= 3).length
  const ge5 = [...banCount.values()].filter(n => n >= 5).length
  const ge10 = [...banCount.values()].filter(n => n >= 10).length

  console.log(`Books with bans:           ${total}`)
  console.log(`Books with >=2 bans:       ${ge2}`)
  console.log(`Books with >=3 bans:       ${ge3}`)
  console.log(`Books with >=5 bans:       ${ge5}`)
  console.log(`Books with >=10 bans:      ${ge10}`)

  // Distinct countries per book
  const ge3byCountry = [...countryCount.entries()].filter(([, s]) => s.size >= 3).length
  console.log(`Books in >=3 countries:    ${ge3byCountry}`)

  // Top 20 by ban count
  const top = [...banCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  if (top.length > 0) {
    const ids = top.map(([id]) => id)
    const { data: books } = await sb
      .from('books')
      .select('id, title, slug')
      .in('id', ids)
    const byId = new Map((books ?? []).map((b: { id: number; title: string; slug: string }) => [b.id, b]))
    console.log('\nTop 20 candidates:')
    for (const [id, count] of top) {
      const b = byId.get(id)
      console.log(`  ${count.toString().padStart(3)}  ${b?.title ?? '?'} [${b?.slug ?? '?'}]`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
