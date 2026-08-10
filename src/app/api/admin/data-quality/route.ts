import { type NextRequest, NextResponse } from 'next/server'
import { unstable_cache, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'

// Data-quality metrics for the admin dashboard.
//
// All counting, anti-joins and duplicate detection live in two SQL functions
// (admin_data_quality_counts / admin_data_quality_detail — see migration
// 20260807100000_admin_portal_load.sql). The previous implementation paginated
// whole tables through PostgREST to filter in JS: ~158 round-trips and ~3 MB
// per dashboard load, 10-15 MB per detail click.
//
// The counts only change when imports/enrichment run, so they sit behind a 1h
// cache; the card's Refresh button busts it via ?refresh=1.

export const maxDuration = 30

type Metric = {
  key: string
  label: string
  type: 'ban' | 'book'
  count: number
  total: number
  // Shown for visibility but excluded from the overall data-health score
  // (e.g. editorial classification — most books legitimately stay unclassified).
  informational?: boolean
}

async function fetchCountsUncached() {
  const sb = adminClient()
  const { data, error } = await sb.rpc('admin_data_quality_counts')
  if (error) throw new Error(`admin_data_quality_counts: ${error.message}`)
  const c = data as Record<string, number>

  const tb = c.total_bans ?? 0
  const tbooks = c.total_books ?? 0
  const tauthors = c.total_authors ?? 0

  const metrics: Metric[] = [
    { key: 'no_ban_reason', label: 'No ban reason', type: 'ban', count: c.no_ban_reason ?? 0, total: tb },
    { key: 'no_ban_year', label: 'No ban year', type: 'ban', count: c.no_ban_year ?? 0, total: tb },
    { key: 'no_source', label: 'No source / citation', type: 'ban', count: c.no_source ?? 0, total: tb },
    { key: 'no_ban_desc', label: 'No ban description', type: 'book', count: c.no_ban_desc ?? 0, total: tbooks },
    { key: 'no_author', label: 'No author linked', type: 'book', count: c.no_author ?? 0, total: tbooks },
    { key: 'no_genre', label: 'No genre', type: 'book', count: c.no_genre ?? 0, total: tbooks },
    { key: 'duplicates', label: 'Duplicate books', type: 'book', count: c.duplicates ?? 0, total: tbooks },
    { key: 'no_cover', label: 'No cover', type: 'book', count: c.no_cover ?? 0, total: tbooks },
    { key: 'no_description', label: 'No description', type: 'book', count: c.no_description ?? 0, total: tbooks },
    { key: 'no_isbn', label: 'No ISBN-13', type: 'book', count: c.no_isbn ?? 0, total: tbooks },
    { key: 'author_no_bio', label: 'Authors without bio', type: 'book', count: c.author_no_bio ?? 0, total: tauthors },
    { key: 'author_no_photo', label: 'Authors without photo', type: 'book', count: c.author_no_photo ?? 0, total: tauthors },
    {
      key: 'unclassified',
      label: 'Editorially unclassified',
      type: 'book',
      count: c.unclassified ?? 0,
      total: tbooks,
      informational: true,
    },
  ]

  return { totalBans: tb, totalBooks: tbooks, metrics, computedAt: new Date().toISOString() }
}

const CACHE_TAG = 'admin-data-quality'

const fetchCountsCached = unstable_cache(fetchCountsUncached, ['admin-dq-counts'], {
  revalidate: 3600,
  tags: [CACHE_TAG],
})

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const sp = new URL(req.url).searchParams
  const detail = sp.get('detail')
  const limit = Math.min(parseInt(sp.get('limit') ?? '100', 10), 500)

  try {
    if (detail) {
      const sb = adminClient()
      const { data, error } = await sb.rpc('admin_data_quality_detail', {
        metric: detail,
        max_rows: limit,
      })
      if (error) throw new Error(`admin_data_quality_detail: ${error.message}`)
      return NextResponse.json(data)
    }

    if (sp.get('refresh') === '1') revalidateTag(CACHE_TAG, 'max')
    return NextResponse.json(await fetchCountsCached())
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
