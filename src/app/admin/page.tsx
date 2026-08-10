import { adminClient } from '@/lib/supabase'
import AdminDashboardClient from './admin-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = adminClient()


  const [
    { count: bookCount },
    { count: authorCount },
    { count: newsCount },
    { count: banCount },
    needsEnrichmentRes,
    { count: countryCountRaw },
    { data: refreshLog },
  ] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('authors').select('*', { count: 'exact', head: true }),
    supabase.from('news_items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    // Books missing at least one enrichable field — approximates "pending enrichment"
    // without a dedicated flag column. ISBN deliberately excluded: it's nice-to-have, not editorial.
    supabase.from('books').select('*', { count: 'exact', head: true })
      .or('description_book.is.null,cover_url.is.null,description_ban.is.null'),
    supabase.from('countries').select('*', { count: 'exact', head: true }),
    supabase.from('mv_refresh_log').select('key, updated_at'),
  ])
  const needsEnrichment = needsEnrichmentRes.error ? 0 : (needsEnrichmentRes.count ?? 0)

  const countryCount = countryCountRaw ?? 0
  const logMap = new Map((refreshLog ?? []).map(r => [r.key, r.updated_at as string]))
  const dataLastChanged  = logMap.get('data_last_changed') ?? null
  const viewsLastRefreshed = logMap.get('last_refreshed') ?? null
  const datasetBuiltAt = logMap.get('dataset_built_at') ?? null

  // ── Dataset orders + DB size ────────────────────────────────────────────────
  // Independent reads — run them concurrently rather than as a waterfall.
  // The DB-stats RPC may not exist on every env, so it fails soft to a
  // neutral default and the corresponding card hides gracefully.
  const SUSPICIOUS_DOWNLOADS_THRESHOLD = 10
  const dbLimitGb = Number(process.env.SUPABASE_DB_LIMIT_GB ?? '8')
  const dbLimitBytes = dbLimitGb * 1024 * 1024 * 1024

  const [datasetOrdersRes, dbStats] = await Promise.all([
    supabase.from('dataset_orders').select('amount_cents, currency, paid_at, downloads_count'),
    (async () => {
      try {
        const { data: stats } = await supabase.rpc('admin_db_stats')
        if (stats && typeof stats === 'object') {
          const s = stats as Record<string, unknown>
          return {
            dbSizeBytes: Number(s.db_size_bytes ?? 0) || null,
            pageviewsSizeBytes: Number(s.pageviews_size_bytes ?? 0),
            pageviewsRows: Number(s.pageviews_rows ?? 0),
          }
        }
      } catch {
        // RPC not yet deployed — card hides the size row gracefully
      }
      return { dbSizeBytes: null, pageviewsSizeBytes: null, pageviewsRows: null }
    })(),
  ])

  const datasetOrderRows = datasetOrdersRes.data ?? []
  const paidDatasetOrders = datasetOrderRows.filter(o => o.paid_at != null)
  const datasetStats = {
    totalOrders: datasetOrderRows.length,
    paidOrders: paidDatasetOrders.length,
    totalRevenueCents: paidDatasetOrders.reduce((sum, o) => sum + (o.amount_cents ?? 0), 0),
    currency: paidDatasetOrders[0]?.currency ?? 'usd',
    totalDownloads: datasetOrderRows.reduce((sum, o) => sum + (o.downloads_count ?? 0), 0),
    maxDownloadsOnSingleOrder: datasetOrderRows.reduce((max, o) => Math.max(max, o.downloads_count ?? 0), 0),
    suspiciousOrderCount: datasetOrderRows.filter(o => (o.downloads_count ?? 0) > SUSPICIOUS_DOWNLOADS_THRESHOLD).length,
    datasetBuiltAt,
    suspiciousThreshold: SUSPICIOUS_DOWNLOADS_THRESHOLD,
  }

  const { dbSizeBytes, pageviewsSizeBytes, pageviewsRows } = dbStats

  return (
    <AdminDashboardClient
      bookCount={bookCount ?? 0}
      authorCount={authorCount ?? 0}
      newsCount={newsCount ?? 0}
      banCount={banCount ?? 0}
      countryCount={countryCount}
      needsEnrichment={needsEnrichment}
      dbSizeBytes={dbSizeBytes}
      dbLimitBytes={dbLimitBytes}
      pageviewsSizeBytes={pageviewsSizeBytes}
      pageviewsRows={pageviewsRows}
      dataLastChanged={dataLastChanged}
      viewsLastRefreshed={viewsLastRefreshed}
      datasetStats={datasetStats}
      isLocalDev={process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production'}
    />
  )
}
