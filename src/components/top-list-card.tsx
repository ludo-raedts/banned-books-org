import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from './book-cover-placeholder'
import AuthorAvatar from './author-avatar'
import { coverAlt } from '@/lib/cover-alt'

export type TopListBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  author: string
  context?: string
}

export type TopListAuthor = {
  id: number
  display_name: string
  slug: string
  photo_url: string | null
  context?: string
}

// Vertical-on-desktop, horizontal-on-mobile book card. Layout mirrors the
// HighlightsStrip on mobile (cover left, text right) but collapses to a
// stacked grid card on >=sm so 5 columns fit in the homepage container.
export function TopListBookCard({ book }: { book: TopListBook }) {
  const alt = coverAlt(book.title, book.author)
  return (
    <Link
      href={`/books/${book.slug}`}
      className="group flex flex-row sm:flex-col gap-3 sm:gap-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors h-full"
    >
      <div className="shrink-0 w-14 sm:w-full aspect-[2/3] relative overflow-hidden rounded shadow-sm">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={alt}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 56px"
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
      <div className="flex-1 min-w-0 sm:mt-2.5">
        <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-brand dark:group-hover:text-brand transition-colors">
          {book.title}
        </h3>
        {book.author && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            {book.author}
          </p>
        )}
        {book.context && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2 leading-snug">
            {book.context}
          </p>
        )}
      </div>
    </Link>
  )
}

export function TopListAuthorCard({ author }: { author: TopListAuthor }) {
  return (
    <Link
      href={`/authors/${author.slug}`}
      className="group flex flex-row sm:flex-col gap-3 sm:gap-0 sm:items-center sm:text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors h-full"
    >
      <div className="shrink-0 sm:flex sm:justify-center sm:w-full">
        <AuthorAvatar
          name={author.display_name}
          photoUrl={author.photo_url}
          className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover shadow-sm"
          initialsClassName="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-brand/10 dark:bg-brand/20 text-brand dark:text-red-300 flex items-center justify-center text-lg font-semibold tracking-tight shadow-sm"
          sizes="(min-width: 640px) 80px, 56px"
        />
      </div>
      <div className="flex-1 min-w-0 sm:mt-2.5">
        <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-brand dark:group-hover:text-brand transition-colors">
          {author.display_name}
        </h3>
        {author.context && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2 leading-snug">
            {author.context}
          </p>
        )}
      </div>
    </Link>
  )
}
