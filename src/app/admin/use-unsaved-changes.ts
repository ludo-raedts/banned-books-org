'use client'

import { useEffect } from 'react'

// Warns before the tab is closed/reloaded or the page is left via a full
// navigation while there are unsaved edits. Note: Next's App Router client-side
// navigations (clicking a nav link) do not fire `beforeunload`, so edit forms
// should also surface a visible "unsaved changes" hint — this hook covers the
// close/refresh/external-link case, which is where silent data loss hurts most.
export function useUnsavedChanges(when: boolean) {
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])
}
