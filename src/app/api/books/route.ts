import type { NextRequest } from 'next/server'
import { searchBooks, parseBookSort } from '@/lib/book-search'

export const dynamic = 'force-dynamic'

// CDN-cache identical search-query responses on the edge for 4 hours,
// serve stale for up to a day while refreshing. The catalogue changes at
// most daily, so popular searches (empty q, common authors, country
// filters) collapse to one origin hit per query string per region per 4h
// instead of one per visitor keystroke.
// Errors are deliberately not cached.
const SEARCH_CACHE_HEADER = 'public, s-maxage=14400, stale-while-revalidate=86400'

// Public endpoint: clamp paging so `?limit=100000` cannot pull the whole
// catalogue (Supabase egress) or blow past PostgREST limits. The browsers
// request ≤ 96 per page; deep offsets beyond the catalogue return [].
const MAX_LIMIT = 96
const MAX_OFFSET = 25_000

function clampInt(raw: string | null, fallback: number, max: number): number {
  const n = parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, max)
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await searchBooks({
    q:          sp.get('q') ?? undefined,
    scope:      sp.get('scope') ?? undefined,
    country:    sp.get('country') ?? undefined,
    activeOnly: sp.get('activeOnly') === '1',
    reason:     sp.get('reason') ?? undefined,
    year:       Number.isFinite(parseInt(sp.get('year') ?? '', 10)) ? parseInt(sp.get('year')!, 10) : undefined,
    sort:       parseBookSort(sp.get('sort')),
    offset:     clampInt(sp.get('offset'), 0, MAX_OFFSET),
    limit:      clampInt(sp.get('limit'), 48, MAX_LIMIT),
  })

  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json(
    { books: result.books, total: result.total },
    { headers: { 'Cache-Control': SEARCH_CACHE_HEADER } },
  )
}
