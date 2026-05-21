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
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

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

          <Eyebrow>Top-list · International</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Banned books not written in English.
          </h1>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            The {books.length} most-banned books originally written in non-Latin-script languages — Russian, Arabic, Chinese, Persian, Hebrew, and others. Most English-language &ldquo;banned books&rdquo; lists stop at the US school-board frontier. This one keeps going: Solzhenitsyn smuggled out of the USSR, El Saadawi imprisoned in Egypt, Li Hongzhi outlawed in China.
          </p>
        </div>
      </section>

      <SectionShell tone="cream" eyebrow="Ranked by ban count">
        {books.length === 0 ? (
          <p className="text-neutral-500 text-sm">
            No non-English titles in the top-banned ranking yet.
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
            href="/countries"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">By geography</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Browse countries →
            </p>
          </Link>
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
            href="/banned-classics"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Historical</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Banned classics →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
