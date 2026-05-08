import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/books/search?q=...
//
// Lightweight admin-side title search used by the Reading Club admin UI to
// pick books for manual tracks (Classics, Themes overrides) and BBW
// alternates. Returns a small projection — id, title, slug, authors,
// banCount, countryCount — enough to render a list row without further
// roundtrips.
//
// Title-only ILIKE search; query string under 2 chars returns []. Capped at
// 20 results.

type SearchResult = {
  id: number
  title: string
  slug: string
  authors: string[]
  banCount: number
  countryCount: number
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, slug,
      book_authors(authors(display_name)),
      bans(country_code)
    `)
    .ilike('title', `%${q}%`)
    .order('title')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: number
    title: string
    slug: string
    book_authors: { authors: { display_name: string } | null }[] | null
    bans: { country_code: string }[] | null
  }

  const results: SearchResult[] = (data as unknown as Row[] ?? []).map(b => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    authors: (b.book_authors ?? [])
      .map(ba => ba.authors?.display_name)
      .filter((s): s is string => !!s),
    banCount: (b.bans ?? []).length,
    countryCount: new Set((b.bans ?? []).map(x => x.country_code)).size,
  }))

  return NextResponse.json({ results })
}
