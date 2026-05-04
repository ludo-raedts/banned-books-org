export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'

export const metadata: Metadata = {
  title: 'Banned Classic Literature — Works Published Before 1970',
  description: 'Classic books that are still banned or challenged today. Orwell, Nabokov, Lawrence, Flaubert — enduring literature that governments still find threatening.',
  alternates: { canonical: '/banned-classics' },
}

type ClassicBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number
  book_authors: { authors: { display_name: string } | null }[]
  bans: { country_code: string; countries: { name_en: string } | null }[]
}

function topCountry(bans: ClassicBook['bans']): string | null {
  const counts = new Map<string, { name: string; count: number }>()
  for (const ban of bans) {
    const name = ban.countries?.name_en ?? ban.country_code
    const e = counts.get(name) ?? { name, count: 0 }
    e.count++
    counts.set(name, e)
  }
  if (counts.size === 0) return null
  return [...counts.values()].sort((a, b) => b.count - a.count)[0].name
}

function era(year: number): 'pre1900' | '1900to1945' | '1945to1970' {
  if (year < 1900) return 'pre1900'
  if (year < 1945) return '1900to1945'
  return '1945to1970'
}

const ERA_LABELS: Record<string, string> = {
  pre1900: 'Before 1900',
  '1900to1945': '1900 – 1945',
  '1945to1970': '1945 – 1970',
}

async function fetchClassics(): Promise<ClassicBook[]> {
  const supabase = adminClient()
  const SELECT = 'id, title, slug, cover_url, first_published_year, book_authors(authors(display_name)), bans(country_code, countries(name_en))'

  let all: ClassicBook[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books')
      .select(SELECT)
      .lt('first_published_year', 1970)
      .not('first_published_year', 'is', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as ClassicBook[])
    if (data.length < 1000) break
    offset += 1000
  }

  return all
    .filter(b => b.bans.length >= 1)
    .sort((a, b) => b.bans.length - a.bans.length)
}

export default async function BannedClassicsPage() {
  const books = await fetchClassics()

  const grouped: Record<string, ClassicBook[]> = { pre1900: [], '1900to1945': [], '1945to1970': [] }
  for (const book of books) {
    grouped[era(book.first_published_year)].push(book)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Banned Classic Literature
        </h1>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl text-sm">
          A common assumption is that book banning is a relic of less enlightened times. The titles
          below prove otherwise. Every work on this page was first published before 1970 — and every
          one has been formally banned, challenged, or removed from shelves within living memory.
          Orwell wrote <em>1984</em> in 1948; it is still removed from school curricula today.
          Nabokov&apos;s <em>Lolita</em> was prosecuted in multiple countries in the 1950s; it
          still appears on challenge lists. The books that threaten power tend to keep threatening it.
          For how we define a ban, see our{' '}
          <Link href="/methodology" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            methodology
          </Link>.
        </p>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        {books.length} works · sorted by ban count within each era
      </p>

      {(['pre1900', '1900to1945', '1945to1970'] as const).map(eraKey => {
        const group = grouped[eraKey]
        if (group.length === 0) return null
        return (
          <section key={eraKey} className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 pb-2 border-b border-gray-200 dark:border-gray-700">
              {ERA_LABELS[eraKey]}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{group.length} works</p>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {group.map((book, i) => {
                const author = book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
                const top = topCountry(book.bans)
                return (
                  <Link
                    key={book.id}
                    href={`/books/${book.slug}`}
                    className="flex items-center gap-4 py-3 group hover:bg-gray-50 dark:hover:bg-gray-900/50 -mx-3 px-3 rounded-lg transition-colors"
                  >
                    {/* Rank */}
                    <span className="w-7 shrink-0 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500 font-mono">
                      {i + 1}
                    </span>

                    {/* Cover */}
                    <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {book.cover_url ? (
                        <Image
                          src={book.cover_url}
                          alt={`Cover of ${book.title}`}
                          width={36}
                          height={48}
                          className="w-full h-full object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:underline truncate">
                        {book.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {author}
                        {book.first_published_year && (
                          <span className="text-gray-400 dark:text-gray-500"> · {book.first_published_year}</span>
                        )}
                      </p>
                      {top && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{top}</p>
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
          </section>
        )
      })}

      <p className="mt-6 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-800 pt-6">
        Includes only works with at least one documented ban in our catalogue. Coverage skews toward
        English-language sources.{' '}
        <Link href="/methodology" className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Read the methodology →
        </Link>
      </p>
    </main>
  )
}
