import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase'

async function auth(): Promise<boolean> {
  const cs = await cookies()
  const session = cs.get('admin_session')?.value
  return !!(process.env.ADMIN_SECRET && session === process.env.ADMIN_SECRET)
}

async function paginatedIds(
  sb: ReturnType<typeof adminClient>,
  table: string,
  col: string,
): Promise<Set<number>> {
  const ids = new Set<number>()
  let off = 0
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from(table as any) as any).select(col).range(off, off + 999)
    if (error) throw new Error(`${table}.${col}: ${error.message}`)
    if (!data?.length) break
    for (const r of data) ids.add((r as any)[col])
    if (data.length < 1000) break
    off += 1000
  }
  return ids
}

type Metric = {
  key: string
  label: string
  type: 'ban' | 'book'
  count: number
  total: number
}

async function fetchCounts(sb: ReturnType<typeof adminClient>) {
  const [
    { count: totalBans },
    { count: noYearBans },
    { count: totalBooks },
    { count: noCoverBooks },
    { count: noDescBooks },
    { count: noDescBanBooks },
    { count: noIsbnBooks },
    { count: totalAuthors },
    { count: noBioAuthors },
    { count: noPhotoAuthors },
  ] = await Promise.all([
    sb.from('bans').select('*', { count: 'exact', head: true }),
    sb.from('bans').select('*', { count: 'exact', head: true }).is('year_started', null),
    sb.from('books').select('*', { count: 'exact', head: true }),
    sb.from('books').select('*', { count: 'exact', head: true }).is('cover_url', null),
    sb.from('books').select('*', { count: 'exact', head: true }).is('description_book', null),
    sb.from('books').select('*', { count: 'exact', head: true }).is('description_ban', null),
    sb.from('books').select('*', { count: 'exact', head: true }).is('isbn13', null),
    sb.from('authors').select('*', { count: 'exact', head: true }),
    sb.from('authors').select('*', { count: 'exact', head: true }).is('bio', null),
    sb.from('authors').select('*', { count: 'exact', head: true }).is('photo_url', null),
  ])

  // No genre: genres defaults to '{}' (NOT NULL), check empty array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: noGenreBooks } = await (sb.from('books') as any)
    .select('*', { count: 'exact', head: true })
    .filter('genres', 'eq', '{}')

  const [banIdsWithReason, bookIdsWithAuthor] = await Promise.all([
    paginatedIds(sb, 'ban_reason_links', 'ban_id'),
    paginatedIds(sb, 'book_authors', 'book_id'),
  ])

  // Try ban_sources — may not have ban_id FK in current schema
  let banIdsWithSource: Set<number> | null = null
  try {
    banIdsWithSource = await paginatedIds(sb, 'ban_sources', 'ban_id')
  } catch {
    banIdsWithSource = null
  }

  // Duplicates: fetch all book titles
  const allTitles: Array<{ id: number; title: string }> = []
  let off = 0
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('books') as any).select('id, title').range(off, off + 999)
    if (!data?.length) break
    allTitles.push(...data)
    if (data.length < 1000) break
    off += 1000
  }
  const titleMap = new Map<string, number>()
  for (const b of allTitles) {
    const key = b.title.toLowerCase().trim()
    titleMap.set(key, (titleMap.get(key) ?? 0) + 1)
  }
  const dupCount = [...titleMap.values()].filter(c => c > 1).reduce((s, c) => s + c, 0)

  const tb = totalBans ?? 0
  const tbooks = totalBooks ?? 0
  const tauthors = totalAuthors ?? 0

  const metrics: Metric[] = [
    { key: 'no_ban_reason', label: 'No ban reason', type: 'ban', count: tb - banIdsWithReason.size, total: tb },
    { key: 'no_ban_year', label: 'No ban year', type: 'ban', count: noYearBans ?? 0, total: tb },
    ...(banIdsWithSource !== null
      ? [{ key: 'no_source', label: 'No source / citation', type: 'ban' as const, count: tb - banIdsWithSource.size, total: tb }]
      : []),
    { key: 'no_ban_desc', label: 'No ban description', type: 'book', count: noDescBanBooks ?? 0, total: tbooks },
    { key: 'no_author', label: 'No author linked', type: 'book', count: tbooks - bookIdsWithAuthor.size, total: tbooks },
    { key: 'no_genre', label: 'No genre', type: 'book', count: noGenreBooks ?? 0, total: tbooks },
    { key: 'duplicates', label: 'Duplicate books', type: 'book', count: dupCount, total: tbooks },
    { key: 'no_cover', label: 'No cover', type: 'book', count: noCoverBooks ?? 0, total: tbooks },
    { key: 'no_description', label: 'No description', type: 'book', count: noDescBooks ?? 0, total: tbooks },
    { key: 'no_isbn', label: 'No ISBN-13', type: 'book', count: noIsbnBooks ?? 0, total: tbooks },
    { key: 'author_no_bio', label: 'Authors without bio', type: 'book', count: noBioAuthors ?? 0, total: tauthors },
    { key: 'author_no_photo', label: 'Authors without photo', type: 'book', count: noPhotoAuthors ?? 0, total: tauthors },
  ]

  return { totalBans: tb, totalBooks: tbooks, metrics }
}

type BanDetailRow = {
  ban_id: number; book_title: string; book_slug: string
  author: string; country_code: string; year_started: number | null
}
type BookDetailRow = {
  book_id: number; title: string; slug: string
  author: string; ban_count: number; created_at: string | null
}
type DupDetailRow = {
  title: string; slug: string; author: string; count: number; first_created_at: string | null
}

async function fetchDetail(sb: ReturnType<typeof adminClient>, metric: string, limit: number) {
  // Anti-join ban metrics
  if (metric === 'no_ban_reason' || metric === 'no_source') {
    const table = metric === 'no_ban_reason' ? 'ban_reason_links' : 'ban_sources'
    let linkedIds: Set<number>
    try {
      linkedIds = await paginatedIds(sb, table, 'ban_id')
    } catch {
      linkedIds = new Set()
    }

    // Fetch all bans with book info (paginated)
    const allBans: Array<{
      id: number; year_started: number | null; country_code: string
      books: { title: string; slug: string; book_authors: Array<{ authors: { display_name: string } | null }> } | null
    }> = []
    let off = 0
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from('bans') as any)
        .select('id, year_started, country_code, books(title, slug, book_authors(authors(display_name)))')
        .range(off, off + 999)
      if (!data?.length) break
      allBans.push(...data)
      if (data.length < 1000) break
      off += 1000
    }

    const unlinked = allBans.filter(b => !linkedIds.has(b.id))
    const rows: BanDetailRow[] = unlinked.slice(0, limit).map(b => ({
      ban_id: b.id,
      book_title: b.books?.title ?? '',
      book_slug: b.books?.slug ?? '',
      author: (b.books?.book_authors ?? [])
        .map(ba => ba.authors?.display_name)
        .filter(Boolean).join(', '),
      country_code: b.country_code,
      year_started: b.year_started,
    }))

    return { rows, total: unlinked.length, type: 'ban' }
  }

  // Direct filter ban metric
  if (metric === 'no_ban_year') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('bans') as any)
      .select('id, year_started, country_code, books(title, slug, book_authors(authors(display_name)))')
      .is('year_started', null)
      .order('id')
      .range(0, limit - 1)

    const rows: BanDetailRow[] = (data ?? []).map((b: any) => ({
      ban_id: b.id,
      book_title: b.books?.title ?? '',
      book_slug: b.books?.slug ?? '',
      author: (b.books?.book_authors ?? [])
        .map((ba: any) => ba.authors?.display_name)
        .filter(Boolean).join(', '),
      country_code: b.country_code,
      year_started: null,
    }))

    const { count } = await sb.from('bans').select('*', { count: 'exact', head: true }).is('year_started', null)
    return { rows, total: count ?? rows.length, type: 'ban' }
  }

  // Anti-join book metric
  if (metric === 'no_author') {
    const bookIdsWithAuthor = await paginatedIds(sb, 'book_authors', 'book_id')

    const allBooks: Array<{
      id: number; title: string; slug: string; created_at: string | null
      bans: Array<{ id: number }>
    }> = []
    let off = 0
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from('books') as any)
        .select('id, title, slug, created_at, bans(id)')
        .order('title')
        .range(off, off + 999)
      if (!data?.length) break
      allBooks.push(...data)
      if (data.length < 1000) break
      off += 1000
    }

    const unlinked = allBooks.filter(b => !bookIdsWithAuthor.has(b.id))
    const rows: BookDetailRow[] = unlinked.slice(0, limit).map(b => ({
      book_id: b.id,
      title: b.title,
      slug: b.slug,
      author: '',
      ban_count: (b.bans ?? []).length,
      created_at: b.created_at,
    }))

    return { rows, total: unlinked.length, type: 'book' }
  }

  // Direct filter book metrics
  type BookFilter = { col?: string; isNull?: boolean; emptyArr?: boolean }
  const bookFilters: Record<string, BookFilter> = {
    no_ban_desc:   { col: 'description_ban', isNull: true },
    no_genre:      { col: 'genres', emptyArr: true },
    no_cover:      { col: 'cover_url', isNull: true },
    no_description: { col: 'description_book', isNull: true },
    no_isbn:       { col: 'isbn13', isNull: true },
  }

  if (metric in bookFilters) {
    const f = bookFilters[metric]

    function applyFilter(q: any): any {
      if (f.isNull) return q.is(f.col, null)
      if (f.emptyArr) return q.filter(f.col, 'eq', '{}')
      return q
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('books') as any)
      .select('id, title, slug, created_at, book_authors(authors(display_name)), bans(id)')
      .order('title')
      .range(0, limit - 1)
    q = applyFilter(q)
    const { data } = await q

    const rows: BookDetailRow[] = (data ?? []).map((b: any) => ({
      book_id: b.id,
      title: b.title,
      slug: b.slug,
      author: (b.book_authors ?? [])
        .map((ba: any) => ba.authors?.display_name)
        .filter(Boolean).join(', '),
      ban_count: (b.bans ?? []).length,
      created_at: b.created_at,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cq = (sb.from('books') as any).select('*', { count: 'exact', head: true })
    cq = applyFilter(cq)
    const { count } = await cq

    return { rows, total: count ?? rows.length, type: 'book' }
  }

  // Duplicates
  if (metric === 'duplicates') {
    const allBooks: Array<{
      id: number; title: string; slug: string; created_at: string | null
      book_authors: Array<{ authors: { display_name: string } | null }>
      bans: Array<{ id: number }>
    }> = []
    let off = 0
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from('books') as any)
        .select('id, title, slug, created_at, book_authors(authors(display_name)), bans(id)')
        .order('title')
        .range(off, off + 999)
      if (!data?.length) break
      allBooks.push(...data)
      if (data.length < 1000) break
      off += 1000
    }

    const groups = new Map<string, typeof allBooks>()
    for (const b of allBooks) {
      const key = b.title.toLowerCase().trim()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(b)
    }

    const rows: DupDetailRow[] = []
    for (const books of groups.values()) {
      if (books.length < 2) continue
      const earliest = books.reduce((a, b) =>
        (a.created_at ?? '') <= (b.created_at ?? '') ? a : b,
      )
      rows.push({
        title: books[0].title,
        slug: books[0].slug,
        author: (books[0].book_authors ?? [])
          .map(ba => ba.authors?.display_name)
          .filter(Boolean).join(', '),
        count: books.length,
        first_created_at: earliest.created_at,
      })
    }
    rows.sort((a, b) => b.count - a.count)

    return { rows: rows.slice(0, limit), total: rows.length, type: 'duplicates' }
  }

  // Author bio/photo metrics — reuse BookDetailRow shape (book_id = author_id)
  if (metric === 'author_no_bio' || metric === 'author_no_photo') {
    const col = metric === 'author_no_bio' ? 'bio' : 'photo_url'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, count } = await (sb.from('authors') as any)
      .select('id, display_name, slug, birth_year', { count: 'exact' })
      .is(col, null)
      .order('display_name')
      .range(0, limit - 1)
    const rows: BookDetailRow[] = (data ?? []).map((a: any) => ({
      book_id: a.id,
      title: a.display_name,
      slug: a.slug ?? '',
      author: a.birth_year ? String(a.birth_year) : '',
      ban_count: 0,
      created_at: null,
    }))
    return { rows, total: count ?? rows.length, type: 'book' }
  }

  return { rows: [], total: 0, type: 'unknown' }
}

export async function GET(req: NextRequest) {
  if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const detail = sp.get('detail')
  const limit = Math.min(parseInt(sp.get('limit') ?? '100'), 500)

  const sb = adminClient()

  try {
    if (detail) {
      return NextResponse.json(await fetchDetail(sb, detail, limit))
    }
    return NextResponse.json(await fetchCounts(sb))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
