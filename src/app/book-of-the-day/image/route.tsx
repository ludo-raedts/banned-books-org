// Hot-linkable "banned book of the day" badge image (1200×630 PNG).
//
// Same branded card shape as the per-book OG images, but it renders TODAY's
// pick — so anyone can embed a live daily badge with a plain <img> (READMEs,
// forums, newsletters, email signatures). X-Frame-Options doesn't affect
// <img>, so this needs no header exception; it just needs to be cacheable.

import { ImageResponse } from 'next/og'
import { getBookOfTheDay, reasonPhrases, joinHuman, whereClause } from '@/lib/book-of-the-day'

const size = { width: 1200, height: 630 }

export async function GET() {
  const book = await getBookOfTheDay()

  if (!book) {
    return new ImageResponse(
      (
        <div style={{
          background: '#FBF6F3', width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8B2020', fontSize: 72, fontFamily: 'Georgia, serif', letterSpacing: 8,
        }}>
          BANNED BOOKS
        </div>
      ),
      { ...size },
    )
  }

  const reasons = reasonPhrases(book.reasons)
  const where = whereClause(book.countries, book.countryCount)
  const whyLine = reasons.length
    ? `Banned for ${joinHuman(reasons.slice(0, 2))}${where ? ` ${where}` : ''}`
    : where ? `Banned ${where}` : null

  const titleLen = book.title.length
  const titleSize = titleLen > 60 ? 44 : titleLen > 40 ? 56 : titleLen > 22 ? 72 : 88

  return new ImageResponse(
    (
      <div style={{
        background: '#FBF6F3', width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif',
      }}>
        {/* Brand accent bar */}
        <div style={{ height: 12, background: '#8B2020', display: 'flex' }} />

        {/* Body: cover + text */}
        <div style={{ flex: 1, display: 'flex', padding: '52px 64px 28px' }}>
          {/* Left rail: cover */}
          <div style={{
            width: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverUrl}
                alt={book.title}
                width={290}
                height={435}
                style={{
                  objectFit: 'cover', borderRadius: 8,
                  border: '1px solid #e8d5cc', boxShadow: '0 14px 36px rgba(92,16,16,0.22)',
                }}
              />
            ) : (
              <div style={{
                width: 290, height: 435, background: '#fff', border: '2px solid #e8d5cc',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#b89a90', fontSize: 24, letterSpacing: 4, padding: 20, textAlign: 'center',
              }}>
                NO COVER
              </div>
            )}
          </div>

          {/* Right rail: text */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            paddingLeft: 56,
          }}>
            <div style={{ fontSize: 22, color: '#8B2020', letterSpacing: 6, fontWeight: 700, marginBottom: 26 }}>
              📚 BANNED BOOK OF THE DAY
            </div>
            <div style={{
              fontSize: titleSize, color: '#1a1414', fontWeight: 700, lineHeight: 1.1, marginBottom: 18,
              display: 'flex', flexWrap: 'wrap',
            }}>
              {book.title}
            </div>
            <div style={{ fontSize: 34, color: '#6f6f6f', marginBottom: 28, display: 'flex', flexWrap: 'wrap' }}>
              by {book.author}{book.year ? ` (${book.year})` : ''}
            </div>
            {whyLine && (
              <div style={{
                fontSize: 26, color: '#8B2020', fontWeight: 600,
                borderTop: '2px solid #e8d5cc', paddingTop: 22, display: 'flex', flexWrap: 'wrap',
              }}>
                {whyLine}
              </div>
            )}
          </div>
        </div>

        {/* Footer: branding */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 64px 34px', fontSize: 23,
        }}>
          <span style={{ display: 'flex', color: '#9a8f8b' }}>A new banned book every day</span>
          <span style={{ display: 'flex', color: '#8B2020', fontWeight: 700 }}>banned-books.org</span>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}
