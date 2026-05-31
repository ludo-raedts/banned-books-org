'use client'

// Last-resort boundary for errors thrown in the root layout itself. It
// replaces the whole document, so it must render its own <html>/<body> and
// can't rely on globals.css — hence inline styles. Brand colour is #8B2020.
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '2rem',
          textAlign: 'center',
          color: '#111',
          background: '#fff',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#555', marginBottom: '1.5rem' }}>
            A critical error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#8B2020',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '0.6rem 1.2rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
