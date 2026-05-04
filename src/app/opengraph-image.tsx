import { ImageResponse } from 'next/og'

export const alt = 'Banned Books — International Catalogue of Censored Literature'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '80px',
        }}
      >
        {/* Red accent bar */}
        <div style={{ width: 64, height: 6, background: '#dc2626', borderRadius: 3, marginBottom: 32 }} />

        <div style={{ fontSize: 72, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: 24 }}>
          📕 Banned Books
        </div>

        <div style={{ fontSize: 32, color: '#d1d5db', lineHeight: 1.4, maxWidth: 800 }}>
          An international catalogue of books banned by governments
          and schools worldwide.
        </div>

        <div style={{ marginTop: 48, fontSize: 22, color: '#6b7280' }}>
          banned-books.org
        </div>
      </div>
    ),
    { ...size }
  )
}
