import Link from 'next/link'

type Props = {
  title: string
  subtitle?: string
  viewAllHref?: string
  viewAllLabel?: string
  accent?: 'black' | 'oxblood'
}

export default function SectionHeader({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'View all',
  accent = 'black',
}: Props) {
  const hairline =
    accent === 'oxblood'
      ? 'border-b border-oxblood/30'
      : 'border-b border-black/80'
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
        <Link
          href={viewAllHref}
          className="shrink-0 text-xs font-medium tracking-wide text-gray-700 hover:text-oxblood transition-colors whitespace-nowrap"
        >
          {viewAllLabel} →
        </Link>
      )}
    </div>
  )
}
