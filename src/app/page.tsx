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
      id, title, slug, cover_url, description, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
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

  interface BookMeta {
    title: string; slug: string
    banCount: number; distinctCountries: number
    maxYear: number | null; minYear: number | null
    qualified: boolean
  }
  const bookMetas: BookMeta[] = []
  let multiBannedCount = 0, totalBans = 0, recentBansCount = 0

  for (const book of books) {
    const distinctCountries = new Set(book.bans.map(b => b.country_code)).size
    if (distinctCountries >= 3) multiBannedCount++
    let maxYear: number | null = null
    let minYear: number | null = null
    for (const ban of book.bans) {
      totalBans++
      if (ban.year_started != null) {
        if (maxYear === null || ban.year_started > maxYear) maxYear = ban.year_started
        if (minYear === null || ban.year_started < minYear) minYear = ban.year_started
        if (ban.year_started >= currentYear - 15) recentBansCount++
      }
    }
    const qualified = !!(book.openlibrary_work_id || book.isbn13)
    bookMetas.push({ title: book.title, slug: book.slug, banCount: book.bans.length, distinctCountries, maxYear, minYear, qualified })
  }

  function pickBest(
    metas: BookMeta[],
    getValue: (m: BookMeta) => number | null,
    descending: boolean,
    exclude: Set<string>
  ): BookMeta | null {
    const sorted = metas
      .filter(m => !exclude.has(m.slug) && getValue(m) !== null)
      .sort((a, b) => {
        const va = getValue(a)!; const vb = getValue(b)!
        return descending ? vb - va : va - vb
      })
    return sorted[0] ?? null
  }

  const qualifiedMetas = bookMetas.filter(m => m.qualified)

  // Set 1: cards 1, 2, 3 — all different books
  const used1 = new Set<string>()
  const card1 = pickBest(bookMetas, m => m.banCount, true, used1)
  if (card1) used1.add(card1.slug)
  const card2 = pickBest(bookMetas, m => m.distinctCountries, true, used1)
  if (card2) used1.add(card2.slug)
  // Cards 3 & 4 use quality filter: only bibliographically verified books
  const card3 = pickBest(qualifiedMetas, m => m.maxYear, true, used1)

  // Set 2: card 4 — different from card 3
  const used2 = new Set<string>()
  if (card3) used2.add(card3.slug)
  const card4 = pickBest(qualifiedMetas, m => m.minYear, false, used2)

  const totalBooks = books.length
  const multiBannedPct = totalBooks > 0 ? Math.round(multiBannedCount / totalBooks * 100) : 0
  const recentBansPct = totalBans > 0 ? Math.round(recentBansCount / totalBans * 100) : 0
  const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s

  const rotatingStats: StatCard[] = books.length > 0 ? [
    ...(card1 ? [{
      largeText: trunc(card1.title, 40),
      fullTitle: card1.title,
      isTitle: true,
      label: 'Most documented book',
      sub: `${card1.banCount} recorded bans`,
      href: `/books/${card1.slug}`,
    }] : []),
    ...(card2 ? [{
      largeText: trunc(card2.title, 40),
      fullTitle: card2.title,
      isTitle: true,
      label: 'Banned in most countries',
      sub: `Restricted across ${card2.distinctCountries} countries`,
      href: `/books/${card2.slug}`,
    }] : []),
    ...(card3 ? [{
      largeText: trunc(card3.title, 40),
      fullTitle: card3.title,
      isTitle: true,
      label: 'Most recently documented ban',
      sub: card3.maxYear ? `Banned in ${card3.maxYear}` : 'Year unknown',
      href: `/books/${card3.slug}`,
    }] : []),
    ...(card4 ? [{
      largeText: trunc(card4.title, 40),
      fullTitle: card4.title,
      isTitle: true,
      label: 'Oldest ban on record',
      sub: card4.minYear ? `First documented in ${card4.minYear}` : 'Year unknown',
      href: `/books/${card4.slug}`,
    }] : []),
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
