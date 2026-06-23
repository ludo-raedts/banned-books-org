// Open Graph / Twitter card image for /share — renders TODAY's banned book in
// the shared branded badge. So when someone shares the /share URL itself, the
// social preview shows the live daily book, not a generic site card.
//
// File-based OG image (Next convention): overrides the inherited root image for
// this route and auto-wires og:image + twitter:image with the size below.

import { ImageResponse } from 'next/og'
import { getBookOfTheDay } from '@/lib/book-of-the-day'
import { renderBadge, BADGE_SIZE } from '@/lib/book-of-the-day-badge'

export const alt = 'Banned book of the day'
export const size = BADGE_SIZE
export const contentType = 'image/png'

export default async function Image() {
  const book = await getBookOfTheDay()
  return new ImageResponse(renderBadge(book), { ...size })
}
