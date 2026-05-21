import type { Metadata } from 'next'
import Link from 'next/link'
import { getClassicsTrack } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Banned classics — Reading Club',
  description: 'Classic banned books — works that survived the censors of their era and still read powerfully today.',
  alternates: { canonical: '/reading-club/classics' },
}

export default async function ClassicsTrackPage() {
  const [rows, blocks] = await Promise.all([
    getClassicsTrack(),
    getPublishedBlockMap(REQUIRED_BLOCKS_BY_PAGE['reading-club-classics']),
  ])
  const intro = blocks.get('track-classics-intro')

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

          <Eyebrow>Track · Historical</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Banned classics.
          </h1>

          {intro && (
            <div
              className="mt-6 prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}

          <p className="mt-6 text-xs text-neutral-500">
            Looking for a deeper catalogue? See{' '}
            <Link href="/banned-classics" className="text-oxblood hover:underline">
              all classics in the dataset
            </Link>.
          </p>
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
                  track="classics"
                  clubHref={r.bookSlug ? `/reading-club/classics/${r.bookSlug}` : undefined}
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
          <Link href="/reading-club/international" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Worldwide</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              International cases →
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
