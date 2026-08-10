// Read-only: rank authors by number of POSTABLE banned books (same eligibility
// gate as the Bluesky picker) so we know who the birthday-push feature should
// cover, and how many already have a birth_year.
import { adminClient } from '../src/lib/supabase'
import { LATIN_SCRIPT_LANGS } from '../src/lib/top-list-data'

const MIN_BANS = 2
const sb = adminClient()

async function main() {
  const byAuthor = new Map<number, { name: string; slug: string; birthYear: number | null; books: number; bans: number }>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, book_authors!inner(authors!inner(id, display_name, slug, birth_year)), bans(country_code)')
      .eq('is_gated', false)
      .eq('is_blanket_works', false)
      .not('cover_url', 'is', null)
      .not('description_ban', 'is', null)
      .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{
      id: number
      book_authors: Array<{ authors: { id: number; display_name: string; slug: string; birth_year: number | null } | null }> | null
      bans: Array<{ country_code: string | null }> | null
    }>
    for (const r of rows) {
      const bans = r.bans ?? []
      const hasNonUs = bans.some(b => b.country_code && b.country_code !== 'US')
      if (!(bans.length >= MIN_BANS || hasNonUs)) continue
      for (const ba of r.book_authors ?? []) {
        const a = ba.authors
        if (!a) continue
        const cur = byAuthor.get(a.id) ?? { name: a.display_name, slug: a.slug, birthYear: a.birth_year, books: 0, bans: 0 }
        cur.books += 1
        cur.bans += bans.length
        byAuthor.set(a.id, cur)
      }
    }
    if (rows.length < PAGE) break
  }

  const ranked = [...byAuthor.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.books - a.books || b.bans - a.bans)

  console.log(`Distinct authors with >=1 postable banned book: ${ranked.length}\n`)
  console.log('rank  books  bans  birthYr  author')
  ranked.slice(0, 40).forEach((a, i) => {
    console.log(
      `${String(i + 1).padStart(3)}  ${String(a.books).padStart(5)}  ${String(a.bans).padStart(5)}  ${String(a.birthYear ?? '—').padStart(6)}  ${a.name}  (#${a.id})`,
    )
  })
}

main().catch(e => { console.error(e); process.exit(1) })
