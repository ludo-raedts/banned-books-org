// /book-of-the-day/feed.xml — the "banned book of the day" as an RSS feed.
//
// This is the skeleton key for non-social channels: Slack (its official RSS
// app: `/feed subscribe <this url>`), Discord (via MonitoRSS), Teams (Power
// Automate "When a feed item is published"), and any RSS reader all consume
// this one feed. No per-subscriber webhooks, no fan-out cron, no stored data
// — the platforms poll us. That keeps the "no script, no tracking" promise and
// costs us nothing per subscriber.
//
// Content reuses the SAME pick as the Bluesky bot and the /share hub
// (pickForDates → pickDailyBook), so every channel broadcasts the same title
// on the same UTC day. One item per day, GUID keyed to the date, so a poller
// posts each day exactly once and never reposts.

import { unstable_cache } from 'next/cache'
import { pickForDates, type DailyBook } from '@/lib/bluesky-post'
import { reasonPhrases, joinHuman, whereClause } from '@/lib/book-of-the-day'
import { SITE_URL } from '@/lib/canonical-host'

// How many past days to carry. RSS pollers (Slack's app, MonitoRSS, …) bookmark
// the last item they saw and only post newer ones, so a fresh subscriber won't
// get spammed with the whole window — it's just backfill / a non-empty feed.
const WINDOW_DAYS = 14

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** The last WINDOW_DAYS dates (UTC), newest first, as YYYY-MM-DD. */
function recentDates(today: Date): string[] {
  const out: string[] = []
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** One sentence of grounded context — the editor ban note if we have one, else
 *  the same reason/where line the embed and Bluesky post use. */
function whyLine(book: DailyBook): string {
  if (book.descriptionBan?.trim()) return book.descriptionBan.trim()
  const reasons = reasonPhrases(book.reasons)
  const where = whereClause(book.countries, book.countryCount)
  return reasons.length
    ? `Banned for ${joinHuman(reasons.slice(0, 3))}${where ? ` ${where}` : ''}.`
    : `Banned${where ? ` ${where}` : ''}.`
}

// Cache the per-day picks for the window once per UTC day, sharing the
// 'book-of-the-day' tag so an admin revalidate clears this too.
function pickWindow(dates: string[]) {
  const key = dates[0] // newest date pins the whole window
  return unstable_cache(
    () => pickForDates(dates),
    ['book-of-the-day-feed', key],
    { revalidate: 3600, tags: ['book-of-the-day'] },
  )()
}

export async function GET() {
  const now = new Date()
  const dates = recentDates(now)
  const picks = await pickWindow(dates)

  const items = dates
    .map((ymd, i) => ({ ymd, book: picks[i] }))
    .filter((x): x is { ymd: string; book: DailyBook } => !!x.book)
    .map(({ ymd, book }) => {
      const link = `${SITE_URL}/books/${book.slug}?utm_source=rss&utm_medium=feed&utm_campaign=book-of-the-day`
      const yearPart = book.year ? ` (${book.year})` : ''
      const title = `Banned book of the day: ${book.title}${yearPart} — ${book.author}`
      // Each day "publishes" at 08:00 UTC; clamp today's to now so readers never
      // see a future-dated item (some reject them).
      const pubMs = Math.min(new Date(`${ymd}T08:00:00.000Z`).getTime(), now.getTime())
      const pubDate = new Date(pubMs).toUTCString()
      const cover =
        book.coverUrl && /^https?:\/\//.test(book.coverUrl)
          ? `\n      <enclosure url="${escapeXml(book.coverUrl)}" type="${
              /\.png(\?|$)/i.test(book.coverUrl) ? 'image/png' : 'image/jpeg'
            }" length="0" />\n      <media:content url="${escapeXml(book.coverUrl)}" medium="image" />`
          : ''
      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">tag:banned-books.org,${ymd}:book-of-the-day</guid>
      <description>${escapeXml(whyLine(book))}</description>
      <pubDate>${pubDate}</pubDate>${cover}
    </item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Banned book of the day</title>
    <link>${SITE_URL}/share</link>
    <description>A different banned or challenged book every day, with the record of where and why it was censored. From banned-books.org.</description>
    <language>en-us</language>
    <ttl>720</ttl>
    <atom:link href="${SITE_URL}/book-of-the-day/feed.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
