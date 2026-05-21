import type { Metadata } from 'next'
import Link from 'next/link'
import { getInternationalTrack } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'

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
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/reading-club" className="text-sm text-gray-500 hover:underline">
        ← Reading Club
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-4">International cases</h1>

      {intro && (
        <section className="mb-8 prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: intro }} />
      )}

      {rows.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 mb-10">
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
        <p className="text-sm text-gray-500 my-10">List not yet published.</p>
      )}

      <p className="text-xs text-gray-500 mt-10">
        → <Link href="/reading-club/currently-challenged" className="hover:underline">Currently challenged (US)</Link>{' · '}
        <Link href="/reading-club/classics" className="hover:underline">Classics</Link>{' · '}
        <Link href="/reading-club/by-theme" className="hover:underline">By theme</Link>
      </p>
    </main>
  )
}
