import Link from 'next/link'

export type DataQualityStatus = 'confident' | 'default' | 'flagged'

const EXPLAINER_HREF = '/data-quality'

/**
 * Small check icon shown next to the title on `confident` records.
 * Tooltip + link to the explainer; the SVG itself is decorative.
 */
export function QualityCheck({ status }: { status: DataQualityStatus }) {
  if (status !== 'confident') return null
  return (
    <Link
      href={EXPLAINER_HREF}
      title="High-confidence record — see how we classify data quality"
      aria-label="High-confidence record — see how we classify data quality"
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors align-middle ml-2 shrink-0"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </Link>
  )
}

/**
 * Prominent notice rendered near the top of `flagged` records.
 * Yellow/amber, not red — this is "limited verification", not "wrong".
 */
export function QualityFlaggedNotice({
  status,
  entityLabel,
}: {
  status: DataQualityStatus
  entityLabel: 'book' | 'author'
}) {
  if (status !== 'flagged') return null
  return (
    <section
      role="note"
      aria-label="Limited verification"
      className="mb-8 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 sm:p-5"
    >
      <p className="text-xs font-semibold tracking-wide uppercase text-amber-800 mb-1.5">
        Limited verification
      </p>
      <p className="text-sm text-amber-900 leading-relaxed">
        This {entityLabel} entry was created from an automated import and key
        facts have not yet been cross-checked. Treat specific details (
        {entityLabel === 'book'
          ? 'publication year, source citations, author attribution'
          : 'biographical dates, nationality, name spelling'}
        ) as provisional.{' '}
        <Link
          href={EXPLAINER_HREF}
          className="underline hover:no-underline font-medium"
        >
          How we classify data quality
        </Link>
        .
      </p>
    </section>
  )
}

/**
 * Provenance line rendered in the page footer alongside "Last verified".
 * Shown for every record so the data origin is always transparent —
 * `confident` and `default` records get a neutral line, `flagged`
 * mirrors the notice above with a softer footer phrasing.
 */
export function QualityFooterLine({
  status,
  evaluatedAt,
}: {
  status: DataQualityStatus
  evaluatedAt: string | null
}) {
  const label =
    status === 'confident'
      ? 'High-confidence record'
      : status === 'flagged'
        ? 'Limited verification'
        : 'Automated import — not individually verified'

  return (
    <p className="text-xs text-gray-400 mt-1">
      Data quality:{' '}
      <Link href={EXPLAINER_HREF} className="underline hover:no-underline">
        {label}
      </Link>
      {evaluatedAt && (
        <>
          {' '}
          ·{' '}
          <time dateTime={evaluatedAt}>
            evaluated{' '}
            {new Date(evaluatedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
        </>
      )}
    </p>
  )
}
