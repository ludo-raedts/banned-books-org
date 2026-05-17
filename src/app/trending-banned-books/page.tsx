// ISR: matches the homepage trending cadence (views update continuously; a
// 30-min cache window keeps the list "fresh enough" without thrashing
// pageviews aggregation).
export const revalidate = 1800

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { TopListBookCard } from '@/components/top-list-card'
import {
  TOP_LIST_BOOK_SELECT,
  type TopListBookRow,
  banContext,
  toBookCard,
} from '@/lib/top-list-data'

export const metadata: Metadata = {
  title: 'Trending banned books this week',
  description:
    'The banned books people are reading most on banned-books.org over the last 7 days. A live snapshot of which censored titles are drawing attention right now.',
  alternates: { canonical: '/trending-banned-books' },
}

export default async function TrendingBannedBooksPage() {
  const timer = newTimer('trending-destination')
  const supabase = adminClient()

  const { data: trendingRes } = await timer.wrap('v_top_books_this_week', () =>
    supabase.from('v_top_books_this_week').select('entity_id, views').limit(50),
  )
  const trendingIds = ((trendingRes ?? []) as { entity_id: number }[]).map(r => Number(r.entity_id))

  const { data: booksRaw } = trendingIds.length > 0
    ? await timer.wrap('books', () =>
        supabase.from('books').select(TOP_LIST_BOOK_SELECT).in('id', trendingIds),
      )
    : { data: null }
  const bookById = new Map(((booksRaw ?? []) as unknown as TopListBookRow[]).map(b => [b.id, b]))

  const books = trendingIds
    .map(id => bookById.get(id))
    .filter((b): b is TopListBookRow => !!b)
    .map(b => toBookCard(b, banContext(b)))

  timer.end()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trending banned books this week',
    numberOfItems: books.length,
    itemListElement: books.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://www.banned-books.org/books/${b.slug}`,
      name: b.title,
    })),
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
      />
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-3">
          Trending banned books this week
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          The {books.length} banned books that drew the most readers on banned-books.org over the
          last seven days. The list rebuilds itself as new visitors land — a 1989 fatwa novel might
          sit beside a 2023 school-board removal, depending on what&rsquo;s in the news cycle.
        </p>
      </header>

      {books.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No view data yet — check back once the catalogue has accumulated traffic.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {books.map(book => (
            <TopListBookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">← Home</Link>
        <Link href="/rising-banned-books" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">Rising this week →</Link>
        <Link href="/top-100-banned-books" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">Top 100 banned books →</Link>
      </div>
    </main>
  )
}
