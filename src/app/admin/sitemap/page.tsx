import { adminClient } from '@/lib/supabase'
import AdminTabs from '../admin-tabs'
import SitemapClient from './sitemap-client'
import { SITEMAP_STATIC_ENTRIES } from '@/lib/sitemap-static-entries'

export const dynamic = 'force-dynamic'

export default async function AdminSitemapPage() {
  const supabase = adminClient()

  const [
    { data: countryRows },
    { count: sitemapBookCount },
    { count: sitemapAuthorCount },
    { count: sitemapReasonCount },
  ] = await Promise.all([
    supabase.from('bans').select('country_code').range(0, 9999),
    supabase.from('books').select('*', { count: 'exact', head: true }).not('slug', 'is', null),
    supabase.from('authors').select('*', { count: 'exact', head: true }).not('slug', 'is', null),
    supabase.from('reasons').select('*', { count: 'exact', head: true }).not('slug', 'is', null),
  ])

  const countryCount = new Set((countryRows ?? []).map(r => r.country_code)).size

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">banned-books.org</p>
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <AdminTabs />

      <SitemapClient
        sitemapCounts={{
          static: SITEMAP_STATIC_ENTRIES.length,
          books: sitemapBookCount ?? 0,
          authors: sitemapAuthorCount ?? 0,
          countries: countryCount,
          reasons: sitemapReasonCount ?? 0,
        }}
      />
    </main>
  )
}
