import { adminClient } from '@/lib/supabase'
import { getNewsConfig } from '@/config/news'
import NewsAdminClient from './news-admin-client'

export const dynamic = 'force-dynamic'

const SELECT_COLS = 'id, title, headline, source_name, source_url, published_at, summary, source_language, original_title, original_summary'

export default async function AdminNewsPage() {
  const supabase = adminClient()
  const [{ data: drafts }, { data: published }, config] = await Promise.all([
    supabase
      .from('news_items')
      .select(SELECT_COLS)
      .eq('status', 'draft')
      .order('published_at', { ascending: false }),
    // Recent 50 — enough to catch and undo a bad auto-publish run without
    // turning the admin page into the full archive. Ordered by created_at
    // (ingest time) so today's auto-published items appear at the top,
    // even when the source article's published_at is older than items
    // we manually reviewed yesterday.
    supabase
      .from('news_items')
      .select(`${SELECT_COLS}, auto_published`)
      .eq('status', 'published')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(50),
    getNewsConfig(),
  ])

  const items = drafts ?? []
  const publishedItems = published ?? []

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">News drafts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{items.length} item{items.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">← Admin dashboard</a>
      </div>
      <NewsAdminClient
        initialItems={items}
        initialPublished={publishedItems}
        initialConfig={config}
      />
    </main>
  )
}
