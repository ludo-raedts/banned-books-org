import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { submitInBatches } from '@/lib/indexnow'
import { getAllCanonicalUrls } from '@/lib/site-urls'
import { getSitemapStaticEntries } from '@/lib/sitemap-static-entries'
import { adminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  if (!process.env.INDEXNOW_KEY) {
    return NextResponse.json({ error: 'INDEXNOW_KEY not configured' }, { status: 503 })
  }

  const [urls, staticEntries] = await Promise.all([
    getAllCanonicalUrls(),
    getSitemapStaticEntries(),
  ])
  const summary = await submitInBatches(urls)

  const allOk = summary.results.every((r) => r.ok)
  const firstFailed = summary.results.find((r) => !r.ok)
  const firstStatus = summary.results[0]?.status ?? 0

  // Record the static URL set with the row so the delta endpoint can diff
  // current static URLs against this baseline on its next call and pick up
  // any newly-introduced static pages (top-list destinations etc.).
  await adminClient().from('indexnow_submissions').insert({
    kind: 'full',
    url_count: summary.total,
    ok: allOk,
    status: firstStatus,
    error: firstFailed && !firstFailed.ok ? firstFailed.error : null,
    static_urls: staticEntries.map((e) => e.loc),
  })

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
