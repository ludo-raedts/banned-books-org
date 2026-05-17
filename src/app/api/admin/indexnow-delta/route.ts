import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { submitInBatches } from '@/lib/indexnow'
import { SITEMAP_BASE_URL } from '@/lib/sitemap-xml'
import { getSitemapStaticEntries } from '@/lib/sitemap-static-entries'
import { adminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

// Genesis cutoff: when there has never been a successful submission, look back
// this far. Mirrors the launch month so a first-time click submits everything
// that's been created since the site went public.
const GENESIS_CUTOFF = '2026-01-01T00:00:00Z'

async function fetchSlugsCreatedAfter(
  table: 'books' | 'authors',
  cutoff: string,
): Promise<string[]> {
  const supabase = adminClient()
  const slugs: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('slug')
      .gt('created_at', cutoff)
      .not('slug', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (row.slug) slugs.push(row.slug)
    }
    if (data.length < 1000) break
    offset += 1000
  }
  return slugs
}

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

  const supabase = adminClient()
  const { data: lastOk } = await supabase
    .from('indexnow_submissions')
    .select('submitted_at, static_urls')
    .eq('ok', true)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cutoff = lastOk?.submitted_at ?? GENESIS_CUTOFF

  // Static-URL diff: compare the current static-entry set against the set
  // recorded with the last successful submission. NULL static_urls on the
  // last row = legacy (pre-migration 20260517100000_indexnow_static_urls);
  // re-submit the full current static set once to re-baseline, then future
  // calls only diff against the new baseline.
  const currentStaticEntries = await getSitemapStaticEntries()
  const currentStaticUrls = currentStaticEntries.map((e) => e.loc)
  const lastStaticUrls = Array.isArray(lastOk?.static_urls)
    ? (lastOk.static_urls as unknown[]).filter((v): v is string => typeof v === 'string')
    : null
  const lastStaticSet = lastStaticUrls ? new Set(lastStaticUrls) : null
  const newStaticUrls = lastStaticSet
    ? currentStaticUrls.filter((u) => !lastStaticSet.has(u))
    : currentStaticUrls

  const [bookSlugs, authorSlugs] = await Promise.all([
    fetchSlugsCreatedAfter('books', cutoff),
    fetchSlugsCreatedAfter('authors', cutoff),
  ])

  const urls = [
    ...bookSlugs.map((slug) => `${SITEMAP_BASE_URL}/books/${slug}`),
    ...authorSlugs.map((slug) => `${SITEMAP_BASE_URL}/authors/${slug}`),
    ...newStaticUrls,
  ]

  if (urls.length === 0) {
    // Record the current static set even on no-op so the next delta call
    // has a fresh baseline to diff against (handles the case where last
    // submission's static_urls was NULL but nothing else changed since).
    await supabase.from('indexnow_submissions').insert({
      kind: 'delta',
      url_count: 0,
      ok: true,
      status: 200,
      error: null,
      static_urls: currentStaticUrls,
    })
    return NextResponse.json({
      ok: true,
      cutoff,
      total: 0,
      books: 0,
      authors: 0,
      staticPages: 0,
      message: 'No new pages since last successful submission.',
    })
  }

  const summary = await submitInBatches(urls)
  const allOk = summary.results.every((r) => r.ok)
  const firstFailed = summary.results.find((r) => !r.ok)
  const firstStatus = summary.results[0]?.status ?? 0

  await supabase.from('indexnow_submissions').insert({
    kind: 'delta',
    url_count: summary.total,
    ok: allOk,
    status: firstStatus,
    error: firstFailed && !firstFailed.ok ? firstFailed.error : null,
    static_urls: currentStaticUrls,
  })

  return NextResponse.json(
    {
      ok: allOk,
      cutoff,
      total: summary.total,
      batches: summary.batches,
      books: bookSlugs.length,
      authors: authorSlugs.length,
      staticPages: newStaticUrls.length,
      results: summary.results.map((r) =>
        r.ok
          ? { ok: true, status: r.status, count: r.submitted.length }
          : { ok: false, status: r.status, error: r.error, count: r.submitted?.length ?? 0 },
      ),
    },
    { status: allOk ? 200 : 207 },
  )
}
