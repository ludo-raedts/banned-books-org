// Per-author Open Graph card — same rationale as /books/[slug]/opengraph-image.tsx.
// Author photos from Wikimedia are typically high-res, but the previous
// default of "no openGraph.images at all" left author shares with a
// generic site-logo card. This generates a 1200×630 branded card with
// photo + name + book/ban summary.

import { ImageResponse } from 'next/og'
import { adminClient } from '@/lib/supabase'

export const alt = 'Banned author — Banned Books archive'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

type Params = { params: Promise<{ slug: string }> }

export default async function Image({ params }: Params) {
  const { slug } = await params

  const { data: author } = await adminClient()
    .from('authors')
    .select('id, display_name, photo_url')
    .eq('slug', slug)
    .single()

  if (!author) {
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

  // Ban + book summary via 2 small joins.
  const { data: bookLinks } = await adminClient()
    .from('book_authors').select('book_id').eq('author_id', author.id)
  const bookIds = (bookLinks ?? []).map((b: { book_id: number }) => b.book_id)
  let totalBans = 0
  let countryCount = 0
  if (bookIds.length > 0) {
    const { data: bans } = await adminClient()
      .from('bans').select('country_code').in('book_id', bookIds)
    totalBans = bans?.length ?? 0
    countryCount = new Set((bans ?? []).map((b: { country_code: string }) => b.country_code)).size
  }

  const summary = bookIds.length === 0
    ? null
    : `${bookIds.length} ${bookIds.length === 1 ? 'book' : 'books'} · ${totalBans} ${totalBans === 1 ? 'ban' : 'bans'} across ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`

  const nameLen = author.display_name.length
  const nameSize = nameLen > 30 ? 56 : nameLen > 20 ? 72 : 96

  return new ImageResponse(
    (
      <div style={{
        background: '#080808',
        width: '100%', height: '100%',
        display: 'flex',
        fontFamily: 'Georgia, serif',
      }}>
        {/* Left rail: portrait */}
        <div style={{
          width: 380, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 50,
        }}>
          {author.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.photo_url}
              alt={author.display_name}
              width={280}
              height={350}
              style={{ objectFit: 'cover', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
            />
          ) : (
            <div style={{
              width: 280, height: 350,
              background: '#1a1a1a',
              border: '2px solid #5C1010',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5C1010', fontSize: 24, letterSpacing: 4,
            }}>
              NO PHOTO
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
            fontSize: nameSize, color: '#F5E8E8', fontWeight: 700,
            lineHeight: 1.05, marginBottom: 28,
            display: 'flex', flexWrap: 'wrap',
          }}>
            {author.display_name}
          </div>
          {summary && (
            <div style={{
              fontSize: 26, color: '#5C1010', fontWeight: 600,
              borderTop: '2px solid #5C1010', paddingTop: 24,
              display: 'flex', flexWrap: 'wrap',
            }}>
              {summary}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
