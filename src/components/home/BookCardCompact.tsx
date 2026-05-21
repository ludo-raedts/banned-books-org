import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'
import type { TopListBook } from '@/components/top-list-card'

export default function BookCardCompact({ book, sizes }: { book: TopListBook; sizes?: string }) {
  const alt = coverAlt(book.title, book.author)
  return (
    <Link
      href={`/books/${book.slug}`}
      className="hover-lift-book group flex flex-col bg-white border border-neutral-200 rounded-sm p-3 h-full"
    >
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-sm">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={alt}
            fill
            className="object-cover"
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
      <div className="flex-1 min-w-0 mt-3">
        <h3 className="book-title font-serif text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
          {book.title}
        </h3>
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
