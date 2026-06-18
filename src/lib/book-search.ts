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
  year?: number
  activeOnly?: boolean
  offset?: number
  limit?: number
  sort?: BookSort
}

// Supabase caps a plain .select() at 1000 rows, so any filter that maps over a
// large table (bans for the US, ban_reason_links for 'political') silently
// truncates without pagination — e.g. reason=political returned 913 of 5788
// books. Page through with a stable .order() until the rows run out. The caller
// supplies a factory that applies .order().range(from, to).
async function paginateAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data } = await make(from, from + 999)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

export type BookSearchResult = {
  books: unknown[]
  total: number
  error?: string
}

// The catalogue cards render only: ban count (bans.length), the country label
// (country_code + one countries.name_en), and up to two reason badges
// (ban_reason_links → reasons.slug). id/status/year_started/scopes were embedded
// but never read by any consumer (book-browser, search-client, ReasonCatalogue
// doesn't even read bans) — dropping them removes a scopes LATERAL join per ban
// row and ~halves the payload on heavily-banned titles.
const SELECT = `
  id, title, slug, cover_url, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
  book_authors(authors(display_name)),
  bans(
    country_code,
    countries(name_en),
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
  const year       = params.year && Number.isFinite(params.year) ? params.year : 0
  const sort       = params.sort ?? DEFAULT_BOOK_SORT
  const offset     = Math.max(0, params.offset ?? 0)
  const limit      = Math.min(100, Math.max(1, params.limit ?? 48))

  const supabase = adminClient()
  const hasFilters = !!(q || scope || country || activeOnly || reason || year)

  // ── No filters: page directly off books, ordering depends on sort ──────────
  if (!hasFilters) {
    if (sort === 'alpha') {
      const { data, count, error } = await supabase
        .from('books').select(SELECT, { count: 'exact' })
        .eq('is_gated', false)
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
      .from('books').select(SELECT).eq('is_gated', false).in('id', pageIds)
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
    const rows = await paginateAll<{ book_id: number }>((f, t) =>
      supabase.from('bans').select('book_id').eq('country_code', country).order('id').range(f, t))
    idSets.push(new Set(rows.map(b => b.book_id)))
  }

  if (activeOnly) {
    const rows = await paginateAll<{ book_id: number }>((f, t) =>
      supabase.from('bans').select('book_id').eq('status', 'active').order('id').range(f, t))
    idSets.push(new Set(rows.map(b => b.book_id)))
  }

  if (year) {
    const rows = await paginateAll<{ book_id: number }>((f, t) =>
      supabase.from('bans').select('book_id').eq('year_started', year).order('id').range(f, t))
    idSets.push(new Set(rows.map(b => b.book_id)))
  }

  if (scope) {
    const { data: scopeRow } = await supabase.from('scopes').select('id').eq('slug', scope).single()
    if (!scopeRow) return { books: [], total: 0 }
    const rows = await paginateAll<{ book_id: number }>((f, t) =>
      supabase.from('bans').select('book_id').eq('scope_id', scopeRow.id).order('id').range(f, t))
    idSets.push(new Set(rows.map(b => b.book_id)))
  }

  if (reason) {
    const { data: reasonRow } = await supabase.from('reasons').select('id').eq('slug', reason).single()
    if (!reasonRow) return { books: [], total: 0 }
    // Paginate the links (popular reasons have >>1000), then chunk the ban→book
    // lookup so thousands of ban_ids don't blow the PostgREST URL-length cap.
    const links = await paginateAll<{ ban_id: number }>((f, t) =>
      supabase.from('ban_reason_links').select('ban_id').eq('reason_id', reasonRow.id).order('ban_id').range(f, t))
    if (!links.length) return { books: [], total: 0 }
    const banIds = links.map(l => l.ban_id)
    const bookIds = new Set<number>()
    const CHUNK = 500
    for (let i = 0; i < banIds.length; i += CHUNK) {
      const { data } = await supabase.from('bans').select('book_id').in('id', banIds.slice(i, i + CHUNK))
      for (const b of (data ?? []) as { book_id: number }[]) bookIds.add(b.book_id)
    }
    idSets.push(bookIds)
  }

  if (idSets.length === 0) return { books: [], total: 0 }
  const allIds = [...idSets[0]].filter(id => idSets.every(s => s.has(id)))
  if (allIds.length === 0) return { books: [], total: 0 }

  // Fetch sort keys for the matched ids in chunks — `.in('id', allIds)` with
  // thousands of ids would exceed the PostgREST URL-length cap (this is what
  // silently zeroed out large reason/country filters once they stopped being
  // truncated to 1000). Exclude gated here so `total` and paging match what
  // actually renders below, then sort in JS.
  const SORT_CHUNK = 500
  type SortRow = { id: number; title: string; created_at: string | null }
  const sortRows: SortRow[] = []
  for (let i = 0; i < allIds.length; i += SORT_CHUNK) {
    const { data } = await supabase
      .from('books').select('id, title, created_at')
      .eq('is_gated', false)
      .in('id', allIds.slice(i, i + SORT_CHUNK))
    if (data) sortRows.push(...(data as SortRow[]))
  }

  let sortedIds: number[]
  if (sort === 'alpha') {
    sortedIds = [...sortRows].sort((a, b) => a.title.localeCompare(b.title)).map(r => r.id)
  } else {
    const topIds = await topIdsForSort(supabase, sort)
    const rank = new Map<number, number>()
    topIds.forEach((id, i) => rank.set(id, i))
    // Head = view rank (popular/most-banned); tail = created_at DESC so newly
    // added books bubble above the alphabetical long tail (title as tiebreak).
    sortedIds = [...sortRows].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity
      const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity
      if (ra !== rb) return ra - rb
      const ca = a.created_at ?? '', cb = b.created_at ?? ''
      if (ca !== cb) return ca < cb ? 1 : -1
      return a.title.localeCompare(b.title)
    }).map(r => r.id)
  }

  const total = sortedIds.length
  const pageIds = sortedIds.slice(offset, offset + limit)
  if (pageIds.length === 0) return { books: [], total }

  const { data, error } = await supabase.from('books').select(SELECT).eq('is_gated', false).in('id', pageIds)
  if (error) return { books: [], total: 0, error: error.message }
  const byId = new Map(((data ?? []) as Array<{ id: number }>).map(b => [b.id, b]))
  const ordered = pageIds.map(id => byId.get(id)).filter(Boolean) as unknown[]
  return { books: ordered, total }
}
