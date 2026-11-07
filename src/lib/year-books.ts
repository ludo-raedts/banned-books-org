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

type BanRow = { id: number; book_id: number; country_code: string }

type BookRow = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  book_authors: { authors: { display_name: string } | null }[]
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
  // A failed page must throw, not end the sweep: treating an error (e.g. a
  // 57014 statement timeout under DB load) as "no rows" got an empty result
  // cached for 24h, and /banned-books/2021 + 2024 rendered "No bans" while
  // the DB held thousands. Throwing keeps the last good ISR page instead.
  const withRetry = async <T>(what: string, q: () => PromiseLike<{ data: unknown; error: { code: string; message: string } | null }>) => {
    for (let attempt = 1; ; attempt++) {
      const res = await q()
      if (!res.error) return (res.data ?? []) as T[]
      if (attempt >= 3) throw new Error(`year-books ${yearNum} ${what}: ${res.error.code} ${res.error.message}`)
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }

  // 1. Bans only (no embeds), keyset-paged on id. Embedding book + authors on
  //    every ban and paging by offset made the deep pages of 2025 (~7k bans
  //    after the Texas import) hit statement_timeout during builds (2026-11-07).
  const rawBans: BanRow[] = []
  for (let lastId = 0; ;) {
    const page = await withRetry<BanRow>(`bans >${lastId}`, () => supabase
      .from('bans')
      .select('id, book_id, country_code')
      .eq('year_started', yearNum)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(1000))
    rawBans.push(...page)
    if (page.length < 1000) break
    lastId = page[page.length - 1].id
  }

  // 2. Each book once, in chunks (a long .in() overflows the PostgREST URL).
  const bookIds = [...new Set(rawBans.map(b => b.book_id))]
  const booksById = new Map<number, BookRow>()
  for (let i = 0; i < bookIds.length; i += 300) {
    const chunk = bookIds.slice(i, i + 300)
    const rows = await withRetry<BookRow>(`books @${i}`, () => supabase
      .from('books')
      .select('id, title, slug, cover_url, book_authors(authors(display_name))')
      .in('id', chunk))
    for (const b of rows) booksById.set(b.id, b)
  }

  // 3. Country names (one small table).
  const codes = [...new Set(rawBans.map(b => b.country_code))]
  const countryRows = await withRetry<{ code: string; name_en: string }>('countries', () => supabase
    .from('countries').select('code, name_en').in('code', codes))
  const countryName = new Map(countryRows.map(c => [c.code, c.name_en]))

  // Group bans by book; per book count bans per country.
  const byBook = new Map<number, { book: BookRow; n: number; perCountry: Map<string, { name: string; n: number }> }>()
  const countryTotals = new Map<string, { name: string; count: number }>()
  for (const ban of rawBans) {
    const name = countryName.get(ban.country_code) ?? ban.country_code
    const total = countryTotals.get(ban.country_code) ?? { name, count: 0 }
    total.count++
    countryTotals.set(ban.country_code, total)
    const book = booksById.get(ban.book_id)
    if (!book) continue
    const e = byBook.get(book.id) ?? { book, n: 0, perCountry: new Map() }
    e.n++
    const c = e.perCountry.get(ban.country_code) ?? { name, n: 0 }
    c.n++
    e.perCountry.set(ban.country_code, c)
    byBook.set(book.id, e)
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
