import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import { isBannedBooksWeekPromoActive } from '@/config/banned-books-week'

// ISR: reading-club page reads content blocks (editor-managed) + a
// banned-books-week promo flag. Both change at most a few times per
// week; 1h revalidate is plenty. Promo flag is time-derived so the
// regen also catches week boundaries within the hour.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Reading Club — Reading banned books together',
  description:
    'Read banned books together. Four tracks: Currently Challenged (US), International, Classics, By Theme.',
  alternates: { canonical: '/reading-club' },
}

const TRACKS = [
  { href: '/reading-club/currently-challenged', label: 'Currently Challenged (US)', text: 'The ALA OIF annual list, with discussion prompts.' },
  { href: '/reading-club/international',         label: 'International cases',       text: 'Engine-curated set spanning regimes and regions.' },
  { href: '/reading-club/classics',              label: 'Banned classics',           text: 'Books that survived the censors of their era.' },
  { href: '/reading-club/by-theme',               label: 'By theme',                  text: 'LGBTQ+, political dissent, religious censorship, race, sexuality.' },
] as const

export default async function ReadingClubHubPage() {
  const slugs = REQUIRED_BLOCKS_BY_PAGE['reading-club-hub']
  const blocks = await getPublishedBlockMap(slugs)
  const intro = blocks.get('reading-club-intro')
  const why = blocks.get('reading-club-why')
  const howToStart = blocks.get('reading-club-how-to-start')
  const universal = blocks.get('reading-club-universal-questions')
  const showBBWLink = await isBannedBooksWeekPromoActive()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://www.banned-books.org/reading-club',
        name: 'Reading Club — Reading banned books together',
        description:
          'Read banned books together. Four tracks: Currently Challenged (US), International, Classics, By Theme. Discussion questions included.',
        url: 'https://www.banned-books.org/reading-club',
        isPartOf: { '@type': 'WebSite', name: 'banned-books.org', url: 'https://www.banned-books.org' },
      },
      {
        '@type': 'ItemList',
        name: 'Reading Club tracks',
        numberOfItems: TRACKS.length,
        itemListElement: TRACKS.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'WebPage',
            name: t.label,
            description: t.text,
            url: `https://www.banned-books.org${t.href}`,
          },
        })),
      },
    ],
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">Reading banned books together</h1>
        {showBBWLink && (
          <p className="text-sm text-brand">
            <Link href="/banned-books-week" className="hover:underline">→ Banned Books Week hub</Link>
          </p>
        )}
      </header>

      {intro && (
        <section className="mb-10">
          <div className="prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: intro }} />
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Pick a track</h2>
        {/*
          items-stretch on the grid keeps every cell the same height; h-full on
          each Link fills the cell so cards are visually equal regardless of
          how long the description copy is.
        */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
          {TRACKS.map(t => (
            <li key={t.href} className="flex">
              <Link
                href={t.href}
                className="group flex flex-col h-full w-full rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors"
              >
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover:text-brand dark:group-hover:text-brand transition-colors">{t.label}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t.text}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {why && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Why read banned books together</h2>
          <div className="prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: why }} />
        </section>
      )}

      {howToStart && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">How to start</h2>
          <div className="prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: howToStart }} />
        </section>
      )}

      {universal && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Discussion questions for any banned book</h2>
          <div className="prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: universal }} />
        </section>
      )}
    </main>
  )
}
