// Shared delta-submission logic. Used by both the admin POST endpoint
// (cookie auth) and the Vercel cron GET endpoint (CRON_SECRET auth) so
// the eligibility rules and submission accounting stay in lockstep.

import { submitInBatches } from './indexnow'
import { SITEMAP_BASE_URL } from './sitemap-xml'
import { getSitemapStaticEntries } from './sitemap-static-entries'
import { adminClient } from './supabase'

// Genesis cutoff for the first run. Mirrors the launch month so a
// first-time submission captures everything created since the site went
// public.
const GENESIS_CUTOFF = '2026-01-01T00:00:00Z'

export type IndexNowDeltaResult = {
  ok: boolean
  status: number
  cutoff: string
  total: number
  batches: number
  books: number
  authors: number
  staticPages: number
  message?: string
  results?: Array<
    | { ok: true; status: number; count: number }
    | { ok: false; status: number; error: string; count: number }
  >
}

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

export async function runIndexNowDelta(): Promise<IndexNowDeltaResult> {
  if (!process.env.INDEXNOW_KEY) {
    return {
      ok: false,
      status: 503,
      cutoff: GENESIS_CUTOFF,
      total: 0,
      batches: 0,
      books: 0,
      authors: 0,
      staticPages: 0,
      message: 'INDEXNOW_KEY not configured',
    }
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

  // Static-URL diff: compare current sitemap-static entries against the
  // set recorded with the last successful submission so newly-added
  // landing pages (top-list destinations, /discover, …) get picked up.
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
    // Record the current static set even on a no-op so the next delta
    // call has a fresh baseline (handles legacy NULL static_urls rows).
    await supabase.from('indexnow_submissions').insert({
      kind: 'delta',
      url_count: 0,
      ok: true,
      status: 200,
      error: null,
      static_urls: currentStaticUrls,
    })
    return {
      ok: true,
      status: 200,
      cutoff,
      total: 0,
      batches: 0,
      books: 0,
      authors: 0,
      staticPages: 0,
      message: 'No new pages since last successful submission.',
    }
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

  return {
    ok: allOk,
    status: allOk ? 200 : 207,
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
  }
}
