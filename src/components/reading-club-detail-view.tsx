// Shared HTML layout for a single Reading Club book entry. Used by every
// track-specific page (international, classics, by-theme, currently-
// challenged) so the visual language stays identical and we don't fork
// markup four ways.

import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'
import { reasonLabel } from '@/components/reason-badge'
import { getBookshopUrl, getBookshopLinkType, BOOKSHOP_REL } from '@/lib/bookshop'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import TrackedPdfDownload from '@/components/tracked-pdf-download'
import type { ReadingClubDetail } from '@/lib/reading-club-detail'
import { aggregateSources } from '@/lib/reading-club-detail'

type Props = {
  detail: ReadingClubDetail
  // Path to the route's own HTML page; `/pdf` is appended for the download.
  pageHref: string
}

export default function ReadingClubDetailView({ detail, pageHref }: Props) {
  const bookshopUrl = getBookshopUrl({ isbn13: detail.book.isbn13 })
  const author = detail.book.authors.join(', ') || 'Unknown author'
  const pdfHref = `${pageHref}/pdf`

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-neutral-500 mb-4">
            <Link href="/reading-club" className="hover:underline">Reading Club</Link>
            {' · '}
            <Link href={detail.trackHref} className="hover:underline">{detail.trackLabel}</Link>
          </p>
          <Eyebrow>Book-club guide</Eyebrow>
          <div className="flex flex-col-reverse md:flex-row md:items-start gap-6 md:gap-8">
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] text-gray-900">
                {detail.book.title}
              </h1>
              <p className="mt-2 text-base md:text-lg text-neutral-700">{author}</p>
              {detail.book.firstPublishedYear != null && (
                <p className="mt-1 text-sm text-neutral-500">First published {detail.book.firstPublishedYear}</p>
              )}
              {detail.challengeCount != null && (
                <p className="mt-1 text-sm text-neutral-500">
                  {detail.challengeCount} ALA challenges in {detail.year}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3 items-center">
                <TrackedPdfDownload
                  href={pdfHref}
                  track={detail.track}
                  bookSlug={detail.book.slug}
                  themeSlug={detail.themeSlug ?? null}
                  year={detail.year ?? null}
                  position={detail.position ?? null}
                  source="detail-hero"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-oxblood text-white text-sm font-medium rounded-sm hover:bg-oxblood/90 transition-colors"
                >
                  Download book-club PDF
                </TrackedPdfDownload>
                {detail.book.slug && (
                  <Link
                    href={`/books/${detail.book.slug}`}
                    className="text-sm text-oxblood hover:underline"
                  >
                    View full ban record →
                  </Link>
                )}
              </div>
            </div>

            <div className="w-32 md:w-40 flex-shrink-0">
              {detail.book.coverUrl ? (
                <Image
                  src={detail.book.coverUrl}
                  alt={`Cover of ${detail.book.title}`}
                  width={160}
                  height={240}
                  className="rounded shadow-sm w-full h-auto object-cover"
                />
              ) : (
                <BookCoverPlaceholder
                  title={detail.book.title}
                  author={author}
                  slug={detail.book.slug ?? detail.book.title}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {(detail.customBlurb || detail.book.description) && (
        <SectionShell tone="cream" eyebrow="About the book">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-5 pb-3 border-b border-oxblood/30">
              About the book
            </h2>
            {detail.customBlurb && (
              <p className="font-serif text-lg leading-relaxed text-gray-900 italic mb-4">
                {detail.customBlurb}
              </p>
            )}
            {detail.book.description && (
              <p className="text-base leading-relaxed text-gray-800 whitespace-pre-line">
                {detail.book.description}
              </p>
            )}
          </div>
        </SectionShell>
      )}

      {detail.authorRecords.some(a => a.bio || a.birthYear != null || a.birthCountry) && (
        <SectionShell tone="white" eyebrow="The writer">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-5 pb-3 border-b border-oxblood/30">
              About the author
            </h2>
            <div className="space-y-8">
              {detail.authorRecords.map((a, i) => {
                const dateParts: string[] = []
                if (a.birthYear != null || a.deathYear != null) {
                  dateParts.push(`${a.birthYear ?? '?'}–${a.deathYear ?? 'present'}`)
                }
                if (a.birthCountry) dateParts.push(a.birthCountry)
                return (
                  <div key={i} className="flex flex-col sm:flex-row gap-5">
                    {a.photoUrl && (
                      <div className="w-28 flex-shrink-0">
                        <Image
                          src={a.photoUrl}
                          alt={`Portrait of ${a.displayName}`}
                          width={112}
                          height={112}
                          className="rounded-full w-28 h-28 object-cover bg-neutral-100"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-lg font-semibold text-gray-900">{a.displayName}</p>
                      {dateParts.length > 0 && (
                        <p className="text-sm text-neutral-500 mb-2">{dateParts.join(' · ')}</p>
                      )}
                      {a.bio && (
                        <p className="text-base leading-relaxed text-gray-800 whitespace-pre-line">
                          {a.bio}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </SectionShell>
      )}

      {(detail.banSummary || detail.bans.length > 0) && (
        <SectionShell tone="cream" eyebrow="Censorship context">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-5 pb-3 border-b border-oxblood/30">
              Why it was banned
            </h2>
            {detail.banSummary && (
              <p className="text-base md:text-lg leading-relaxed text-gray-800 mb-6">
                {detail.banSummary}
              </p>
            )}
            {detail.bans.length > 0 && (
              <ul className="space-y-3">
                {detail.bans.slice(0, 10).map((b, i) => (
                  <li key={i} className="border-l-2 border-oxblood/30 pl-4">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-semibold text-gray-900">{b.countryName}</span>
                      {(b.yearStarted || b.yearEnded) && (
                        <span className="text-sm text-neutral-500">
                          {b.yearStarted && b.yearEnded
                            ? `${b.yearStarted}–${b.yearEnded}`
                            : b.yearStarted
                              ? (b.status === 'active' ? `since ${b.yearStarted}` : String(b.yearStarted))
                              : `until ${b.yearEnded}`}
                        </span>
                      )}
                      {b.reasons.length > 0 && (
                        <span className="text-sm text-neutral-600">
                          {b.reasons.map(r => reasonLabel(r)).join(' · ')}
                        </span>
                      )}
                    </div>
                    {b.description && (
                      <p className="text-sm text-neutral-700 mt-1 leading-relaxed">{b.description}</p>
                    )}
                  </li>
                ))}
                {detail.bans.length > 10 && detail.book.slug && (
                  <li className="text-sm text-neutral-500 pl-4">
                    + {detail.bans.length - 10} more — see the{' '}
                    <Link href={`/books/${detail.book.slug}`} className="text-oxblood hover:underline">
                      full ban record
                    </Link>.
                  </li>
                )}
              </ul>
            )}
          </div>
        </SectionShell>
      )}

      {detail.discussionQuestions.length > 0 && (
        <SectionShell tone="white" eyebrow="For your reading group">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-5 pb-3 border-b border-oxblood/30">
              Discussion questions for this book
            </h2>
            <ol className="list-decimal pl-6 space-y-3 text-base text-gray-800 leading-relaxed marker:text-oxblood marker:font-semibold">
              {detail.discussionQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>
        </SectionShell>
      )}

      {detail.universalQuestions.length > 0 && (
        <SectionShell tone="cream" eyebrow="For any banned book">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-5 pb-3 border-b border-oxblood/30">
              Discussion questions for any banned book
            </h2>
            <ol className="list-decimal pl-6 space-y-3 text-base text-gray-800 leading-relaxed marker:text-oxblood marker:font-semibold">
              {detail.universalQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>
        </SectionShell>
      )}

      <SourcesAndAttribution detail={detail} />

      <SectionShell tone="white">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-4">
          <TrackedPdfDownload
            href={pdfHref}
            track={detail.track}
            bookSlug={detail.book.slug}
            themeSlug={detail.themeSlug ?? null}
            year={detail.year ?? null}
            position={detail.position ?? null}
            source="detail-footer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-oxblood text-white text-sm font-medium rounded-sm hover:bg-oxblood/90 transition-colors"
          >
            Download book-club PDF
          </TrackedPdfDownload>
          <TrackedOutboundLink
            eventName="Bookshop Click"
            eventProperties={{ source: 'reading-club-detail', bookSlug: detail.book.slug, isbn13: detail.book.isbn13 ?? null, linkType: getBookshopLinkType(bookshopUrl) }}
            href={bookshopUrl}
            target="_blank"
            rel={BOOKSHOP_REL}
            className="text-sm text-gray-700 hover:text-oxblood underline-offset-2 hover:underline"
          >
            Buy on Bookshop.org
          </TrackedOutboundLink>
          <Link
            href={detail.trackHref}
            className="text-sm text-neutral-500 hover:underline ml-auto"
          >
            ← Back to {detail.trackLabel}
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}

// Per-ban upstream sources + ALA OIF credit + CC-BY notice for the
// curated text. Mirrors the same block embedded in the PDF so the HTML
// and PDF tell the reader the same story about provenance.
function SourcesAndAttribution({ detail }: { detail: ReadingClubDetail }) {
  const sources = aggregateSources(detail.bans)
  const isAla = detail.track === 'currently-challenged'
  return (
    <SectionShell tone="cream" eyebrow="Sources & attribution">
      <div className="max-w-3xl mx-auto text-sm text-neutral-700 space-y-2">
        {isAla && (
          <p>
            ALA Office for Intellectual Freedom — Top 10 Most Challenged Books
            {detail.year ? ` (${detail.year})` : ''}.
            {detail.sourceUrl && (
              <>
                {' '}
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-oxblood hover:underline break-all"
                >
                  {detail.sourceUrl}
                </a>
              </>
            )}
          </p>
        )}
        {sources.length > 0 && (
          <ul className="space-y-1">
            {sources.map((s, i) => (
              <li key={i}>
                {s.name} —{' '}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-oxblood hover:underline break-all"
                >
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-500 pt-2">
          Discussion questions and curated text © banned-books.org, licensed{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            CC BY 4.0
          </a>{' '}
          — share with attribution.
        </p>
      </div>
    </SectionShell>
  )
}

// JSON-LD helper, shared so each route can render the same structured-data
// surface for SEO without duplicating the Book/FAQPage shape.
export function buildReadingClubJsonLd(detail: ReadingClubDetail) {
  const allQuestions = [...detail.discussionQuestions, ...detail.universalQuestions]
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Book',
        name: detail.book.title,
        author: detail.book.authors.map(a => ({ '@type': 'Person', name: a })),
        ...(detail.book.firstPublishedYear ? { datePublished: String(detail.book.firstPublishedYear) } : {}),
        ...(detail.book.isbn13 ? { isbn: detail.book.isbn13 } : {}),
        ...(detail.book.coverUrl ? { image: detail.book.coverUrl } : {}),
        ...(detail.book.slug ? { url: `https://www.banned-books.org/books/${detail.book.slug}` } : {}),
      },
      ...(allQuestions.length > 0 ? [{
        '@type': 'FAQPage',
        mainEntity: allQuestions.slice(0, 10).map(q => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Open discussion question — bring your reading group’s own perspective.',
          },
        })),
      }] : []),
    ],
  }
}
