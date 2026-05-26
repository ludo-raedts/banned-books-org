import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getYoungReadersTrack } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Banned books for young readers — Reading Club',
  description:
    'Books written for children that adults tried to keep from them. The paradox of banning children’s literature, with discussion questions on both the book and the ban.',
  alternates: { canonical: '/reading-club/young-readers' },
}

// Max covers in the strip directly below the hero. Tuned for the 6-column
// desktop grid so the strip is exactly one row on large screens. Mobile
// shows the first 6 in a 3-col grid (two rows).
const STRIP_LIMIT = 12

export default async function YoungReadersTrackPage() {
  const [rows, blocks] = await Promise.all([
    getYoungReadersTrack(),
    getPublishedBlockMap(REQUIRED_BLOCKS_BY_PAGE['reading-club-young-readers']),
  ])
  const intro = blocks.get('track-young-readers-intro')

  // Cover strip: prefer the featured-flagged subset (editorial signal), but
  // top up from the rest in position order if fewer than ~6 are flagged.
  // The strip exists to put visual content above the fold; never gate it on
  // the featured-flag alone.
  const featured = rows.filter(r => r.featured && r.coverUrl && r.bookSlug)
  const fillers = rows.filter(r => !r.featured && r.coverUrl && r.bookSlug)
  const stripRows = [...featured, ...fillers].slice(0, STRIP_LIMIT)

  return (
    <main>
      {/* ── Slim hero ────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-6 md:pb-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/reading-club"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Reading Club
          </Link>

          <Eyebrow>Track · For young readers</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Banned books for young readers.
          </h1>

          <p className="mt-4 font-serif text-lg md:text-xl leading-relaxed text-gray-700 max-w-[680px]">
            Books written for children that adults tried to keep from them. {rows.length}{' '}
            {rows.length === 1 ? 'title' : 'titles'}, curated.
          </p>
        </div>
      </section>

      {/* ── Cover strip — visual anchor above the fold ──────────── */}
      {stripRows.length > 0 && (
        <section aria-label="Books on this track" className="bg-white px-6 md:px-9 pb-10 md:pb-14">
          <div className="max-w-5xl mx-auto">
            <ul className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-5 items-start">
              {stripRows.map(r => (
                <li key={r.bookId ?? r.position}>
                  <Link
                    href={r.bookSlug ? `/reading-club/young-readers/${r.bookSlug}` : '#'}
                    className="group flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40 rounded-sm"
                  >
                    <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-sm bg-neutral-100 ring-1 ring-neutral-200 shadow-sm transition-all group-hover:ring-oxblood group-hover:shadow-md">
                      {r.coverUrl ? (
                        <Image
                          src={r.coverUrl}
                          alt={`Cover of ${r.title}`}
                          fill
                          sizes="(min-width: 768px) 14vw, 30vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <BookCoverPlaceholder title={r.title} slug={r.bookSlug ?? r.title} className="h-full" />
                      )}
                    </span>
                    {r.audienceAsPublished && (
                      <span className="mt-2 text-[10px] uppercase tracking-wider text-neutral-500 line-clamp-1">
                        {r.audienceAsPublished.split(' (')[0]}
                      </span>
                    )}
                    <span className="font-serif text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-oxblood transition-colors">
                      {r.title}
                    </span>
                    {r.authors.length > 0 && (
                      <span className="text-xs text-neutral-600 line-clamp-1">{r.authors.join(', ')}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Full curated list with paradox blurbs + Q-set teasers ─ */}
      <SectionShell tone="cream" eyebrow={`${rows.length} ${rows.length === 1 ? 'title' : 'titles'} · curated`}>
        <div className="max-w-3xl mx-auto">
          {rows.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4">
              {rows.map(r => (
                <ReadingClubBookCard
                  key={r.bookId ?? r.position}
                  card={r}
                  track="young-readers"
                  clubHref={r.bookSlug ? `/reading-club/young-readers/${r.bookSlug}` : undefined}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">List not yet published.</p>
          )}
        </div>
      </SectionShell>

      {/* ── Comprehensive directory CTA ─────────────────────────── */}
      <SectionShell tone="white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-3 px-4 py-2.5 border border-oxblood/30 rounded-sm bg-cream/40">
            <p className="text-sm text-gray-800">
              Looking for the wide catalogue rather than the reading-group format?{' '}
              <Link href="/banned-childrens-books" className="text-oxblood hover:underline font-medium">
                → All banned children&rsquo;s books in our database
              </Link>
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ── Editorial framing — long-form, moved below the books ── */}
      {intro && (
        <SectionShell tone="cream" eyebrow="About this track">
          <div className="max-w-3xl mx-auto">
            <div
              className="prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          </div>
        </SectionShell>
      )}

      {/* ── Cross-promo to other tracks ─────────────────────────── */}
      <SectionShell tone="white" eyebrow="Other tracks">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Link href="/reading-club/currently-challenged" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">This year</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Currently challenged →
            </p>
          </Link>
          <Link href="/reading-club/international" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Worldwide</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              International cases →
            </p>
          </Link>
          <Link href="/reading-club/classics" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Historical</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Banned classics →
            </p>
          </Link>
          <Link href="/reading-club/by-theme" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Curated</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              By theme →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
