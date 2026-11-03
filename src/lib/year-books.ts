import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'

// Shared by /banned-books/[year] (first LIST_CAP rows, server-rendered) and
// /api/banned-books/[year] (the "show more" pages), so both use one sort order.

export const YEAR_LIST_CAP = 250

export function countryFlag(code: string): string {
  if (['SU', 'CS', 'DD', 'YU'].includes(code)) return '🚩'
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('')
}

type BanRow = {
  book_id: number
  country_code: string
  countries: { name_en: string } | null
  books: {
    id: number
    title: string
    slug: string
    cover_url: string | null
    book_authors: { authors: { display_name: string } | null }[]
  } | null
}

export type YearBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  author: string
  banCount: number
  /** "🇺🇸 United States ×21 · 🇧🇾 Belarus" — one entry per country. */
  countries: string
}

export type YearBooks = {
  books: YearBook[]
  banCount: number
  countryTotals: [string, { name: string; count: number }][]
}

async function fetchYearBooks(yearNum: number): Promise<YearBooks> {
  const supabase = adminClient()
  let rawBans: BanRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase
      .from('bans')
      .select('book_id, country_code, countries(name_en), books(id, title, slug, cover_url, book_authors(authors(display_name)))')
      .eq('year_started', yearNum)
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    rawBans = rawBans.concat(data as unknown as BanRow[])
    if (data.length < 1000) break
  }

  // Group bans by book; per book count bans per country.
  const byBook = new Map<number, { book: NonNullable<BanRow['books']>; n: number; perCountry: Map<string, { name: string; n: number }> }>()
  const countryTotals = new Map<string, { name: string; count: number }>()
  for (const ban of rawBans) {
    const name = ban.countries?.name_en ?? ban.country_code
    const total = countryTotals.get(ban.country_code) ?? { name, count: 0 }
    total.count++
    countryTotals.set(ban.country_code, total)
    if (!ban.books) continue
    const e = byBook.get(ban.books.id) ?? { book: ban.books, n: 0, perCountry: new Map() }
    e.n++
    const c = e.perCountry.get(ban.country_code) ?? { name, n: 0 }
    c.n++
    e.perCountry.set(ban.country_code, c)
    byBook.set(ban.books.id, e)
  }

  const books: YearBook[] = [...byBook.values()]
    .sort((a, b) => b.n - a.n)
    .map(({ book, n, perCountry }) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      cover_url: book.cover_url,
      author: book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '),
      banCount: n,
      countries: [...perCountry.entries()]
        .map(([code, { name, n: k }]) => `${countryFlag(code)} ${name}${k > 1 ? ` ×${k}` : ''}`)
        .join(' · '),
    }))

  return {
    books,
    banCount: rawBans.length,
    countryTotals: [...countryTotals.entries()].sort((a, b) => b[1].count - a[1].count),
  }
}

// One ~10-request sweep per year per day, shared by the page and the "show
// more" API (uncached that sweep took ~7 s for 2025). 2025's entry is ~1 MB.
export const getYearBooks = unstable_cache(fetchYearBooks, ['year-books'], {
  revalidate: 86400,
  tags: ['year-books'],
})
