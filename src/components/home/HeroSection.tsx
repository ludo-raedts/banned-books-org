import Link from '@/components/link'
import Eyebrow from '@/components/section/Eyebrow'
import { roundedThousands } from '@/lib/format-count'
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
  registerTitles,
  callout,
}: {
  totalBooks: number
  countryCount: number
  totalBans: number
  /** Titles on official ban lists kept as registers — shown beside the stats, never added to them. */
  registerTitles: number
  callout: HeroCallout
}) {
  // First-screen trial (UX review 2026-11-11). On a 375px phone the hero was
  // the headline, four large figures, the register line, an intro and the DOI
  // before the search field, and no book in sight. New order: one sentence,
  // search, a few routes into the rest of the site, then compact figures.
  // Two figures stay large; "bans recorded" becomes a sentence and the "100%
  // citation-backed" tile is gone — every ban record links to a source, which
  // is not the same as every statement having been checked, so it is said in
  // words with a link to how we verify.
  const stats: Stat[] = [
    { value: totalBooks.toLocaleString('en'), label: 'Books' },
    { value: countryCount.toLocaleString('en'), label: 'Countries' },
  ]

  return (
    <section className="pt-10 md:pt-12 px-6 md:px-9 pb-8 md:pb-10 bg-white">
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
            <p className="mt-4 text-base md:text-lg leading-relaxed text-gray-700">
              Banned, restricted and challenged books, historical and contemporary, from {countryCount.toLocaleString('en')} countries —
              with the source behind every record and the stories around them.
            </p>

            <div className="mt-5">
              <HeroSearch />
            </div>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-7 gap-y-2 border-t border-neutral-200 pt-3">
              {stats.map(s => (
                <div key={s.label} className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-oxblood tabular-nums">
                    {s.value}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-neutral-600">{s.label}</span>
                </div>
              ))}
            </div>

            <p className="mt-2 text-sm text-neutral-700">
              <span className="tabular-nums">{totalBans.toLocaleString('en')}</span> ban records, each linked to its source.{' '}
              <Link href="/methodology" className="text-oxblood underline decoration-oxblood/30 underline-offset-2 hover:decoration-oxblood">
                How we verify
              </Link>
              {' · '}
              <Link href="/stats" className="text-oxblood underline decoration-oxblood/30 underline-offset-2 hover:decoration-oxblood">
                More figures
              </Link>
            </p>

            {/* The second layer and the citable dataset: for the reader who
                wants to understand the scale, so after the search, not before. */}
            <p className="mt-2 text-xs leading-relaxed text-neutral-600">
              {registerTitles > 0 && (
                <>
                  Plus more than <span className="tabular-nums">{roundedThousands(registerTitles)}</span> further titles on
                  official ban lists, kept as{' '}
                  <Link href="/registers" className="text-oxblood underline decoration-oxblood/30 underline-offset-2 hover:decoration-oxblood">
                    registers
                  </Link>
                  .{' '}
                </>
              )}
              {ZENODO_DOI_URL && (
                <>
                  Citable dataset:{' '}
                  <a href={ZENODO_DOI_URL} target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">
                    Zenodo DOI {ZENODO_CONCEPT_DOI}
                  </a>{' '}
                  (CC-BY-4.0).
                </>
              )}
            </p>
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
