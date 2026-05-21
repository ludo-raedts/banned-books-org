import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import { isBannedBooksWeekPromoActive } from '@/config/banned-books-week'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

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

  // Shared prose styling for the editor-managed content blocks. Mirrors the
  // article-prose styles used on /methodology and /history so all editorial
  // copy across the site looks like the same publication.
  const proseClass =
    'prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-oxblood/30 prose-h3:mt-6 prose-h3:mb-2 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none'

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Reading club · Four tracks</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Reading banned books together.
          </h1>
          {intro && (
            <div
              className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900 prose-p:!my-0 prose-a:text-oxblood"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}
          {showBBWLink && (
            <p className="mt-4 text-sm">
              <Link href="/banned-books-week" className="text-oxblood hover:underline">
                → Banned Books Week hub
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ── Pick a track ──────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="Choose a path">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            Pick a track
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            {TRACKS.map(t => (
              <li key={t.href} className="flex">
                <Link
                  href={t.href}
                  className="group flex flex-col h-full w-full bg-white border border-neutral-200 hover:border-oxblood rounded-sm p-5 transition-colors"
                >
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Track</span>
                  <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                    {t.label}
                  </p>
                  <p className="text-xs text-neutral-600 leading-relaxed mt-1.5">{t.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      {/* ── Why read banned books together ────────────────────────── */}
      {why && (
        <SectionShell tone="white" eyebrow="The case for it">
          <article className={`max-w-3xl mx-auto ${proseClass}`}>
            <h2 className="!mt-0">Why read banned books together</h2>
            <div dangerouslySetInnerHTML={{ __html: why }} />
          </article>
        </SectionShell>
      )}

      {/* ── How to start ──────────────────────────────────────────── */}
      {howToStart && (
        <SectionShell tone="cream" eyebrow="Getting started">
          <article className={`max-w-3xl mx-auto ${proseClass}`}>
            <h2 className="!mt-0">How to start</h2>
            <div dangerouslySetInnerHTML={{ __html: howToStart }} />
          </article>
        </SectionShell>
      )}

      {/* ── Universal discussion questions ────────────────────────── */}
      {universal && (
        <SectionShell tone="white" eyebrow="For any banned book">
          <article className={`max-w-3xl mx-auto ${proseClass}`}>
            <h2 className="!mt-0">Discussion questions for any banned book</h2>
            <div dangerouslySetInnerHTML={{ __html: universal }} />
          </article>
        </SectionShell>
      )}
    </main>
  )
}
