'use client'

// Anchor that fires a Vercel Analytics "Reading Club PDF Download" event
// before the browser starts streaming the file. Used on every Reading Club
// detail page + listing card so we can see in the Vercel dashboard which
// books, tracks, and surfaces drive PDF downloads.

import { track } from '@vercel/analytics'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> & {
  track: 'international' | 'classics' | 'by-theme' | 'currently-challenged'
  bookSlug: string | null
  themeSlug?: string | null
  year?: number | null
  position?: number | null
  // Where the click happened — "detail-hero", "detail-footer", "card".
  // Lets us tell whether the card-level CTA or the detail-page button
  // drives more downloads.
  source: 'detail-hero' | 'detail-footer' | 'card'
  children: ReactNode
}

export default function TrackedPdfDownload({
  track: trackName,
  bookSlug,
  themeSlug,
  year,
  position,
  source,
  children,
  ...rest
}: Props) {
  return (
    <a
      {...rest}
      download
      onClick={() => {
        track('Reading Club PDF Download', {
          track: trackName,
          bookSlug: bookSlug ?? null,
          themeSlug: themeSlug ?? null,
          year: year ?? null,
          position: position ?? null,
          source,
        })
      }}
    >
      {children}
    </a>
  )
}
