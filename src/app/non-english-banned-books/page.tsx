// ISR: 1h. Driven by ban-count ranking, which only changes on ingestion of
// new bans — slower than view-driven lists.
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { TopListBookCard } from '@/components/top-list-card'
import {
  TOP_LIST_BOOK_SELECT,
  LATIN_SCRIPT_LANGS,
  type TopListBookRow,
  langContext,
  toBookCard,
} from '@/lib/top-list-data'

export const metadata: Metadata = {
  title: 'Banned books not written in English',
  description:
    'A ranked list of the most-censored books originally written in non-English languages — Russian, Arabic, Chinese, Persian, and beyond. The international half of the censorship catalogue.',
  alternates: { canonical: '/non-english-banned-books' },
}

export default async function NonEnglishBannedBooksPage() {
  const timer = newTimer('non-english-destination')
  const supabase = adminClient()

  // Strategy: query `books` directly with a non-Latin language filter, then
  // sort by ban-count client-side. The global v_top_banned_books view only
  // surfaces ~10 non-Latin titles in its top 100 (English-language censorship
  // dominates), which is too thin for a destination page. Pulling from books
  // table gives us the full long tail of non-English bans.
  const { data: booksRaw } = await timer.wrap('books-non-latin', () =>
    supabase
      .from('books')
      .select(TOP_LIST_BOOK_SELECT)
      .not('original_language', 'is', null)
      .not('original_language', 'in', `(${LATIN_SCRIPT_LANGS.join(',')})`)
      .limit(1000),
  )
  const candidates = (booksRaw ?? []) as unknown as TopListBookRow[]

  const books = candidates
    .filter(b => b.bans.length > 0)
    .sort((a, b) => b.bans.length - a.bans.length)
    .slice(0, 50)
    .map(b => toBookCard(b, langContext(b)))

  timer.end()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Banned books not written in English',
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
          Banned books not written in English
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          The {books.length} most-banned books originally written in non-Latin-script languages —
          Russian, Arabic, Chinese, Persian, Hebrew, and others. Most English-language
          &ldquo;banned books&rdquo; lists stop at the US school-board frontier. This one keeps going:
          Solzhenitsyn smuggled out of the USSR, El Saadawi imprisoned in Egypt, Li Hongzhi
          outlawed in China.
        </p>
      </header>

      {books.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No non-English titles in the top-banned ranking yet.
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
        <Link href="/countries" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">By country →</Link>
        <Link href="/top-100-banned-books" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">Top 100 banned books →</Link>
      </div>
    </main>
  )
}
