import { adminClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import BookEditClient from './book-edit-client'

export const dynamic = 'force-dynamic'

export type BookEditData = {
  id: number
  slug: string
  title: string
  cover_url: string | null
  first_published_year: number | null
  genres: string[]
  description_book: string | null
  description_ban: string | null
  censorship_context: string | null
  ai_drafted: boolean | null
  isbn13: string | null
  openlibrary_work_id: string | null
  ban_count: number
  ban_countries: string
}

export default async function AdminBookEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('books')
    .select(`
      id, slug, title, cover_url, first_published_year, genres,
      description_book, description_ban, censorship_context,
      ai_drafted, isbn13, openlibrary_work_id,
      bans(id, country_code)
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) notFound()

  const raw = data as unknown as {
    id: number; slug: string; title: string; cover_url: string | null
    first_published_year: number | null; genres: string[]
    description_book: string | null; description_ban: string | null
    censorship_context: string | null; ai_drafted: boolean | null
    isbn13: string | null; openlibrary_work_id: string | null
    bans: Array<{ id: number; country_code: string }>
  }

  const countries = [...new Set(raw.bans.map(b => b.country_code))].sort().join(', ')

  const book: BookEditData = {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    cover_url: raw.cover_url,
    first_published_year: raw.first_published_year,
    genres: raw.genres ?? [],
    description_book: raw.description_book,
    description_ban: raw.description_ban,
    censorship_context: raw.censorship_context,
    ai_drafted: raw.ai_drafted,
    isbn13: raw.isbn13,
    openlibrary_work_id: raw.openlibrary_work_id,
    ban_count: raw.bans.length,
    ban_countries: countries,
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <a href="/admin/books" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">← All books</a>
          <h1 className="text-2xl font-bold mt-2 leading-snug">{book.title}</h1>
        </div>
      </div>
      <BookEditClient book={book} />
    </main>
  )
}
