import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentlyChallenged } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import { ALAAttribution } from '@/components/bbw-disclaimer'
import ReadingClubBookCard from '@/components/reading-club-card'

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
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/reading-club" className="text-sm text-gray-500 hover:underline">
        ← Reading Club
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Currently Challenged ({yearShown})</h1>

      <div className="my-5">
        <ALAAttribution />
      </div>

      {intro && (
        <section className="mb-8 prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: intro }} />
      )}

      {rows.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 mb-10">
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
        <p className="text-sm text-gray-500 my-10">List for {yearShown} not yet published.</p>
      )}

      <p className="text-xs text-gray-500 mt-10">
        → <Link href="/reading-club/international" className="hover:underline">International cases</Link>{' · '}
        <Link href="/reading-club/classics" className="hover:underline">Classics</Link>{' · '}
        <Link href="/reading-club/by-theme" className="hover:underline">By theme</Link>
      </p>
    </main>
  )
}
