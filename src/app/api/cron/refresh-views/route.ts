import { type NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rising MVs only (7-day pageview window) — hourly. Ban-count MVs change only
  // on import and are refreshed by /api/cron/refresh-counts (daily) +
  // refresh_all_materialized_views() on demand after an import.
  const { error } = await adminClient().rpc('refresh_rising_materialized_views')
  // Incremental upsert of the last 2 UTC days into the pageviews_daily rollup
  // (admin Traffic chart). Index-scan over ~1 day of rows, a few ms.
  const { error: dailyError } = await adminClient().rpc('refresh_pageviews_daily')
  // Same window for the per-day country / referrer rollup behind the admin
  // Stats breakdowns (yesterday + today; a few thousand raw rows, no sort spill).
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const { error: dimError } = await adminClient().rpc('refresh_pageviews_daily_dim', {
    p_from: yesterday.toISOString().slice(0, 10),
    p_to: today.toISOString().slice(0, 10),
  })
  if (error || dailyError || dimError) {
    return NextResponse.json(
      { error: [error?.message, dailyError?.message, dimError?.message].filter(Boolean).join('; ') },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
