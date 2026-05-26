import type { NextRequest } from 'next/server'
import { searchBooks, parseBookSort } from '@/lib/book-search'

export const dynamic = 'force-dynamic'

// CDN-cache identical search-query responses on the edge for 10 minutes,
// serve stale for up to a day while refreshing. Popular searches (empty q,
// common authors, country filters) collapse to one origin hit per query
// string per region per 10 min instead of one per visitor keystroke.
// Errors are deliberately not cached.
const SEARCH_CACHE_HEADER = 'public, s-maxage=600, stale-while-revalidate=86400'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await searchBooks({
    q:          sp.get('q') ?? undefined,
    scope:      sp.get('scope') ?? undefined,
    country:    sp.get('country') ?? undefined,
    activeOnly: sp.get('activeOnly') === '1',
    reason:     sp.get('reason') ?? undefined,
    sort:       parseBookSort(sp.get('sort')),
    offset:     parseInt(sp.get('offset') ?? '0', 10),
    limit:      parseInt(sp.get('limit') ?? '48', 10),
  })

  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json(
    { books: result.books, total: result.total },
    { headers: { 'Cache-Control': SEARCH_CACHE_HEADER } },
  )
}
