import { NextRequest, NextResponse } from 'next/server'
import { runIndexNowDelta } from '@/lib/indexnow-delta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily IndexNow ping. The delta logic only submits books, authors, and
// static landing pages that did NOT appear in the previous successful
// submission — so a deploy that adds /discover (or any new landing
// page in sitemap-static-entries) gets crawled within ~24h of going
// live, with no human in the loop. Same logic as the admin button.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runIndexNowDelta()
  if (result.status === 503) {
    return NextResponse.json({ error: result.message ?? 'unavailable' }, { status: 503 })
  }
  return NextResponse.json(result, { status: result.status })
}
