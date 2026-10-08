'use client'

// Ranked list of books with a 40×56 cover thumb, used by the long directory
// pages (/banned-childrens-books). Two things keep these 700+-row pages light:
//  1. It is a client component fed compact row data, so the server does not
//     duplicate every rendered row into the RSC flight payload (that doubled
//     the page to ~5 MB).
//  2. The thumb is a plain <img> pointing at ONE optimizer URL (w=160 covers
//     2× retina at 40px) instead of next/image's 6-entry srcset (~1.3 KB/row).

import Link from '@/components/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'

export type ThumbRow = {
  id: number
  slug: string
  title: string
  author: string
  year: number | null
  cover: string | null
  bans: number
  top: string | null
}

export default function ThumbBookList({ rows }: { rows: ThumbRow[] }) {
  return (
    <ol className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
      {rows.map((book, i) => (
        <li key={book.id}>
          <Link href={`/books/${book.slug}`} className="group flex items-center gap-4 px-4 py-3 hover:bg-cream/50 transition-colors">
            <span className="w-8 shrink-0 text-right font-serif text-base tabular-nums text-oxblood font-semibold">
              {i + 1}
            </span>
            <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-neutral-100">
              {book.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/_next/image?url=${encodeURIComponent(book.cover)}&w=160&q=75`}
                  alt={coverAlt(book.title, book.author, book.year ?? undefined)}
                  width={40}
                  height={56}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-base font-medium text-gray-900 leading-snug group-hover:text-oxblood transition-colors truncate">
                {book.title}
              </p>
              <p className="text-xs text-neutral-600 truncate">
                {book.author || '—'}
                {book.year && <span className="text-neutral-400"> · {book.year}</span>}
              </p>
              {book.top && <p className="text-[11px] text-neutral-500 truncate mt-0.5">{book.top}</p>}
            </div>
            <div className="shrink-0 text-right">
              <span className="font-serif text-lg font-semibold tabular-nums text-oxblood">{book.bans}</span>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                {book.bans === 1 ? 'ban' : 'bans'}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}
