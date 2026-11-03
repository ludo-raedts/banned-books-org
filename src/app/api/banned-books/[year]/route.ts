import type { NextRequest } from 'next/server'
import { getYearBooks, YEAR_LIST_CAP } from '@/lib/year-books'

export const dynamic = 'force-dynamic'

// "Show more" pages for /banned-books/[year]: same list and order as the page,
// YEAR_LIST_CAP rows per request. Edge-cached like /api/books (the catalogue
// changes at most daily), so one origin sweep per offset per region per 4h.
const CACHE_HEADER = 'public, s-maxage=14400, stale-while-revalidate=86400'
const CURRENT_YEAR = new Date().getFullYear()

export async function GET(request: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params
  const yearNum = parseInt(year, 10)
  if (!Number.isFinite(yearNum) || yearNum < 1000 || yearNum > CURRENT_YEAR + 1) {
    return Response.json({ error: 'invalid year' }, { status: 400 })
  }
  const raw = parseInt(request.nextUrl.searchParams.get('offset') ?? '', 10)
  const offset = Number.isFinite(raw) && raw >= 0 ? raw : YEAR_LIST_CAP

  const { books } = await getYearBooks(yearNum)
  return Response.json(
    { books: books.slice(offset, offset + YEAR_LIST_CAP), total: books.length },
    { headers: { 'Cache-Control': CACHE_HEADER } },
  )
}
