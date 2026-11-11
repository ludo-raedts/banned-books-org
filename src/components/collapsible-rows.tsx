'use client'

import { useEffect, useRef, useState } from 'react'

// Wraps a server-rendered table and folds away the rows marked `data-extra`
// until the reader asks for them. The rows stay in the HTML (hidden with CSS,
// not dropped), so crawlers and text-only agents still read the full record.
//
// Why: a widely-banned book's table ran to several screens, and readers did
// not scroll past it to the sourced background below.
export default function CollapsibleRows({
  hiddenCount,
  hiddenHint,
  showLabel,
  children,
}: {
  /** How many rows are folded away. 0 → renders the children untouched. */
  hiddenCount: number
  /** What is behind the fold, e.g. "China, Cuba, Malaysia and 2 more". */
  hiddenHint?: string
  /** Button text while folded. Name the unit ("Show 10 more entries") when the
   *  page counts something else nearby — a bare "Show 10 more" under a
   *  "27 bans" headline read as ten of the 27. */
  showLabel?: string
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const justFolded = useRef(false)

  // Folding shortens the page above the button, which would leave the reader
  // somewhere further down. Once the rows are gone, bring the (now short)
  // table back into view. An effect, not requestAnimationFrame: it has to run
  // after the rows are hidden, and rAF does not fire in a background tab.
  useEffect(() => {
    if (!expanded && justFolded.current) {
      justFolded.current = false
      ref.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [expanded])

  if (hiddenCount <= 0) return <>{children}</>

  return (
    <div
      ref={ref}
      data-collapsed={expanded ? undefined : 'true'}
      className="scroll-mt-20 [&[data-collapsed=true]_tr[data-extra]]:hidden"
    >
      {children}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          justFolded.current = expanded
          setExpanded(!expanded)
        }}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {expanded ? (
          'Show fewer'
        ) : (
          <>
            <span>{showLabel ?? `Show ${hiddenCount} more`}</span>
            {hiddenHint && <span className="font-normal text-gray-500">{hiddenHint}</span>}
          </>
        )}
        <span aria-hidden="true" className="text-gray-400">{expanded ? '↑' : '↓'}</span>
      </button>
    </div>
  )
}
