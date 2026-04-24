export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import ReasonBadge, { reasonLabel, reasonIcon } from '@/components/reason-badge'

const FILTER_REASONS = ['lgbtq', 'political', 'religious', 'sexual', 'violence', 'racial']

type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: {
    id: number
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]
}

function getReasons(book: Book): string[] {
  return [
    ...new Set(
      book.bans.flatMap((ban) =>
        ban.ban_reason_links
          .map((l) => l.reasons?.slug)
          .filter((s): s is string => !!s)
      )
    ),
  ]
}

function authorName(book: Book): string {
  return book.book_authors
    .map((ba) => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ')
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason: activeReason } = await searchParams

  let books: Book[] = []
  let fetchError: string | null = null

  try {
    const supabase = adminClient()
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, first_published_year,
        book_authors(authors(display_name)),
        bans(id, ban_reason_links(reasons(slug)))
      `)
      .order('title')

    if (error) fetchError = error.message
    else books = (data as unknown as Book[]) ?? []
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  const filtered = activeReason
    ? books.filter((b) => getReasons(b).includes(activeReason))
    : books

  const [featured, ...rest] = filtered

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Banned Books</h1>
        <p className="text-gray-500 text-sm">
          An international catalogue of books banned by governments and schools.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/"
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            !activeReason
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          All books
        </Link>
        {FILTER_REASONS.map((slug) => (
          <Link
            key={slug}
            href={`/?reason=${slug}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeReason === slug
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <span aria-hidden="true">{reasonIcon(slug)}</span>
            {reasonLabel(slug)}
          </Link>
        ))}
      </div>

      {fetchError && (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50 mb-8">
          Could not load books: {fetchError}
        </p>
      )}

      {!fetchError && filtered.length === 0 && (
        <p className="text-gray-500">No books found for this filter.</p>
      )}

      {/* Featured book */}
      {featured && (
        <Link href={`/books/${featured.slug}`} className="block mb-10 group">
          <div className="flex gap-6 border rounded-xl p-5 hover:border-gray-400 transition-colors bg-white">
            <div className="shrink-0">
              {featured.cover_url ? (
                <Image
                  src={featured.cover_url}
                  alt={`Cover of ${featured.title}`}
                  width={110}
                  height={165}
                  className="rounded shadow-sm object-cover"
                />
              ) : (
                <div className="w-[110px] h-[165px] bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs text-center p-2">
                  No cover
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-2 min-w-0">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Featured</p>
                <h2 className="text-xl font-bold group-hover:underline leading-snug">{featured.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {authorName(featured)}
                  {featured.first_published_year && (
                    <span className="text-gray-400"> · {featured.first_published_year}</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getReasons(featured).map((slug) => (
                  <ReasonBadge key={slug} slug={slug} />
                ))}
              </div>
              <p className="text-sm text-gray-500">
                Banned in{' '}
                <span className="font-semibold text-gray-900">{featured.bans.length}</span>{' '}
                {featured.bans.length === 1 ? 'country' : 'countries'}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Book grid */}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {rest.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.slug}`}
              className="group flex flex-col"
            >
              <div className="mb-2">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={`Cover of ${book.title}`}
                    width={160}
                    height={240}
                    className="rounded shadow-sm object-cover w-full"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs text-center p-3">
                    {book.title}
                  </div>
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug group-hover:underline">
                {book.title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{authorName(book)}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {getReasons(book).map((slug) => (
                  <ReasonBadge key={slug} slug={slug} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Banned in {book.bans.length}{' '}
                {book.bans.length === 1 ? 'country' : 'countries'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
