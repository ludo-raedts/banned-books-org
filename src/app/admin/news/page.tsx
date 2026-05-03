import { adminClient } from '@/lib/supabase'
import NewsAdminClient from './news-admin-client'

export const dynamic = 'force-dynamic'

export default async function AdminNewsPage() {
  const { data } = await adminClient()
    .from('news_items')
    .select('id, title, source_name, source_url, published_at, summary')
    .eq('status', 'draft')
    .order('published_at', { ascending: false })

  const items = data ?? []

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">News drafts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{items.length} item{items.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/admin/books" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Books</a>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">← Site</a>
        </div>
      </div>
      <NewsAdminClient initialItems={items} />
    </main>
  )
}
