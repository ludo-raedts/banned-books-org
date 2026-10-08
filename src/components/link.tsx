import NextLink from 'next/link'
import type { ComponentProps } from 'react'

// Site-wide <Link> with viewport prefetching OFF by default.
//
// Next prefetches every <Link> that enters the viewport. Our pages carry
// 100–180 internal links (book/country grids, 45-link header+footer), so one
// pageview fanned out into dozens of RSC + /_next/image requests — ~390k edge
// requests/day for ~1k visitors (2026-10-08 audit). Visitors here view 1–3
// pages, so the prefetch is almost pure waste. Pass `prefetch` explicitly to
// opt a specific link back in.
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />
}
