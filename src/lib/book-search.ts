import { adminClient } from '@/lib/supabase'

export type BookSort = 'popular' | 'bans' | 'alpha'

export const DEFAULT_BOOK_SORT: BookSort = 'popular'

export function parseBookSort(raw: string | undefined | null): BookSort {
  return raw === 'alpha' || raw === 'bans' || raw === 'popular' ? raw : DEFAULT_BOOK_SORT
}

export type BookSearchParams = {
  q?: string
  country?: string
  scope?: string
  reason?: string
  activeOnly?: boolean
  offset?: number
  limit?: number
  sort?: BookSort
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

// v_top_books_all_time / v_top_banned_books are both LIMIT 100 inside the view.
// We pull the ordered ID list once and use it as the head of the sort, then
// fill the tail with the rest of the catalogue ordered by created_at DESC
// (so newly added books bubble up above the alphabetical long tail rather
// than being buried — cold-start mitigation for popularity).
async function topIdsForSort(
  supabase: ReturnType<typeof adminClient>,
  sort: BookSort,
): Promise<number[]> {
  // entity_id is the stable tiebreaker — without it, ties on views/total_bans
  // shuffle between calls, so the server-rendered first page and a client-side
  // loadMore can return overlapping IDs (duplicate React keys).
  if (sort === 'popular') {
    const { data } = await supabase
      .from('v_top_books_all_time').select('entity_id, views')
      .order('views', { ascending: false })
      .order('entity_id', { ascending: true })
    return (data ?? []).map(r => Number(r.entity_id))
  }
  if (sort === 'bans') {
    const { data } = await supabase
      .from('v_top_banned_books').select('entity_id, total_bans')
      .order('total_bans', { ascending: false })
      .order('entity_id', { ascending: true })
    return (data ?? []).map(r => Number(r.entity_id))
  }
  return []
}

export async function searchBooks(params: BookSearchParams): Promise<BookSearchResult> {
  const q          = params.q?.trim() ?? ''
  const scope      = params.scope ?? ''
  const country    = params.country ?? ''
  const activeOnly = !!params.activeOnly
  const reason     = params.reason ?? ''
  const sort       = params.sort ?? DEFAULT_BOOK_SORT
  const offset     = Math.max(0, params.offset ?? 0)
  const limit      = Math.min(100, Math.max(1, params.limit ?? 48))

  const supabase = adminClient()
  const hasFilters = !!(q || scope || country || activeOnly || reason)

  // ── No filters: page directly off books, ordering depends on sort ──────────
  if (!hasFilters) {
    if (sort === 'alpha') {
      const { data, count, error } = await supabase
        .from('books').select(SELECT, { count: 'exact' })
        .order('title')
        .range(offset, offset + limit - 1)
      if (error) return { books: [], total: 0, error: error.message }
      return { books: data ?? [], total: count ?? 0 }
    }

    // popular / bans: head = topIds from the view (≤100), tail = rest of
    // books ordered by created_at DESC (title as tiebreaker).
    const topIds = await topIdsForSort(supabase, sort)
    const topCount = topIds.length

    const headSlice =
      offset < topCount ? topIds.slice(offset, Math.min(offset + limit, topCount)) : []
    const needTail = limit - headSlice.length

    let tailIds: number[] = []
    if (needTail > 0) {
      const tailOffset = Math.max(0, offset - topCount)
      let tailQ = supabase
        .from('books').select('id')
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('title')
        .range(tailOffset, tailOffset + needTail - 1)
      if (topIds.length > 0) tailQ = tailQ.not('id', 'in', `(${topIds.join(',')})`)
      const { data } = await tailQ
      tailIds = (data ?? []).map(r => Number(r.id))
    }

    const pageIds = [...headSlice, ...tailIds]
    const { count: totalCount } = await supabase
      .from('books').select('*', { count: 'exact', head: true })

    if (pageIds.length === 0) return { books: [], total: totalCount ?? 0 }

    const { data: hydrated, error } = await supabase
      .from('books').select(SELECT).in('id', pageIds)
    if (error) return { books: [], total: 0, error: error.message }
    const byId = new Map(((hydrated ?? []) as Array<{ id: number }>).map(b => [b.id, b]))
    const ordered = pageIds.map(id => byId.get(id)).filter(Boolean) as unknown[]
    return { books: ordered, total: totalCount ?? 0 }
  }

  // ── Filters: collect sets of matching book IDs per condition, then intersect ──
  const idSets: Set<number>[] = []

  // Text search — match across all 4 title variants (so a query for
  // "The Book of Sadegh Hedayat" finds the canonical "ketāb-e sādeq-e hedāyat"
  // via title_english_meaningful, and vice versa) plus author name.
  // PostgREST's `or()` accepts comma-separated conditions; ilike values are
  // wrapped with % wildcards for substring match.
  if (q) {
    const lq = `%${q}%`
    const titleOr =
      `title.ilike.${lq},` +
      `title_native.ilike.${lq},` +
      `title_transliterated.ilike.${lq},` +
      `title_english_meaningful.ilike.${lq}`
    const [{ data: titleHits }, { data: authorHits }] = await Promise.all([
      supabase.from('books').select('id').or(titleOr),
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

  // Sort the intersected set.
  let sortedIds: number[]
  if (sort === 'alpha') {
    const { data: sorted } = await supabase
      .from('books').select('id').in('id', allIds).order('title')
    sortedIds = sorted?.map(b => b.id as number) ?? allIds
  } else {
    const topIds = await topIdsForSort(supabase, sort)
    const rank = new Map<number, number>()
    topIds.forEach((id, i) => rank.set(id, i))
    // Pull intersected ids in created_at DESC order as the tail tiebreaker;
    // stable-sort by rank puts the popular/most-banned head first and leaves
    // the rest in created_at DESC order.
    const { data: tail } = await supabase
      .from('books').select('id').in('id', allIds)
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('title')
    sortedIds = (tail ?? []).map(r => r.id as number)
    sortedIds.sort((a, b) => {
      const ra = rank.has(a) ? rank.get(a)! : Infinity
      const rb = rank.has(b) ? rank.get(b)! : Infinity
      return ra === rb ? 0 : ra - rb
    })
  }

  const total = sortedIds.length
  const pageIds = sortedIds.slice(offset, offset + limit)
  if (pageIds.length === 0) return { books: [], total }

  const { data, error } = await supabase.from('books').select(SELECT).in('id', pageIds)
  if (error) return { books: [], total: 0, error: error.message }
  const byId = new Map(((data ?? []) as Array<{ id: number }>).map(b => [b.id, b]))
  const ordered = pageIds.map(id => byId.get(id)).filter(Boolean) as unknown[]
  return { books: ordered, total }
}
