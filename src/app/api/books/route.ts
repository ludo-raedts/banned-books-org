import type { NextRequest } from 'next/server'
import { searchBooks } from '@/lib/book-search'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const result = await searchBooks({
    q:          sp.get('q') ?? undefined,
    scope:      sp.get('scope') ?? undefined,
    country:    sp.get('country') ?? undefined,
    activeOnly: sp.get('activeOnly') === '1',
    reason:     sp.get('reason') ?? undefined,
    offset:     parseInt(sp.get('offset') ?? '0', 10),
    limit:      parseInt(sp.get('limit') ?? '48', 10),
  })

  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ books: result.books, total: result.total })
}
