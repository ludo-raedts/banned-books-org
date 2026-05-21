import type { Metadata } from 'next'
import Link from 'next/link'
import { getInternationalTrack } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'International cases — Reading Club',
  description:
    'Banned and censored books from around the world, spanning regimes and regions. Curated by an automated diversity engine.',
  alternates: { canonical: '/reading-club/international' },
}

export default async function InternationalTrackPage() {
  const [rows, blocks] = await Promise.all([
    getInternationalTrack(),
    getPublishedBlockMap(REQUIRED_BLOCKS_BY_PAGE['reading-club-international']),
  ])
  const intro = blocks.get('track-international-intro')

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

          <Eyebrow>Track · Worldwide</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            International cases.
          </h1>

          {intro && (
            <div
              className="mt-6 prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}
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
                  showCountries
                  track="international"
                  clubHref={r.bookSlug ? `/reading-club/international/${r.bookSlug}` : undefined}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">List not yet published.</p>
          )}
        </div>
      </SectionShell>

      <SectionShell tone="white" eyebrow="Other tracks">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/reading-club/currently-challenged" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">This year</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Currently challenged →
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
