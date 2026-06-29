'use client'

import { track } from '@vercel/analytics'
import type { ReactNode } from 'react'

type Props = {
  className?: string
  priceUsd: number
  children: ReactNode
}

export default function DatasetCheckoutButton({ className, priceUsd, children }: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        // The form POSTs to /api/dataset/checkout which 303-redirects to Stripe
        // (another origin). Firing track() in the same tick as the navigation
        // risks the analytics beacon being dropped before it leaves the page.
        // Hold the submit briefly so the beacon flushes first.
        const form = e.currentTarget.form
        if (!form) return
        e.preventDefault()
        track('Dataset Checkout Clicked', { priceUsd })
        setTimeout(() => form.submit(), 150)
      }}
    >
      {children}
    </button>
  )
}
