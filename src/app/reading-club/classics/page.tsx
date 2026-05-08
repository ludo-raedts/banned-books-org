import type { Metadata } from 'next'
import Link from 'next/link'
import { getClassicsTrack } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'

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
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/reading-club" className="text-sm text-gray-500 hover:underline">
        ← Reading Club
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-4">Banned classics</h1>

      {intro && (
        <section className="mb-8 prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: intro }} />
      )}

      <p className="text-xs text-gray-500 mb-6">
        Looking for a deeper catalogue? See <Link href="/banned-classics" className="hover:underline">all classics in the dataset</Link>.
      </p>

      {rows.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 mb-10">
          {rows.map(r => <ReadingClubBookCard key={r.bookId ?? r.position} card={r} />)}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 my-10">List not yet published.</p>
      )}

      <p className="text-xs text-gray-500 mt-10">
        → <Link href="/reading-club/currently-challenged" className="hover:underline">Currently challenged (US)</Link>{' · '}
        <Link href="/reading-club/international" className="hover:underline">International cases</Link>{' · '}
        <Link href="/reading-club/by-theme" className="hover:underline">By theme</Link>
      </p>
    </main>
  )
}
