// Shared book card used on every Reading Club track page. Keeps the visual
// language consistent across Currently Challenged / International / Classics
// / theme subpages.

import Link from 'next/link'
import Image from 'next/image'
import { getBookshopUrl, getBookshopLinkType, BOOKSHOP_REL } from '@/lib/bookshop'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import type { ReadingClubCard as Card } from '@/lib/reading-club-data'

export default function ReadingClubBookCard({
  card,
  showCountries,
  clubHref,
}: {
  card: Card
  showCountries?: boolean
  // When set, the card surfaces a "Book-club guide" link + PDF download.
  // Each track passes its own URL; auto-pulled by-theme rows without a
  // curator entry omit it to avoid 404s.
  clubHref?: string
}) {
  // Always go through the canonical helper: per-ISBN deeplink when
  // bookshop_status='valid', otherwise storefront fallback. Manual URL
  // overrides on the currently-challenged track were removed because
  // they shipped stale search URLs that broke when bookshop changed
  // their search routing (migration 20260521180000).
  const bookshopUrl = getBookshopUrl({ isbn13: card.isbn13, bookshopIsbn13: card.bookshopIsbn13, bookshopStatus: card.bookshopStatus })

  return (
    <li className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
      <div className="flex gap-3">
        {card.coverUrl ? (
          <Image src={card.coverUrl} alt="" width={64} height={96} className="rounded object-cover w-16 h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-800" />
        ) : (
          <div className="w-16 h-24 flex-shrink-0 rounded bg-gray-100 dark:bg-gray-800" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-gray-400">#{card.position}</span>
            {card.bookSlug ? (
              <Link href={`/books/${card.bookSlug}`} className="font-semibold text-sm hover:text-brand transition-colors">
                {card.title}
              </Link>
            ) : (
              <span className="font-semibold text-sm">{card.title}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {card.authors.length > 0 ? card.authors.join(', ') : '—'}
            {card.challengeCount != null && ` · ${card.challengeCount} ALA challenges`}
            {card.banCount > 0 && ` · ${card.banCount} bans`}
            {showCountries && card.countries.length > 0 && ` · ${new Set(card.countries).size} countries`}
          </div>
          {card.customBlurb ? (
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{card.customBlurb}</p>
          ) : card.description ? (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed line-clamp-3">{card.description}</p>
          ) : null}
        </div>
      </div>

      {card.discussionQuestions.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs font-medium text-gray-500 cursor-pointer">
            {card.discussionQuestions.length} discussion question{card.discussionQuestions.length !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 list-disc pl-5 space-y-1">
            {card.discussionQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {clubHref && (
          <Link href={clubHref} className="text-oxblood font-medium hover:underline">
            Book-club guide →
          </Link>
        )}
        {clubHref && (
          <a
            href={`${clubHref}/pdf`}
            download
            className="text-oxblood hover:underline"
          >
            Download PDF
          </a>
        )}
        {card.bookSlug && (
          <Link href={`/books/${card.bookSlug}`} className="text-brand hover:underline">
            View in our database →
          </Link>
        )}
        <TrackedOutboundLink
          eventName="Bookshop Click"
          eventProperties={{ source: 'reading-club', bookSlug: card.bookSlug ?? null, isbn13: card.isbn13 ?? null, linkType: getBookshopLinkType(bookshopUrl) }}
          href={bookshopUrl}
          target="_blank"
          rel={BOOKSHOP_REL}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Buy on Bookshop.org
        </TrackedOutboundLink>
        {card.sourceUrl && (
          <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
            Source
          </a>
        )}
      </div>
    </li>
  )
}
