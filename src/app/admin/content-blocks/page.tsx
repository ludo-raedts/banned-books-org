import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import AdminBackLink from '@/components/admin-back-link'
import { REQUIRED_BLOCKS_BY_PAGE, type ContentBlockRow } from '@/lib/content-blocks'

export const dynamic = 'force-dynamic'

// Friendly page labels in the same order as REQUIRED_BLOCKS_BY_PAGE — one
// "section" per public page that uses content blocks.
const PAGE_LABELS: Record<string, string> = {
  'bbw-hub': 'Banned Books Week — hub',
  'bbw-tile': 'Banned Books Week — homepage tile',
  'reading-club-hub': 'Reading Club — hub',
  'reading-club-currently-challenged': 'Reading Club — Currently Challenged',
  'reading-club-international': 'Reading Club — International',
  'reading-club-classics': 'Reading Club — Classics',
  'reading-club-themes': 'Reading Club — By Theme',
  'theme-lgbtq': 'Theme — LGBTQ+',
  'theme-political-dissent': 'Theme — Political dissent',
  'theme-religious-censorship': 'Theme — Religious censorship',
  'theme-race-and-racism': 'Theme — Race and racism',
  'theme-sexuality': 'Theme — Sexuality',
}

function StatusPill({ status }: { status: ContentBlockRow['status'] }) {
  const styles: Record<ContentBlockRow['status'], string> = {
    placeholder: 'bg-gray-200 text-gray-700',
    draft:       'bg-amber-100 text-amber-800',
    published:   'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  )
}

export default async function AdminContentBlocksPage() {
  const { data } = await adminClient()
    .from('content_blocks')
    .select('slug, title, status, last_edited_at, published_at')
    .order('slug')

  const blocks = (data ?? []) as Pick<ContentBlockRow, 'slug' | 'title' | 'status' | 'last_edited_at' | 'published_at'>[]
  const bySlug = new Map(blocks.map(b => [b.slug, b]))

  const pages = Object.entries(REQUIRED_BLOCKS_BY_PAGE).map(([pageKey, slugs]) => {
    const rows = slugs.map(slug => bySlug.get(slug)).filter((r): r is typeof blocks[number] => r != null)
    const publishedCount = rows.filter(r => r.status === 'published').length
    return {
      pageKey,
      label: PAGE_LABELS[pageKey] ?? pageKey,
      rows,
      publishedCount,
      total: slugs.length,
      ready: publishedCount === slugs.length,
    }
  })

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content blocks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Editorial markdown for Banned Books Week and the Reading Club. Pages cannot go live until every required block is published.
          </p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      <div className="flex flex-col gap-6">
        {pages.map(page => (
          <section key={page.pageKey} className="border border-gray-200 rounded-xl bg-white">
            <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{page.label}</h2>
              <span className={`text-xs ${page.ready ? 'text-green-700' : 'text-gray-500'}`}>
                {page.publishedCount} / {page.total} published
              </span>
            </header>
            <ul className="divide-y divide-gray-100">
              {page.rows.map(row => (
                <li key={row.slug} className="px-4 py-3 flex items-center gap-3">
                  <Link
                    href={`/admin/content-blocks/${row.slug}`}
                    className="flex-1 group"
                  >
                    <div className="text-sm font-medium group-hover:text-brand transition-colors">{row.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{row.slug}</div>
                  </Link>
                  <StatusPill status={row.status} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
