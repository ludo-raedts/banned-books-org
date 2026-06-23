// Shared visual for the "banned book of the day" 1200×630 card. Rendered by
// BOTH the hot-linkable badge (/book-of-the-day/image) and the /share Open
// Graph image (share/opengraph-image.tsx) so the two never drift apart.
//
// Returns a plain element tree for next/og's ImageResponse — no client code,
// no hooks. Light, branded card matching the /embed widget and /share page.

import type { ReactElement } from 'react'
import { reasonPhrases, joinHuman, whereClause, type DailyBook } from '@/lib/book-of-the-day'

export const BADGE_SIZE = { width: 1200, height: 630 }

export function renderBadge(book: DailyBook | null): ReactElement {
  if (!book) {
    return (
      <div style={{
        background: '#FBF6F3', width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#8B2020', fontSize: 72, fontFamily: 'Georgia, serif', letterSpacing: 8,
      }}>
        BANNED BOOKS
      </div>
    )
  }

  const reasons = reasonPhrases(book.reasons)
  const where = whereClause(book.countries, book.countryCount)
  const whyLine = reasons.length
    ? `Banned for ${joinHuman(reasons.slice(0, 2))}${where ? ` ${where}` : ''}`
    : where ? `Banned ${where}` : null

  const titleLen = book.title.length
  const titleSize = titleLen > 60 ? 44 : titleLen > 40 ? 56 : titleLen > 22 ? 72 : 88

  return (
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
  )
}
