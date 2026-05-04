'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Analytics } from '@vercel/analytics/react'

export default function AnalyticsWrapper() {
  const pathname = usePathname()
  // Start blocked until the client confirms no internal-user cookie.
  // This keeps the SSR and initial hydration outputs consistent (both null).
  const [internalUser, setInternalUser] = useState(true)

  useEffect(() => {
    setInternalUser(document.cookie.includes('bb_internal=true'))
  }, [])

  if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') return null
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return null
  if (internalUser) return null

  return <Analytics />
}
