export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { adminClient } from '@/lib/supabase'
import BookBrowser, { type Book, type NewsPreview } from '@/components/book-browser'
import { type StatCard } from '@/components/rotating-stats'

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('books').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse by country, genre, and reason.`,
    alternates: { canonical: '/' },
  }
}

export default async function HomePage() {
  let books: Book[] = []
  let fetchError: string | null = null
  let latestNews: NewsPreview[] = []

  try {
    const supabase = adminClient()
    const SELECT = `
      id, title, slug, cover_url, description, description_book, first_published_year, genres,
      book_authors(authors(display_name)),
      bans(
        id, status, country_code, year_started,
        countries(name_en),
        scopes(slug, label_en),
        ban_reason_links(reasons(slug))
      )
    `
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('books')
        .select(SELECT)
        .order('title')
        .range(offset, offset + PAGE - 1)
      if (error) { fetchError = error.message; break }
      books = books.concat((data as unknown as Book[]) ?? [])
      if (!data || data.length < PAGE) break
      offset += PAGE
    }

    const { data: news } = await supabase
      .from('news_items')
      .select('id, source_name, published_at, summary')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3)
    latestNews = (news ?? []) as NewsPreview[]
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  const bookCount = books.length

  // Server-side random featured book — different on every request (force-dynamic)
  const eligible = books.filter(b => b.cover_url && (b.description_book || b.description))
  const featuredBook: Book | null = eligible.length > 0
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : null

  // Rotating stats — computed from loaded books (no extra DB round-trips)
  const currentYear = new Date().getFullYear()
  let mostBannedTitle = '', mostBannedSlug = '', mostBannedCount = 0
  let mostCountriesTitle = '', mostCountriesSlug = '', mostCountriesCount = 0
  let recentBanTitle = '', recentBanSlug = '', recentBanYear = 0
  let oldestBanTitle = '', oldestBanSlug = '', oldestBanYear = Infinity
  let multiBannedCount = 0, totalBans = 0, recentBansCount = 0

  for (const book of books) {
    if (book.bans.length > mostBannedCount) {
      mostBannedCount = book.bans.length
      mostBannedTitle = book.title
      mostBannedSlug = book.slug
    }
    const distinctCountries = new Set(book.bans.map(b => b.country_code)).size
    if (distinctCountries > mostCountriesCount) {
      mostCountriesCount = distinctCountries
      mostCountriesTitle = book.title
      mostCountriesSlug = book.slug
    }
    if (distinctCountries >= 3) multiBannedCount++
    for (const ban of book.bans) {
      totalBans++
      if (ban.year_started != null) {
        if (ban.year_started > recentBanYear) {
          recentBanYear = ban.year_started
          recentBanTitle = book.title
          recentBanSlug = book.slug
        }
        if (ban.year_started < oldestBanYear) {
          oldestBanYear = ban.year_started
          oldestBanTitle = book.title
          oldestBanSlug = book.slug
        }
        if (ban.year_started >= currentYear - 15) recentBansCount++
      }
    }
  }

  const totalBooks = books.length
  const multiBannedPct = totalBooks > 0 ? Math.round(multiBannedCount / totalBooks * 100) : 0
  const recentBansPct = totalBans > 0 ? Math.round(recentBansCount / totalBans * 100) : 0
  const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s

  const rotatingStats: StatCard[] = books.length > 0 ? [
    {
      largeText: trunc(mostBannedTitle, 40),
      label: 'Most documented book',
      sub: `${mostBannedCount} recorded bans`,
      href: `/books/${mostBannedSlug}`,
    },
    {
      largeText: trunc(mostCountriesTitle, 40),
      label: 'Banned in most countries',
      sub: `Restricted across ${mostCountriesCount} countries`,
      href: `/books/${mostCountriesSlug}`,
    },
    {
      largeText: trunc(recentBanTitle, 40),
      label: 'Most recently documented ban',
      sub: recentBanYear > 0 ? `Banned in ${recentBanYear}` : 'Year unknown',
      href: `/books/${recentBanSlug}`,
    },
    {
      largeText: trunc(oldestBanTitle, 40),
      label: 'Oldest ban on record',
      sub: isFinite(oldestBanYear) ? `First documented in ${oldestBanYear}` : 'Year unknown',
      href: `/books/${oldestBanSlug}`,
    },
    {
      largeText: multiBannedCount.toLocaleString('en'),
      label: 'Books banned in 3+ countries',
      sub: `${multiBannedPct}% of all documented books`,
      href: '/stats',
    },
    {
      largeText: `${recentBansPct}%`,
      label: 'Of all bans in the last 15 years',
      sub: `${recentBansCount.toLocaleString('en')} bans since ${currentYear - 15}`,
      href: '/stats',
    },
  ] : []

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {fetchError && (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50 mb-8">
          Could not load books: {fetchError}
        </p>
      )}

      {!fetchError && (
        <BookBrowser
          books={books}
          latestNews={latestNews}
          featuredBook={featuredBook}
          bookCount={bookCount}
          rotatingStats={rotatingStats}
        />
      )}

    </main>
  )
}
