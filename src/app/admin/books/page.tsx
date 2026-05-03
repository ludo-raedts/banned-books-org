import { adminClient } from '@/lib/supabase'
import BooksListClient from './books-list-client'

export const dynamic = 'force-dynamic'

export type BookListItem = {
  id: number
  slug: string
  title: string
  cover_url: string | null
  first_published_year: number | null
  ai_drafted: boolean | null
  author: string | null
}

export default async function AdminBooksPage() {
  const supabase = adminClient()

  // Paginate through all books (Supabase caps at 1000/request)
  let all: BookListItem[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, cover_url, first_published_year, ai_drafted, book_authors(authors(display_name))')
      .order('title', { ascending: true })
      .range(offset, offset + 999)
    if (error || !data || data.length === 0) break
    const page = (data as unknown as Array<{
      id: number; slug: string; title: string; cover_url: string | null
      first_published_year: number | null; ai_drafted: boolean | null
      book_authors: Array<{ authors: { display_name: string } | null }>
    }>).map(b => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      cover_url: b.cover_url,
      first_published_year: b.first_published_year,
      ai_drafted: b.ai_drafted,
      author: b.book_authors?.[0]?.authors?.display_name ?? null,
    }))
    all = all.concat(page)
    if (data.length < 1000) break
    offset += 1000
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Books</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{all.length.toLocaleString()} books in catalogue</p>
        </div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">← Admin dashboard</a>
      </div>
      <BooksListClient books={all} />
    </main>
  )
}
