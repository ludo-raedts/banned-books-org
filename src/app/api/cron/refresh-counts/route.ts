import { type NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Ban-count aggregate MVs (mv_ban_counts, mv_country_reason_counts,
// mv_book_scope_counts) only change on import, so a daily refresh is plenty.
// The "rising" pageview MVs refresh separately and hourly via
// /api/cron/refresh-views; a full on-demand refresh after a big import is
// available through /api/admin/refresh-views and scripts/refresh-mv.ts.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = adminClient()
  const { error } = await sb.rpc('refresh_ban_count_materialized_views')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Only refresh_all_materialized_views() stamps 'last_refreshed', so the admin
  // "Materialized views · Last refresh" stuck at 2026-09-03 while this daily
  // refresh kept the counts current. Stamp it here too (fail-soft).
  await sb.from('mv_refresh_log').upsert({ key: 'last_refreshed', updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return NextResponse.json({ ok: true })
}
