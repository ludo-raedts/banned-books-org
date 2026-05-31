// ISR: mv_top_books_rising is refreshed by the views-cron. 30 min keeps the
// page within one cron tick of the underlying data.
export const revalidate = 1800

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { TopListBookCard } from '@/components/top-list-card'
import {
  TOP_LIST_BOOK_SELECT,
  type TopListBookRow,
  toBookCard,
} from '@/lib/top-list-data'

export const metadata: Metadata = {
  title: 'Rising banned books this week',
  description:
    'Banned books gaining momentum this week — titles whose readership grew most sharply compared to last week. Different from "trending": this list catches news-driven spikes.',
  alternates: { canonical: '/rising-banned-books' },
}

type RisingRow = { entity_id: number; this_week: number; prev_week: number }

export default async function RisingBannedBooksPage() {
  const timer = newTimer('rising-destination')
  const supabase = adminClient()

  const { data: risingRes } = await timer.wrap('mv_top_books_rising', () =>
    supabase.from('mv_top_books_rising').select('entity_id, this_week, prev_week').limit(50),
  )
  const risingRows = (risingRes ?? []) as RisingRow[]
  const risingIds = risingRows.map(r => Number(r.entity_id))

  const { data: booksRaw } = risingIds.length > 0
    ? await timer.wrap('books', () =>
        supabase.from('books').select(TOP_LIST_BOOK_SELECT).eq('is_gated', false).in('id', risingIds),
      )
    : { data: null }
  const bookById = new Map(((booksRaw ?? []) as unknown as TopListBookRow[]).map(b => [b.id, b]))

  const books = risingRows
    .map(r => {
      const b = bookById.get(Number(r.entity_id))
      if (!b) return null
      const pct = r.prev_week > 0
        ? Math.round(((r.this_week - r.prev_week) / r.prev_week) * 100)
        : null
      const ctx = pct !== null && pct > 0 ? `↑${pct}% this week` : 'New this week'
      return toBookCard(b, ctx)
    })
    .filter((x): x is ReturnType<typeof toBookCard> => x !== null)

  timer.end()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Rising banned books this week',
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
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-3">
          Rising banned books this week
        </h1>
        <p className="text-base text-gray-600 leading-relaxed">
          Books gaining the most momentum compared to last week — measured by growth in distinct
          readers, not absolute volume. A title can sit here at +900% while a permanent trending
          favourite at +5% does not. Useful for spotting which censorship stories the news cycle
          just put back on the map.
        </p>
      </header>

      {books.length === 0 ? (
        <p className="text-gray-500">
          Not enough comparative view data yet — the rising metric needs at least two consecutive
          weeks of traffic.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {books.map(book => (
            <TopListBookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/" className="text-gray-600 hover:text-brand transition-colors">← Home</Link>
        <Link href="/trending-banned-books" className="text-gray-600 hover:text-brand transition-colors">Trending this week →</Link>
        <Link href="/top-100-banned-books" className="text-gray-600 hover:text-brand transition-colors">Top 100 banned books →</Link>
      </div>
    </main>
  )
}
