'use client'

import { useEffect } from 'react'
import { track } from '@vercel/analytics'

type Props = {
  sessionId: string
  amountTotal: number | null
  currency: string | null
}

export default function TrackDatasetPurchase({ sessionId, amountTotal, currency }: Props) {
  useEffect(() => {
    const key = `bb_track_dataset_${sessionId}`
    try {
      if (window.localStorage.getItem(key)) return
      window.localStorage.setItem(key, '1')
    } catch {
      // localStorage unavailable (private mode etc.) — fall through and fire anyway.
    }
    track('Dataset Purchased', {
      sessionId,
      amountTotal: amountTotal ?? null,
      currency: currency ?? null,
    })
  }, [sessionId, amountTotal, currency])
  return null
}
