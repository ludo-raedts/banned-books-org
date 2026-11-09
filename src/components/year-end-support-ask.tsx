'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@vercel/analytics'
import { SUPPORT_LINK_ONE_OFF } from '@/lib/support-links'

// End-of-year appeal: a non-blocking slide-in card (bottom sheet on mobile)
// asking once for the $5 one-off contribution. Client-only and renders nothing
// on the server, so ISR/CDN output and crawlers are untouched.
//
// Shown only to engaged readers: on the 2nd pageview of a session, or after
// 45s of visible time on a page — never on a search landing's first view.
// Dismiss/click is remembered in localStorage (30 days / whole campaign).
// Force it for a check with ?support-ask=1.

const CAMPAIGN_ID = 'eoy2026'
const CAMPAIGN_END = Date.parse('2027-01-01T00:00:00Z')
const VISIBLE_DELAY_MS = 45_000
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

const STORAGE_KEY = `bb_support_ask_${CAMPAIGN_ID}`
const SESSION_VIEWS_KEY = 'bb_support_ask_views'

const EXCLUDED_PREFIXES = ['/support', '/dataset', '/admin', '/api', '/embed', '/share']

const CHECKOUT_URL = `${SUPPORT_LINK_ONE_OFF}?client_reference_id=${CAMPAIGN_ID}`

// Guards against counting one pageview twice (Strict Mode effect re-run).
let lastCountedPath: string | null = null

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

export default function YearEndSupportAsk() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const excluded = EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))

  // Count pageviews per session; open on the second one.
  useEffect(() => {
    if (open || excluded) return
    if (Date.now() >= CAMPAIGN_END) return
    if (new URLSearchParams(window.location.search).get('support-ask') === '1') {
      setOpen(true)
      return
    }
    if (isSuppressed()) return

    let views = 0
    try {
      views = Number(sessionStorage.getItem(SESSION_VIEWS_KEY) ?? '0')
      if (lastCountedPath !== pathname) {
        lastCountedPath = pathname
        views += 1
        sessionStorage.setItem(SESSION_VIEWS_KEY, String(views))
      }
    } catch {}
    if (views >= 2) {
      setOpen(true)
      return
    }

    // Otherwise wait for 45s of visible time on this page.
    let visibleMs = 0
    let lastTick = Date.now()
    const interval = window.setInterval(() => {
      const now = Date.now()
      if (document.visibilityState === 'visible') visibleMs += now - lastTick
      lastTick = now
      if (visibleMs >= VISIBLE_DELAY_MS) {
        window.clearInterval(interval)
        setOpen(true)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [pathname, open, excluded])

  const dismiss = useCallback(() => {
    writeState('dismissed')
    track('Support Ask Dismissed', { campaign: CAMPAIGN_ID })
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    track('Support Ask Shown', { campaign: CAMPAIGN_ID })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  function onGive() {
    writeState('clicked')
    track('Support Clicked', { type: 'one_off', campaign: CAMPAIGN_ID })
    setOpen(false)
  }

  if (!open || excluded) return null

  return (
    <aside
      aria-label="Support this project"
      className="fixed inset-x-0 bottom-0 z-30 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[320px] motion-safe:animate-fade-in"
    >
      <div className="overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-lg sm:rounded-xl">
        <div
          aria-hidden="true"
          className="h-1.5"
          style={{
            background:
              'repeating-linear-gradient(90deg, var(--color-oxblood) 0 14px, #2F5D2A 14px 28px)',
          }}
        />
        <div className="relative px-5 pb-5 pt-4">
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
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#2F5D2A]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 2v20M4.9 6.9l14.2 10.2M19.1 6.9 4.9 17.1M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" />
            </svg>
            End-of-year appeal
          </p>
          <p className="mt-1.5 pr-6 font-serif text-xl leading-snug text-gray-900">
            Help keep these books findable
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            No ads, no paywall — just one person keeping a record of what gets
            banned. A one-time $5 covers about a day of hosting and data.
          </p>
          <a
            href={CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onGive}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-oxblood px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-oxblood/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
          >
            Give $5 once
          </a>
          <div className="mt-2.5 flex items-center justify-center gap-2 text-xs text-gray-500">
            <button type="button" onClick={dismiss} className="hover:text-gray-800 hover:underline">
              Maybe later
            </button>
            <span aria-hidden="true">·</span>
            <span>Secure checkout via Stripe</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
