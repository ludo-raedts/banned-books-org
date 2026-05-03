export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data } = await adminClient()
    .from('scopes')
    .select('label_en')
    .eq('slug', slug.replace(/-/g, '_'))
    .single()

  if (!data) return {}

  const title = `${data.label_en} Bans`
  const description = `Browse all books banned in a ${data.label_en.toLowerCase()} context and the reasons behind their censorship.`

  return { title, description, alternates: { canonical: `/scope/${slug}` }, openGraph: { title, description } }
}

type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  first_published_year: number | null
  genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans: {
    id: number
    scope_id: number
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]
}

function authorName(book: Book): string {
  return book.book_authors
    .map((ba) => ba.authors?.display_name)
    .filter(Boolean)
    .join(', ')
}

function getReasons(book: Book): string[] {
  return [
    ...new Set(
      book.bans.flatMap((ban) =>
        ban.ban_reason_links.map((l) => l.reasons?.slug).filter((s): s is string => !!s)
      )
    ),
  ]
}

function banLabel(bans: Book['bans']): string {
  const n = bans.length
  if (n === 0) return 'No recorded bans'
  if (n === 1) {
    const country = bans[0].countries?.name_en
    return country ? `Banned in ${country}` : 'Banned in 1 country'
  }
  return `Banned in ${n} countries`
}

export default async function ScopePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dbSlug = slug.replace(/-/g, '_')
  const supabase = adminClient()

  const { data: scope, error: scopeError } = await supabase
    .from('scopes')
    .select('id, slug, label_en')
    .eq('slug', dbSlug)
    .single()

  if (scopeError || !scope) notFound()

  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, slug, cover_url, description, first_published_year, genres,
      book_authors(authors(display_name)),
      bans(id, scope_id, countries(name_en), ban_reason_links(reasons(slug)))
    `)
    .order('title')

  if (error) throw error

  const books = ((data as unknown as Book[]) ?? [])
    .filter((b) => b.bans.some((ban) => ban.scope_id === scope.id))

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors">
        ← All books
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">{scope.label_en} bans</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {books.length} {books.length === 1 ? 'book' : 'books'} banned in a {scope.label_en.toLowerCase()} context
        </p>
      </div>

      {books.length === 0 ? (
        <p className="text-gray-500">No books recorded for this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {books.map((book) => (
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
                    sizes="160px"
                  />
                ) : (
                  <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} />
                )}
              </div>
              <h3 className="text-sm font-semibold leading-snug group-hover:underline">
                {book.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{authorName(book)}</p>
              {book.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3">
                  {book.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {book.genres.map((g) => (
                  <GenreBadge key={g} slug={g} />
                ))}
                {getReasons(book).map((r) => (
                  <ReasonBadge key={r} slug={r} />
                ))}
              </div>
              <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1.5">
                {banLabel(book.bans)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
