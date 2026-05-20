import Link from 'next/link'
import Eyebrow from '@/components/section/Eyebrow'

type Stat = { value: string; label: string }

type PillLink = {
  href: string
  label: string
  primary?: boolean
}

const PILLS: PillLink[] = [
  { href: '/top-100-banned-books', label: 'Top 100 banned books', primary: true },
  { href: '/countries', label: 'By country' },
  { href: '/reasons', label: 'By reason' },
  { href: '/stats', label: 'Statistics' },
]

export default function HeroSection({
  totalBooks,
  countryCount,
  totalBans,
}: {
  totalBooks: number
  countryCount: number
  totalBans: number
}) {
  const stats: Stat[] = [
    { value: totalBooks.toLocaleString('en'), label: 'Books documented' },
    { value: countryCount.toLocaleString('en'), label: 'Countries' },
    { value: totalBans.toLocaleString('en'), label: 'Bans recorded' },
    { value: '100%', label: 'Citation-backed' },
  ]

  return (
    <section className="pt-12 px-9 pb-10 bg-white dark:bg-gray-950">
      <div className="max-w-5xl mx-auto">
        <Eyebrow>An international archive of censored literature</Eyebrow>

        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.03] text-gray-900 dark:text-gray-50">
          The world&apos;s books under censorship.
        </h1>

        <div className="max-w-[720px]">
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black dark:border-gray-200 border-b border-neutral-200 dark:border-gray-800 py-4">
            {stats.map(s => (
              <div key={s.label}>
                <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600 dark:text-gray-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm md:text-base leading-relaxed text-gray-700 dark:text-gray-300">
            Banned, restricted, and challenged books — historical and contemporary, worldwide. Every entry traces back to a verifiable source.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {PILLS.map(pill => (
              <Link
                key={pill.href}
                href={pill.href}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium transition-colors ${
                  pill.primary
                    ? 'border-black text-gray-900 hover:bg-gray-900 hover:text-white dark:border-gray-200 dark:text-gray-100 dark:hover:bg-gray-100 dark:hover:text-gray-900'
                    : 'border-neutral-300 text-gray-700 hover:border-oxblood hover:text-oxblood dark:border-gray-700 dark:text-gray-300'
                }`}
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
