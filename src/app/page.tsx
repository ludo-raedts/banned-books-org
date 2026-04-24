import { adminClient } from '@/lib/supabase'

type Book = {
  id: number
  title: string
  book_authors: { authors: { display_name: string } | null }[]
  bans: { id: number }[]
}

export default async function HomePage() {
  const supabase = adminClient()
  const { data: books, error } = await supabase
    .from('books')
    .select(`
      id,
      title,
      book_authors(authors(display_name)),
      bans(id)
    `)
    .order('title')

  if (error) throw error

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Banned Books</h1>
      <p className="text-gray-500 mb-8">
        An international catalogue of books banned by country.
      </p>
      <ul className="space-y-4">
        {(books as Book[])?.map((book) => (
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
    </main>
  )
}
