import Link from '@/components/link'
import CoverThumb from '@/components/cover-thumb'
import { coverAlt } from '@/lib/cover-alt'
import type { YearBook } from '@/lib/year-books'

// One row of the /banned-books/[year] list. Hook-free so the server page and
// the client "show more" list render identical markup.
export default function YearBookRow({ book, rank }: { book: YearBook; rank: number }) {
  return (
    <Link
      href={`/books/${book.slug}`}
      className="flex items-center gap-4 py-3 group hover:bg-gray-50 -mx-3 px-3 rounded-lg transition-colors"
    >
      <span className="w-7 shrink-0 text-right text-xs tabular-nums text-gray-400 font-mono">
        {rank}
      </span>
      <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-gray-100">
        <CoverThumb
          title={book.title}
          slug={book.slug}
          coverUrl={book.cover_url}
          alt={coverAlt(book.title, book.author)}
          width={36}
          height={48}
          sizes="36px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug group-hover:underline truncate">
          {book.title}
        </p>
        {book.author && (
          <p className="text-xs text-gray-500 truncate">{book.author}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5 truncate">{book.countries}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-sm font-bold tabular-nums text-red-500">
          {book.banCount}
        </span>
        <p className="text-xs text-gray-400">
          {book.banCount === 1 ? 'ban' : 'bans'}
        </p>
      </div>
    </Link>
  )
}
