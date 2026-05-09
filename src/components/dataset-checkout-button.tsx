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
      onClick={() => {
        track('Dataset Checkout Clicked', { priceUsd })
      }}
    >
      {children}
    </button>
  )
}
