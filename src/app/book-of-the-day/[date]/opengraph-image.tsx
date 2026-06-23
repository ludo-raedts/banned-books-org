// OG / Twitter card for a dated banned-book-of-the-day page — renders that
// day's book in the shared branded badge. Same renderer as the live badge and
// /share, so all three stay visually identical.

import { ImageResponse } from 'next/og'
import { getBookForDate, isPublishableBotdDate } from '@/lib/book-of-the-day'
import { renderBadge, BADGE_SIZE } from '@/lib/book-of-the-day-badge'

export const alt = 'Banned book of the day'
export const size = BADGE_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const book = isPublishableBotdDate(date) ? await getBookForDate(date) : null
  return new ImageResponse(renderBadge(book), { ...size })
}
