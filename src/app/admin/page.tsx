import { adminClient } from '@/lib/supabase'
import AdminDashboardClient from './admin-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = adminClient()

  const [
    { count: bookCount },
    { count: newsCount },
    { count: banCount },
    { count: noCoverCount },
    { count: noDescCount },
    { data: countryRows },
  ] = await Promise.all([
    // rows: 0 (count only) × 5 | reason: dashboard stat cards
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('news_items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }).is('cover_url', null),
    supabase.from('books').select('*', { count: 'exact', head: true }).is('description_book', null),
    // rows: ≤10000 | fields: [country_code] | reason: COUNT(DISTINCT) unavailable in PostgREST
    supabase.from('bans').select('country_code').range(0, 9999),
  ])

  const countryCount = new Set((countryRows ?? []).map(r => r.country_code)).size

  return (
    <AdminDashboardClient
      bookCount={bookCount ?? 0}
      newsCount={newsCount ?? 0}
      banCount={banCount ?? 0}
      countryCount={countryCount}
      noCoverCount={noCoverCount ?? 0}
      noDescCount={noDescCount ?? 0}
    />
  )
}
