import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'

// Refreshed daily — counts shift only as new bans get imported / re-classified.
export const revalidate = 86400

const FIRST_YEAR = 2015
const CURRENT_YEAR = new Date().getFullYear()

export const metadata: Metadata = {
  title: 'Books Banned by Year — Annual archives',
  description: `Browse documented book bans by the year each ban began, from ${FIRST_YEAR} to ${CURRENT_YEAR}.`,
  alternates: { canonical: '/banned-books' },
}

export default async function BannedBooksHubPage() {
  const supabase = adminClient()
  const years = Array.from(
    { length: CURRENT_YEAR - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  )

  // One count query per year. With an index on year_started these are cheap,
  // and the whole page is cached for 24h via ISR.
  const counts = await Promise.all(
    years.map(async year => {
      const { count } = await supabase
        .from('bans')
        .select('*', { count: 'exact', head: true })
        .eq('year_started', year)
      return { year, count: count ?? 0 }
    }),
  )

  const total = counts.reduce((sum, c) => sum + c.count, 0)
  const sorted = [...counts].sort((a, b) => b.year - a.year)
  const populated = sorted.filter(c => c.count > 0)
  const peak = [...counts].sort((a, b) => b.count - a.count)[0]

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Books Banned by Year',
    url: 'https://www.banned-books.org/banned-books',
    description: `Annual archives of documented book bans from ${FIRST_YEAR} to ${CURRENT_YEAR}.`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: populated.length,
      itemListElement: populated.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.banned-books.org/banned-books/${c.year}`,
        name: `Books banned in ${c.year}`,
      })),
    },
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <Link
        href="/stats"
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 inline-block transition-colors"
      >
        ← Stats
      </Link>

      <header className="mb-8 max-w-3xl">
        <p className="text-sm uppercase tracking-[0.12em] font-semibold text-oxblood mb-3.5">
          By year · {FIRST_YEAR}–{CURRENT_YEAR}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 dark:text-gray-50 mb-4">
          Books banned by year.
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          Annual archives of documented book bans, indexed by the year each ban
          began.
          {total > 0 && (
            <>
              {' '}
              {total.toLocaleString('en-US')} bans recorded since {FIRST_YEAR}
              {peak && peak.count > 0
                ? `, peaking in ${peak.year} with ${peak.count.toLocaleString('en-US')}.`
                : '.'}
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map(({ year, count }) => {
          const empty = count === 0
          return (
            <Link
              key={year}
              href={`/banned-books/${year}`}
              aria-disabled={empty}
              tabIndex={empty ? -1 : undefined}
              className={`group block px-4 py-3 border rounded-md transition-colors ${
                empty
                  ? 'border-gray-100 dark:border-gray-900 text-gray-400 dark:text-gray-600 pointer-events-none'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              <div
                className={`font-serif text-2xl font-semibold tabular-nums transition-colors ${
                  empty
                    ? ''
                    : 'text-gray-900 dark:text-gray-50 group-hover:text-brand'
                }`}
              >
                {year}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                {count.toLocaleString('en-US')} {count === 1 ? 'ban' : 'bans'}
              </div>
            </Link>
          )
        })}
      </div>

      <p className="mt-10 text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-2xl">
        Each year covers the bans whose <em>start</em> year falls in that
        calendar year. A ban that began in 2018 and remains active still
        appears under 2018. Bans whose start year is unknown are not counted
        here — see <Link href="/data-quality" className="underline hover:text-gray-600 dark:hover:text-gray-300">data quality</Link> for details.
      </p>
    </main>
  )
}
