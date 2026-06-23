// Embeddable "banned book of the day" widget. Returns a self-contained,
// chrome-free HTML card (no site header/footer) that any site can drop into an
// <iframe>. The global X-Frame-Options: DENY in next.config is lifted for
// /embed/* (replaced by CSP frame-ancestors *) so this frames cross-origin.
//
// It is a route handler — not a page — so it inherits none of the root layout
// and we control caching + framing headers directly. All CSS is inline; the
// whole card is one outbound link to the book's full record (target=_blank
// because it lives inside someone else's frame).

import { getBookOfTheDay, reasonPhrases, joinHuman, whereClause } from '@/lib/book-of-the-day'
import { SITE_URL } from '@/lib/canonical-host'

// Re-evaluate hourly at the edge; the pick itself only changes at 00:00 UTC.
export const revalidate = 3600

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET() {
  const book = await getBookOfTheDay()

  const utm = 'utm_source=embed&utm_medium=widget&utm_campaign=book-of-the-day'
  const href = book
    ? `${SITE_URL}/books/${encodeURIComponent(book.slug)}?${utm}`
    : `${SITE_URL}/share?${utm}`

  // Card body. Falls back to a generic prompt if the pick is unavailable so the
  // widget never renders blank.
  let inner: string
  if (book) {
    const yearPart = book.year ? ` <span style="color:#9a9a9a;font-weight:400">(${book.year})</span>` : ''
    const reasons = reasonPhrases(book.reasons)
    const why = reasons.length
      ? `Banned for ${esc(joinHuman(reasons.slice(0, 3)))} ${esc(whereClause(book.countries, book.countryCount))}.`
      : `Banned ${esc(whereClause(book.countries, book.countryCount))}.`.replace(' .', '.')
    const cover = book.coverUrl
      ? `<img src="${esc(book.coverUrl)}" alt="" width="92" height="138" loading="lazy"
             style="width:92px;height:138px;object-fit:cover;border-radius:4px;flex:0 0 auto;box-shadow:0 2px 8px rgba(0,0,0,.18)" />`
      : `<div style="width:92px;height:138px;flex:0 0 auto;border-radius:4px;background:#f4e8e2;border:1px solid #e8d5cc"></div>`
    inner = `
      <div style="display:flex;gap:16px;align-items:flex-start">
        ${cover}
        <div style="min-width:0">
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8B2020;font-weight:700;margin-bottom:8px">
            📚 Banned book of the day
          </div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.25;color:#171717;font-weight:700;margin-bottom:4px">
            ${esc(book.title)}${yearPart}
          </div>
          <div style="font-size:13px;color:#555;margin-bottom:10px">${esc(book.author)}</div>
          <div style="font-size:13px;line-height:1.45;color:#3a3a3a">${why}</div>
        </div>
      </div>`
  } else {
    inner = `
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8B2020;font-weight:700;margin-bottom:8px">
        📚 Banned book of the day
      </div>
      <div style="font-family:Georgia,serif;font-size:18px;color:#171717">See today&#39;s banned book →</div>`
  }

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Banned book of the day</title>
<style>
  html,body{margin:0;padding:0;background:transparent}
  *{box-sizing:border-box}
  a.card{
    display:block;text-decoration:none;color:inherit;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    background:#fff;border:1px solid #e8d5cc;border-radius:12px;
    padding:18px 20px;max-width:520px;
    transition:border-color .15s ease, box-shadow .15s ease;
  }
  a.card:hover{border-color:#8B2020;box-shadow:0 6px 18px rgba(92,16,16,.10)}
  .foot{margin-top:14px;padding-top:12px;border-top:1px solid #f0e6e0;
    font-size:11px;color:#9a9a9a;display:flex;justify-content:space-between;align-items:center}
  .foot b{color:#8B2020;font-weight:700}
</style></head>
<body>
  <a class="card" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
    ${inner}
    <div class="foot"><span>The full censorship record →</span><span><b>banned-books.org</b></span></div>
  </a>
</body></html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // CDN-cache for an hour, serve stale for a day while revalidating.
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
