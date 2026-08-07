import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { normalizeNewsDisplay, TranslatedBadge, OriginalTitleLine } from '@/lib/news-display'
import EssayCard from '@/components/essay-card'
import { publishedEssays } from '@/lib/essays-data'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'

// ?page=N pagination means this page reads searchParams — a request-time API
// that forces the whole route dynamic, so a `revalidate` export is a dead
// letter here (it silently never cached anything; /stats had the same bug).
// The per-request queries are light (one 30-row news page + a count); the
// heavy part — the linkify reference corpus of every book title — is cached
// in loadLinkifyRefs below.
export const dynamic = 'force-dynamic'

// Items per page. Tuned so a typical page is ~3–6 daily groups under the
// daily auto-publish flow, which keeps the HTML payload small without making
// pagination feel paranoid.
const ITEMS_PER_PAGE = 30

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Book Ban News — Latest Censorship Updates',
    description:
      'Daily-updated coverage of book bans and censorship worldwide: newly challenged titles, school and library removals, legislation, court rulings, and reversals.',
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

// Reference corpus for linkifying book titles + country names in summaries.
// Paginated so the FULL catalogue is covered — the previous single
// .range(0, 9999) fetch silently dropped everything past 10k rows, so half
// the ~20k books were never linked. Cached 24h: titles/slugs change rarely,
// and this saves a multi-MB Supabase read per pageview. Sequential pages are
// fine here — the cold fill runs at most once a day.
const loadLinkifyRefs = unstable_cache(
  async (): Promise<{ books: BookRef[]; countries: CountryRef[] }> => {
    const supabase = adminClient()
    const books: BookRef[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('books')
        .select('slug, title')
        // Stable total order or .range() pagination skips/dupes rows.
        .order('id')
        .range(offset, offset + 999)
      if (error) throw error
      books.push(...((data ?? []) as BookRef[]))
      if (!data || data.length < 1000) break
    }
    const { data: countries, error } = await supabase
      .from('countries')
      .select('code, name_en')
      .range(0, 299)
    if (error) throw error
    return { books, countries: (countries ?? []) as CountryRef[] }
  },
  ['news-linkify-refs'],
  { revalidate: 86400, tags: ['news-linkify-refs'] },
)

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

type Matcher = { regex: RegExp; make: (match: string, k: number) => React.ReactNode }

// Compile the match regexes ONCE per render instead of once per book×item:
// with ~20k books and 30 items per page the old inline construction meant
// ~600k RegExp compiles per pageview.
//
// Generic-title guard: the catalogue holds real books titled "America",
// "Court", "Will", "Freedom", "Novel", … which as case-insensitive matchers
// linked ordinary words in summaries (even "America" inside "PEN America").
// So book titles match case-SENSITIVELY; single-word titles only link when
// the summary quotes them ("Maus" banned in …); multi-word titles need ≥2
// capitalized tokens, so sentence-case fragments like "On the" never match.
const QUOTE_CLASS = `["'“”‘’«»]`
function buildMatchers(books: BookRef[], countries: CountryRef[]): Matcher[] {
  const matchers: Matcher[] = []
  for (const book of books) {
    const title = book.title.trim()
    if (title.length < 4) continue
    const words = title.split(/\s+/)
    let pattern: string
    if (words.length === 1) {
      pattern = `(?<=${QUOTE_CLASS})${escapeRegex(title)}(?=${QUOTE_CLASS})`
    } else {
      const capTokens = words.filter(w => /^[^a-z]/.test(w)).length
      if (capTokens < 2) continue
      pattern = `\\b${escapeRegex(title)}\\b`
    }
    matchers.push({
      regex: new RegExp(pattern, 'g'),
      make: (match, k) => <Link key={k} href={`/books/${book.slug}`} className="text-gray-900 underline underline-offset-2 hover:no-underline">{match}</Link>,
    })
  }
  for (const country of countries) {
    if (country.name_en.length < 4) continue
    matchers.push({
      regex: new RegExp(`\\b${escapeRegex(country.name_en)}\\b`, 'gi'),
      make: (match, k) => <Link key={k} href={`/countries/${country.code.toLowerCase()}`} className="text-gray-500 underline underline-offset-2 hover:no-underline">{match}</Link>,
    })
  }
  return matchers
}

function linkify(text: string, matchers: Matcher[]): React.ReactNode[] {
  type Span = { start: number; end: number; node: React.ReactNode }
  const spans: Span[] = []
  let key = 0

  for (const { regex, make } of matchers) {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, node: make(m[0], key++) })
    }
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

  const [{ data: rawItems, count: totalCount }, { books, countries }] = await Promise.all([
    // rows: 30 per page | reason: paginated daily news feed; count drives the pager
    supabase
      .from('news_items')
      .select('id, title, headline, source_name, source_url, published_at, summary, published_week, source_language, original_title', { count: 'exact' })
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1),
    // full book + country corpus for linkify — cached 24h, see loadLinkifyRefs
    loadLinkifyRefs(),
  ])

  const items = (rawItems ?? []) as NewsItem[]
  const matchers = buildMatchers(books, countries)
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

  // Sandwich layout: on page 1 with essays available, the most recent day
  // sits above the essays interlude and the rest below. Without essays, or
  // on paginated archive pages, all days render in a single section.
  const hasInterlude = page === 1 && essays.length > 0 && days.length > 0
  const [firstDay, ...restDays] = days
  const earlierItemsCount = restDays.reduce((n, [, items]) => n + items.length, 0)

  function renderDayGroup([day, dayItems]: [string, NewsItem[]]) {
    return (
      <section key={day} className="mb-10 last:mb-0">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          {day !== 'unknown' ? formatDay(day) : '—'}
        </h3>
        <div className="flex flex-col gap-6">
          {dayItems.map(item => {
            const { title, sourceName } = normalizeNewsDisplay(item.title, item.source_name)
            return (
              <article key={item.id} className="border-l-2 border-gray-200 pl-4">
                {item.headline && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-1">
                    {item.headline}
                  </p>
                )}
                <h4 className="text-base font-semibold text-gray-900 leading-snug mb-1.5">
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="hover:underline underline-offset-2"
                  >
                    {title}
                  </a>
                </h4>
                <OriginalTitleLine
                  code={item.source_language}
                  originalTitle={item.original_title}
                  className="mb-1.5"
                />
                <p className="text-sm text-gray-700 leading-relaxed">
                  {linkify(item.summary, matchers)}
                </p>
                <p className="mt-2 text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="hover:text-gray-700 transition-colors underline underline-offset-2"
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
    )
  }

  function renderPagination() {
    if (totalPages <= 1) return null
    return (
      <nav
        aria-label="News pagination"
        className="mt-12 flex items-center justify-between border-t border-gray-200 pt-6"
      >
        {page > 1 ? (
          <Link
            href={pageHref(page - 1)}
            rel="prev"
            className="text-sm text-gray-600 hover:text-oxblood transition-colors"
          >
            ← Previous
          </Link>
        ) : (
          <span className="text-sm text-gray-300 cursor-default">← Previous</span>
        )}
        <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
        {page < totalPages ? (
          <Link
            href={pageHref(page + 1)}
            rel="next"
            className="text-sm text-gray-600 hover:text-oxblood transition-colors"
          >
            Next →
          </Link>
        ) : (
          <span className="text-sm text-gray-300 cursor-default">Next →</span>
        )}
      </nav>
    )
  }

  return (
    <main>
      <section className="relative pt-10 md:pt-12 px-6 md:px-9 pb-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-5 transition-colors"
          >
            ← Home
          </Link>

          <Eyebrow>Latest · From the wires</Eyebrow>

          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
              News.
            </h1>
            <a
              href="/feed.xml"
              type="application/rss+xml"
              className="shrink-0 text-xs font-medium tracking-wide text-gray-700 hover:text-oxblood underline underline-offset-2 transition-colors whitespace-nowrap"
            >
              RSS feed ↗
            </a>
          </div>

          <p className="mt-4 max-w-[720px] text-sm leading-relaxed text-gray-700">
            News about book bans, censorship, and literary freedom worldwide.
            Sourced from PEN America, PEN International, Index on Censorship, Publishers Weekly, Freedom to Read Canada, RSF, HRW, Article 19, China Digital Times, IranWire, Meduza, and Google News.
          </p>
        </div>
      </section>

      {days.length === 0 && (
        <SectionShell tone="cream" eyebrow="Latest">
          <p className="text-gray-500 text-sm py-8">No published news yet — check back soon.</p>
        </SectionShell>
      )}

      {hasInterlude ? (
        <>
          <SectionShell tone="cream" eyebrow="Latest">
            <SectionHeader
              title="From the wires."
              subtitle="The most recent day of news."
              accent="oxblood"
            />
            {renderDayGroup(firstDay)}
          </SectionShell>

          <SectionShell tone="white" eyebrow="Essays">
            <SectionHeader
              title="From the desk."
              subtitle="Long-form pieces on censorship and what we document."
              viewAllHref="/essays"
              viewAllLabel="All essays"
              accent="black"
            />
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {essays.map(essay => (
                <li key={essay.slug}>
                  <EssayCard essay={essay} compact />
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-gray-500">
              <a
                href="/essays/feed.xml"
                type="application/rss+xml"
                className="hover:text-oxblood underline underline-offset-2"
              >
                Essays RSS feed ↗
              </a>
            </p>
          </SectionShell>

          {(restDays.length > 0 || totalPages > 1) && (
            <SectionShell tone="cream" eyebrow="Earlier">
              <SectionHeader
                title="Older days."
                subtitle={
                  earlierItemsCount > 0
                    ? `${earlierItemsCount} more item${earlierItemsCount === 1 ? '' : 's'} on this page.`
                    : 'Browse the archive.'
                }
                accent="oxblood"
              />
              {restDays.map(renderDayGroup)}
              {renderPagination()}
            </SectionShell>
          )}
        </>
      ) : days.length > 0 ? (
        <SectionShell tone="cream" eyebrow={page === 1 ? 'Latest' : `News · Page ${page}`}>
          <SectionHeader
            title={page === 1 ? 'From the wires.' : `News archive — page ${page}.`}
            subtitle={
              totalCount
                ? `${totalCount.toLocaleString('en-US')} items total, grouped by day.`
                : 'Grouped by day.'
            }
            accent="oxblood"
          />
          {days.map(renderDayGroup)}
          {renderPagination()}
        </SectionShell>
      ) : null}
    </main>
  )
}
