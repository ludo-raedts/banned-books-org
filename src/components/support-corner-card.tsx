'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@vercel/analytics'
import { SUPPORT_LINK_ONE_OFF } from '@/lib/support-links'

// A small, non-blocking card in the bottom-right corner, DESKTOP ONLY. The
// in-page card at the foot of book pages and essays is calm but easy to miss;
// on a computer a corner card gets attention without covering anything (Ludo,
// 2026-11-11). On a phone only the in-page card exists: the old full-width
// slide-in covered a large part of the screen there, which the UX reviewer
// flagged.
//
// Shown on book and essay pages only, after real reading: half the page
// scrolled, or 30 s of visible time. Hidden while the in-page card is on screen,
// so the two never show at once. Dismiss is remembered for 30 days, a click for
// the whole campaign (localStorage only; nothing is sent to a server). Renders
// nothing on the server, so ISR/CDN output and crawlers are untouched.
// Force it for a check with ?support-ask=1.

const CAMPAIGN_ID = 'corner2026'
const VISIBLE_DELAY_MS = 30_000
const SCROLL_SHARE = 0.5
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const STORAGE_KEY = `bb_support_corner_${CAMPAIGN_ID}`
// 1280 and up: below that the card would sit over the reading column (reviewer,
// 2026-11-11, saw it cover background text at 1280 wide, so it is also smaller
// and lower than first built).
const DESKTOP_QUERY = '(min-width: 1280px) and (hover: hover)'

const CHECKOUT_URL = `${SUPPORT_LINK_ONE_OFF}?client_reference_id=card-corner`

function readState(): { at: number; action: 'dismissed' | 'clicked' } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeState(action: 'dismissed' | 'clicked') {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), action }))
  } catch {}
}

function isSuppressed(): boolean {
  const state = readState()
  if (!state) return false
  if (state.action === 'clicked') return true
  return Date.now() - state.at < SNOOZE_MS
}

export default function SupportCornerCard() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [inlineVisible, setInlineVisible] = useState(false)

  const eligible = pathname.startsWith('/books/') || pathname.startsWith('/essays/')

  // Open after half the page has been read, or 30 s of visible time.
  useEffect(() => {
    if (open || !eligible) return
    if (!window.matchMedia(DESKTOP_QUERY).matches) return
    if (new URLSearchParams(window.location.search).get('support-ask') === '1') {
      setOpen(true)
      return
    }
    if (isSuppressed()) return

    let visibleMs = 0
    let lastTick = Date.now()
    const interval = window.setInterval(() => {
      const now = Date.now()
      if (document.visibilityState === 'visible') visibleMs += now - lastTick
      lastTick = now
      if (visibleMs >= VISIBLE_DELAY_MS) setOpen(true)
    }, 1000)
    const onScroll = () => {
      const doc = document.documentElement
      if (window.scrollY + window.innerHeight >= doc.scrollHeight * SCROLL_SHARE) setOpen(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname, open, eligible])

  // Step aside while the in-page card is on screen.
  useEffect(() => {
    if (!open || !eligible) return
    const inline = document.querySelector('aside[aria-labelledby="support-card-title"]')
    if (!inline || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      setInlineVisible(entries.some(e => e.isIntersecting))
    })
    observer.observe(inline)
    return () => {
      observer.disconnect()
      setInlineVisible(false)
    }
  }, [open, eligible, pathname])

  const dismiss = useCallback(() => {
    writeState('dismissed')
    track('Support Ask Dismissed', { campaign: CAMPAIGN_ID })
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    track('Support Card Viewed', { campaign: 'card-corner' })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  if (!open || !eligible || inlineVisible) return null

  return (
    <aside
      aria-label="Support this project"
      className="fixed bottom-3 right-3 z-30 hidden w-[256px] motion-safe:animate-fade-in xl:block"
    >
      <div className="relative rounded-xl border border-gray-200 bg-white px-4 pb-3.5 pt-3.5 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2 top-2 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
        <p className="pr-6 font-serif text-base font-semibold leading-snug text-gray-900">Help keep this archive open</p>
        <p className="mt-1 text-[13px] leading-snug text-gray-600">
          Maintained by one person, no ads or paywall. A one-time contribution helps cover hosting and data costs.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <a
            href={CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              writeState('clicked')
              track('Support Clicked', { type: 'one_off', campaign: 'card-corner' })
              setOpen(false)
            }}
            className="inline-flex items-center justify-center rounded-lg bg-oxblood px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-oxblood/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
          >
            Give $5 once
          </a>
          <button type="button" onClick={dismiss} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">
            Maybe later
          </button>
        </div>
      </div>
    </aside>
  )
}
