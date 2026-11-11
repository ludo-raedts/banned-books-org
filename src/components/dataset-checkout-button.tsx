'use client'

import { track } from '@vercel/analytics'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'

type Props = {
  className?: string
  priceUsd: number
  children: ReactNode
}

type Phase = 'idle' | 'opening' | 'failed'

// The buy button on /dataset. It used to submit the form with no feedback:
// nothing changed on screen until Stripe answered, the button stayed clickable,
// and every extra click created another Checkout session — one visitor clicked
// seven times in five seconds (Vercel logs, 26 Oct 2026). A failure showed the
// API's raw JSON as a page.
//
// Now: one click, a visible and announced "Opening secure checkout…", and on
// failure (API error or no network) a plain message with a retry. Without JS
// the surrounding <form> still POSTs and the API still answers with a 303.
export default function DatasetCheckoutButton({ className, priceUsd, children }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  // A ref, not the state: two clicks in the same tick both see phase 'idle'.
  const busy = useRef(false)

  // Coming back from Stripe with the browser's Back button can restore this
  // page from the back/forward cache with the button still "opening".
  useEffect(() => {
    const reset = () => {
      busy.current = false
      setPhase('idle')
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  async function openCheckout(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (busy.current) return
    busy.current = true
    setPhase('opening')
    track('Dataset Checkout Clicked', { priceUsd })
    try {
      const res = await fetch('/api/dataset/checkout', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const body = (await res.json().catch(() => null)) as { url?: string } | null
      if (!res.ok || !body?.url) throw new Error('no checkout url')
      track('Dataset Checkout Opened', { priceUsd })
      // Stripe is another origin: give the analytics beacon a moment to leave
      // before the navigation drops it. Stays "opening" until the page unloads.
      const url = body.url
      setTimeout(() => window.location.assign(url), 150)
    } catch {
      busy.current = false
      setPhase('failed')
      track('Dataset Checkout Failed', { priceUsd })
    }
  }

  return (
    <>
      {/* aria-disabled, not disabled: a disabled button drops keyboard focus,
          and the click guard above already makes a second click a no-op. */}
      <button
        type="submit"
        className={`${className ?? ''} aria-disabled:cursor-wait aria-disabled:opacity-70`}
        aria-disabled={phase === 'opening'}
        onClick={openCheckout}
      >
        {phase === 'opening' ? 'Opening secure checkout…' : phase === 'failed' ? 'Try again →' : children}
      </button>
      {/* One live region for both states, always in the DOM so screen readers
          announce the change: hidden while opening (the button says it), a
          visible message when it failed. */}
      <span
        role="status"
        aria-live="polite"
        className={
          phase === 'failed'
            ? 'mt-3 block rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
            : 'sr-only'
        }
      >
        {phase === 'opening'
          ? 'Opening secure checkout…'
          : phase === 'failed'
            ? 'Checkout didn’t open. Nothing was charged. Please try again.'
            : ''}
      </span>
    </>
  )
}
