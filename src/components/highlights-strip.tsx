import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from './book-cover-placeholder'
import AuthorAvatar from './author-avatar'
import type { Book } from './book-browser'
import { coverAlt } from '@/lib/cover-alt'

export type HighlightSlot = 'most-banned' | 'trending' | 'all-time'

export type HighlightItem = {
  slot: HighlightSlot
  book: Book
  context: string
}

export type AuthorHighlightItem = {
  slot: HighlightSlot
  author: { id: number; display_name: string; slug: string; photo_url: string | null }
  context: string
}

const BOOK_SLOT_META: Record<HighlightSlot, { label: string; classes: string }> = {
  'most-banned': { label: 'Most banned',         classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  'trending':    { label: 'Trending this week',  classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'all-time':    { label: 'All-time most read',  classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

const AUTHOR_SLOT_META: Record<HighlightSlot, { label: string; classes: string }> = {
  'most-banned': { label: 'Most banned author',           classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  'trending':    { label: 'Trending author this week',    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'all-time':    { label: 'All-time most read author',    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

const ROW_CLASSES = 'flex gap-3 overflow-x-auto -mx-4 px-4 pb-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory sm:snap-none'
const CARD_CLASSES = 'group shrink-0 w-[78%] sm:w-auto snap-start flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors'

function bookAuthorName(book: Book): string {
  return book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
}

// Author avatar moved to its own file (`./author-avatar`) so it can run as
// a client component and catch <Image> load failures via onError — the
// stripped-down version that used to live here showed alt-text fallback
// instead of initials when Wikipedia rate-limited the optimizer batch.

export default function HighlightsStrip({
  items,
  authorItems = [],
}: {
  items: HighlightItem[]
  authorItems?: AuthorHighlightItem[]
}) {
  if (items.length === 0 && authorItems.length === 0) return null

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Highlights</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        The books readers come back to — and the authors authorities most want to silence.
      </p>

      {items.length > 0 && (
        <div className={ROW_CLASSES}>
          {items.map(item => {
            const meta = BOOK_SLOT_META[item.slot]
            const author = bookAuthorName(item.book)
            return (
              <Link key={`book-${item.slot}`} href={`/books/${item.book.slug}`} className={CARD_CLASSES}>
                <span className={`self-start inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-3 ${meta.classes}`}>
                  {meta.label}
                </span>
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 w-16 h-24 relative overflow-hidden rounded shadow-sm">
                    {item.book.cover_url ? (
                      <Image
                        src={item.book.cover_url}
                        alt={coverAlt(item.book.title, author)}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <BookCoverPlaceholder
                        title={item.book.title}
                        author={author}
                        slug={item.book.slug}
                        className="absolute inset-0 w-full h-full"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-brand dark:group-hover:text-brand transition-colors">
                      {item.book.title}
                    </h3>
                    {author && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{author}</p>
                    )}
                    {item.context && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2 leading-snug">
                        {item.context}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {authorItems.length > 0 && (
        <div className={`${ROW_CLASSES} ${items.length > 0 ? 'mt-3' : ''}`}>
          {authorItems.map(item => {
            const meta = AUTHOR_SLOT_META[item.slot]
            return (
              <Link key={`author-${item.slot}`} href={`/authors/${item.author.slug}`} className={CARD_CLASSES}>
                <span className={`self-start inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-3 ${meta.classes}`}>
                  {meta.label}
                </span>
                <div className="flex gap-3 items-center">
                  <div className="shrink-0">
                    <AuthorAvatar
                      name={item.author.display_name}
                      photoUrl={item.author.photo_url}
                      className="w-16 h-16 rounded-full object-cover shadow-sm"
                      initialsClassName="w-16 h-16 rounded-full bg-brand/10 dark:bg-brand/20 text-brand dark:text-red-300 flex items-center justify-center text-lg font-semibold tracking-tight shadow-sm"
                      sizes="64px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-brand dark:group-hover:text-brand transition-colors">
                      {item.author.display_name}
                    </h3>
                    {item.context && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2 leading-snug">
                        {item.context}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
