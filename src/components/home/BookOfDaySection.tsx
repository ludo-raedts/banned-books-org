import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import SectionShell from '@/components/section/SectionShell'
import { coverAlt } from '@/lib/cover-alt'
import { reasonLabel } from '@/components/reason-badge'
import { reasonColor } from '@/lib/reasons-display'

export type BookOfDay = {
  title: string
  slug: string
  cover_url: string | null
  author: string
  year: number | null
  description: string | null
  genres: string[]
  /** Either the editorial `books.censorship_summary` or a template generated from ban data. */
  summary: string
  /** Distinct reason slugs aggregated across every ban for this book. */
  reasons: string[]
  banCount: number
  countryCount: number
  activeCount: number
}

const REASON_PILL_ORDER = ['political', 'racial', 'sexual', 'religious', 'lgbtq', 'language', 'violence', 'obscenity', 'drugs', 'blasphemy', 'moral'] as const

function orderedReasons(slugs: string[]): string[] {
  const idx = (s: string) => {
    const i = (REASON_PILL_ORDER as readonly string[]).indexOf(s)
    return i === -1 ? REASON_PILL_ORDER.length : i
  }
  return [...slugs].sort((a, b) => idx(a) - idx(b))
}

export default function BookOfDaySection({ book }: { book: BookOfDay }) {
  const displayedReasons = orderedReasons(book.reasons)
  const displayedGenres = book.genres.slice(0, 3)
  return (
    <SectionShell tone="cream" eyebrow="Book of the day">
      {/* Stretched-link card: the whole card opens the book entry, but the
          footer "Share" link sits above the overlay (relative z-10) so it
          navigates to /share — the daily-book share hub — instead. */}
      <div className="hover-lift-book group relative bg-white border border-cream-border rounded-sm p-5 md:p-7">
        <Link
          href={`/books/${book.slug}`}
          aria-label={`Read the full entry for ${book.title}`}
          className="absolute inset-0 rounded-sm"
        />
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 md:gap-7 items-start">
          <div className="mx-auto md:mx-0">
            <div
              className="relative w-[180px] h-[270px] overflow-hidden rounded-sm"
              style={{ boxShadow: '6px 6px 0 rgba(92, 16, 16, 0.12)' }}
            >
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={coverAlt(book.title, book.author, book.year)}
                  fill
                  className="object-cover"
                  sizes="180px"
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

            {displayedGenres.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {displayedGenres.map(g => (
                  <span
                    key={g}
                    className="inline-flex text-[10px] px-2 py-0.5 bg-white border border-neutral-300 rounded-full text-neutral-600"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="book-title font-serif text-2xl font-semibold tracking-tight text-neutral-900">
              {book.title}
            </h3>
            {book.author && (
              <p className="mt-1 text-xs font-medium text-oxblood">
                {book.author}
                {book.year ? ` · ${book.year}` : ''}
              </p>
            )}
            {book.description && (
              <p className="mt-3.5 font-serif text-[15px] leading-relaxed text-neutral-800">
                {book.description}
              </p>
            )}

            {book.summary && (
              <div className="mt-4 bg-white border-l-[3px] border-oxblood p-3.5 mb-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-oxblood font-semibold mb-1.5">
                  Censorship summary
                </p>
                <p className="text-xs text-neutral-800 leading-relaxed mb-2.5">
                  {book.summary}
                </p>
                {displayedReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {displayedReasons.map(slug => (
                      <span
                        key={slug}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white border border-neutral-300 rounded-full text-[11px] text-neutral-600"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: reasonColor(slug) }}
                          aria-hidden="true"
                        />
                        {reasonLabel(slug)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-600"
              style={{ borderColor: '#e8d4cd' }}
            >
              {/* Subtle share affordance — sits above the stretched card link
                  (relative z-10) so it routes to the daily-book share hub. */}
              <Link
                href="/share"
                className="relative z-10 inline-flex items-center gap-1.5 font-medium text-neutral-500 hover:text-oxblood transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share this book
              </Link>
              <span className="text-neutral-400" aria-hidden="true">·</span>
              <span>
                <span className="font-semibold text-oxblood">{book.countryCount}</span>{' '}
                {book.countryCount === 1 ? 'country' : 'countries'}
              </span>
              <span className="text-neutral-400" aria-hidden="true">·</span>
              <span>
                <span className="font-semibold text-oxblood">{book.banCount.toLocaleString('en')}</span>{' '}
                recorded {book.banCount === 1 ? 'ban' : 'bans'}
              </span>
              <span className="text-neutral-400" aria-hidden="true">·</span>
              <span>
                <span className="font-semibold text-oxblood">{book.activeCount.toLocaleString('en')}</span>{' '}
                still active
              </span>
              <span className="ml-auto font-medium text-oxblood">Read full entry →</span>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
