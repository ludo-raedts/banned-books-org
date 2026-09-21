import Link from 'next/link'

export type BbwCalloutProps = {
  /** BBW year, e.g. 2026. */
  year: number
  /** "Oct 4 – Oct 10", from the DB-backed config. */
  dateRange: string
  /**
   * True only during the actual week. During the lead-up the badge shows the
   * dates instead of "Now" — a promo window that opens weeks early must not
   * claim the week is happening.
   */
  isLive: boolean
  /**
   * Rendered HTML of the `bbw-tile-tagline` content block (the official
   * campaign line). Callers only build the callout when this is present: per
   * the content-block doctrine a section hides rather than falling back to
   * invented copy.
   */
  taglineHtml: string
  /**
   * False renders the same block without the link wrapper — for the admin
   * preview, which mirrors the homepage but must not navigate away.
   */
  interactive?: boolean
}

/**
 * The Banned Books Week block: a cream panel inside an oxblood border, used in
 * the homepage hero and mirrored 1:1 in the BBW admin preview. It is a
 * time-boxed campaign call to action, so unlike the ambient archive quote it is
 * a filled block rather than a borderless note, and it shows on phones too.
 */
export default function BbwCallout({
  year,
  dateRange,
  isLive,
  taglineHtml,
  interactive = true,
}: BbwCalloutProps) {
  const shell =
    'group block rounded-lg border border-oxblood bg-cream p-5 shadow-[0_1px_3px_rgba(92,16,16,0.08)]' +
    (interactive
      ? ' transition-shadow hover:shadow-[0_6px_18px_rgba(92,16,16,0.16)]'
      : '')

  const body = (
    <>
      {/* The chip is outlined and the CTA filled, so the one saturated shape
          in the block is the thing to click. */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-oxblood/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-oxblood">
        {isLive && <span className="h-1.5 w-1.5 rounded-full bg-oxblood" aria-hidden="true" />}
        {isLive ? 'Now' : dateRange}
      </span>

      {/* text-balance keeps the year from orphaning onto its own line in the
          280px hero rail. */}
      <p className="mt-3 text-balance font-serif text-xl font-semibold leading-tight text-gray-900">
        Banned Books Week {year}
      </p>

      {/* Editor-managed campaign line (bbw-tile-tagline content block). */}
      <div
        className="mt-1.5 text-xs leading-snug text-neutral-700 [&_a]:text-oxblood [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: taglineHtml }}
      />

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-oxblood px-3 py-1.5 text-xs font-semibold text-cream">
        Explore the hub
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </>
  )

  if (!interactive) return <div className={shell}>{body}</div>

  return (
    <Link href="/banned-books-week" className={shell}>
      {body}
    </Link>
  )
}
