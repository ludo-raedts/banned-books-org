import { adminClient } from '@/lib/supabase'
import AdminTabs from '../admin-tabs'
import SitemapClient from './sitemap-client'
import { getSitemapStaticEntries } from '@/lib/sitemap-static-entries'

export const dynamic = 'force-dynamic'

export default async function AdminSitemapPage() {
  const supabase = adminClient()

  const [
    { count: sitemapCountryCount },
    { count: sitemapBookCount },
    { count: sitemapAuthorCount },
    { count: sitemapReasonCount },
    staticEntries,
    { data: lastSubmissionRow },
  ] = await Promise.all([
    supabase.from('mv_ban_counts').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }).not('slug', 'is', null),
    supabase.from('authors').select('*', { count: 'exact', head: true }).not('slug', 'is', null),
    supabase.from('reasons').select('*', { count: 'exact', head: true }).not('slug', 'is', null),
    getSitemapStaticEntries(),
    supabase
      .from('indexnow_submissions')
      .select('submitted_at, kind, url_count, ok')
      .eq('ok', true)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">banned-books.org</p>
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <AdminTabs />

      <SitemapClient
        sitemapCounts={{
          static: staticEntries.length,
          books: sitemapBookCount ?? 0,
          authors: sitemapAuthorCount ?? 0,
          countries: sitemapCountryCount ?? 0,
          reasons: sitemapReasonCount ?? 0,
        }}
        lastSubmission={
          lastSubmissionRow
            ? {
                submittedAt: lastSubmissionRow.submitted_at,
                kind: lastSubmissionRow.kind as 'full' | 'delta',
                urlCount: lastSubmissionRow.url_count,
              }
            : null
        }
      />
    </main>
  )
}
