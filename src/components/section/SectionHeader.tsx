import Link from 'next/link'

type Props = {
  title: string
  subtitle?: string
  viewAllHref?: string
  viewAllLabel?: string
  /** When true the viewAll link opens in a new tab (for outbound links). */
  viewAllExternal?: boolean
  accent?: 'black' | 'oxblood'
}

export default function SectionHeader({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'View all',
  viewAllExternal = false,
  accent = 'black',
}: Props) {
  const hairline =
    accent === 'oxblood'
      ? 'border-b border-oxblood/30'
      : 'border-b border-black/80'
  const linkClass = 'shrink-0 text-xs font-medium tracking-wide text-gray-700 hover:text-oxblood transition-colors whitespace-nowrap'
  return (
    <div className={`mb-6 pb-3 flex items-end justify-between gap-4 ${hairline}`}>
      <div className="min-w-0">
        <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-600">
            {subtitle}
          </p>
        )}
      </div>
      {viewAllHref && (
        viewAllExternal ? (
          <a
            href={viewAllHref}
            target="_blank"
            rel="noopener"
            className={linkClass}
          >
            {viewAllLabel} ↗
          </a>
        ) : (
          <Link href={viewAllHref} className={linkClass}>
            {viewAllLabel} →
          </Link>
        )
      )}
    </div>
  )
}
