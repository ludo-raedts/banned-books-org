import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import SectionShell from '@/components/section/SectionShell'
import { coverAlt } from '@/lib/cover-alt'

export type BookOfDay = {
  title: string
  slug: string
  cover_url: string | null
  author: string
  year: number | null
  description: string | null
  banCount: number
  countryCount: number
}

export default function BookOfDaySection({ book }: { book: BookOfDay }) {
  return (
    <SectionShell tone="cream" eyebrow="Book of the day">
      <Link
        href={`/books/${book.slug}`}
        className="hover-lift-book group block bg-white dark:bg-gray-900 border border-cream-border dark:border-gray-700 rounded-sm p-5 md:p-7"
      >
        <div className="flex flex-col sm:flex-row gap-6 md:gap-10 items-start">
          <div className="shrink-0 mx-auto sm:mx-0">
            <div
              className="relative w-[200px] sm:w-[220px] md:w-[300px] aspect-[2/3] overflow-hidden rounded-sm"
              style={{ boxShadow: '6px 6px 0 rgba(92, 16, 16, 0.12)' }}
            >
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={coverAlt(book.title, book.author, book.year)}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 300px, (min-width: 640px) 220px, 200px"
                  priority
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
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="book-title font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {book.title}
            </h3>
            {book.author && (
              <p className="mt-1 text-xs md:text-sm font-medium text-oxblood">
                {book.author}
                {book.year ? ` · ${book.year}` : ''}
              </p>
            )}
            {book.description && (
              <p className="mt-4 font-serif text-base md:text-lg leading-relaxed text-gray-800 dark:text-gray-200 max-w-[460px] line-clamp-5">
                {book.description}
              </p>
            )}

            <div className="mt-5 pt-3 border-t flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300" style={{ borderColor: '#e8d4cd' }}>
              <span>
                {book.countryCount} {book.countryCount === 1 ? 'country' : 'countries'}
                {book.banCount > book.countryCount
                  ? ` · ${book.banCount.toLocaleString('en')} recorded bans`
                  : ''}
              </span>
              <span className="font-medium text-oxblood">Read entry →</span>
            </div>
          </div>
        </div>
      </Link>
    </SectionShell>
  )
}
