import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await adminClient()
    .from('pageviews')
    .delete()
    .lt('viewed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  return Response.json({ ok: true })
}
