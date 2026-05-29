'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import type { ScoredCandidate } from '@/lib/discover-engine'

export type WheelPhase = 'idle' | 'spinning' | 'revealed' | 'empty'

type Props = {
  phase: WheelPhase
  primary: ScoredCandidate | null
  alternatives: ScoredCandidate[]
  pool: ScoredCandidate[]
  onComplete: () => void
}

// Reel order: [left-alt, middle-primary, right-alt]. Middle lands LAST so
// the jackpot reveal is the climax.
const STOP_AT_MS = [900, 1700, 1300] as const
const SPIN_FRAME_MS = 70

export default function SlotMachine({
  phase,
  primary,
  alternatives,
  pool,
  onComplete,
}: Props) {
  // Slot-machine convention: middle reel is the jackpot. Alternatives flank
  // the primary so the eye lands on it.
  const targets: (ScoredCandidate | null)[] = [
    alternatives[0] ?? null,
    primary,
    alternatives[1] ?? null,
  ]

  const cyclePool = useMemo(() => {
    const withCover = pool.filter(b => b.coverUrl)
    if (withCover.length === 0) return [] as ScoredCandidate[]
    const repeats = withCover.length < 10 ? 3 : 1
    const out: ScoredCandidate[] = []
    for (let i = 0; i < repeats; i++) out.push(...withCover)
    return shuffle(out)
  }, [pool])

  // For idle: deterministic three covers from the current pool so a filter
  // change visibly swaps the wheel contents without random churn.
  const idleCovers = useMemo(() => pickIdleCovers(pool), [pool])

  const completedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'spinning') return
    completedRef.current = false
    const finalAt = Math.max(...STOP_AT_MS) + 220
    const t = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, finalAt)
    return () => clearTimeout(t)
  }, [phase, primary?.bookId, onComplete])

  const headlineCopy =
    phase === 'spinning' ? 'Spinning the wheel…'
    : phase === 'revealed' ? 'Your pick'
    : phase === 'empty' ? 'Nothing fits'
    : 'The banned books wheel'

  return (
    <div className="relative">
      {/* Wheel frame — cabinet styled, cream with oxblood border, decorative top/bottom marquee bars */}
      <div
        className={
          'relative rounded-3xl border-2 p-5 sm:p-6 pt-6 sm:pt-7 shadow-xl transition-all overflow-hidden ' +
          'bg-gradient-to-b from-[#fdf3ec] via-cream to-[#f7ece2] ' +
          (phase === 'revealed'
            ? 'border-oxblood/45 shadow-oxblood/15'
            : 'border-oxblood/20 shadow-oxblood/[0.06]')
        }
      >
        {/* Top marquee bar — slot-machine cabinet detail */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-oxblood/0 via-oxblood/55 to-oxblood/0"
        />
        {/* Bottom marquee bar — pairs with the top to bookend the cabinet */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-oxblood/0 via-oxblood/35 to-oxblood/0"
        />

        <p className={
          'text-center text-[11px] uppercase tracking-[0.18em] font-semibold mb-4 transition-colors ' +
          (phase === 'revealed' ? 'text-oxblood' : 'text-oxblood/70')
        }>
          {headlineCopy}
        </p>

        {/* Inset reel area — white card inside the cream cabinet so the
            covers don't compete with the panel background. */}
        <div className="rounded-xl bg-white ring-1 ring-oxblood/10 p-3 sm:p-4 shadow-inner">
          <div className="grid grid-cols-[1fr_1.28fr_1fr] gap-2.5 sm:gap-3 items-center">
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                phase={phase}
                target={targets[i]}
                idleCover={idleCovers[i] ?? null}
                cyclePool={cyclePool}
                stopAtMs={STOP_AT_MS[i]}
                isPrimary={i === 1}
              />
            ))}
          </div>
        </div>

        {phase === 'revealed' && primary && (
          <RevealCallout primary={primary} />
        )}

        {phase === 'idle' && (
          <p className="text-center text-[11px] uppercase tracking-wider text-oxblood/55 mt-5 sm:mt-6">
            Sample of what&apos;s loaded · spin to land on one
          </p>
        )}

        {phase === 'empty' && (
          <p className="text-center text-sm text-gray-700 mt-5 sm:mt-6 max-w-xs mx-auto">
            Adjust a filter to refill the wheel.
          </p>
        )}
      </div>
    </div>
  )
}

function Reel({
  phase,
  target,
  idleCover,
  cyclePool,
  stopAtMs,
  isPrimary,
}: {
  phase: WheelPhase
  target: ScoredCandidate | null
  idleCover: ScoredCandidate | null
  cyclePool: ScoredCandidate[]
  stopAtMs: number
  isPrimary: boolean
}) {
  const [spinFrame, setSpinFrame] = useState<ScoredCandidate | null>(null)
  const [spinStopped, setSpinStopped] = useState(false)
  const indexRef = useRef(0)

  // Drive the spin animation only when the phase says so.
  useEffect(() => {
    if (phase !== 'spinning') {
      setSpinStopped(false)
      setSpinFrame(null)
      indexRef.current = 0
      return
    }

    if (cyclePool.length === 0) {
      // Fall back to immediate target if nothing to cycle.
      setSpinFrame(target)
      const t = setTimeout(() => setSpinStopped(true), stopAtMs)
      return () => clearTimeout(t)
    }

    setSpinStopped(false)
    setSpinFrame(cyclePool[0])
    indexRef.current = 0

    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % cyclePool.length
      setSpinFrame(cyclePool[indexRef.current])
    }, SPIN_FRAME_MS)

    const stopTimer = setTimeout(() => {
      clearInterval(interval)
      setSpinFrame(target)
      setSpinStopped(true)
    }, stopAtMs)

    return () => {
      clearInterval(interval)
      clearTimeout(stopTimer)
    }
  }, [phase, target?.bookId, cyclePool, stopAtMs, target])

  let shown: ScoredCandidate | null = null
  let showStaticLabel = false
  let highlight = false

  if (phase === 'idle') {
    shown = idleCover
  } else if (phase === 'empty') {
    shown = null
  } else if (phase === 'spinning') {
    shown = spinFrame ?? target ?? idleCover
    highlight = spinStopped && isPrimary
    showStaticLabel = spinStopped
  } else if (phase === 'revealed') {
    shown = target
    highlight = isPrimary
    showStaticLabel = true
  }

  const isSpinningMoving = phase === 'spinning' && !spinStopped
  // The glitter halo only fires once the primary reel locks. Side reels
  // never glitter — visual hierarchy says "middle is the jackpot".
  const showGlitter = isPrimary && (phase === 'revealed' || (phase === 'spinning' && spinStopped))

  // The primary slot keeps a quiet oxblood-tinted frame in idle so the
  // eye knows where the jackpot lands — without competing with the full
  // glitter halo that fires once the wheel actually stops.
  const idlePrimaryHint = phase === 'idle' && isPrimary

  const ringCls = showGlitter
    ? '' // glitter wrapper handles the framing
    : highlight
      ? 'ring-2 ring-oxblood/70 shadow-lg'
      : phase === 'revealed' || (phase === 'spinning' && spinStopped)
        ? 'ring-1 ring-black/10 shadow-md'
        : idlePrimaryHint
          ? 'ring-2 ring-oxblood/25 shadow-md'
          : 'ring-1 ring-black/5 shadow-sm'

  const cover = (
    <div
      className={`relative w-full aspect-[2/3] overflow-hidden rounded-md bg-gray-100 transition-all duration-200 ${ringCls} ${isSpinningMoving ? 'animate-[slot-shake_120ms_ease-in-out_infinite]' : ''}`}
    >
      {shown?.coverUrl ? (
        <Image
          key={`${shown.bookId}-${phase}-${spinStopped ? 'stop' : 'live'}`}
          src={shown.coverUrl}
          alt=""
          fill
          className={`object-cover transition-opacity duration-200 ${isSpinningMoving ? 'opacity-90' : 'opacity-100'}`}
          sizes="(min-width: 1024px) 140px, (min-width: 640px) 160px, 120px"
        />
      ) : shown ? (
        <BookCoverPlaceholder
          title={shown.title}
          author={shown.author}
          slug={shown.slug}
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
      )}
      {isSpinningMoving && (
        <>
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/50 to-transparent pointer-events-none" />
        </>
      )}
    </div>
  )

  // Reels become clickable once the reveal animation finishes, so users
  // can dive straight into the case from any of the three locked covers.
  const isClickable = phase === 'revealed' && !!target

  const reelBody = (
    <>
      {showGlitter ? (
        <div
          className="relative w-full p-[3px] rounded-lg transition-transform duration-200 group-hover/reel:-translate-y-0.5"
          style={{
            background:
              'linear-gradient(135deg, #b45309 0%, #fbbf24 25%, #fef3c7 45%, #f59e0b 65%, #b45309 85%, #fbbf24 100%)',
            backgroundSize: '300% 300%',
            animation:
              'glitter-pan 2.4s linear infinite, glitter-glow 2.4s ease-in-out infinite',
          }}
        >
          {cover}
          <Sparkles />
        </div>
      ) : (
        <div className="w-full transition-transform duration-200 group-hover/reel:-translate-y-0.5">
          {cover}
        </div>
      )}
      <div className={`mt-2 h-9 text-center transition-opacity duration-300 ${showStaticLabel ? 'opacity-100' : 'opacity-0'}`}>
        {showStaticLabel && (target || shown) && (
          <p className={`text-[11px] leading-tight line-clamp-2 transition-colors ${isPrimary ? 'text-oxblood font-semibold' : 'text-gray-500 group-hover/reel:text-oxblood'}`}>
            {(target ?? shown)!.title}
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className="flex flex-col items-center w-full">
      {isClickable ? (
        <Link
          href={`/books/${target!.slug}`}
          className="block w-full group/reel focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 rounded-lg"
          aria-label={`Read about ${target!.title} by ${target!.author}`}
        >
          {reelBody}
        </Link>
      ) : (
        <div className="w-full">{reelBody}</div>
      )}
      <style jsx global>{`
        @keyframes slot-shake {
          0%, 100% { transform: translateY(-1px); }
          50%      { transform: translateY(1px); }
        }
        @keyframes glitter-pan {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes glitter-glow {
          0%, 100% { box-shadow: 0 0 18px -6px rgba(251,191,36,0.55), 0 6px 14px -6px rgba(180,83,9,0.4); }
          50%      { box-shadow: 0 0 34px -2px rgba(251,191,36,0.85), 0 8px 20px -6px rgba(180,83,9,0.55); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
          45%      { opacity: 1; transform: scale(1.15) rotate(45deg); }
          55%      { opacity: 1; transform: scale(1.15) rotate(45deg); }
        }
        @keyframes drift {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(2px, -2px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sparkles around the winning reel. Eight star-shaped twinklers with
// staggered delays so the eye keeps catching new flashes.

type SparkleSpec = {
  top: string
  left: string
  size: number
  delay: string
  color: string
}

const SPARKLES: SparkleSpec[] = [
  { top: '-8%',  left: '-6%',  size: 14, delay: '0ms',    color: '#fde68a' },
  { top: '-4%',  left: '92%',  size: 12, delay: '420ms',  color: '#fbbf24' },
  { top: '38%',  left: '-9%',  size: 10, delay: '800ms',  color: '#fef3c7' },
  { top: '52%',  left: '96%',  size: 16, delay: '1100ms', color: '#fbbf24' },
  { top: '92%',  left: '-5%',  size: 11, delay: '180ms',  color: '#fde68a' },
  { top: '94%',  left: '88%',  size: 13, delay: '650ms',  color: '#f59e0b' },
  { top: '20%',  left: '50%',  size: 8,  delay: '950ms',  color: '#ffffff' },
  { top: '74%',  left: '38%',  size: 9,  delay: '320ms',  color: '#ffffff' },
]

function Sparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="absolute animate-[twinkle_1.8s_ease-in-out_infinite]"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            animationDelay: s.delay,
            filter: `drop-shadow(0 0 ${s.size / 3}px ${s.color})`,
          }}
        >
          <svg viewBox="0 0 24 24" width={s.size} height={s.size} className="block">
            <path
              d="M12 0 L13.6 10.4 L24 12 L13.6 13.6 L12 24 L10.4 13.6 L0 12 L10.4 10.4 Z"
              fill={s.color}
            />
          </svg>
        </span>
      ))}
    </div>
  )
}

function RevealCallout({ primary }: { primary: ScoredCandidate }) {
  return (
    <div className="mt-5 pt-5 border-t border-oxblood/15 text-center">
      <p className="font-serif text-xl sm:text-2xl font-semibold text-gray-900 leading-tight">
        {primary.title}
      </p>
      <p className="text-sm text-gray-600 mt-0.5">{primary.author}</p>
      <Link
        href={`/books/${primary.slug}`}
        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-oxblood hover:underline"
      >
        Read the case →
      </Link>
    </div>
  )
}

function pickIdleCovers(pool: ScoredCandidate[]): ScoredCandidate[] {
  const withCover = pool.filter(b => b.coverUrl)
  // Stride through the pool so we don't always get the same three covers —
  // first, middle, near-end gives visual diversity without RNG (which would
  // re-shuffle on every re-render).
  if (withCover.length === 0) return []
  if (withCover.length <= 3) return withCover.slice(0, 3)
  const i0 = 0
  const i1 = Math.floor(withCover.length / 2)
  const i2 = Math.min(withCover.length - 1, Math.floor(withCover.length * 0.85))
  return [withCover[i0], withCover[i1], withCover[i2]]
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
