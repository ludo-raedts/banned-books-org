import { ImageResponse } from 'next/og'

export const alt = 'Pick me a banned book — the Banned Books wheel'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// On-brand: oxblood (#5C1010), cream (#F5E8E8), warm gold for the winning
// reel halo (#FBBF24). Three "reels" sit on the right; headline + tagline
// occupy the left third. No external images — keeps the OG render fast
// and deterministic across deploys.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#080808',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 80px',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Left: copy */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            paddingRight: 40,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: '#F5E8E8',
              letterSpacing: 8,
              fontWeight: 600,
              textTransform: 'uppercase',
              marginBottom: 28,
            }}
          >
            The Wheel · Discover
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: '#F5E8E8',
              lineHeight: 0.95,
              letterSpacing: -2,
            }}
          >
            Pick me a banned book.
          </div>
          <div
            style={{
              width: 120,
              height: 4,
              background: '#5C1010',
              marginTop: 36,
              marginBottom: 36,
            }}
          />
          <div
            style={{
              fontSize: 24,
              color: '#C9B7B7',
              lineHeight: 1.35,
            }}
          >
            Spin the wheel against the world&apos;s most documented bans —
            filter by theme, region, and reading-club guide.
          </div>
        </div>

        {/* Right: 3 stacked-rectangle reels with the middle one in a gold frame */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
          }}
        >
          {[0, 1, 2].map(i => {
            const isPrimary = i === 1
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: isPrimary ? 150 : 118,
                  height: isPrimary ? 230 : 178,
                  borderRadius: 10,
                  background: isPrimary
                    ? 'linear-gradient(135deg, #b45309 0%, #fbbf24 35%, #fef3c7 50%, #f59e0b 70%, #b45309 100%)'
                    : '#1a1a1a',
                  padding: isPrimary ? 5 : 0,
                  boxShadow: isPrimary
                    ? '0 0 60px rgba(251, 191, 36, 0.45)'
                    : '0 6px 18px rgba(0,0,0,0.4)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 6,
                    background:
                      i === 0
                        ? 'linear-gradient(160deg, #3a1a1a, #1a0a0a)'
                        : i === 1
                          ? 'linear-gradient(160deg, #5C1010, #2a0808)'
                          : 'linear-gradient(160deg, #2a2a3a, #0a0a1a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F5E8E8',
                    fontSize: isPrimary ? 64 : 50,
                    fontWeight: 700,
                    fontFamily: 'Georgia, serif',
                    opacity: isPrimary ? 1 : 0.6,
                  }}
                >
                  📕
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ),
    { ...size },
  )
}
