import { adminClient } from '@/lib/supabase'
import { countryCodeForQuery } from '@/lib/country-aliases'

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
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  // Pages are fetched WAVE at a time in parallel: same rows and DB work as a
  // sequential walk (at most WAVE-1 empty tail pages extra), but US (~40 pages)
  // no longer pays 40 round trips back to back. Errors throw — a swallowed
  // page error used to yield a silently partial result that /api/books then
  // cached at the CDN for hours.
  const WAVE = 4
  const out: T[] = []
  for (let from = 0; ; from += WAVE * 1000) {
    const pages = await Promise.all(
      Array.from({ length: WAVE }, (_, i) => make(from + i * 1000, from + i * 1000 + 999)),
    )
    for (const { data, error } of pages) {
      if (error) throw new Error(error.message)
      out.push(...(data ?? []))
      if (!data || data.length < 1000) return out
    }
  }
}

// Run chunked lookups WAVE at a time; throw on the first error (see paginateAll).
async function inWaves<T>(tasks: (() => PromiseLike<{ data: T[] | null; error: { message: string } | null }>)[]): Promise<T[]> {
  const WAVE = 4
  const out: T[] = []
  for (let i = 0; i < tasks.length; i += WAVE) {
    for (const { data, error } of await Promise.all(tasks.slice(i, i + WAVE).map(t => t()))) {
      if (error) throw new Error(error.message)
      out.push(...(data ?? []))
    }
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
// Gated (CSAM-adjacent policy, Bucket B) works ARE findable in search — the
// interstitial on the record page is the warning — but result cards must never
// carry their cover or blurb. Strip both here so no consumer can render them.
function hideGatedMedia<T>(rows: T[]): T[] {
  return rows.map(r => {
    const b = r as { is_gated?: boolean }
    return b.is_gated ? ({ ...r, cover_url: null, description_book: null } as T) : r
  })
}

const SELECT = `
  id, title, slug, is_gated, cover_url, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
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
// Errors are returned, not swallowed: a timed-out view used to yield [] and the
// page silently fell back to the created_at tail, which /search then cached for
// an hour as "popular" (2026-11-09, DB slow after a bulk import).
async function topIdsForSort(
  supabase: ReturnType<typeof adminClient>,
  sort: BookSort,
): Promise<{ ids: number[]; error?: string }> {
  // entity_id is the stable tiebreaker — without it, ties on views/total_bans
  // shuffle between calls, so the server-rendered first page and a client-side
  // loadMore can return overlapping IDs (duplicate React keys).
  if (sort === 'popular') {
    const { data, error } = await supabase
      .from('v_top_books_all_time').select('entity_id, views')
      .order('views', { ascending: false })
      .order('entity_id', { ascending: true })
    return { ids: (data ?? []).map(r => Number(r.entity_id)), error: error?.message }
  }
  if (sort === 'bans') {
    const { data, error } = await supabase
      .from('v_top_banned_books').select('entity_id, total_bans')
      .order('total_bans', { ascending: false })
      .order('entity_id', { ascending: true })
    return { ids: (data ?? []).map(r => Number(r.entity_id)), error: error?.message }
  }
  return { ids: [] }
}

// Cards need the ban COUNT, the distinct countries and the reason slugs — not
// every district-level row. A US title with 70 PEN district bans shipped 70
// {country_code, countries, ban_reason_links} objects in the RSC payload (≈75%
// of /search and /reasons/* HTML). Collapse to one row per country with the
// union of its reasons, and carry the true count in ban_count.
type RawBan = { country_code: string; countries: { name_en: string } | null; ban_reason_links: { reasons: { slug: string } | null }[] }
function compactBans(books: unknown[]): unknown[] {
  return books.map(b => {
    const book = b as { bans?: RawBan[] }
    if (!Array.isArray(book.bans)) return b
    const byCountry = new Map<string, { country_code: string; countries: RawBan['countries']; slugs: Set<string> }>()
    for (const ban of book.bans) {
      const e = byCountry.get(ban.country_code) ?? { country_code: ban.country_code, countries: ban.countries, slugs: new Set<string>() }
      for (const l of ban.ban_reason_links ?? []) if (l.reasons?.slug) e.slugs.add(l.reasons.slug)
      byCountry.set(ban.country_code, e)
    }
    return {
      ...book,
      ban_count: book.bans.length,
      bans: [...byCountry.values()].map(e => ({
        country_code: e.country_code,
        countries: e.countries,
        ban_reason_links: [...e.slugs].map(slug => ({ reasons: { slug } })),
      })),
    }
  })
}

export async function searchBooks(params: BookSearchParams): Promise<BookSearchResult> {
  let res: BookSearchResult
  try {
    res = await searchBooksRaw(params)
  } catch (e) {
    return { books: [], total: 0, error: e instanceof Error ? e.message : String(e) }
  }
  return { ...res, books: compactBans(res.books) }
}

async function searchBooksRaw(params: BookSearchParams): Promise<BookSearchResult> {
  const q          = params.q?.trim() ?? ''
  const scope      = params.scope ?? ''
  const country    = params.country ?? ''
  const activeOnly = !!params.activeOnly
  const reason     = params.reason ?? ''
  const year       = params.year && Number.isFinite(params.year) ? params.year : 0
  const sort       = params.sort ?? DEFAULT_BOOK_SORT
  // Number.isFinite guards against NaN from parseInt on junk query strings
  // (?limit=abc) — NaN survives Math.min/max and turns .range() into a 500.
  const offset     = Number.isFinite(params.offset) ? Math.max(0, params.offset!) : 0
  const limit      = Number.isFinite(params.limit) ? Math.min(100, Math.max(1, params.limit!)) : 48

  const supabase = adminClient()
  const hasFilters = !!(q || scope || country || activeOnly || reason || year)

  // ── No filters: page directly off books, ordering depends on sort ──────────
  if (!hasFilters) {
    if (sort === 'alpha') {
      const { data, count, error } = await supabase
        .from('books').select(SELECT, { count: 'exact' })
        .order('title')
        .range(offset, offset + limit - 1)
      if (error) return { books: [], total: 0, error: error.message }
      return { books: hideGatedMedia(data ?? []), total: count ?? 0 }
    }

    // popular / bans: head = topIds from the view (≤100), tail = rest of
    // books ordered by created_at DESC (title as tiebreaker).
    const { ids: topIds, error: topError } = await topIdsForSort(supabase, sort)
    if (topError) return { books: [], total: 0, error: topError }
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
      const { data, error: tailError } = await tailQ
      if (tailError) return { books: [], total: 0, error: tailError.message }
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
    return { books: hideGatedMedia(ordered), total: totalCount ?? 0 }
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
    // "DDR" / "GDR" / "East Germany": the query names a jurisdiction, so it
    // matches books banned there (ban rows, see country-aliases.ts) INSTEAD of
    // a substring scan: "ddr" would otherwise hit "…unddreissig…" in unrelated titles.
    const aliasCode = countryCodeForQuery(q)
    const [{ data: titleHits }, { data: authorHits }] = aliasCode
      ? [{ data: null }, { data: null }]
      : await Promise.all([
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
    if (aliasCode) {
      const rows = await paginateAll<{ id: number; book_id: number }>((f, t) =>
        supabase.from('bans').select('id, book_id').eq('country_code', aliasCode).order('id').range(f, t))
      rows.forEach(r => ids.add(r.book_id))
    }
    idSets.push(ids)
  }

  // Country, year, active status, institution scope and reason are all facts
  // about ONE ban. They are applied to the same ban rows, not intersected as
  // separate book sets: otherwise "United States + 2026" returned a book banned
  // in the US in 2019 and in France in 2026 (UX review 2026-11-11, step 9).
  if (country || activeOnly || year || scope || reason) {
    let scopeId: number | null = null
    if (scope) {
      const { data: scopeRow } = await supabase.from('scopes').select('id').eq('slug', scope).single()
      if (!scopeRow) return { books: [], total: 0 }
      scopeId = scopeRow.id as number
    }

    let reasonBanIds: Set<number> | null = null
    if (reason) {
      const { data: reasonRow } = await supabase.from('reasons').select('id').eq('slug', reason).single()
      if (!reasonRow) return { books: [], total: 0 }
      // Paginate the links (popular reasons have >>1000).
      const links = await paginateAll<{ ban_id: number }>((f, t) =>
        supabase.from('ban_reason_links').select('ban_id').eq('reason_id', reasonRow.id).order('ban_id').range(f, t))
      if (!links.length) return { books: [], total: 0 }
      reasonBanIds = new Set(links.map(l => l.ban_id))
    }

    if (country || activeOnly || year || scopeId !== null) {
      const rows = await paginateAll<{ id: number; book_id: number }>((f, t) => {
        let qb = supabase.from('bans').select('id, book_id')
        if (country) qb = qb.eq('country_code', country)
        if (activeOnly) qb = qb.eq('status', 'active')
        if (year) qb = qb.eq('year_started', year)
        if (scopeId !== null) qb = qb.eq('scope_id', scopeId)
        return qb.order('id').range(f, t)
      })
      const kept = reasonBanIds ? rows.filter(r => reasonBanIds.has(r.id)) : rows
      idSets.push(new Set(kept.map(r => r.book_id)))
    } else if (reasonBanIds) {
      // Reason only: chunk the ban→book lookup so thousands of ban_ids don't
      // blow the PostgREST URL-length cap.
      const banIds = [...reasonBanIds]
      const CHUNK = 500
      const chunks: number[][] = []
      for (let i = 0; i < banIds.length; i += CHUNK) chunks.push(banIds.slice(i, i + CHUNK))
      const bans = await inWaves<{ book_id: number }>(chunks.map(c => () =>
        supabase.from('bans').select('book_id').in('id', c)))
      idSets.push(new Set(bans.map(b => b.book_id)))
    }
  }

  if (idSets.length === 0) return { books: [], total: 0 }
  const allIds = [...idSets[0]].filter(id => idSets.every(s => s.has(id)))
  if (allIds.length === 0) return { books: [], total: 0 }

  // Fetch sort keys for the matched ids in chunks — `.in('id', allIds)` with
  // thousands of ids would exceed the PostgREST URL-length cap (this is what
  // silently zeroed out large reason/country filters once they stopped being
  // truncated to 1000). Then sort in JS.
  const SORT_CHUNK = 500
  type SortRow = { id: number; title: string; created_at: string | null }
  const sortChunks: number[][] = []
  for (let i = 0; i < allIds.length; i += SORT_CHUNK) sortChunks.push(allIds.slice(i, i + SORT_CHUNK))
  const sortRows = await inWaves<SortRow>(sortChunks.map(c => () =>
    supabase.from('books').select('id, title, created_at').in('id', c)))

  let sortedIds: number[]
  if (sort === 'alpha') {
    sortedIds = [...sortRows].sort((a, b) => a.title.localeCompare(b.title)).map(r => r.id)
  } else {
    const { ids: topIds, error: topError } = await topIdsForSort(supabase, sort)
    if (topError) return { books: [], total: 0, error: topError }
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

  const { data, error } = await supabase.from('books').select(SELECT).in('id', pageIds)
  if (error) return { books: [], total: 0, error: error.message }
  const byId = new Map(((data ?? []) as Array<{ id: number }>).map(b => [b.id, b]))
  const ordered = pageIds.map(id => byId.get(id)).filter(Boolean) as unknown[]
  return { books: hideGatedMedia(ordered), total }
}
