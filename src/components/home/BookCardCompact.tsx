import Image from 'next/image'
import Link from '@/components/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'
import { displayNativeTitle } from '@/lib/native-title'
import type { TopListBook } from '@/components/top-list-card'

export default function BookCardCompact({
  book,
  sizes,
  dense = false,
}: {
  book: TopListBook
  sizes?: string
  /** Small-cover variant for rows of five or six: tighter padding, and the
   *  whole cover shown on a neutral ground instead of cropped to 2:3 — at this
   *  size a cropped cover loses its title or author line (UX review 2026-11-11). */
  dense?: boolean
}) {
  const alt = coverAlt(book.title, book.author)
  const nativeTitle = displayNativeTitle(book.title, book.title_native, book.title_native_lang)
  return (
    <Link
      href={`/books/${book.slug}`}
      className={`hover-lift-book group flex flex-col bg-white border border-neutral-200 rounded-sm h-full ${dense ? 'p-2' : 'p-3'}`}
    >
      <div className={`relative w-full aspect-[2/3] overflow-hidden rounded-sm ${dense ? 'bg-neutral-100' : ''}`}>
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={alt}
            fill
            className={dense ? 'object-contain' : 'object-cover'}
            sizes={sizes ?? '(min-width: 1024px) 220px, (min-width: 640px) 30vw, 90vw'}
          />
        ) : (
          <BookCoverPlaceholder
            title={book.title}
            author={book.author}
            slug={book.slug}
            className="absolute inset-0 w-full h-full"
          />
        )}
      </div>
      <div className={`flex-1 min-w-0 ${dense ? 'mt-2' : 'mt-3'}`}>
        <h3 className="book-title font-serif text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
          {book.title}
        </h3>
        {nativeTitle && (
          <p className="text-xs text-gray-700 mt-0.5 line-clamp-1" lang={book.title_native_lang ?? undefined}>
            {nativeTitle}
          </p>
        )}
        {book.author && (
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
            {book.author}
          </p>
        )}
        {book.context && (
          <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-snug">
            {book.context}
          </p>
        )}
      </div>
    </Link>
  )
}
