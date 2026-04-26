export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookBrowser, { type Book } from '@/components/book-browser'

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('books').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    description: `An international catalogue of ${n.toLocaleString('en')} books banned by governments and schools worldwide. Browse by country, genre, and reason.`,
  }
}

export default async function HomePage() {
  let books: Book[] = []
  let fetchError: string | null = null

  try {
    const supabase = adminClient()
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url, description, first_published_year, genres,
        book_authors(authors(display_name)),
        bans(
          id, status, country_code,
          countries(name_en),
          scopes(slug, label_en),
          ban_reason_links(reasons(slug))
        )
      `)
      .order('title')

    if (error) fetchError = error.message
    else books = (data as unknown as Book[]) ?? []
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
    </main>
  )
}
