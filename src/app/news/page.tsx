import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Banned Books News — Weekly censorship briefing',
  description: 'A weekly summary of news about book bans, censorship, and literary freedom worldwide.',
  alternates: { canonical: '/news' },
}

type NewsItem = {
  id: number
  title: string
  source_name: string
  source_url: string
  published_at: string | null
  summary: string
  published_week: string
}

type BookRef = { slug: string; title: string }
type CountryRef = { code: string; name_en: string }

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
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
    // Skip very short names — too likely to cause false positives inside other words
    if (country.name_en.length < 4) continue
    collect(
      new RegExp(`\\b${escapeRegex(country.name_en)}\\b`, 'gi'),
      (match, k) => <Link key={k} href={`/countries/${country.code.toLowerCase()}`} className="text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:no-underline">{match}</Link>
    )
  }

  // Sort by position; at same start, prefer the longer match
  spans.sort((a, b) => a.start - b.start || b.end - a.end)

  const result: React.ReactNode[] = []
  let pos = 0
  for (const span of spans) {
    if (span.start < pos) continue // overlaps a prior match — skip
    if (span.start > pos) result.push(text.slice(pos, span.start))
    result.push(span.node)
    pos = span.end
  }
  if (pos < text.length) result.push(text.slice(pos))

  return result.length > 0 ? result : [text]
}

export default async function NewsPage() {
  const supabase = adminClient()

  const [{ data: rawItems }, { data: books }, { data: countries }] = await Promise.all([
    supabase
      .from('news_items')
      .select('id, title, source_name, source_url, published_at, summary, published_week')
      .eq('status', 'published')
      .order('published_week', { ascending: false })
      .order('published_at', { ascending: false }),
    supabase.from('books').select('slug, title'),
    supabase.from('countries').select('code, name_en'),
  ])

  const items = (rawItems ?? []) as NewsItem[]
  const bookRefs = (books ?? []) as BookRef[]
  const countryRefs = (countries ?? []) as CountryRef[]

  // Group by published_week
  const byWeek = new Map<string, NewsItem[]>()
  for (const item of items) {
    const week = item.published_week ?? 'unknown'
    const existing = byWeek.get(week) ?? []
    existing.push(item)
    byWeek.set(week, existing)
  }

  const weeks = [...byWeek.entries()]

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">News</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          A weekly digest of news about book bans, censorship, and literary freedom worldwide.
          Sourced from PEN America, Index on Censorship, Publishers Weekly, and Freedom to Read Canada.
        </p>
      </div>

      {weeks.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-8">No published news yet — check back soon.</p>
      )}

      {weeks.map(([week, weekItems]) => (
        <section key={week} className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
            Week of {week !== 'unknown' ? formatWeek(week) : '—'}
          </h2>
          <div className="flex flex-col gap-6">
            {weekItems.map(item => (
              <article key={item.id} className="border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {linkify(item.summary, bookRefs, countryRefs)}
                </p>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors underline underline-offset-2"
                  >
                    {item.source_name}
                  </a>
                  {item.published_at && (
                    <span> · {new Date(item.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
