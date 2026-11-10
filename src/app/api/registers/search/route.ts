import type { NextRequest } from 'next/server'
import { searchRegisterEntries } from '@/lib/registers'

export const dynamic = 'force-dynamic'

// Same edge policy as /api/books: identical queries collapse to one origin hit
// per 4 hours. Register lists change only on an import. Errors are not cached.
const CACHE_HEADER = 'public, s-maxage=14400, stale-while-revalidate=86400'

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  try {
    const hits = await searchRegisterEntries(q)
    return Response.json({ hits }, { headers: { 'Cache-Control': CACHE_HEADER } })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'search failed' }, { status: 500 })
  }
}
