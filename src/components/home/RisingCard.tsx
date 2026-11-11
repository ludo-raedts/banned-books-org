import Image from 'next/image'
import Link from '@/components/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'

export type RisingBook = {
  id: number
  title: string
  slug: string
  author: string
  cover_url: string | null
  /** Distinct visitor-days this week and the week before. */
  thisWeek: number
  prevWeek: number
}

export default function RisingCard({ book }: { book: RisingBook }) {
  const alt = coverAlt(book.title, book.author)
  return (
    <Link
      href={`/books/${book.slug}`}
      className="hover-lift-card group flex gap-3 bg-white border border-neutral-200 rounded-sm p-3 h-full"
    >
      <div className="shrink-0 relative w-14 h-[84px] overflow-hidden rounded-sm">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={alt}
            fill
            className="object-cover"
            sizes="56px"
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
      <div className="flex-1 min-w-0">
        {/* Counts, not a percentage: "+300%" from 1 visit to 4 reads as a trend.
            Visits are visitor-days (the visitor hash changes daily; no cookies),
            so they are called visits. */}
        <div className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-oxblood leading-none">
          {book.thisWeek}{' '}
          <span className="font-sans text-xs font-medium tracking-normal text-neutral-700">visits this week</span>
        </div>
        <div className="mt-1 text-[11px] text-neutral-700">
          {book.prevWeek > 0 ? `up from ${book.prevWeek} the week before` : 'none the week before'}
        </div>
        <h3 className="book-title mt-1 font-serif text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
          {book.title}
        </h3>
        {book.author && (
          <p className="text-[11px] text-gray-600 line-clamp-1">
            {book.author}
          </p>
        )}
      </div>
    </Link>
  )
}
