// ISR: regenerate every 30 minutes. The homepage renders a daily-rotating
// "book of the day" plus five top-lists whose source views (v_top_books_*,
// mv_top_books_rising, v_top_banned_authors, ban_reason_links) only update
// on aggregation cycles. 30 min keeps the feel live, drops TTFB from
// 600ms+ (force-dynamic batch) to ~50ms on cached hits, and lifts
// Core Web Vitals LCP on the highest-PageRank URL on the site.
export const revalidate = 1800

import type { Metadata } from 'next'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { reasonLabel } from '@/components/reason-badge'
import { buildHomepageFaq } from '@/lib/homepage-faq'
import {
  TOP_LIST_BOOK_SELECT,
  type TopListBookRow,
  authorNameOf,
  banContext,
  isNonEnglish,
  langContext,
  toBookCard,
} from '@/lib/top-list-data'
import type { TopListBook, TopListAuthor } from '@/components/top-list-card'
import {
  dayOfYear,
  hashReasonSlug,
  selectRotatingBooks,
  selectWithLanguageDiversity,
} from '@/lib/homepage-rotation'

import HeroSection from '@/components/home/HeroSection'
import BookOfDaySection, { type BookOfDay } from '@/components/home/BookOfDaySection'
import HappeningNowSection from '@/components/home/HappeningNowSection'
import TrendingSection from '@/components/home/TrendingSection'
import MostBannedAuthorsSection from '@/components/home/MostBannedAuthorsSection'
import RisingSection from '@/components/home/RisingSection'
import WhyBooksGetBannedSection, {
  withReasonDescriptions,
} from '@/components/home/WhyBooksGetBannedSection'
import NonEnglishSection from '@/components/home/NonEnglishSection'
import FaqSection from '@/components/home/FaqSection'
import FinalCtaSection from '@/components/home/FinalCtaSection'
import type { RisingBook } from '@/components/home/RisingCard'

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

// Latin-script language gate for the Book-of-the-day pick — keeps the
// English homepage hero on titles that render with a real English name
// (not pinyin/transliteration). Non-Latin titles surface in the dedicated
// Non-English section + the /non-english-banned-books destination.
const LATIN_SCRIPT_LANGS = [
  'en','es','fr','de','nl','it','pt','ca','gl','eu',
  'sv','da','no','nb','nn','fi','is',
  'pl','cs','sk','hu','ro','hr','sl','lv','lt','et','sq','bs',
  'tr','id','ms','vi','tl','sw','af','cy','ga','mt','lb','la',
] as const

const REASON_SLUGS = ['lgbtq', 'sexual', 'political', 'religious', 'racial'] as const

type RichBookOfDayRow = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number | null
  description_book: string | null
  description_ban: string | null
  genres: string[] | null
  book_authors: { authors: { display_name: string } | null }[] | null
  bans:
    | {
        country_code: string
        year_started: number | null
        status: string | null
        ban_reason_links: { reasons: { slug: string } | null }[] | null
      }[]
    | null
}

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastPeriod = slice.lastIndexOf('. ')
  if (lastPeriod > maxLen * 0.5) return slice.slice(0, lastPeriod + 1) + '…'
  return slice.replace(/\s\S*$/, '') + '…'
}

function buildBookOfDay(row: RichBookOfDayRow, countryNames: Map<string, string>): BookOfDay {
  const bans = row.bans ?? []
  const total = bans.length
  const countries = new Set(bans.map(b => b.country_code))
  const active = bans.filter(b => b.status === 'active').length

  const datedBans = bans
    .filter(b => b.year_started != null)
    .sort((a, b) => (a.year_started ?? 0) - (b.year_started ?? 0))
  const firstBan = datedBans[0] ?? bans[0] ?? null
  const firstCountry = firstBan ? countryNames.get(firstBan.country_code) ?? firstBan.country_code : null
  const firstYear = firstBan?.year_started ?? null

  const reasonSet = new Set<string>()
  for (const ban of bans) {
    for (const link of ban.ban_reason_links ?? []) {
      if (link.reasons?.slug) reasonSet.add(link.reasons.slug)
    }
  }

  let summary = row.description_ban
  if (!summary) {
    const others = countries.size - 1
    const banWord = `${total === 1 ? 'ban remains' : 'bans remain'}`
    if (firstCountry && firstYear && others > 0) {
      summary = `Banned in ${firstCountry} (${firstYear}) and ${others} other ${others === 1 ? 'country' : 'countries'}. ${active} of ${total} ${banWord} active.`
    } else if (firstCountry && firstYear) {
      summary = `Banned in ${firstCountry} (${firstYear}). ${active} of ${total} ${banWord} active.`
    } else if (firstCountry) {
      summary = `Banned in ${firstCountry}. ${active} of ${total} ${banWord} active.`
    } else {
      summary = `${total} ${total === 1 ? 'recorded ban' : 'recorded bans'}.`
    }
  }

  const author = (row.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)
    .join(', ')

  const description = row.description_book ? truncateAtSentence(row.description_book, 500) : null

  return {
    title: row.title,
    slug: row.slug,
    cover_url: row.cover_url,
    author,
    year: row.first_published_year,
    description,
    genres: row.genres ?? [],
    summary,
    reasons: [...reasonSet],
    banCount: total,
    countryCount: countries.size,
    activeCount: active,
  }
}

export default async function HomePage() {
  const timer = newTimer('home')
  const supabase = adminClient()

  const REASON_POOL_DEPTH = 40

  const [
    totalCountRes,
    totalBansRes,
    trendingRes,
    bannedAuthorsRes,
    topBannedRes,
    risingRes,
    countriesRes,
    banCountsRes,
    placeholderAuthorsRes,
    reasonTopBooksRes,
    bbwConfigRes,
  ] = await timer.wrap('parallel-batch-11', () => Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('v_top_books_this_week').select('entity_id, views').limit(10),
    supabase.from('v_top_banned_authors').select('entity_id, total_bans, banned_books, granular_events, aggregate_events').limit(30),
    // 300 instead of 100 so the Non-English rotation pool has enough
    // language-diverse candidates after the cover-valid + dedup filters.
    supabase.from('v_top_banned_books').select('entity_id, total_bans').limit(300),
    supabase.from('mv_top_books_rising').select('entity_id, this_week, prev_week').limit(10),
    supabase.from('countries').select('code, name_en'),
    supabase.from('mv_ban_counts').select('country_code, distinct_books').gt('distinct_books', 0),
    supabase.from('authors').select('id').eq('is_placeholder', true),
    // Pre-aggregated top-N book_ids per reason. Replaced a paginated read of
    // 45k ban_reason_links rows (~3.4 MB) with this ~200-row slice (~3 KB).
    // Refreshed hourly by refresh_all_materialized_views(); 1h staleness is
    // fine — homepage's revalidate=1800 dominates.
    supabase.from('mv_reason_top_books')
      .select('reason_slug, book_id, rank')
      .in('reason_slug', REASON_SLUGS)
      .lte('rank', REASON_POOL_DEPTH)
      .order('reason_slug').order('rank'),
    // bbw_config powers the hero callout (BBW banner when enabled, else the
    // rotating "From the archive" quote). Read via adminClient (this supabase
    // var) on purpose — anon hits RLS on the singleton and silently returns
    // DEFAULTS, which masks an editor-enabled BBW state.
    supabase.from('bbw_config').select('enabled, year').eq('id', 1).maybeSingle(),
  ]))

  const total = totalCountRes.count ?? 0
  const totalBans = totalBansRes.count ?? 0
  const bbwConfig = (bbwConfigRes.data ?? null) as { enabled: boolean; year: number } | null

  const trendingIds = ((trendingRes.data ?? []) as { entity_id: number }[]).map(r => Number(r.entity_id))
  const risingRows = (risingRes.data ?? []) as { entity_id: number; this_week: number; prev_week: number }[]
  const risingIds = risingRows.map(r => Number(r.entity_id))
  const topBannedRows = (topBannedRes.data ?? []) as { entity_id: number; total_bans: number }[]
  const placeholderIds = new Set(((placeholderAuthorsRes.data ?? []) as { id: number }[]).map(a => a.id))
  const bannedAuthorRows = ((bannedAuthorsRes.data ?? []) as { entity_id: number; total_bans: number; banned_books: number; granular_events: number; aggregate_events: number }[])
    .filter(r => !placeholderIds.has(Number(r.entity_id)))
    .slice(0, 10)
  const bannedAuthorIds = bannedAuthorRows.map(r => Number(r.entity_id))

  // ── Group the pre-ranked rows from mv_reason_top_books by slug ───────────
  // The MV is partitioned per reason_slug and pre-sorted by rank, so a single
  // pass groups it into the per-slug ID arrays the rotation logic expects.
  // We keep up to 40 candidates per reason instead of 3 so the
  // cover-status='valid' filter + cross-section dedup can drop weak entries
  // without exhausting the pool. The final 3-per-reason pick is done after
  // rotation.
  const reasonRankedBookIds = new Map<string, number[]>()
  const reasonAllBookIds = new Set<number>()
  for (const slug of REASON_SLUGS) reasonRankedBookIds.set(slug, [])
  for (const row of ((reasonTopBooksRes.data ?? []) as Array<{ reason_slug: string; book_id: number; rank: number }>)) {
    reasonRankedBookIds.get(row.reason_slug)?.push(row.book_id)
    reasonAllBookIds.add(row.book_id)
  }

  // ── Single book-details fetch covers every list ──────────────────────────
  const allBookIds = new Set<number>()
  trendingIds.forEach(id => allBookIds.add(id))
  risingIds.forEach(id => allBookIds.add(id))
  topBannedRows.forEach(r => allBookIds.add(Number(r.entity_id)))
  reasonAllBookIds.forEach(id => allBookIds.add(id))

  const { data: allBooksRaw } = allBookIds.size > 0
    ? await timer.wrap('all-books', () =>
        supabase.from('books').select(TOP_LIST_BOOK_SELECT).eq('is_gated', false).in('id', [...allBookIds]),
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
  // Cross-section dedup: a single page render never repeats the same book in
  // Trending / Rising / Why-books / Non-English. Book-of-the-day is exempt
  // (it's an independent editorial pick). Order matters — Trending feeds
  // come first so popular books anchor that slot; Why-books and Non-English
  // do rotation downstream and accept fewer items if the pool is exhausted.
  const seed = dayOfYear()
  const excludeIds = new Set<number>()

  const trendingBooks: TopListBook[] = trendingIds
    .map(id => bookById.get(id))
    .filter((b): b is TopListBookRow => !!b)
    .map(b => toBookCard(b, banContext(b)))
  trendingBooks.forEach(b => excludeIds.add(b.id))

  const risingBooks: RisingBook[] = risingRows
    .map((r): RisingBook | null => {
      const b = bookById.get(Number(r.entity_id))
      if (!b) return null
      const pct = r.prev_week > 0
        ? Math.round(((r.this_week - r.prev_week) / r.prev_week) * 100)
        : null
      return {
        id: b.id,
        title: b.title,
        slug: b.slug,
        cover_url: b.cover_url,
        author: authorNameOf(b),
        pct: pct !== null && pct > 0 ? pct : null,
      }
    })
    .filter((x): x is RisingBook => x !== null)
  risingBooks.forEach(b => excludeIds.add(b.id))

  const bannedAuthors: TopListAuthor[] = bannedAuthorRows
    .map((r): TopListAuthor | null => {
      const a = authorById.get(Number(r.entity_id))
      if (!a) return null
      const banBooks = Number(r.banned_books)
      // granular_events (region OR institution set) — discrete documented
      // events. total_bans would also count Wikipedia/ALA aggregate rows
      // (1 row = "banned somewhere historically") and inflate the badge.
      const granular = Number(r.granular_events ?? 0)
      const eventsTail = granular > 0 ? ` (${granular.toLocaleString('en')} ${granular === 1 ? 'event' : 'events'})` : ''
      return {
        id: a.id,
        display_name: a.display_name,
        slug: a.slug,
        photo_url: a.photo_url,
        context: `${banBooks} ${banBooks === 1 ? 'book' : 'books'} banned${eventsTail}`,
      }
    })
    .filter((a): a is TopListAuthor => a !== null)

  // Why books get banned — per-reason rotation. Each reason rotates from its
  // own cover-valid top-N pool with a stable per-day seed and per-reason
  // salt; later reasons in the loop see books already chosen by earlier
  // reasons in `excludeIds` and skip them.
  const reasonBlocks = REASON_SLUGS.map(slug => {
    const rankedIds = reasonRankedBookIds.get(slug) ?? []
    const pool = rankedIds
      .map(id => bookById.get(id))
      .filter((b): b is TopListBookRow => !!b)
      .filter(b => b.cover_status === 'valid')
    const picked = selectRotatingBooks({
      pool,
      count: 3,
      seed,
      reasonOffset: hashReasonSlug(slug),
      excludeIds,
    })
    picked.forEach(b => excludeIds.add(b.id))
    return {
      reasonSlug: slug,
      reasonLabel: reasonLabel(slug) ?? slug,
      books: picked.map(b => toBookCard(b, banContext(b))),
    }
  })
  const reasonBlocksWithDesc = withReasonDescriptions(reasonBlocks)

  // Non-English banned books — rotate from a pool of 30, then apply soft
  // language-diversity (greedy distinct `original_language` first, fill the
  // rest with what's left). Rotation gives day-to-day variation; diversity
  // stops the row from being three French or three Russian titles. Filter is
  // "any non-English" (incl. fr/de/es/…), not just non-Latin script — within
  // the top-100 banned, non-Latin alone yields just ~6 candidates which
  // collapses to a 6-day cycle of the same trio.
  const nonEnglishPool: TopListBookRow[] = topBannedRows
    .map(r => bookById.get(Number(r.entity_id)))
    .filter((b): b is TopListBookRow => !!b)
    .filter(b => isNonEnglish(b.original_language))
    .filter(b => b.cover_status === 'valid')
    .slice(0, 30)
  const nonEnglishRotated = selectRotatingBooks({
    pool: nonEnglishPool,
    count: 10,
    seed,
    reasonOffset: hashReasonSlug('non-english'),
    excludeIds,
  })
  const nonEnglishPicked = selectWithLanguageDiversity(nonEnglishRotated, 3)
  nonEnglishPicked.forEach(b => excludeIds.add(b.id))
  const nonEnglishBooks: TopListBook[] = nonEnglishPicked.map(b => toBookCard(b, langContext(b)))

  const countMap = new Map((banCountsRes.data ?? []).map(r => [r.country_code, r.distinct_books as number]))
  const countryCount = ((countriesRes.data ?? []) as { code: string }[]).filter(c => countMap.has(c.code)).length
  const countryNameMap = new Map(
    ((countriesRes.data ?? []) as { code: string; name_en: string }[]).map(c => [c.code, c.name_en]),
  )

  // Book of the day: pick from the top-100 globally-banned pool (already in
  // bookById from the top-banned rail) so the daily rotation lands on a
  // recognisable censored title — 1984, Lolita, Satanic Verses, etc. —
  // rather than a random catalogue entry. Latin-script + description filter
  // are the same constraints as before so the hero card always has English
  // copy + a real synopsis to render.
  const pickPool = topBannedRows
    .map(r => bookById.get(Number(r.entity_id)))
    .filter((b): b is TopListBookRow => !!b)
    .filter(b => !!b.description_book)
    .filter(b => !b.original_language || (LATIN_SCRIPT_LANGS as readonly string[]).includes(b.original_language))
  const bookOfDaySeed = new Date().toISOString().slice(0, 10)
  const bookOfDaySeedSum = bookOfDaySeed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pickBookRow = pickPool.length > 0 ? pickPool[bookOfDaySeedSum % pickPool.length] : null

  // One follow-up fetch to pull the richer fields we need for the new card
  // shape (description_ban, genres, per-ban status + year + reasons). Cheap
  // because it's a single book by id, and the page is on revalidate=1800.
  // `description_ban` is the editor-maintained "why was this banned" copy
  // already surfaced on the book detail page; reused here so the homepage
  // doesn't need a parallel editorial field.
  let bookOfDay: BookOfDay | null = null
  if (pickBookRow) {
    const { data: richRaw } = await timer.wrap('book-of-day-rich', () =>
      supabase.from('books').select(
        'id, title, slug, cover_url, first_published_year, description_book, description_ban, genres, ' +
        'book_authors(authors(display_name)), ' +
        'bans(country_code, year_started, status, ban_reason_links(reasons(slug)))',
      ).eq('id', pickBookRow.id).maybeSingle(),
    )
    if (richRaw) bookOfDay = buildBookOfDay(richRaw as unknown as RichBookOfDayRow, countryNameMap)
  }

  // FAQ: reuse the top-banned signal already in scope. mostBanned is the #1
  // entry from v_top_banned_books, fully hydrated via bookById — no extra
  // DB roundtrip needed for the data-driven answer.
  const mostBannedRow = topBannedRows[0]
  const mostBannedBookRow = mostBannedRow ? bookById.get(Number(mostBannedRow.entity_id)) : null
  const faqItems = buildHomepageFaq({
    total,
    countryCount,
    mostBannedBook: mostBannedBookRow
      ? {
          title: mostBannedBookRow.title,
          author: authorNameOf(mostBannedBookRow),
          slug: mostBannedBookRow.slug,
          banCount: mostBannedBookRow.bans.length,
          countryCount: new Set(mostBannedBookRow.bans.map(b => b.country_code)).size,
        }
      : null,
  })

  timer.end()

  // ── Schema.org JSON-LD ───────────────────────────────────────────────────
  // WebSite + Organization on the homepage so Google can surface a sitelinks
  // search box for brand queries and so AI Overview has an entity anchor for
  // the catalogue.
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://www.banned-books.org/#website',
    name: 'Banned Books',
    alternateName: 'banned-books.org',
    url: 'https://www.banned-books.org',
    description: `An international catalogue of ${total.toLocaleString('en')} books banned by governments, schools, and libraries worldwide.`,
    author: { '@id': 'https://www.banned-books.org/#organization' },
    publisher: { '@id': 'https://www.banned-books.org/#organization' },
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
    '@id': 'https://www.banned-books.org/#organization',
    name: 'Banned Books',
    url: 'https://www.banned-books.org',
    logo: {
      '@type': 'ImageObject',
      // Raster PNG, not the SVG icon — Google's logo structured-data guidelines
      // don't reliably accept SVG for the knowledge-panel/logo.
      url: 'https://www.banned-books.org/brand/compact-bb.png',
    },
    description: 'An international catalogue of books banned by governments and schools worldwide. Documents censorship history, dates, scope, and source citations.',
  }

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(organizationJsonLd) }} />

      <HeroSection
        totalBooks={total}
        countryCount={countryCount}
        totalBans={totalBans}
        callout={
          bbwConfig?.enabled
            ? { kind: 'bbw', year: bbwConfig.year ?? new Date().getFullYear() }
            : { kind: 'archive', seed }
        }
      />
      {bookOfDay && <BookOfDaySection book={bookOfDay} />}
      <HappeningNowSection />
      <TrendingSection books={trendingBooks} />
      <MostBannedAuthorsSection authors={bannedAuthors} />
      <RisingSection books={risingBooks} />
      <WhyBooksGetBannedSection blocks={reasonBlocksWithDesc} />
      <NonEnglishSection books={nonEnglishBooks} />
      <FaqSection items={faqItems} />
      <FinalCtaSection totalBooks={total} />
    </main>
  )
}
