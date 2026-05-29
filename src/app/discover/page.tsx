import type { Metadata } from 'next'
import Link from 'next/link'
import { loadDiscoverData } from '@/lib/discover-data'
import { REGIONS, type SpinScope } from '@/lib/discover-engine'
import FaqAccordion, { type FaqItem } from '@/components/faq-accordion'
import DiscoverWizard from './discover-wizard'

// The candidate pool comes from mv_reason_top_books, which the platform
// refreshes hourly via the existing cron. Matching that cadence with ISR
// means crawlers and warm users hit cached HTML instead of triggering a
// fresh DB round-trip on every request.
export const revalidate = 3600

export const metadata: Metadata = {
  // Root layout adds the "%s | Banned Books" suffix — keep this clean to
  // avoid the duplicated "Banned Books | Banned Books" tail in SERPs.
  title: 'Pick me a banned book — Discover',
  description:
    'Spin the wheel and discover a banned book to read next. Filter by theme (LGBTQ+, political, religious, sexual, racial, …), genre, country or region where it was banned, and whether a free reading-club discussion guide is available.',
  alternates: { canonical: '/discover' },
  keywords: [
    'banned book recommender',
    'find a banned book',
    'banned book picker',
    'what banned book to read',
    'discover banned books',
    'reading club banned books',
  ],
}

type SearchParams = {
  r?: string
  g?: string
  c?: string
  region?: string
  x?: string
  rc?: string
}

function parseInitial(
  sp: SearchParams,
  validReasonSlugs: Set<string>,
  validCountryCodes: Set<string>,
  validGenreSlugs: Set<string>,
) {
  const reasonSlugs = (sp.r ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s && validReasonSlugs.has(s))
    .slice(0, 3)

  const genreSlugs = (sp.g ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s && validGenreSlugs.has(s))
    .slice(0, 3)

  let scope: SpinScope = { type: 'all' }
  if (sp.c && validCountryCodes.has(sp.c)) {
    scope = { type: 'country', code: sp.c }
  } else if (sp.region && REGIONS.some(r => r.code === sp.region)) {
    scope = { type: 'region', region: sp.region as (typeof REGIONS)[number]['code'] }
  }

  const excludeIconic = sp.x === '1'
  const withReadingClubGuide = sp.rc === '1'

  return (
    reasonSlugs.length > 0
    || genreSlugs.length > 0
    || scope.type !== 'all'
    || excludeIconic
    || withReadingClubGuide
  )
    ? { reasonSlugs, genreSlugs, scope, excludeIconic, withReadingClubGuide }
    : undefined
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { reasons, countries, genres, candidates } = await loadDiscoverData()
  const validReasonSlugs = new Set(reasons.map(r => r.slug))
  const validCountryCodes = new Set(countries.map(c => c.code))
  const validGenreSlugs = new Set(genres.map(g => g.slug))
  const initial = parseInitial(sp, validReasonSlugs, validCountryCodes, validGenreSlugs)

  const totalCandidates = candidates.length

  const faqItems: FaqItem[] = [
    {
      q: 'How does the banned books wheel work?',
      a: `Tell the wheel what kind of banned book interests you — a theme of censorship, a genre, a country or region where it was banned, and whether you want a reading-club guide to go with it. The wheel pools the most-banned books from [our catalogue](/top-100-banned-books), weighs how strongly each one matches your filters, and lands on one. The middle reel is your pick; the two flanking reels are alternates in case you've already read the main one.`,
    },
    {
      q: `Why are ${totalCandidates} books in the wheel and not all of them?`,
      a: `The wheel pools the top-50 most-banned books in each of our 11 reason categories — books with the strongest documented censorship histories. After deduplication that's ${totalCandidates} unique titles. We could load all 12,000+ records, but the top-by-reason pool gives a stronger pick than a random draw from every book that's been challenged once. The pool refreshes hourly as new bans are documented.`,
    },
    {
      q: 'What counts as a "banned book" here?',
      a: 'Any book with a documented ban, removal, or formal challenge — at school, library, district, government, or court level. The legal status varies by country, so [each record carries its full censorship history](/methodology) with sources cited. The wheel weighs books by how many separate bans they have accumulated, not by severity of any single one.',
    },
    {
      q: 'Is the wheel random or does it actually pick smartly?',
      a: "Weighted. Books that match more of your selected themes rank higher; books with more documented bans rank higher; the wheel then picks from the top ~20 candidates with a soft random weighting. You get variety on every spin, but the wheel never lands on an obvious mismatch. The two side reels show the next-strongest candidates by score — they're not random alternatives, they're the runner-ups.",
    },
    {
      q: 'Why is there a "skip the famous classics" option?',
      a: '1984, Animal Farm, The Handmaid\'s Tale, Lolita, Fahrenheit 451 and a few others dominate by ban count — they\'d win almost every spin if we let them. Tick the option to drop a hand-curated list of mainstream titles so the wheel surfaces banned books you\'ve probably never heard of. Leave it off if you don\'t mind familiar territory.',
    },
    {
      q: 'What\'s in the reading-club guide and how do I get it?',
      a: 'A free PDF with 7–10 discussion prompts about the story and about the censorship case behind it — useful solo or with a [classroom or book club](/reading-club). To grab one: spin the wheel, click the book it lands on to open its page, and tap the "★ Reading Club" badge near the title — the PDF downloads from there. Roughly 40 of the books in the wheel come with a guide; tick step 5 to filter to those.',
    },
  ]

  // Pick the top 12 by ban impact for the ItemList. This mirrors the visible
  // idle-state preview pool and gives crawlers concrete titles + authors
  // to cite — keeps the schema honest without dumping all 363 candidates.
  const itemListBooks = candidates
    .map(c => {
      const maxBan = Object.values(c.reasonBanCounts).reduce(
        (m, n) => (n > m ? n : m),
        0,
      )
      return { c, score: maxBan }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ c }) => c)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://www.banned-books.org/discover',
        url: 'https://www.banned-books.org/discover',
        name: 'Pick me a banned book — Discover',
        description:
          'Interactive recommender for banned books. Filter by reason, genre, country/region, and reading-club guide availability, then spin the wheel.',
        isPartOf: {
          '@type': 'WebSite',
          name: 'Banned Books',
          url: 'https://www.banned-books.org',
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Banned Books',
              item: 'https://www.banned-books.org',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Reading Club',
              item: 'https://www.banned-books.org/reading-club',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Discover',
              item: 'https://www.banned-books.org/discover',
            },
          ],
        },
      },
      {
        '@type': 'ItemList',
        name: 'Banned books in the discovery wheel',
        description: `A sample of ${totalCandidates.toLocaleString()} of the most-banned books worldwide, surfaced by the Banned Books wheel.`,
        numberOfItems: itemListBooks.length,
        itemListElement: itemListBooks.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Book',
            name: b.title,
            author: { '@type': 'Person', name: b.author },
            url: `https://www.banned-books.org/books/${b.slug}`,
            ...(b.coverUrl ? { image: b.coverUrl } : {}),
          },
        })),
      },
    ],
  }

  return (
    <main className="bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-cream-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, #4a0e16 0 2px, transparent 2px 14px), repeating-linear-gradient(0deg, #4a0e16 0 1px, transparent 1px 28px)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 md:px-9 pt-8 md:pt-10 pb-6 md:pb-8">
          <Link
            href="/reading-club"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-4 transition-colors"
          >
            ← Reading Club
          </Link>

          <p className="text-sm uppercase tracking-[0.18em] font-semibold text-oxblood mb-2.5">
            The wheel · Discover
          </p>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.02] text-gray-900">
            Pick me a banned book.
          </h1>

          <p className="mt-3 text-sm md:text-base text-gray-700 leading-relaxed max-w-2xl">
            <span className="font-semibold text-oxblood">{totalCandidates.toLocaleString()}</span>{' '}
            of the most-banned books in our catalogue are loaded into the wheel. Narrow it by theme,
            genre, or region — then spin.
          </p>
        </div>
      </section>

      {/* ── Wizard ────────────────────────────────────────────────── */}
      <section className="px-6 md:px-9 py-8 md:py-12 bg-white">
        <div className="max-w-5xl mx-auto">
          <DiscoverWizard
            reasons={reasons}
            countries={countries}
            genres={genres}
            candidates={candidates}
            initial={initial}
          />
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="px-6 md:px-9 py-12 md:py-16 bg-cream border-t border-cream-border">
        <div className="max-w-3xl mx-auto">
          <FaqAccordion
            title="About the wheel"
            subtitle="How the picker works, what's in the pool, and how to use the reading-club guide."
            items={faqItems}
            defaultOpenCount={1}
          />
        </div>
      </section>
    </main>
  )
}
