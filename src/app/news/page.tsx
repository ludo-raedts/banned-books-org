import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { normalizeNewsDisplay, TranslatedBadge, OriginalTitleLine } from '@/lib/news-display'
import EssayCard from '@/components/essay-card'
import { publishedEssays } from '@/lib/essays-data'

// ISR: news content auto-publishes daily via cron (fetch-news cron at
// 06:00 UTC = 08:00 Amsterdam in summer, 07:00 in winter). 30-min
// revalidate keeps the list reasonably fresh between cron cycles without
// re-rendering the page on every visit. ?page=N pagination forces
// dynamic per page-param, but the default landing view (/news without
// params) benefits from the cache window.
export const revalidate = 1800

// Items per page. Tuned so a typical page is ~3–6 daily groups under the
// daily auto-publish flow, which keeps the HTML payload small without making
// pagination feel paranoid.
const ITEMS_PER_PAGE = 30

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Book Ban News — Latest Censorship Updates | Banned Books',
    description: 'Latest news on book bans and censorship worldwide.',
    alternates: { canonical: '/news' },
  }
}

type NewsItem = {
  id: number
  title: string
  headline: string | null
  source_name: string
  source_url: string
  published_at: string | null
  summary: string
  published_week: string
  source_language: string | null
  original_title: string | null
}

type BookRef = { slug: string; title: string }
type CountryRef = { code: string; name_en: string }

// "Friday, 8 May 2026" — anchored in UTC so the header is stable regardless
// of the visitor's timezone (matches how published_at is stored).
function formatDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function linkify(text: string, books: BookRef[], countries: CountryRef[]): React.ReactNode[] {
  type Span = { start: number; end: number; node: React.ReactNode }
  const spans: Span[] = []
  let key = 0

  const collect = (regex: RegExp, makeNode: (match: string, k: number) => React.ReactNode) => {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, node: makeNode(m[0], key++) })
    }
  }

  for (const book of books) {
    collect(
      new RegExp(`\\b${escapeRegex(book.title)}\\b`, 'gi'),
      (match, k) => <Link key={k} href={`/books/${book.slug}`} className="text-gray-900 dark:text-gray-100 underline underline-offset-2 hover:no-underline">{match}</Link>
    )
  }

  for (const country of countries) {
    if (country.name_en.length < 4) continue
    collect(
      new RegExp(`\\b${escapeRegex(country.name_en)}\\b`, 'gi'),
      (match, k) => <Link key={k} href={`/countries/${country.code.toLowerCase()}`} className="text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:no-underline">{match}</Link>
    )
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end)

  const result: React.ReactNode[] = []
  let pos = 0
  for (const span of spans) {
    if (span.start < pos) continue
    if (span.start > pos) result.push(text.slice(pos, span.start))
    result.push(span.node)
    pos = span.end
  }
  if (pos < text.length) result.push(text.slice(pos))

  return result.length > 0 ? result : [text]
}

function pageHref(page: number): string {
  return page === 1 ? '/news' : `/news?page=${page}`
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const requestedPage = parseInt(params.page ?? '1', 10) || 1
  const page = Math.max(1, requestedPage)
  const offset = (page - 1) * ITEMS_PER_PAGE

  const supabase = adminClient()

  const [{ data: rawItems, count: totalCount }, { data: books }, { data: countries }] = await Promise.all([
    // rows: 30 per page | reason: paginated daily news feed; count drives the pager
    supabase
      .from('news_items')
      .select('id, title, headline, source_name, source_url, published_at, summary, published_week, source_language, original_title', { count: 'exact' })
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1),
    // rows: ≤10000 | fields: [slug, title] | reason: linkify book titles in news summaries
    supabase.from('books').select('slug, title').range(0, 9999),
    // rows: ≤300 | fields: [code, name_en] | reason: linkify country names in news summaries
    supabase.from('countries').select('code, name_en').range(0, 299),
  ])

  const items = (rawItems ?? []) as NewsItem[]
  const bookRefs = (books ?? []) as BookRef[]
  const countryRefs = (countries ?? []) as CountryRef[]
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / ITEMS_PER_PAGE))

  // Essays strip only renders on page 1 — paginated pages are meant for
  // deeper news archives, and repeating the same essay strip on every page
  // would be noise. Capped at 3 so the strip stays a single row and doesn't
  // dominate the news flow; older essays remain reachable via /essays.
  const essays = page === 1 ? publishedEssays().slice(0, 3) : []

  // Group by UTC date of published_at; fall back to published_week (Monday)
  // for legacy items that pre-date the per-day flow. Insertion order
  // preserves the descending sort from the query.
  const byDay = new Map<string, NewsItem[]>()
  for (const item of items) {
    const day = item.published_at
      ? item.published_at.slice(0, 10)
      : item.published_week ?? 'unknown'
    const existing = byDay.get(day) ?? []
    existing.push(item)
    byDay.set(day, existing)
  }

  const days = [...byDay.entries()]

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-8 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Latest</p>
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">News</h1>
          <a
            href="/feed.xml"
            type="application/rss+xml"
            className="text-xs text-brand/80 hover:text-brand underline underline-offset-2 shrink-0"
          >
            RSS feed
          </a>
        </div>
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          News about book bans, censorship, and literary freedom worldwide.
          Sourced from PEN America, PEN International, Index on Censorship, Publishers Weekly, Freedom to Read Canada, RSF, HRW, Article 19, China Digital Times, IranWire, Meduza, and Google News.
        </p>
      </div>

      {essays.length > 0 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Essays
            </h2>
            <div className="flex items-baseline gap-4 shrink-0">
              <a
                href="/essays/feed.xml"
                type="application/rss+xml"
                className="text-xs text-gray-500 hover:text-brand underline underline-offset-2"
              >
                RSS
              </a>
              <Link
                href="/essays"
                className="text-xs text-gray-500 hover:text-brand underline underline-offset-2"
              >
                All essays →
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {essays.map(essay => (
              <li key={essay.slug}>
                <EssayCard essay={essay} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      {days.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-8">No published news yet — check back soon.</p>
      )}

      {days.map(([day, dayItems]) => (
        <section key={day} className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
            {day !== 'unknown' ? formatDay(day) : '—'}
          </h2>
          <div className="flex flex-col gap-6">
            {dayItems.map(item => {
              const { title, sourceName } = normalizeNewsDisplay(item.title, item.source_name)
              return (
                <article key={item.id} className="border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                  {item.headline && (
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-1">
                      {item.headline}
                    </p>
                  )}
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-1.5">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="hover:underline underline-offset-2"
                    >
                      {title}
                    </a>
                  </h3>
                  <OriginalTitleLine
                    code={item.source_language}
                    originalTitle={item.original_title}
                    className="mb-1.5"
                  />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {linkify(item.summary, bookRefs, countryRefs)}
                  </p>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2 flex-wrap">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors underline underline-offset-2"
                    >
                      {sourceName}
                    </a>
                    <TranslatedBadge code={item.source_language} />
                  </p>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {totalPages > 1 && (
        <nav
          aria-label="News pagination"
          className="mt-12 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-6"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              rel="prev"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Previous
            </Link>
          ) : (
            <span className="text-sm text-gray-300 dark:text-gray-600 cursor-default">← Previous</span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              rel="next"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Next →
            </Link>
          ) : (
            <span className="text-sm text-gray-300 dark:text-gray-600 cursor-default">Next →</span>
          )}
        </nav>
      )}
    </main>
  )
}
