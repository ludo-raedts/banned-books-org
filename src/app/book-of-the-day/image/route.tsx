// Hot-linkable "banned book of the day" badge image (1200×630 PNG).
//
// Same branded card shape as the per-book OG images, but it renders the daily
// pick — so anyone can embed a live daily badge with a plain <img> (READMEs,
// forums, newsletters, email signatures). X-Frame-Options doesn't affect
// <img>, so this needs no header exception; it just needs to be cacheable.
//
// Defaults to today; an optional ?date=YYYY-MM-DD renders that day's pick. The
// dated permalink pages use this (via openGraph.images) as their OG/Twitter
// card image: a Route Handler stays out of the page's RSC graph, whereas a
// file-based opengraph-image.tsx in a *dynamic* segment gets bundled into it
// and drags next/og's require() in, crashing the page (Turbopack).
//
// The card visual is shared with /share's Open Graph image via renderBadge().

import { ImageResponse } from 'next/og'
import { getBookOfTheDay, getBookForDate, isPublishableBotdDate } from '@/lib/book-of-the-day'
import { renderBadge, BADGE_SIZE } from '@/lib/book-of-the-day-badge'

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date')
  const book = date && isPublishableBotdDate(date)
    ? await getBookForDate(date)
    : await getBookOfTheDay()

  return new ImageResponse(renderBadge(book), {
    ...BADGE_SIZE,
    headers: {
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
