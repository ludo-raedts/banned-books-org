export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import BookBrowser, { type Book, type NewsPreview, type CountryOption } from '@/components/book-browser'
import HighlightsStrip, { type HighlightItem, type HighlightSlot, type AuthorHighlightItem } from '@/components/highlights-strip'
import CatalogueNav from '@/components/catalogue-nav'
import TrendingWidget from '@/components/trending-widget'
import RisingWidget from '@/components/rising-widget'
import TrendingTabs from '@/components/trending-tabs'

export async function generateMetadata(): Promise<Metadata> {
  const timer = newTimer('metadata')
  // Planner statistic — close enough for an SEO description, avoids a COUNT(*) scan.
  const { count } = await timer.wrap('books-count-estimated', () =>
    adminClient().from('books').select('*', { count: 'estimated', head: true }),
  )
  timer.end('metadata-fn-end')
  const n = count ?? 0
  return {
    title: 'Banned Books — International Catalogue of Censored Literature',
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse by country, genre, and reason.`,
    alternates: { canonical: '/' },
  }
}

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
  const timer = newTimer('home')
  const supabase = adminClient()
  let fetchError: string | null = null

  // Three small queries replace the old "fetch every book" loop:
  //   - total count for the H1 sub-line
  //   - eligible count (books with description) → idx for book-of-the-day
  //   - top-banned book ids → "most banned" highlight slot
  const [totalCountRes, eligibleCountRes, topBannedRes] = await timer.wrap(
    'homepage-stats-parallel-3',
    () => Promise.all([
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }).not('description_book', 'is', null),
      supabase.from('v_top_banned_books').select('entity_id, total_bans').limit(2),
    ]),
  )

  const totalCount = totalCountRes.count ?? 0
  const eligibleCount = eligibleCountRes.count ?? 0
  if (totalCountRes.error) fetchError = totalCountRes.error.message
  else if (eligibleCountRes.error) fetchError = eligibleCountRes.error.message

  // ── Pick book of the day — deterministic offset into title-ordered eligibles ──
  const seed = new Date().toISOString().slice(0, 10)
  const seedSum = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const idx = eligibleCount > 0 ? seedSum % eligibleCount : 0

  const { data: pickedArr } = eligibleCount > 0
    ? await timer.wrap('book-of-the-day', () =>
        supabase.from('books').select('id').not('description_book', 'is', null).order('title').range(idx, idx),
      )
    : { data: null as { id: number }[] | null }
  const pickedLight = (pickedArr?.[0] as { id: number } | undefined) ?? null

  // ── Highlight slot IDs: most banned (deduped vs featured) ───────────────────
  const featuredId = pickedLight?.id ?? null
  const topBannedRows = (topBannedRes.data ?? []) as { entity_id: number; total_bans: number }[]
  const mostBannedRow = topBannedRows.find(r => Number(r.entity_id) !== featuredId) ?? null
  const mostBannedId: number | null = mostBannedRow ? Number(mostBannedRow.entity_id) : null

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
  ] = await timer.wrap('parallel-batch-10', () => Promise.all([
    supabase.from('books').select(FULL_SELECT).order('title').range(0, 47),
    pickedLight
      ? supabase.from('books').select(FULL_SELECT).eq('id', pickedLight.id).single()
      : Promise.resolve({ data: null }),
    supabase.from('news_items').select('id, title, source_name, published_at, summary, source_language')
      .eq('status', 'published').order('published_at', { ascending: false }).limit(3),
    supabase.from('mv_ban_counts').select('country_code, total_bans').gt('total_bans', 0),
    supabase.from('countries').select('code, name_en'),
    supabase.from('v_top_books_this_week').select('entity_id, views').limit(10),
    supabase.from('v_top_books_all_time').select('entity_id, views').limit(10),
    supabase.from('v_top_banned_authors').select('entity_id, total_bans, banned_books').limit(10),
    supabase.from('v_top_authors_this_week').select('entity_id, views').limit(10),
    supabase.from('v_top_authors_all_time').select('entity_id, views').limit(10),
  ]))

  const initialBooks = (initialBooksRaw as unknown as Book[]) ?? []
  const featuredBook = featuredRaw as unknown as Book | null
  const latestNews = (newsRaw ?? []) as NewsPreview[]

  // ── Resolve trending IDs, dedupe against featured + most banned ─────────────
  const used = new Set<number>([featuredId, mostBannedId].filter((v): v is number => v !== null))

  const trendingThisWeekRows = (trendingThisWeekRes.data as { entity_id: number; views: number }[] | null) ?? []
  const trendingId = trendingThisWeekRows.find(r => !used.has(Number(r.entity_id)))
  if (trendingId) used.add(Number(trendingId.entity_id))

  const trendingAllTimeRows = (trendingAllTimeRes.data as { entity_id: number; views: number }[] | null) ?? []
  const allTimeId = trendingAllTimeRows.find(r => !used.has(Number(r.entity_id)))

  // ── Fetch full data for highlight books in one round-trip ───────────────────
  const highlightIds: number[] = []
  if (mostBannedId !== null) highlightIds.push(mostBannedId)
  if (trendingId) highlightIds.push(Number(trendingId.entity_id))
  if (allTimeId) highlightIds.push(Number(allTimeId.entity_id))

  const { data: highlightBooksRaw } = highlightIds.length > 0
    ? await timer.wrap('highlight-books', () =>
        supabase.from('books').select(FULL_SELECT).in('id', highlightIds),
        { ids: highlightIds.length })
    : { data: null }
  const highlightBooks = (highlightBooksRaw as unknown as Book[]) ?? []
  const bookById = new Map(highlightBooks.map(b => [b.id, b]))

  const highlights: HighlightItem[] = []
  if (mostBannedId !== null && bookById.has(mostBannedId)) {
    const b = bookById.get(mostBannedId)!
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
    ? await timer.wrap('highlight-authors', () =>
        supabase.from('authors').select('id, display_name, slug, photo_url').in('id', authorIds),
        { ids: authorIds.length })
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

  timer.end()

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
