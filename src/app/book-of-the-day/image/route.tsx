// Hot-linkable "banned book of the day" badge image (1200×630 PNG).
//
// Same branded card shape as the per-book OG images, but it renders TODAY's
// pick — so anyone can embed a live daily badge with a plain <img> (READMEs,
// forums, newsletters, email signatures). X-Frame-Options doesn't affect
// <img>, so this needs no header exception; it just needs to be cacheable.
//
// The card visual is shared with /share's Open Graph image via renderBadge().

import { ImageResponse } from 'next/og'
import { getBookOfTheDay } from '@/lib/book-of-the-day'
import { renderBadge, BADGE_SIZE } from '@/lib/book-of-the-day-badge'

export async function GET() {
  const book = await getBookOfTheDay()

  return new ImageResponse(renderBadge(book), {
    ...BADGE_SIZE,
    headers: {
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
