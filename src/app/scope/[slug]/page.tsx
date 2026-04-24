export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

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
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
        ← All books
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">{scope.label_en} bans</h1>
        <p className="text-gray-500 text-sm">
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
              {book.description && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">
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
              <p className="text-xs font-medium text-red-600 mt-1.5">
                {banLabel(book.bans)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
