export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'

export const metadata: Metadata = {
  title: 'The 100 Most Banned Books in the World',
  description: 'A ranked list of the most censored books worldwide, ordered by number of documented bans across countries. From George Orwell to Toni Morrison.',
  alternates: { canonical: '/top-100-banned-books' },
}

type BookRow = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: { country_code: string; countries: { name_en: string } | null }[]
}

async function fetchTop100() {
  const supabase = adminClient()
  const SELECT = 'id, title, slug, cover_url, book_authors(authors(display_name)), bans(country_code, countries(name_en))'

  let all: BookRow[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books')
      .select(SELECT)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as BookRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  all.sort((a, b) => b.bans.length - a.bans.length)
  return all.slice(0, 100)
}

function topCountries(bans: BookRow['bans'], n = 3): string[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const ban of bans) {
    const name = ban.countries?.name_en ?? ban.country_code
    const entry = counts.get(name) ?? { name, count: 0 }
    entry.count++
    counts.set(name, entry)
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((e) => e.name)
}

export default async function Top100Page() {
  const books = await fetchTop100()

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          The 100 Most Banned Books in the World
        </h1>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl text-sm">
          Ranked by number of documented bans across countries and institutions. A "ban"
          here means a formal government prohibition, a court-ordered removal, or a documented
          school or library challenge resulting in restriction — each with a verifiable source.
          The same book can be banned independently in multiple countries, and each ban is counted
          separately. For more on how we define and verify bans, see our{' '}
          <Link href="/methodology" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            methodology
          </Link>.
        </p>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {books.map((book, i) => {
          const rank = i + 1
          const author = book.book_authors
            .map((ba) => ba.authors?.display_name)
            .filter(Boolean)
            .join(', ')
          const countries = topCountries(book.bans)

          return (
            <Link
              key={book.id}
              href={`/books/${book.slug}`}
              className="flex items-center gap-4 py-3 group hover:bg-gray-50 dark:hover:bg-gray-900/50 -mx-3 px-3 rounded-lg transition-colors"
            >
              {/* Rank */}
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-gray-400 dark:text-gray-500 font-mono">
                {rank}
              </span>

              {/* Cover */}
              <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={`Cover of ${book.title}`}
                    width={40}
                    height={56}
                    className="w-full h-full object-cover"
                    sizes="40px"
                  />
                ) : (
                  <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
                )}
              </div>

              {/* Title + author */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:underline truncate">
                  {book.title}
                </p>
                {author && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{author}</p>
                )}
                {countries.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {countries.join(' · ')}
                  </p>
                )}
              </div>

              {/* Ban count */}
              <div className="shrink-0 text-right">
                <span className="text-sm font-bold tabular-nums text-red-500 dark:text-red-400">
                  {book.bans.length}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {book.bans.length === 1 ? 'ban' : 'bans'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      <p className="mt-10 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-800 pt-6">
        Data is updated daily. Bans reflect documented records in our catalogue — coverage is uneven
        and skewed toward countries with systematic reporting (notably the United States).{' '}
        <Link href="/methodology" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Read the methodology →
        </Link>
      </p>
    </main>
  )
}
