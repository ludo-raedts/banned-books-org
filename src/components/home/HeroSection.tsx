import Link from 'next/link'
import Eyebrow from '@/components/section/Eyebrow'
import HeroSearch from './HeroSearch'

type Stat = { value: string; label: string }

export type HeroCallout =
  | {
      kind: 'bbw'
      /** BBW year, e.g. 2026. */
      year: number
      /** One-line hook under the title. Plain text; default fallback supplied if empty. */
      subtitle?: string | null
    }
  | {
      kind: 'archive'
      /** Rotation seed (e.g. day-of-year) — picks one of ARCHIVE_QUOTES. */
      seed: number
    }

const DEFAULT_BBW_SUBTITLE = 'Featured selection: 25 books worth defending this year.'

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
    <section className="relative pt-12 px-9 pb-10 bg-white">
      <div className="max-w-5xl mx-auto">
        <Eyebrow>An international archive of censored literature</Eyebrow>

        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.03] text-gray-900">
          The world&apos;s books under censorship.
        </h1>

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

          <div className="mt-6">
            <HeroSearch bookCount={totalBooks} />
          </div>
        </div>
      </div>

      <div className="hidden lg:block absolute top-12 right-12 max-w-[260px]">
        {callout.kind === 'bbw' ? (
          <BbwCallout year={callout.year} subtitle={callout.subtitle ?? DEFAULT_BBW_SUBTITLE} />
        ) : (
          <ArchiveCallout seed={callout.seed} />
        )}
      </div>
    </section>
  )
}

function BbwCallout({ year, subtitle }: { year: number; subtitle: string }) {
  return (
    <Link href="/banned-books-week" className="group block">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-oxblood text-cream rounded-full text-[10px] font-semibold tracking-wider uppercase mb-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cream" aria-hidden="true" />
        Now
      </span>
      <p className="font-serif text-base font-semibold leading-tight text-neutral-900 mb-1.5 group-hover:text-oxblood transition-colors">
        Banned Books Week {year}
      </p>
      <p className="text-xs text-neutral-600 leading-snug mb-1.5">{subtitle}</p>
      <span className="text-xs text-oxblood font-medium group-hover:underline">
        Explore the hub →
      </span>
    </Link>
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
