import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { runIndexNowDelta } from '@/lib/indexnow-delta'

export const runtime = 'nodejs'
export const maxDuration = 60

// Admin-triggered "Submit new pages" button on /admin/sitemap. The same
// delta-submission logic also runs daily via /api/cron/indexnow-delta —
// this manual path stays so admins can force an immediate ping right
// after deploying a content change.
export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const result = await runIndexNowDelta()
  if (result.status === 503) {
    return NextResponse.json({ error: result.message ?? 'unavailable' }, { status: 503 })
  }
  return NextResponse.json(result, { status: result.status })
}
