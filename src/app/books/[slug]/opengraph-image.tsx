// Per-book Open Graph card. The previous default was openGraph.images =
// [book.cover_url] which renders the raw Open Library cover — often
// only 200×300, looks awful in Twitter / LinkedIn / Slack previews. This
// route generates a 1200×630 branded card with cover + title + author +
// ban-summary so social shares look professional.
//
// generateMetadata in page.tsx no longer sets openGraph.images; Next's
// file-based metadata convention picks up this file automatically and
// uses it as the OG image for /books/[slug].

import { ImageResponse } from 'next/og'
import { adminClient } from '@/lib/supabase'

export const alt = 'Banned book — Banned Books archive'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Re-renders along with the page on the ISR cycle.
export const revalidate = 3600

type Params = { params: Promise<{ slug: string }> }

export default async function Image({ params }: Params) {
  const { slug } = await params

  const { data } = await adminClient()
    .from('books')
    .select('title, cover_url, is_gated, book_authors(authors(display_name)), bans(country_code)')
    .eq('slug', slug)
    .single()

  type BookRow = {
    title: string
    cover_url: string | null
    is_gated: boolean
    book_authors: Array<{ authors: { display_name: string } | null }>
    bans: Array<{ country_code: string }>
  }
  const book = data as unknown as BookRow | null

  // No book (incl. blocked/deleted slugs) or a gated (Bucket B) book = unbranded
  // fallback. A gated work shows no cover and no identifying title in social
  // previews, consistent with the on-page suppression.
  if (!book || book.is_gated) {
    return new ImageResponse(
      (
        <div style={{
          background: '#080808', width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#5C1010', fontSize: 80, fontFamily: 'Georgia, serif', letterSpacing: 8,
        }}>
          BANNED BOOKS
        </div>
      ),
      { ...size },
    )
  }

  const author = (book.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)
    .join(', ')
  const countryCount = new Set((book.bans ?? []).map(b => b.country_code)).size
  const banLine = countryCount === 0
    ? null
    : `Banned in ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`

  // Title size scales down with length so long titles fit on one card.
  const titleLen = book.title.length
  const titleSize = titleLen > 60 ? 44 : titleLen > 40 ? 56 : titleLen > 22 ? 72 : 88

  return new ImageResponse(
    (
      <div style={{
        background: '#080808',
        width: '100%', height: '100%',
        display: 'flex',
        fontFamily: 'Georgia, serif',
      }}>
        {/* Left rail: cover or placeholder block */}
        <div style={{
          width: 380, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 50,
        }}>
          {book.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt={book.title}
              width={280}
              height={420}
              style={{ objectFit: 'cover', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
            />
          ) : (
            <div style={{
              width: 280, height: 420,
              background: '#1a1a1a',
              border: '2px solid #5C1010',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5C1010', fontSize: 24, letterSpacing: 4, padding: 20,
              textAlign: 'center',
            }}>
              NO COVER
            </div>
          )}
        </div>

        {/* Right rail: text */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 60px 60px 20px',
        }}>
          <div style={{
            fontSize: 22, color: '#5C1010', letterSpacing: 8, fontWeight: 600,
            marginBottom: 28,
          }}>
            BANNED BOOKS
          </div>
          <div style={{
            fontSize: titleSize, color: '#F5E8E8', fontWeight: 700,
            lineHeight: 1.1, marginBottom: 20,
            // ImageResponse needs explicit display:flex on multi-line text
            display: 'flex', flexWrap: 'wrap',
          }}>
            {book.title}
          </div>
          {author && (
            <div style={{
              fontSize: 34, color: '#aaa', marginBottom: 28,
              display: 'flex', flexWrap: 'wrap',
            }}>
              by {author}
            </div>
          )}
          {banLine && (
            <div style={{
              fontSize: 28, color: '#5C1010', fontWeight: 600,
              borderTop: '2px solid #5C1010', paddingTop: 24,
              display: 'flex',
            }}>
              {banLine}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
