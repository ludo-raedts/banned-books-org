import Link from '@/components/link'

// Compact "by year" strip for hub pages (country, reason). Each chip opens the
// search page with this hub's own filter AND the year, so a reader who taps
// "2026" on the United States page gets the US books banned in 2026, not the
// worldwide list for 2026 (UX review 2026-11-11: the old links dropped the
// country without a word). Server component, zero JS.
//
// The worldwide year hubs /banned-books/[year] rank on Bing (/banned-books/2026:
// 1.8k impressions / 28d) and this strip used to be their main inbound link
// (audit 2026-10-25), so the strip keeps one plain link to /banned-books. The
// filtered search links are nofollow: /search is a dynamic, uncached route, and
// 12 chips on every country and reason page would hand crawlers thousands of
// query-string URLs to walk (cost incident 2026-08-03).
//
// Picks the top `max` years by event count, then shows them in reverse
// chronological order so the strip reads as a timeline.

export default function YearStrip({
  yearCounts,
  filter,
  max = 12,
  label = 'By year',
  className = '',
}: {
  yearCounts: Map<number, number>
  /** The hub's own search filter, kept when a year is chosen. */
  filter: { country: string } | { reason: string }
  max?: number
  label?: string
  className?: string
}) {
  const years = [...yearCounts.entries()]
    .filter(([y]) => y >= 1000)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, max)
    .sort((a, b) => b[0] - a[0])
  if (years.length < 2) return null

  return (
    <nav aria-label={`${label}: each year opens the books banned that year on this page's search`} className={`flex flex-wrap items-baseline gap-x-2 gap-y-2 text-sm ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 mr-1">{label}</span>
      {years.map(([year, count]) => (
        <Link
          key={year}
          href={`/search?${new URLSearchParams({ ...filter, year: String(year) }).toString()}`}
          rel="nofollow"
          className="inline-flex items-baseline gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-gray-800 hover:border-oxblood hover:text-oxblood"
          title={`${count.toLocaleString('en')} ${count === 1 ? 'ban' : 'bans'} recorded here in ${year} — opens these books`}
        >
          {year}
          <span className="text-xs font-medium text-gray-600">{count.toLocaleString('en')}</span>
        </Link>
      ))}
      <span className="basis-full text-xs text-gray-500">
        Numbers show recorded bans. One book may have more than one ban.{' '}
        <Link href="/banned-books" className="underline underline-offset-2 hover:text-oxblood">
          All years, worldwide →
        </Link>
      </span>
    </nav>
  )
}
