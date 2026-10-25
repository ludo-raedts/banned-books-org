import Link from '@/components/link'

// Compact "by year" strip for hub pages (country, reason). Links the years
// with the most documented events to /banned-books/[year] — the year hubs
// rank on Bing (/banned-books/2026: 1.8k impressions / 28d) but had a single
// inbound link site-wide (audit 2026-10-25). Server component, zero JS.
//
// Picks the top `max` years by event count, then shows them in reverse
// chronological order so the strip reads as a timeline.

export default function YearStrip({
  yearCounts,
  max = 12,
  label = 'By year',
  className = '',
}: {
  yearCounts: Map<number, number>
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
    <nav aria-label={`${label}: banned books by year`} className={`flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-sm ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 mr-1">{label}</span>
      {years.map(([year, count]) => (
        <Link
          key={year}
          href={`/banned-books/${year}`}
          className="inline-flex items-baseline gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-gray-800 hover:border-oxblood hover:text-oxblood"
          title={`${count.toLocaleString('en')} documented ${count === 1 ? 'event' : 'events'} in ${year}`}
        >
          {year}
          <span className="text-[11px] text-gray-400">{count.toLocaleString('en')}</span>
        </Link>
      ))}
    </nav>
  )
}
