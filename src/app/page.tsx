export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookBrowser, { type Book } from '@/components/book-browser'

type NewsPreview = {
  id: number
  title: string
  source_name: string
  published_at: string | null
  summary: string
}

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('books').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse by country, genre, and reason.`,
    alternates: { canonical: '/' },
  }
}

export default async function HomePage() {
  let books: Book[] = []
  let fetchError: string | null = null
  let latestNews: NewsPreview[] = []

  try {
    const supabase = adminClient()
    const SELECT = `
      id, title, slug, cover_url, description, first_published_year, genres,
      book_authors(authors(display_name)),
      bans(
        id, status, country_code,
        countries(name_en),
        scopes(slug, label_en),
        ban_reason_links(reasons(slug))
      )
    `
    // Supabase/PostgREST caps at 1000 rows per request; fetch all pages
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('books')
        .select(SELECT)
        .order('title')
        .range(offset, offset + PAGE - 1)
      if (error) { fetchError = error.message; break }
      books = books.concat((data as unknown as Book[]) ?? [])
      if (!data || data.length < PAGE) break
      offset += PAGE
    }

    const { data: news } = await supabase
      .from('news_items')
      .select('id, title, source_name, published_at, summary')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3)
    latestNews = (news ?? []) as NewsPreview[]
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Banned Books</h1>
        <p className="text-gray-500 text-sm max-w-xl leading-relaxed">
          An independent catalogue of{' '}
          <span className="font-semibold text-gray-700">{books.length.toLocaleString()} books</span>{' '}
          banned or challenged by governments, schools, and libraries across the world —
          from Cold War censorship to today&rsquo;s classroom removals.
        </p>
      </div>

      <Link
        href="/history"
        className="md:hidden group inline-flex items-center gap-1.5 mb-4 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        Essay: The long shadow of censorship →
      </Link>

      {fetchError && (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50 mb-8">
          Could not load books: {fetchError}
        </p>
      )}

      {!fetchError && <BookBrowser books={books} />}

      {latestNews.length > 0 && (
        <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Latest censorship news
            </h2>
            <Link
              href="/news"
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              More news →
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {latestNews.map((item) => (
              <div key={item.id} className="flex flex-col gap-1">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {item.summary.length > 120 ? item.summary.slice(0, 120).trimEnd() + '…' : item.summary}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {item.source_name}
                  {item.published_at && (
                    <span>
                      {' '}·{' '}
                      {new Date(item.published_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
