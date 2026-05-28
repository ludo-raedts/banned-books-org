import type { NextRequest } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { searchBooks } from '@/lib/book-search'

export const dynamic = 'force-dynamic'

// Same caching policy as /api/books — popular autocomplete queries
// (single-letter prefixes, common author/country names) collapse to one
// origin hit per query string per region per 10 min.
const SUGGEST_CACHE_HEADER = 'public, s-maxage=600, stale-while-revalidate=86400'

const BOOK_LIMIT = 5
const AUTHOR_LIMIT = 3
const COUNTRY_LIMIT = 3

type AuthorRow = {
  id: number
  slug: string
  display_name: string
  photo_url: string | null
}

type CountryRow = {
  code: string
  name_en: string
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return Response.json({ authors: [], countries: [], books: [] })
  }

  const supabase = adminClient()
  const lq = `%${q}%`

  const [authorsRes, countriesRes, booksRes] = await Promise.all([
    supabase
      .from('authors')
      .select('id, slug, display_name, photo_url')
      .eq('is_placeholder', false)
      .or(
        `display_name.ilike.${lq},name_native.ilike.${lq},name_transliterated.ilike.${lq},name_english.ilike.${lq}`,
      )
      .order('display_name')
      .limit(AUTHOR_LIMIT),
    supabase
      .from('countries')
      .select('code, name_en')
      .ilike('name_en', lq)
      .order('name_en')
      .limit(COUNTRY_LIMIT),
    searchBooks({ q, offset: 0, limit: BOOK_LIMIT }),
  ])

  const authorList = (authorsRes.data ?? []) as AuthorRow[]
  const countryList = (countriesRes.data ?? []) as CountryRow[]

  // Hydrate authors with their book counts (one query for all matched authors).
  const authorBookCounts = new Map<number, number>()
  if (authorList.length > 0) {
    const { data: links } = await supabase
      .from('book_authors')
      .select('author_id')
      .in('author_id', authorList.map(a => a.id))
    for (const link of (links ?? []) as { author_id: number }[]) {
      authorBookCounts.set(link.author_id, (authorBookCounts.get(link.author_id) ?? 0) + 1)
    }
  }

  // Hydrate countries with distinct-book ban counts from mv_ban_counts.
  // Countries without any recorded bans are filtered out — they'd be a dead end.
  const countryCounts = new Map<string, number>()
  if (countryList.length > 0) {
    const { data: counts } = await supabase
      .from('mv_ban_counts')
      .select('country_code, distinct_books')
      .in('country_code', countryList.map(c => c.code))
    for (const row of (counts ?? []) as { country_code: string; distinct_books: number }[]) {
      countryCounts.set(row.country_code, row.distinct_books)
    }
  }

  const authors = authorList.map(a => ({
    id: a.id,
    slug: a.slug,
    display_name: a.display_name,
    photo_url: a.photo_url,
    bookCount: authorBookCounts.get(a.id) ?? 0,
  }))

  const countries = countryList
    .map(c => ({
      code: c.code,
      name_en: c.name_en,
      banCount: countryCounts.get(c.code) ?? 0,
    }))
    .filter(c => c.banCount > 0)

  return Response.json(
    { authors, countries, books: booksRes.books },
    { headers: { 'Cache-Control': SUGGEST_CACHE_HEADER } },
  )
}
