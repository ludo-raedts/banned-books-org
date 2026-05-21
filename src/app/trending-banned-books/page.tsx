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
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

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
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
      />

      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Top-list · Updated every 30 minutes</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Trending banned books this week.
          </h1>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            The {books.length} banned books that drew the most readers on banned-books.org over the last seven days. The list rebuilds itself as new visitors land — a 1989 fatwa novel might sit beside a 2023 school-board removal, depending on what&rsquo;s in the news cycle.
          </p>
        </div>
      </section>

      <SectionShell tone="cream" eyebrow="Last 7 days">
        {books.length === 0 ? (
          <p className="text-neutral-500 text-sm">
            No view data yet — check back once the catalogue has accumulated traffic.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {books.map(book => (
              <TopListBookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </SectionShell>

      <SectionShell tone="white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/top-100-banned-books"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">All-time</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Top 100 banned books →
            </p>
          </Link>
          <Link
            href="/most-banned-authors"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">By writer</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Most banned authors →
            </p>
          </Link>
          <Link
            href="/non-english-banned-books"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">International</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Non-English banned books →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
