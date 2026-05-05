import { adminClient } from '@/lib/supabase'
import AuthorsListClient from './authors-list-client'

export const dynamic = 'force-dynamic'

export type AuthorListItem = {
  id: number
  slug: string
  display_name: string
  bio: string | null
  photo_url: string | null
  birth_year: number | null
}

export default async function AdminAuthorsPage() {
  const supabase = adminClient()

  // Paginate through all authors (Supabase caps at 1000/request)
  let all: AuthorListItem[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('authors')
      .select('id, slug, display_name, bio, photo_url, birth_year')
      .order('display_name', { ascending: true })
      .range(offset, offset + 999)
    if (error || !data || data.length === 0) break
    all = all.concat(data as AuthorListItem[])
    if (data.length < 1000) break
    offset += 1000
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Authors</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{all.length.toLocaleString()} authors in catalogue</p>
        </div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">← Admin dashboard</a>
      </div>
      <AuthorsListClient authors={all} />
    </main>
  )
}
