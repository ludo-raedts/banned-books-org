export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'

type Book = {
  id: number
  title: string
  book_authors: { authors: { display_name: string } | null }[]
  bans: { id: number }[]
}

export default async function HomePage() {
  let books: Book[] = []
  let fetchError: string | null = null

  try {
    const supabase = adminClient()
    const { data, error } = await supabase
      .from('books')
      .select(`
        id,
        title,
        book_authors(authors(display_name)),
        bans(id)
      `)
      .order('title')

    if (error) {
      fetchError = error.message
    } else {
      books = (data as unknown as Book[]) ?? []
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unexpected error'
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Banned Books</h1>
      <p className="text-gray-500 mb-8">
        An international catalogue of books banned by country.
      </p>
      {fetchError ? (
        <p className="text-red-600 border border-red-200 rounded-lg p-4 bg-red-50">
          Could not load books: {fetchError}
        </p>
      ) : (
        <ul className="space-y-4">
          {books.map((book) => (
            <li key={book.id} className="border rounded-lg p-4">
              <h2 className="text-lg font-semibold">{book.title}</h2>
              <p className="text-gray-600 text-sm">
                {book.book_authors[0]?.authors?.display_name}
              </p>
              <p className="text-red-600 text-sm mt-1">
                Banned in {book.bans.length}{' '}
                {book.bans.length === 1 ? 'country' : 'countries'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
