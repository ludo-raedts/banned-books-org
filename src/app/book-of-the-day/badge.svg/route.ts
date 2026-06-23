// /book-of-the-day/badge.svg — a crisp, theme-aware SVG badge of today's book
// for README / docs / blog embeds. Sharper than the PNG and tiny. Light by
// default; ?theme=dark for a dark variant (pair the two in a <picture> with
// prefers-color-scheme for auto theme — see the snippet on /share).

import { getBookOfTheDay } from '@/lib/book-of-the-day'

const W = 360
const H = 84

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Trim to a max length on a grapheme-ish basis with an ellipsis. */
function clamp(s: string, max: number): string {
  const chars = Array.from(s)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : s
}

export async function GET(req: Request) {
  const dark = new URL(req.url).searchParams.get('theme') === 'dark'
  const book = await getBookOfTheDay()

  const bg = dark ? '#1a1414' : '#FBF6F3'
  const border = dark ? '#3a2e2e' : '#e8d5cc'
  const accent = dark ? '#e8a0a0' : '#8B2020'
  const titleColor = dark ? '#f5e8e8' : '#1a1414'
  const authorColor = dark ? '#b9a9a9' : '#6f6f6f'

  const title = book ? clamp(book.title, 30) : 'Banned Books'
  const author = book ? clamp(`by ${book.author}`, 34) : 'A new banned book every day'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Banned book of the day: ${esc(title)}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${bg}" stroke="${border}"/>
  <rect x="0" y="0" width="6" height="${H}" rx="3" fill="${accent}"/>
  <text x="22" y="26" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="${accent}">📚 BANNED BOOK OF THE DAY</text>
  <text x="22" y="52" font-family="Georgia,'Times New Roman',serif" font-size="19" font-weight="700" fill="${titleColor}">${esc(title)}</text>
  <text x="22" y="71" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="12" fill="${authorColor}">${esc(author)}</text>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
