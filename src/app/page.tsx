export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookBrowser, { type Book, type NewsPreview, type CountryOption } from '@/components/book-browser'
import HighlightsStrip, { type HighlightItem, type HighlightSlot, type AuthorHighlightItem } from '@/components/highlights-strip'
import CatalogueNav from '@/components/catalogue-nav'
import TrendingWidget from '@/components/trending-widget'
import RisingWidget from '@/components/rising-widget'
import TrendingTabs from '@/components/trending-tabs'

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('books').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    title: 'Banned Books — International Catalogue of Censored Literature',
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse by country, genre, and reason.`,
    alternates: { canonical: '/' },
  }
}

// Lightweight type for stats computation — never sent to the client
type BookLight = {
  id: number
  title: string
  slug: string
  openlibrary_work_id: string | null
  isbn13: string | null
  first_published_year: number | null
  description_book: string | null
  bans: { id: number; status: string; country_code: string; year_started: number | null }[]
}

const LIGHT_SELECT = 'id, title, slug, openlibrary_work_id, isbn13, first_published_year, description_book, bans(id, status, country_code, year_started)'

const FULL_SELECT = `
  id, title, slug, cover_url, description_book, openlibrary_work_id, isbn13, first_published_year, genres,
  book_authors(authors(display_name)),
  bans(
    id, status, country_code, year_started,
    countries(name_en),
    scopes(slug, label_en),
    ban_reason_links(reasons(slug))
  )
`

export default async function HomePage() {
  const supabase = adminClient()
  let fetchError: string | null = null

  // ── Lightweight fetch of all books for stats — server only ────────────────────
  let allBooksLight: BookLight[] = []
  try {
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('books').select(LIGHT_SELECT).order('title').range(offset, offset + PAGE - 1)
      if (error) { fetchError = error.message; break }
      allBooksLight = allBooksLight.concat((data as unknown as BookLight[]) ?? [])
      if (!data || data.length < PAGE) break
      offset += PAGE
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  const totalCount = allBooksLight.length

  // ── Pick book of the day — deterministic per calendar date ──────────────────
  const eligible = allBooksLight.filter(b => b.description_book)
  const seed = new Date().toISOString().slice(0, 10)
  const idx = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % eligible.length
  const pickedLight = eligible.length > 0 ? eligible[idx] : null

  // ── Highlight slot IDs: most banned (in-memory) + trending #1 + all-time #1 ──
  const featuredId = pickedLight?.id ?? null
  const mostBannedLight = [...allBooksLight]
    .filter(b => b.id !== featuredId)
    .sort((a, b) => b.bans.length - a.bans.length)[0] ?? null

  // ── Parallel: initial 48 books + featured + news + countries + trending IDs ──
  const [
    { data: initialBooksRaw },
    { data: featuredRaw },
    { data: newsRaw },
    { data: banCounts },
    { data: countriesRaw },
    trendingThisWeekRes,
    trendingAllTimeRes,
    bannedAuthorsRes,
    trendingAuthorsThisWeekRes,
    trendingAuthorsAllTimeRes,
  ] = await Promise.all([
    supabase.from('books').select(FULL_SELECT).order('title').range(0, 47),
    pickedLight
      ? supabase.from('books').select(FULL_SELECT).eq('id', pickedLight.id).single()
      : Promise.resolve({ data: null }),
    supabase.from('news_items').select('id, title, source_name, published_at, summary')
      .eq('status', 'published').order('published_at', { ascending: false }).limit(3),
    supabase.from('mv_ban_counts').select('country_code, total_bans').gt('total_bans', 0),
    supabase.from('countries').select('code, name_en'),
    supabase.from('v_top_books_this_week').select('entity_id, views').limit(10),
    supabase.from('v_top_books_all_time').select('entity_id, views').limit(10),
    supabase.from('v_top_banned_authors').select('entity_id, total_bans, banned_books').limit(10),
    supabase.from('v_top_authors_this_week').select('entity_id, views').limit(10),
    supabase.from('v_top_authors_all_time').select('entity_id, views').limit(10),
  ])

  const initialBooks = (initialBooksRaw as unknown as Book[]) ?? []
  const featuredBook = featuredRaw as unknown as Book | null
  const latestNews = (newsRaw ?? []) as NewsPreview[]

  // ── Resolve trending IDs, dedupe against featured + most banned ─────────────
  const used = new Set<number>([featuredId, mostBannedLight?.id ?? null].filter((v): v is number => v !== null))

  const trendingThisWeekRows = (trendingThisWeekRes.data as { entity_id: number; views: number }[] | null) ?? []
  const trendingId = trendingThisWeekRows.find(r => !used.has(Number(r.entity_id)))
  if (trendingId) used.add(Number(trendingId.entity_id))

  const trendingAllTimeRows = (trendingAllTimeRes.data as { entity_id: number; views: number }[] | null) ?? []
  const allTimeId = trendingAllTimeRows.find(r => !used.has(Number(r.entity_id)))

  // ── Fetch full data for highlight books in one round-trip ───────────────────
  const highlightIds: number[] = []
  if (mostBannedLight) highlightIds.push(mostBannedLight.id)
  if (trendingId) highlightIds.push(Number(trendingId.entity_id))
  if (allTimeId) highlightIds.push(Number(allTimeId.entity_id))

  const { data: highlightBooksRaw } = highlightIds.length > 0
    ? await supabase.from('books').select(FULL_SELECT).in('id', highlightIds)
    : { data: null }
  const highlightBooks = (highlightBooksRaw as unknown as Book[]) ?? []
  const bookById = new Map(highlightBooks.map(b => [b.id, b]))

  const highlights: HighlightItem[] = []
  if (mostBannedLight && bookById.has(mostBannedLight.id)) {
    const b = bookById.get(mostBannedLight.id)!
    const countries = new Set(b.bans.map(x => x.country_code)).size
    highlights.push({
      slot: 'most-banned' as HighlightSlot,
      book: b,
      context: `${b.bans.length} ${b.bans.length === 1 ? 'ban' : 'bans'} across ${countries} ${countries === 1 ? 'country' : 'countries'}`,
    })
  }
  if (trendingId && bookById.has(Number(trendingId.entity_id))) {
    highlights.push({
      slot: 'trending' as HighlightSlot,
      book: bookById.get(Number(trendingId.entity_id))!,
      context: '',
    })
  }
  if (allTimeId && bookById.has(Number(allTimeId.entity_id))) {
    highlights.push({
      slot: 'all-time' as HighlightSlot,
      book: bookById.get(Number(allTimeId.entity_id))!,
      context: '',
    })
  }

  // ── Author highlights: most banned + trending #1 + all-time #1, deduped ─────
  const usedAuthors = new Set<number>()
  const bannedAuthorRows = (bannedAuthorsRes.data as { entity_id: number; total_bans: number; banned_books: number }[] | null) ?? []
  const bannedAuthor = bannedAuthorRows.find(r => !usedAuthors.has(Number(r.entity_id)))
  if (bannedAuthor) usedAuthors.add(Number(bannedAuthor.entity_id))

  const trendingAuthorRows = (trendingAuthorsThisWeekRes.data as { entity_id: number; views: number }[] | null) ?? []
  const trendingAuthor = trendingAuthorRows.find(r => !usedAuthors.has(Number(r.entity_id)))
  if (trendingAuthor) usedAuthors.add(Number(trendingAuthor.entity_id))

  const allTimeAuthorRows = (trendingAuthorsAllTimeRes.data as { entity_id: number; views: number }[] | null) ?? []
  const allTimeAuthor = allTimeAuthorRows.find(r => !usedAuthors.has(Number(r.entity_id)))

  const authorIds = [...usedAuthors, allTimeAuthor ? Number(allTimeAuthor.entity_id) : null].filter((v): v is number => v !== null)
  const { data: authorsRaw } = authorIds.length > 0
    ? await supabase.from('authors').select('id, display_name, slug, photo_url').in('id', authorIds)
    : { data: null }
  const authorById = new Map(((authorsRaw ?? []) as { id: number; display_name: string; slug: string; photo_url: string | null }[]).map(a => [a.id, a]))

  const authorHighlights: AuthorHighlightItem[] = []
  if (bannedAuthor && authorById.has(Number(bannedAuthor.entity_id))) {
    authorHighlights.push({
      slot: 'most-banned' as HighlightSlot,
      author: authorById.get(Number(bannedAuthor.entity_id))!,
      context: `${bannedAuthor.total_bans.toLocaleString('en')} ${bannedAuthor.total_bans === 1 ? 'ban' : 'bans'} across ${bannedAuthor.banned_books} ${bannedAuthor.banned_books === 1 ? 'book' : 'books'}`,
    })
  }
  if (trendingAuthor && authorById.has(Number(trendingAuthor.entity_id))) {
    authorHighlights.push({
      slot: 'trending' as HighlightSlot,
      author: authorById.get(Number(trendingAuthor.entity_id))!,
      context: '',
    })
  }
  if (allTimeAuthor && authorById.has(Number(allTimeAuthor.entity_id))) {
    authorHighlights.push({
      slot: 'all-time' as HighlightSlot,
      author: authorById.get(Number(allTimeAuthor.entity_id))!,
      context: '',
    })
  }

  // ── Countries for dropdown ────────────────────────────────────────────────────
  const countMap = new Map((banCounts ?? []).map(r => [r.country_code, r.total_bans as number]))
  const countries: CountryOption[] = (countriesRaw ?? [])
    .filter(c => countMap.has(c.code))
    .sort((a, b) => a.name_en.localeCompare(b.name_en))
    .map(c => ({ code: c.code, name: c.name_en, count: countMap.get(c.code) ?? 0 }))

  const countryCount = countries.length

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-2">
          The World&apos;s Books Under Censorship
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400">
          {totalCount.toLocaleString('en')} books documented across {countryCount} {countryCount === 1 ? 'country' : 'countries'} — real bans, real sources.{' '}
          <Link href="/stats" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            See statistics →
          </Link>
          {' · '}
          <Link href="/top-100-banned-books" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            100 most banned books →
          </Link>
          {' · '}
          <Link href="/banned-classics" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            Banned classics →
          </Link>
        </p>
      </div>
      <div className="mb-5">
        <CatalogueNav />
      </div>
      {fetchError && (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50 mb-5">
          Could not load books: {fetchError}
        </p>
      )}
      {!fetchError && (
        <BookBrowser
          initialBooks={initialBooks}
          totalCount={totalCount}
          latestNews={latestNews}
          featuredBook={featuredBook}
          countries={countries}
          highlightsSlot={<HighlightsStrip items={highlights} authorItems={authorHighlights} />}
          trendingSlot={
            <TrendingTabs
              key="trending-tabs"
              trendingSlot={<TrendingWidget compact showHeader={false} mode="all-time" />}
              risingSlot={<RisingWidget compact />}
            />
          }
        />
      )}
    </main>
  )
}
