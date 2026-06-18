import { NextRequest, NextResponse } from 'next/server'
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

  const { error } = await adminClient().rpc('refresh_ban_count_materialized_views')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
