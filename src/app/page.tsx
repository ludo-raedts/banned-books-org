// ISR: regenerate every 30 minutes. The homepage renders a daily-rotating
// "book of the day" plus five top-lists whose source views (v_top_books_*,
// mv_top_books_rising, v_top_banned_authors, ban_reason_links) only update
// on aggregation cycles. 30 min keeps the feel live, drops TTFB from
// 600ms+ (old force-dynamic batch) to ~50ms on cached hits, and lifts
// Core Web Vitals LCP on the highest-PageRank URL on the site.
export const revalidate = 1800

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { coverAlt } from '@/lib/cover-alt'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import CatalogueNav from '@/components/catalogue-nav'
import {
  TopListBooksSection,
  TopListAuthorsSection,
  TopListByReasonSection,
} from '@/components/top-list-section'
import type { TopListBook, TopListAuthor } from '@/components/top-list-card'
import { reasonLabel } from '@/components/reason-badge'
import {
  TOP_LIST_BOOK_SELECT,
  type TopListBookRow,
  authorNameOf,
  banContext,
  isNonLatin,
  langContext,
  toBookCard,
} from '@/lib/top-list-data'

export async function generateMetadata(): Promise<Metadata> {
  const timer = newTimer('metadata')
  // Planner-estimated count: close enough for the meta description, avoids a
  // full COUNT(*) scan on every metadata revalidation.
  const { count } = await timer.wrap('books-count-estimated', () =>
    adminClient().from('books').select('*', { count: 'estimated', head: true }),
  )
  timer.end('metadata-fn-end')
  const n = count ?? 0
  return {
    title: 'Banned Books — International Catalogue of Censored Literature',
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse trending titles, rising titles, the most-banned authors, and books originally written outside English.`,
    alternates: { canonical: '/' },
  }
}

// Daily-pick language gate — keep English readers on Latin-script titles.
// The non-Latin titles surface elsewhere (their own homepage section + a
// dedicated /non-english-banned-books page).
const LATIN_SCRIPT_LANGS = [
  'en','es','fr','de','nl','it','pt','ca','gl','eu',
  'sv','da','no','nb','nn','fi','is',
  'pl','cs','sk','hu','ro','hr','sl','lv','lt','et','sq','bs',
  'tr','id','ms','vi','tl','sw','af','cy','ga','mt','lb','la',
] as const
const DAILY_PICK_LANG_FILTER =
  `original_language.in.(${LATIN_SCRIPT_LANGS.join(',')}),original_language.is.null`

const REASON_SLUGS = ['lgbtq', 'sexual', 'political', 'religious', 'racial'] as const

export default async function HomePage() {
  const timer = newTimer('home')
  const supabase = adminClient()

  const [
    totalCountRes,
    eligibleCountRes,
    trendingRes,
    bannedAuthorsRes,
    topBannedRes,
    risingRes,
    countriesRes,
    banCountsRes,
    placeholderAuthorsRes,
    reasonsRes,
  ] = await timer.wrap('parallel-batch-10', () => Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true })
      .not('description_book', 'is', null).or(DAILY_PICK_LANG_FILTER),
    supabase.from('v_top_books_this_week').select('entity_id, views').limit(10),
    supabase.from('v_top_banned_authors').select('entity_id, total_bans, banned_books').limit(30),
    supabase.from('v_top_banned_books').select('entity_id, total_bans').limit(100),
    supabase.from('mv_top_books_rising').select('entity_id, this_week, prev_week').limit(10),
    supabase.from('countries').select('code, name_en'),
    supabase.from('mv_ban_counts').select('country_code, total_bans').gt('total_bans', 0),
    supabase.from('authors').select('id').eq('is_placeholder', true),
    supabase.from('reasons').select('id, slug').in('slug', REASON_SLUGS),
  ]))

  const total = totalCountRes.count ?? 0
  const eligible = eligibleCountRes.count ?? 0
  const seed = new Date().toISOString().slice(0, 10)
  const seedSum = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const idx = eligible > 0 ? seedSum % eligible : 0

  const { data: pickArr } = eligible > 0
    ? await timer.wrap('book-of-the-day', () =>
        supabase.from('books').select('id').not('description_book', 'is', null)
          .or(DAILY_PICK_LANG_FILTER).order('title').range(idx, idx),
      )
    : { data: null as { id: number }[] | null }
  const pickId = pickArr?.[0]?.id ?? null

  const trendingIds = ((trendingRes.data ?? []) as { entity_id: number }[]).map(r => Number(r.entity_id))
  const risingRows = (risingRes.data ?? []) as { entity_id: number; this_week: number; prev_week: number }[]
  const risingIds = risingRows.map(r => Number(r.entity_id))
  const topBannedRows = (topBannedRes.data ?? []) as { entity_id: number; total_bans: number }[]
  const placeholderIds = new Set(((placeholderAuthorsRes.data ?? []) as { id: number }[]).map(a => a.id))
  const bannedAuthorRows = ((bannedAuthorsRes.data ?? []) as { entity_id: number; total_bans: number; banned_books: number }[])
    .filter(r => !placeholderIds.has(Number(r.entity_id)))
    .slice(0, 10)
  const bannedAuthorIds = bannedAuthorRows.map(r => Number(r.entity_id))

  // ── Aggregate top-3 books per reason in a single paginated round-trip ─────
  const reasons = ((reasonsRes.data ?? []) as { id: number; slug: string }[])
  const reasonIdToSlug = new Map(reasons.map(r => [r.id, r.slug]))
  const reasonIds = reasons.map(r => r.id)
  const byReason = new Map<string, Map<number, number>>()
  if (reasonIds.length > 0) {
    let offset = 0
    while (true) {
      const { data } = await timer.wrap('ban_reason_links-page', () =>
        supabase.from('ban_reason_links').select('reason_id, bans(book_id)')
          .in('reason_id', reasonIds).range(offset, offset + 999),
      )
      if (!data || data.length === 0) break
      for (const link of data as unknown as Array<{ reason_id: number; bans: { book_id: number } | null }>) {
        const slug = reasonIdToSlug.get(link.reason_id)
        const bookId = link.bans?.book_id
        if (!slug || !bookId) continue
        if (!byReason.has(slug)) byReason.set(slug, new Map())
        const m = byReason.get(slug)!
        m.set(bookId, (m.get(bookId) ?? 0) + 1)
      }
      if (data.length < 1000) break
      offset += 1000
    }
  }
  const reasonTopBookIds = new Map<string, number[]>()
  const reasonAllBookIds = new Set<number>()
  for (const slug of REASON_SLUGS) {
    const m = byReason.get(slug) ?? new Map<number, number>()
    const top3 = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id as number)
    reasonTopBookIds.set(slug, top3)
    top3.forEach(id => reasonAllBookIds.add(id))
  }

  // ── Single book-details fetch covers every list ──────────────────────────
  const allBookIds = new Set<number>()
  if (pickId) allBookIds.add(pickId)
  trendingIds.forEach(id => allBookIds.add(id))
  risingIds.forEach(id => allBookIds.add(id))
  topBannedRows.forEach(r => allBookIds.add(Number(r.entity_id)))
  reasonAllBookIds.forEach(id => allBookIds.add(id))

  const { data: allBooksRaw } = allBookIds.size > 0
    ? await timer.wrap('all-books', () =>
        supabase.from('books').select(TOP_LIST_BOOK_SELECT).in('id', [...allBookIds]),
        { ids: allBookIds.size })
    : { data: null }
  const allBooks = (allBooksRaw as unknown as TopListBookRow[]) ?? []
  const bookById = new Map(allBooks.map(b => [b.id, b]))

  const { data: authorsRaw } = bannedAuthorIds.length > 0
    ? await timer.wrap('authors', () =>
        supabase.from('authors').select('id, display_name, slug, photo_url').in('id', bannedAuthorIds),
        { ids: bannedAuthorIds.length })
    : { data: null }
  const authorById = new Map(
    ((authorsRaw ?? []) as { id: number; display_name: string; slug: string; photo_url: string | null }[])
      .map(a => [a.id, a]),
  )

  // ── Shape the lists ──────────────────────────────────────────────────────
  const trendingBooks: TopListBook[] = trendingIds
    .map(id => bookById.get(id))
    .filter((b): b is TopListBookRow => !!b)
    .map(b => toBookCard(b, banContext(b)))

  const risingBooks: TopListBook[] = risingRows
    .map(r => {
      const b = bookById.get(Number(r.entity_id))
      if (!b) return null
      const pct = r.prev_week > 0
        ? Math.round(((r.this_week - r.prev_week) / r.prev_week) * 100)
        : null
      const ctx = pct !== null && pct > 0 ? `↑${pct}% this week` : 'New this week'
      return toBookCard(b, ctx)
    })
    .filter((x): x is TopListBook => x !== null)

  const nonEnglishBooks: TopListBook[] = topBannedRows
    .map(r => bookById.get(Number(r.entity_id)))
    .filter((b): b is TopListBookRow => !!b)
    .filter(b => isNonLatin(b.original_language))
    .slice(0, 10)
    .map(b => toBookCard(b, langContext(b)))

  const bannedAuthors: TopListAuthor[] = bannedAuthorRows
    .map((r): TopListAuthor | null => {
      const a = authorById.get(Number(r.entity_id))
      if (!a) return null
      const totalBans = Number(r.total_bans)
      const banBooks = Number(r.banned_books)
      return {
        id: a.id,
        display_name: a.display_name,
        slug: a.slug,
        photo_url: a.photo_url,
        context: `${totalBans.toLocaleString('en')} ${totalBans === 1 ? 'ban' : 'bans'} across ${banBooks} ${banBooks === 1 ? 'book' : 'books'}`,
      }
    })
    .filter((a): a is TopListAuthor => a !== null)

  const reasonBlocks = REASON_SLUGS.map(slug => ({
    reasonSlug: slug,
    reasonLabel: reasonLabel(slug) ?? slug,
    books: (reasonTopBookIds.get(slug) ?? [])
      .map(id => bookById.get(id))
      .filter((b): b is TopListBookRow => !!b)
      .map(b => toBookCard(b, banContext(b))),
  }))

  const countMap = new Map((banCountsRes.data ?? []).map(r => [r.country_code, r.total_bans as number]))
  const countryCount = ((countriesRes.data ?? []) as { code: string }[]).filter(c => countMap.has(c.code)).length

  const pickBook = pickId ? bookById.get(pickId) : null

  timer.end()

  // ── Schema.org JSON-LD ───────────────────────────────────────────────────
  // WebSite + Organization on the homepage so Google can surface a sitelinks
  // search box for brand queries and so AI Overview has an entity anchor for
  // the catalogue.
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Banned Books',
    alternateName: 'banned-books.org',
    url: 'https://www.banned-books.org',
    description: `An international catalogue of ${total.toLocaleString('en')} books banned by governments, schools, and libraries worldwide.`,
    publisher: {
      '@type': 'Organization',
      name: 'Banned Books',
      url: 'https://www.banned-books.org',
      logo: 'https://www.banned-books.org/icon.svg',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.banned-books.org/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Banned Books',
    url: 'https://www.banned-books.org',
    logo: 'https://www.banned-books.org/icon.svg',
    description: 'An international catalogue of books banned by governments and schools worldwide. Documents censorship history, dates, scope, and source citations.',
  }

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(organizationJsonLd) }} />

      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-2">
          The World&apos;s Books Under Censorship
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400">
          {total.toLocaleString('en')} books documented across {countryCount} {countryCount === 1 ? 'country' : 'countries'} — real bans, real sources.{' '}
          <Link href="/stats" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            See statistics →
          </Link>
          {' · '}
          <Link href="/top-100-banned-books" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            100 most banned books →
          </Link>
        </p>
      </div>

      <CatalogueNav />

      {pickBook && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Book of the day</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            A daily pick from the catalogue. Rotates at midnight.
          </p>
          <Link
            href={`/books/${pickBook.slug}`}
            className="group block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors"
          >
            <div className="flex gap-4 sm:gap-6">
              <div className="shrink-0 w-24 sm:w-36 aspect-[2/3] relative overflow-hidden rounded shadow-md">
                {pickBook.cover_url ? (
                  <Image
                    src={pickBook.cover_url}
                    alt={coverAlt(pickBook.title, authorNameOf(pickBook))}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 144px, 96px"
                    priority
                  />
                ) : (
                  <BookCoverPlaceholder
                    title={pickBook.title}
                    author={authorNameOf(pickBook)}
                    slug={pickBook.slug}
                    className="absolute inset-0 w-full h-full"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand dark:group-hover:text-brand transition-colors line-clamp-2">
                  {pickBook.title}
                </h3>
                {authorNameOf(pickBook) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {authorNameOf(pickBook)}
                    {pickBook.first_published_year ? ` · ${pickBook.first_published_year}` : ''}
                  </p>
                )}
                {pickBook.description_book && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-4 leading-relaxed">
                    {pickBook.description_book}
                  </p>
                )}
                {banContext(pickBook) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{banContext(pickBook)}</p>
                )}
              </div>
            </div>
          </Link>
        </section>
      )}

      <TopListBooksSection
        title="Trending this week"
        subtitle="Books people read most over the last 7 days."
        viewAllHref="/trending-banned-books"
        books={trendingBooks}
      />

      <TopListAuthorsSection
        title="Most banned authors"
        subtitle="Writers censored across the most jurisdictions."
        viewAllHref="/most-banned-authors"
        authors={bannedAuthors}
      />

      <TopListBooksSection
        title="Rising this week"
        subtitle="Books gaining momentum compared to last week."
        viewAllHref="/rising-banned-books"
        books={risingBooks}
      />

      <TopListBooksSection
        title="Banned books not written in English"
        subtitle="The international half of the catalogue — translated, transliterated, suppressed."
        viewAllHref="/non-english-banned-books"
        books={nonEnglishBooks}
      />

      <TopListByReasonSection
        title="Why books get banned"
        subtitle="Three most-banned titles per top reason."
        blocks={reasonBlocks}
      />

      <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <Link
          href="/search"
          className="block text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-6 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors group"
        >
          <span className="text-base font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand dark:group-hover:text-brand transition-colors">
            Browse all {total.toLocaleString('en')} books →
          </span>
        </Link>
      </section>
    </main>
  )
}
