import { ImageResponse } from 'next/og'

export const alt = 'Banned Books — International Archive of Censored Publications'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#080808',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '120px 64px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 600,
            color: '#5C1010',
            letterSpacing: 10,
            lineHeight: 1,
          }}
        >
          BANNED BOOKS
        </div>
        <div
          style={{
            width: '100%',
            height: 4,
            background: '#5C1010',
            marginTop: 36,
            marginBottom: 36,
          }}
        />
        <div
          style={{
            fontSize: 26,
            color: '#F5E8E8',
            letterSpacing: 8,
            fontWeight: 400,
          }}
        >
          INTERNATIONAL ARCHIVE OF CENSORED PUBLICATIONS
        </div>
      </div>
    ),
    { ...size }
  )
}
