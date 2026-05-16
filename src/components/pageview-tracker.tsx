'use client'

import { useEffect } from 'react'

// Fire-and-forget pageview tracker. Replaces the previous server-side
// trackPageview() call inside each detail page, which had forced those
// pages to be `force-dynamic`. With tracking moved to a post-hydration
// fetch, the detail pages can use `revalidate = 3600` and serve cached
// HTML on a ~50ms TTFB instead of ~500ms.
//
// Bot detection runs server-side in the /api/pageview route — same
// User-Agent / Accept-Language signals as before. document.referrer is
// passed in the POST body because the route's Referer header would be
// the page itself, not the navigation source.

type Props = {
  entityType: 'book' | 'author'
  entityId: number
}

export default function PageviewTracker({ entityType, entityId }: Props) {
  useEffect(() => {
    // sendBeacon when available: survives a fast page-close better than fetch.
    const payload = JSON.stringify({
      entity_type: entityType,
      entity_id: entityId,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    })
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon('/api/pageview', blob)
        return
      }
    } catch {
      // Fall through to fetch
    }
    void fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* swallow */ })
  }, [entityType, entityId])

  return null
}
