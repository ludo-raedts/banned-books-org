import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentlyChallenged } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import { ALAAttribution } from '@/components/bbw-disclaimer'
import ReadingClubBookCard from '@/components/reading-club-card'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Currently Challenged — Reading Club',
  description:
    'The ALA Office for Intellectual Freedom annual list of most-challenged books, with discussion questions. Independent of ALA.',
  alternates: { canonical: '/reading-club/currently-challenged' },
}

export default async function CurrentlyChallengedPage() {
  const currentYear = new Date().getFullYear()
  const slugs = REQUIRED_BLOCKS_BY_PAGE['reading-club-currently-challenged']

  // Fetch the latest year that has at least one published row.
  const [thisYear, lastYear, blocks] = await Promise.all([
    getCurrentlyChallenged(currentYear),
    getCurrentlyChallenged(currentYear - 1),
    getPublishedBlockMap(slugs),
  ])
  const rows = thisYear.length > 0 ? thisYear : lastYear
  const yearShown = thisYear.length > 0 ? currentYear : currentYear - 1

  const intro = blocks.get('track-currently-challenged-intro')

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/reading-club"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Reading Club
          </Link>

          <Eyebrow>Track · ALA OIF top 10</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Currently challenged · {yearShown}.
          </h1>

          <div className="mt-6">
            <ALAAttribution />
          </div>

          {intro && (
            <div
              className="mt-6 prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-h3:mt-4 prose-h3:mb-2 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}
        </div>
      </section>

      {/* ── List ──────────────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow={`Ranked · ${rows.length} ${rows.length === 1 ? 'title' : 'titles'}`}>
        <div className="max-w-3xl mx-auto">
          {rows.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4">
              {rows.map(r => (
                <ReadingClubBookCard
                  key={r.position}
                  card={r}
                  track="currently-challenged"
                  year={yearShown}
                  clubHref={`/reading-club/currently-challenged/${yearShown}/${r.position}`}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">List for {yearShown} not yet published.</p>
          )}
        </div>
      </SectionShell>

      {/* ── Other tracks ──────────────────────────────────────────── */}
      <SectionShell tone="white" eyebrow="Other tracks">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
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
