'use client'

import { useEffect, useRef } from 'react'
import { track } from '@vercel/analytics'

// Counts how often the support card is actually SEEN (at least half of it on
// screen), once per page load, as the Vercel event 'Support Card Viewed'. With
// 'Support Clicked' (campaign card-<placement>) this gives views → clicks, so we
// can tell whether the card sits too far down long book pages (reviewer,
// 2026-11-11). Cookieless: a Vercel Analytics event, nothing stored, no
// identifier. Renders nothing; it watches the card it sits in.
export default function SupportCardView({ placement }: { placement: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const card = ref.current?.parentElement
    if (!card || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          track('Support Card Viewed', { campaign: `card-${placement}` })
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [placement])

  return <span ref={ref} hidden />
}
