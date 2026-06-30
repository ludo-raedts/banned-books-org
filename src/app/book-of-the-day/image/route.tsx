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
// ?format=square renders a 1:1 1080×1080 variant for Instagram (and any grid).
// That variant is returned as JPEG — Instagram's publishing API only accepts
// JPEG (no PNG), and next/og emits PNG, so we transcode it with sharp. JPEG is
// fine everywhere, so square is always JPEG; the landscape badge stays PNG
// (OG/Twitter cards and hot-linked <img> badges accept it).
//
// The card visual is shared with /share's Open Graph image via renderBadge().

import { ImageResponse } from 'next/og'
import { getBookOfTheDay, getBookForDate, isPublishableBotdDate } from '@/lib/book-of-the-day'
import { renderBadge, BADGE_SIZE, BADGE_SIZE_SQUARE } from '@/lib/book-of-the-day-badge'

// A specific date's render is deterministic and never changes → cache long.
// The date-less "today" badge is live, so cache it briefly: a previous-day
// render must expire (not be served stale for up to a day), or hot-linked
// badges and date-less image_url consumers (e.g. an Instagram post) show
// yesterday's book. Always link dated URLs where you can; they're unique per
// day and thus immune to any cross-day cache.
const CACHE_DATED = 'public, s-maxage=86400, stale-while-revalidate=604800'
const CACHE_LIVE = 'public, s-maxage=600, stale-while-revalidate=600'

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const date = params.get('date')
  const square = params.get('format') === 'square'
  const dated = !!date && isPublishableBotdDate(date)
  const book = dated ? await getBookForDate(date) : await getBookOfTheDay()
  const cache = dated ? CACHE_DATED : CACHE_LIVE

  const png = Buffer.from(
    await new ImageResponse(renderBadge(book, { square }), {
      ...(square ? BADGE_SIZE_SQUARE : BADGE_SIZE),
    }).arrayBuffer(),
  )

  if (square) {
    const sharp = (await import('sharp')).default
    const jpg = await sharp(png)
      .flatten({ background: '#FBF6F3' }) // JPEG has no alpha; fill on the cream bg
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toBuffer()
    return new Response(new Uint8Array(jpg), {
      headers: { 'content-type': 'image/jpeg', 'cache-control': cache },
    })
  }

  return new Response(new Uint8Array(png), {
    headers: { 'content-type': 'image/png', 'cache-control': cache },
  })
}
