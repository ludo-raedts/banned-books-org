export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookBrowser, { type Book, type NewsPreview, type CountryOption } from '@/components/book-browser'
import TrendingWidget from '@/components/trending-widget'

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('books').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    title: 'Banned Books — International Catalogue of Censored Literature',
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse by country, genre, and reason.`,
    alternates: { canonical: '/' },
  }
}

// Lightweight type for stats computation — never sent to the client
type BookLight = {
  id: number
  title: string
  slug: string
  openlibrary_work_id: string | null
  isbn13: string | null
  first_published_year: number | null
  description_book: string | null
  bans: { id: number; status: string; country_code: string; year_started: number | null }[]
}

const LIGHT_SELECT = 'id, title, slug, openlibrary_work_id, isbn13, first_published_year, description_book, bans(id, status, country_code, year_started)'

const FULL_SELECT = `
  id, title, slug, cover_url, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
  book_authors(authors(display_name)),
  bans(
    id, status, country_code, year_started,
    countries(name_en),
    scopes(slug, label_en),
    ban_reason_links(reasons(slug))
  )
`

export default async function HomePage() {
  const supabase = adminClient()
  let fetchError: string | null = null

  // ── Lightweight fetch of all books for stats — server only ────────────────────
  let allBooksLight: BookLight[] = []
  try {
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('books').select(LIGHT_SELECT).order('title').range(offset, offset + PAGE - 1)
      if (error) { fetchError = error.message; break }
      allBooksLight = allBooksLight.concat((data as unknown as BookLight[]) ?? [])
      if (!data || data.length < PAGE) break
      offset += PAGE
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  const totalCount = allBooksLight.length

  // ── Pick book of the day — deterministic per calendar date ──────────────────
  const eligible = allBooksLight.filter(b => b.description_book)
  const seed = new Date().toISOString().slice(0, 10)
  const idx = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % eligible.length
  const pickedLight = eligible.length > 0 ? eligible[idx] : null

  // ── Parallel: initial 48 books (full) + featured full + news + countries ──────
  const [
    { data: initialBooksRaw },
    { data: featuredRaw },
    { data: newsRaw },
    { data: banCounts },
    { data: countriesRaw },
  ] = await Promise.all([
    supabase.from('books').select(FULL_SELECT).order('title').range(0, 47),
    pickedLight
      ? supabase.from('books').select(FULL_SELECT).eq('id', pickedLight.id).single()
      : Promise.resolve({ data: null }),
    supabase.from('news_items').select('id, source_name, published_at, summary')
      .eq('status', 'published').order('published_at', { ascending: false }).limit(3),
    supabase.from('mv_ban_counts').select('country_code, total_bans').gt('total_bans', 0),
    supabase.from('countries').select('code, name_en'),
  ])

  const initialBooks = (initialBooksRaw as unknown as Book[]) ?? []
  const featuredBook = featuredRaw as unknown as Book | null
  const latestNews = (newsRaw ?? []) as NewsPreview[]

  // ── Countries for dropdown ────────────────────────────────────────────────────
  const countMap = new Map((banCounts ?? []).map(r => [r.country_code, r.total_bans as number]))
  const countries: CountryOption[] = (countriesRaw ?? [])
    .filter(c => countMap.has(c.code))
    .sort((a, b) => a.name_en.localeCompare(b.name_en))
    .map(c => ({ code: c.code, name: c.name_en, count: countMap.get(c.code) ?? 0 }))

  const countryCount = countries.length

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-2">
          The World&apos;s Books Under Censorship
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400">
          {totalCount.toLocaleString('en')} books documented across {countryCount} {countryCount === 1 ? 'country' : 'countries'} — real bans, real sources.{' '}
          <Link href="/stats" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            See statistics →
          </Link>
        </p>
      </div>
      {fetchError && (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50 mb-8">
          Could not load books: {fetchError}
        </p>
      )}
      {!fetchError && (
        <BookBrowser
          initialBooks={initialBooks}
          totalCount={totalCount}
          latestNews={latestNews}
          featuredBook={featuredBook}
          countries={countries}
          trendingSlot={<TrendingWidget compact showHeader={false} />}
        />
      )}
    </main>
  )
}
