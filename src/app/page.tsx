export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { adminClient } from '@/lib/supabase'
import BookBrowser, { type Book, type NewsPreview } from '@/components/book-browser'

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
      .select('id, source_name, published_at, summary')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3)
    latestNews = (news ?? []) as NewsPreview[]
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  const bookCount = books.length

  // Server-side random featured book — different on every request (force-dynamic)
  const eligible = books.filter(b => b.cover_url && b.description)
  const featuredBook: Book | null = eligible.length > 0
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : null

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {fetchError && (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50 mb-8">
          Could not load books: {fetchError}
        </p>
      )}

      {!fetchError && (
        <BookBrowser
          books={books}
          latestNews={latestNews}
          featuredBook={featuredBook}
          bookCount={bookCount}
        />
      )}

      {/* Closing purpose block */}
      <div className="mt-16 bg-gray-50 dark:bg-gray-900/60 rounded-xl py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
            Access to knowledge should not depend on where you live, what you believe, or who is in power.
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm leading-relaxed">
            This project is incomplete and evolving. Every documented book is a small act against forgetting.
          </p>
        </div>
      </div>
    </main>
  )
}
