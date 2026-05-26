import type { Metadata } from 'next'
import Link from 'next/link'
import { getYoungReadersTrack } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Banned books for young readers — Reading Club',
  description:
    'Books written for children that adults tried to keep from them. The paradox of banning children’s literature, with discussion questions on both the book and the ban.',
  alternates: { canonical: '/reading-club/young-readers' },
}

export default async function YoungReadersTrackPage() {
  const [rows, blocks] = await Promise.all([
    getYoungReadersTrack(),
    getPublishedBlockMap(REQUIRED_BLOCKS_BY_PAGE['reading-club-young-readers']),
  ])
  const intro = blocks.get('track-young-readers-intro')

  return (
    <main>
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
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

          {intro && (
            <div
              className="mt-6 prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}

          <p className="mt-6 text-xs text-neutral-500">
            Audience labels on each book come from the publisher, not from banned-books.org. We document who tried to keep
            the book from young readers; what to read with your kid is your decision.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 px-4 py-2.5 border border-oxblood/30 rounded-sm bg-cream/40">
            <p className="text-sm text-gray-800">
              Looking for the wide catalogue rather than the reading-group format?{' '}
              <Link href="/banned-childrens-books" className="text-oxblood hover:underline font-medium">
                → All banned children&rsquo;s books in our database
              </Link>
            </p>
          </div>
        </div>
      </section>

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
