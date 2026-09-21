import Link from 'next/link'
import Eyebrow from '@/components/section/Eyebrow'
import { ZENODO_CONCEPT_DOI, ZENODO_DOI_URL } from '@/lib/zenodo'
import BbwCallout from './BbwCallout'
import HeroSearch from './HeroSearch'

type Stat = { value: string; label: string }

export type HeroCallout =
  | {
      kind: 'bbw'
      /** BBW year, e.g. 2026. */
      year: number
      /** "Oct 4 – Oct 10", from the DB-backed config. */
      dateRange: string
      /**
       * True only during the actual week. During the lead-up the badge shows
       * the dates instead of "Now" — a promo window that opens weeks early
       * must not claim the week is happening.
       */
      isLive: boolean
      /**
       * Rendered HTML of the `bbw-tile-tagline` content block (the official
       * campaign line). The callout is only ever built when this is present:
       * per the content-block doctrine a section hides rather than falling
       * back to invented copy.
       */
      taglineHtml: string
    }
  | {
      kind: 'archive'
      /** Rotation seed (e.g. day-of-year) — picks one of ARCHIVE_QUOTES. */
      seed: number
    }

/**
 * Real, verifiable quotes from authors held in the archive. Rotated daily.
 * Every entry must be a genuine, attributable quote — never paraphrased or
 * invented — and link to a relevant record (book entry or the timeline).
 */
const ARCHIVE_QUOTES: {
  quote: string
  author: string
  href: string
  linkLabel: string
}[] = [
  {
    quote: 'What is freedom of expression? Without the freedom to offend, it ceases to exist.',
    author: 'Salman Rushdie',
    href: '/books/the-satanic-verses',
    linkLabel: 'Read the entry →',
  },
  {
    quote: 'Where they burn books, they will, in the end, burn people too.',
    author: 'Heinrich Heine',
    href: '/timeline',
    linkLabel: 'See the timeline →',
  },
  {
    quote: 'If liberty means anything at all, it means the right to tell people what they do not want to hear.',
    author: 'George Orwell',
    href: '/books/animal-farm',
    linkLabel: 'Read the entry →',
  },
  {
    quote: 'It’s not books they find obscene. It’s reality they find obscene.',
    author: 'John Green',
    href: '/books/looking-for-alaska',
    linkLabel: 'Read the entry →',
  },
]

export default function HeroSection({
  totalBooks,
  countryCount,
  totalBans,
  callout,
}: {
  totalBooks: number
  countryCount: number
  totalBans: number
  callout: HeroCallout
}) {
  const stats: Stat[] = [
    { value: totalBooks.toLocaleString('en'), label: 'Books documented' },
    { value: countryCount.toLocaleString('en'), label: 'Countries' },
    { value: totalBans.toLocaleString('en'), label: 'Bans recorded' },
    { value: '100%', label: 'Citation-backed' },
  ]

  return (
    <section className="pt-12 px-9 pb-10 bg-white">
      <div className="max-w-5xl mx-auto">
        <Eyebrow>An international archive of censored literature</Eyebrow>

        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.03] text-gray-900">
          The world&apos;s books under censorship.
        </h1>

        {/* Below the headline the hero splits into a content column and a
            callout rail. The callout used to be absolutely positioned against
            the section edge, which parked it outside the page grid and — from
            lg up to ~1200px — ran it straight through the headline. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8 lg:items-start">
          <div className="max-w-[720px]">
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
              {stats.map(s => (
                <div key={s.label}>
                  <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood">
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm md:text-base leading-relaxed text-gray-700">
              Banned, restricted, and challenged books — historical and contemporary, worldwide. Every entry traces back to a verifiable source.
            </p>

            {ZENODO_DOI_URL && (
              <p className="mt-2 text-xs text-neutral-500">
                Citable dataset ·{' '}
                <a
                  href={ZENODO_DOI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-oxblood hover:underline"
                >
                  Zenodo DOI {ZENODO_CONCEPT_DOI}
                </a>{' '}
                (CC-BY-4.0)
              </p>
            )}

            <div className="mt-6">
              <HeroSearch bookCount={totalBooks} />
            </div>
          </div>

          {/* The rail. Its top edge lines up with the rule above the stats.
              The archive quote stays desktop-only — it is ambient decoration —
              but the BBW callout is a time-boxed call to action and has to
              reach phones too. */}
          <div
            className={
              callout.kind === 'bbw'
                ? 'mt-8 max-w-[420px] lg:max-w-none'
                : 'hidden lg:mt-8 lg:block'
            }
          >
            {callout.kind === 'bbw' ? (
              <BbwCallout
                year={callout.year}
                dateRange={callout.dateRange}
                isLive={callout.isLive}
                taglineHtml={callout.taglineHtml}
              />
            ) : (
              <ArchiveCallout seed={callout.seed} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ArchiveCallout({ seed }: { seed: number }) {
  const { quote, author, href, linkLabel } =
    ARCHIVE_QUOTES[((seed % ARCHIVE_QUOTES.length) + ARCHIVE_QUOTES.length) % ARCHIVE_QUOTES.length]
  return (
    <Link href={href} className="group block border-l-2 border-oxblood/60 pl-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-oxblood font-semibold mb-2.5">
        From the archive
      </p>
      <p className="font-serif italic text-base font-medium leading-relaxed text-neutral-900 mb-2.5">
        “{quote}”
      </p>
      <p className="text-xs text-oxblood font-medium mb-1.5">— {author}</p>
      <span className="text-[10px] text-oxblood font-medium tracking-wide group-hover:underline">
        {linkLabel}
      </span>
    </Link>
  )
}
