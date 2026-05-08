import type { Metadata } from 'next'
import Link from 'next/link'
import { getThemes } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'By theme — Reading Club',
  description:
    'Banned-books reading paths by theme: LGBTQ+, political dissent, religious censorship, race and racism, sexuality.',
  alternates: { canonical: '/reading-club/by-theme' },
}

export default async function ByThemePage() {
  const [themes, blocks] = await Promise.all([
    getThemes(),
    getPublishedBlockMap(REQUIRED_BLOCKS_BY_PAGE['reading-club-themes']),
  ])
  const intro = blocks.get('track-themes-intro')

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/reading-club" className="text-sm text-gray-500 hover:underline">
        ← Reading Club
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-4">By theme</h1>

      {intro && (
        <section className="mb-8 prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: intro }} />
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {themes.map(t => (
          <li key={t.slug}>
            <Link
              href={`/reading-club/by-theme/${t.slug}`}
              className="group block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors"
            >
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover:text-brand dark:group-hover:text-brand transition-colors">{t.display_name}</div>
              <div className="text-xs text-gray-500 mt-1">→ explore</div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-500 mt-10">
        → <Link href="/reading-club/currently-challenged" className="hover:underline">Currently challenged (US)</Link>{' · '}
        <Link href="/reading-club/international" className="hover:underline">International cases</Link>{' · '}
        <Link href="/reading-club/classics" className="hover:underline">Classics</Link>
      </p>
    </main>
  )
}
