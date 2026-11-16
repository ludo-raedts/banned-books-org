import { type NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RETENTION_DAYS = 90
// One unbounded DELETE over a large backlog runs into the service_role
// statement_timeout (~8s, 57014) and hammers Disk IO. Delete in small batches
// via the viewed_at index instead, inside a time budget; the next daily run
// continues where this one stopped.
const BATCH = 2000
const TIME_BUDGET_MS = 45_000

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = adminClient()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const started = Date.now()
  let deleted = 0

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: rows, error: selectError } = await sb
      .from('pageviews')
      .select('id')
      .lt('viewed_at', cutoff)
      .order('viewed_at', { ascending: true })
      .limit(BATCH)
    if (selectError) {
      console.error('[cleanup-pageviews] select failed', selectError)
      return NextResponse.json({ error: selectError.message, deleted }, { status: 500 })
    }
    if (!rows || rows.length === 0) return NextResponse.json({ ok: true, deleted, done: true })

    const { error: deleteError } = await sb
      .from('pageviews')
      .delete()
      .in('id', rows.map((r) => r.id))
    if (deleteError) {
      console.error('[cleanup-pageviews] delete failed', deleteError)
      return NextResponse.json({ error: deleteError.message, deleted }, { status: 500 })
    }
    deleted += rows.length
    if (rows.length < BATCH) return NextResponse.json({ ok: true, deleted, done: true })
  }

  // Budget used up with rows left: not an error, tomorrow's run continues.
  return NextResponse.json({ ok: true, deleted, done: false })
}
