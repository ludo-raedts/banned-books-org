import { adminClient } from '@/lib/supabase'

export type BookSearchParams = {
  q?: string
  country?: string
  scope?: string
  reason?: string
  activeOnly?: boolean
  offset?: number
  limit?: number
}

export type BookSearchResult = {
  books: unknown[]
  total: number
  error?: string
}

const SELECT = `
  id, title, slug, cover_url, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
  book_authors(authors(display_name)),
  bans(
    id, status, country_code, year_started,
    countries(name_en),
    scopes(slug, label_en),
    ban_reason_links(reasons(slug))
  )
`

export async function searchBooks(params: BookSearchParams): Promise<BookSearchResult> {
  const q          = params.q?.trim() ?? ''
  const scope      = params.scope ?? ''
  const country    = params.country ?? ''
  const activeOnly = !!params.activeOnly
  const reason     = params.reason ?? ''
  const offset     = Math.max(0, params.offset ?? 0)
  const limit      = Math.min(100, Math.max(1, params.limit ?? 48))

  const supabase = adminClient()
  const hasFilters = !!(q || scope || country || activeOnly || reason)

  // ── No filters: simple paginated query ────────────────────────────────────────
  if (!hasFilters) {
    const { data, count, error } = await supabase
      .from('books')
      .select(SELECT, { count: 'exact' })
      .order('title')
      .range(offset, offset + limit - 1)
    if (error) return { books: [], total: 0, error: error.message }
    return { books: data ?? [], total: count ?? 0 }
  }

  // ── Filters: collect sets of matching book IDs per condition, then intersect ──
  const idSets: Set<number>[] = []

  // Text search — title OR author name
  if (q) {
    const lq = `%${q}%`
    const [{ data: titleHits }, { data: authorHits }] = await Promise.all([
      supabase.from('books').select('id').ilike('title', lq),
      supabase.from('authors').select('id').ilike('display_name', lq),
    ])
    const ids = new Set((titleHits ?? []).map(b => b.id as number))
    if (authorHits?.length) {
      const { data: byAuthor } = await supabase
        .from('book_authors').select('book_id')
        .in('author_id', authorHits.map(a => a.id))
      ;(byAuthor ?? []).forEach(b => ids.add(b.book_id as number))
    }
    idSets.push(ids)
  }

  if (country) {
    const { data } = await supabase.from('bans').select('book_id').eq('country_code', country)
    idSets.push(new Set((data ?? []).map(b => b.book_id as number)))
  }

  if (activeOnly) {
    const { data } = await supabase.from('bans').select('book_id').eq('status', 'active')
    idSets.push(new Set((data ?? []).map(b => b.book_id as number)))
  }

  if (scope) {
    const { data: scopeRow } = await supabase.from('scopes').select('id').eq('slug', scope).single()
    if (!scopeRow) return { books: [], total: 0 }
    const { data } = await supabase.from('bans').select('book_id').eq('scope_id', scopeRow.id)
    idSets.push(new Set((data ?? []).map(b => b.book_id as number)))
  }

  if (reason) {
    const { data: reasonRow } = await supabase.from('reasons').select('id').eq('slug', reason).single()
    if (!reasonRow) return { books: [], total: 0 }
    const { data: links } = await supabase
      .from('ban_reason_links').select('ban_id').eq('reason_id', reasonRow.id)
    if (!links?.length) return { books: [], total: 0 }
    const { data: bansForReason } = await supabase
      .from('bans').select('book_id').in('id', links.map(l => l.ban_id))
    idSets.push(new Set((bansForReason ?? []).map(b => b.book_id as number)))
  }

  if (idSets.length === 0) return { books: [], total: 0 }
  const allIds = [...idSets[0]].filter(id => idSets.every(s => s.has(id)))
  if (allIds.length === 0) return { books: [], total: 0 }

  const { data: sorted } = await supabase
    .from('books').select('id').in('id', allIds).order('title')
  const sortedIds = sorted?.map(b => b.id as number) ?? allIds

  const total = sortedIds.length
  const pageIds = sortedIds.slice(offset, offset + limit)
  if (pageIds.length === 0) return { books: [], total }

  const { data, error } = await supabase
    .from('books').select(SELECT).in('id', pageIds).order('title')
  if (error) return { books: [], total: 0, error: error.message }

  return { books: data ?? [], total }
}
