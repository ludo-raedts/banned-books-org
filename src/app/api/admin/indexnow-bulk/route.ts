import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { submitInBatches } from '@/lib/indexnow'
import { getAllCanonicalUrls } from '@/lib/site-urls'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.INDEXNOW_KEY) {
    return NextResponse.json({ error: 'INDEXNOW_KEY not configured' }, { status: 503 })
  }

  const urls = await getAllCanonicalUrls()
  const summary = await submitInBatches(urls)

  const allOk = summary.results.every((r) => r.ok)
  return NextResponse.json(
    {
      total: summary.total,
      batches: summary.batches,
      ok: allOk,
      results: summary.results.map((r) =>
        r.ok
          ? { ok: true, status: r.status, count: r.submitted.length }
          : { ok: false, status: r.status, error: r.error, count: r.submitted?.length ?? 0 },
      ),
    },
    { status: allOk ? 200 : 207 },
  )
}
