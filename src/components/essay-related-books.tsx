import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { adminClient } from '@/lib/supabase'

type RelatedBook = {
  id: number
  slug: string
  title: string
  cover_url: string | null
  book_authors: { authors: { display_name: string } | null }[]
}

export default async function EssayRelatedBooks({ slugs }: { slugs: string[] }) {
  if (slugs.length === 0) return null

  const { data } = await adminClient()
    .from('books')
    .select('id, slug, title, cover_url, book_authors(authors(display_name))')
    .in('slug', slugs)

  const books = (data as unknown as RelatedBook[] | null) ?? []
  if (books.length === 0) return null

  // Preserve the order from the slugs array — that's the curator's intent.
  const bySlug = new Map(books.map(b => [b.slug, b]))
  const ordered = slugs.map(s => bySlug.get(s)).filter((b): b is RelatedBook => !!b)

  return (
    <section className="mt-16 pt-10 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Books on this theme
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        From the catalogue — connected to what you just read.
      </p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {ordered.map(book => {
          const author = book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
          return (
            <li key={book.id}>
              <Link
                href={`/books/${book.slug}`}
                className="group block"
              >
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={`Cover of ${book.title}`}
                      width={240}
                      height={320}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                      sizes="(min-width: 768px) 200px, 45vw"
                    />
                  ) : (
                    <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 group-hover:underline">
                  {book.title}
                </p>
                {author && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{author}</p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
