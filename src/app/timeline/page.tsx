import type { Metadata } from 'next'
import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'
import {
  TIMELINE_ERAS,
  eventsByEra,
  sortedTimelineEvents,
  type TimelineEvent,
} from '@/lib/timeline-events'

export const metadata: Metadata = {
  title: 'Timeline of Banned Books — 2,000 Years of Censorship',
  description:
    'From Qin Shi Huang and the Roman Index to Nazi book burnings, the Satanic Verses fatwa, and 10,000+ US school bans in a single year: landmark moments in the history of suppressed words.',
  openGraph: {
    title: 'Timeline of Banned Books — 2,000 Years of Censorship',
    description:
      'Landmark moments in the history of book banning, from 213 BCE to today.',
    type: 'article',
  },
  alternates: {
    canonical: '/timeline',
  },
}

function isoStartDate(e: TimelineEvent): string {
  // ISO 8601 with explicit sign for BCE years (e.g. -0213).
  const yyyy = e.year < 0
    ? `-${String(Math.abs(e.year)).padStart(4, '0')}`
    : String(e.year).padStart(4, '0')
  if (e.month && e.day) return `${yyyy}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`
  if (e.month) return `${yyyy}-${String(e.month).padStart(2, '0')}`
  return yyyy
}

function relatedLinks(e: TimelineEvent): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = []
  if (e.related?.bookSlug) links.push({ href: `/books/${e.related.bookSlug}`, label: 'Book record' })
  if (e.related?.authorSlug) links.push({ href: `/authors/${e.related.authorSlug}`, label: 'Author' })
  if (e.related?.countryCode) links.push({ href: `/countries/${e.related.countryCode.toLowerCase()}`, label: 'Country bans' })
  return links
}

export default function TimelinePage() {
  const groups = eventsByEra()
  const all = sortedTimelineEvents()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Timeline of Banned Books',
    description:
      'A chronological timeline of landmark moments in the history of book banning, from 213 BCE to the present.',
    url: 'https://www.banned-books.org/timeline',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: all.map((e, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Event',
          name: e.title,
          description: e.summary,
          startDate: isoStartDate(e),
          ...(e.image ? { image: e.image.url } : {}),
        },
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-8 md:pb-10 bg-white">
          <div className="max-w-3xl mx-auto">
            <Eyebrow>Timeline · 2,000 years of book bans</Eyebrow>

            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              The long history of suppressed words.
            </h1>

            <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
              From a Qin emperor burning Confucian texts in 213 BCE to ten thousand US school bans in a single academic year — landmark moments in the long history of suppressed words. The methods change. The instinct doesn&rsquo;t.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/timeline/pdf"
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-oxblood text-white text-sm font-medium rounded-sm hover:bg-oxblood/90 transition-colors"
              >
                Download as PDF
              </a>
              <Link
                href="/history"
                className="text-sm text-oxblood hover:underline"
              >
                Read the history-of-censorship essay →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Sticky era jump-bar ──────────────────────────────────── */}
        <nav
          aria-label="Jump to era"
          className="sticky top-0 z-30 bg-white/95 backdrop-blur border-y border-gray-200"
        >
          <div className="max-w-5xl mx-auto px-6 md:px-9 py-3">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-x-4 gap-y-2 text-xs md:text-sm">
              {TIMELINE_ERAS.map(era => (
                <a
                  key={era.id}
                  href={`#era-${era.id}`}
                  className="text-gray-600 hover:text-oxblood whitespace-nowrap"
                >
                  {era.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        {/* ── Timeline body ───────────────────────────────────────── */}
        <SectionShell tone="cream">
          <div className="max-w-3xl mx-auto">
            {groups.map(({ era, events }) => (
              <section key={era.id} id={`era-${era.id}`} className="scroll-mt-20 mb-16 last:mb-0">
                <header className="mb-8 pt-2">
                  <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 pb-2 border-b border-oxblood/30">
                    {era.label}
                  </h2>
                  <p className="mt-3 text-sm md:text-base text-gray-700 leading-relaxed">
                    {era.intro}
                  </p>
                </header>

                <ol className="space-y-10 md:space-y-12">
                  {events.map(e => (
                    <TimelineEventCard key={e.slug} event={e} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </SectionShell>

        {/* ── Closing CTA ─────────────────────────────────────────── */}
        <SectionShell tone="white" eyebrow="Explore the catalogue">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-gray-700 mb-5 leading-relaxed">
              These are the moments. The catalogue underneath them — every recorded ban, every country, every reason — is one click away.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/history"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:border-gray-400 transition-colors"
              >
                Essay: The long shadow of censorship
              </Link>
              <Link
                href="/countries"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:border-gray-400 transition-colors"
              >
                Browse by country
              </Link>
              <Link
                href="/reasons"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:border-gray-400 transition-colors"
              >
                Browse by reason
              </Link>
              <Link
                href="/stats"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:border-gray-400 transition-colors"
              >
                Stats
              </Link>
            </div>
          </div>
        </SectionShell>
      </main>
    </>
  )
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const links = relatedLinks(event)
  const safeImage = event.image && isAllowedImageUrl(event.image.url) ? event.image : null

  return (
    <li className="md:flex md:items-stretch md:gap-x-6">
      {/* Date column — desktop only. Width fits the longest format we use
          ("14 February 1989", ~127px at text-xs with the uppercase tracking),
          with breathing room so the rail-peg doesn't clip the year. On mobile
          the date pill sits inside the card (see below). */}
      <div className="hidden md:block md:w-36 md:flex-shrink-0 md:pt-6 md:text-right">
        <span className="text-xs uppercase tracking-[0.12em] font-semibold text-oxblood whitespace-nowrap">
          {event.displayDate}
        </span>
      </div>

      {/* Card column with the vertical rail + peg */}
      <div className="relative border-l border-oxblood/25 pl-6 md:pl-7 md:flex-1">
        <span
          aria-hidden
          className="absolute -left-[7px] top-5 md:top-6 h-3 w-3 rounded-full bg-oxblood ring-4 ring-cream"
        />

        <article className="bg-white rounded-xl border border-gray-200 p-5 md:p-6 shadow-sm">
          {/* Date pill — mobile only. */}
          <p className="md:hidden text-xs uppercase tracking-[0.12em] font-semibold text-oxblood">
            {event.displayDate}
          </p>
          <h3 className="mt-1.5 md:mt-0 font-serif text-xl md:text-2xl font-semibold tracking-tight text-gray-900 leading-snug">
            {event.title}
          </h3>

        {safeImage && (
          <figure className="mt-4 -mx-5 md:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={safeImage.url}
              alt={safeImage.alt}
              className="w-full md:rounded-lg object-cover max-h-72"
              loading="lazy"
            />
            {safeImage.credit && (
              <figcaption className="text-[11px] text-gray-400 mt-1.5 px-5 md:px-0">
                {safeImage.credit}
              </figcaption>
            )}
          </figure>
        )}

        <p className="mt-3 text-[15px] md:text-base text-gray-800 leading-relaxed">
          {event.summary}
        </p>

          {(links.length > 0 || event.externalLink) && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {links.map(l => (
                <Link key={l.href} href={l.href} className="text-oxblood hover:underline">
                  {l.label} →
                </Link>
              ))}
              {event.externalLink && (
                <a
                  href={event.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 hover:underline"
                >
                  Reference ↗
                </a>
              )}
            </div>
          )}
        </article>
      </div>
    </li>
  )
}
