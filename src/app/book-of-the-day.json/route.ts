// /book-of-the-day.json — today's banned book of the day as a tiny JSON API.
// Lets anyone (and AI agents) fetch the pick programmatically: bots, widgets,
// digests, dashboards. Same pick as the Bluesky bot / feed / badge, cached per
// UTC day. Built from reliable structured fields only (no synopsis), CORS-open
// so browser clients can read it directly.

import { getBookOfTheDay, reasonPhrases, joinHuman, whereClause, todayYmd } from '@/lib/book-of-the-day'
import { SITE_URL } from '@/lib/canonical-host'

export async function GET() {
  const book = await getBookOfTheDay()
  const date = todayYmd()

  const payload = book
    ? {
        date,
        title: book.title,
        author: book.author,
        year: book.year,
        slug: book.slug,
        reasons: book.reasons,
        countries: book.countries,
        countryCount: book.countryCount,
        whyBanned: (() => {
          const reasons = reasonPhrases(book.reasons)
          const where = whereClause(book.countries, book.countryCount)
          return reasons.length
            ? `Banned for ${joinHuman(reasons.slice(0, 3))}${where ? ` ${where}` : ''}.`
            : where ? `Banned ${where}.` : null
        })(),
        coverUrl: book.coverUrl,
        url: `${SITE_URL}/book-of-the-day/${date}`,
        recordUrl: `${SITE_URL}/books/${book.slug}`,
      }
    : { date, book: null }

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
