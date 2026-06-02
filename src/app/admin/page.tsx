import { adminClient } from '@/lib/supabase'
import AdminDashboardClient from './admin-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = adminClient()

  // `approvedLast7Days` window — anchors the "Approve" pipeline phase count.
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: bookCount },
    { count: newsCount },
    { count: banCount },
    reviewQueueRes,
    approvedRecentRes,
    needsEnrichmentRes,
    { count: countryCountRaw },
    { data: refreshLog },
  ] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('news_items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('import_review_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('import_review_queue').select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('reviewed_at', sevenDaysAgoIso),
    // Books missing at least one enrichable field — approximates "pending enrichment"
    // without a dedicated flag column. ISBN deliberately excluded: it's nice-to-have, not editorial.
    supabase.from('books').select('*', { count: 'exact', head: true })
      .or('description_book.is.null,cover_url.is.null,description_ban.is.null'),
    supabase.from('countries').select('*', { count: 'exact', head: true }),
    supabase.from('mv_refresh_log').select('key, updated_at'),
  ])
  // `import_review_queue` is new (Sprint A Task 2A); fail soft so the page
  // still renders if the migration hasn't run on a given env.
  const reviewQueuePending = reviewQueueRes.error ? 0 : (reviewQueueRes.count ?? 0)
  const approvedLast7Days = approvedRecentRes.error ? 0 : (approvedRecentRes.count ?? 0)
  const needsEnrichment = needsEnrichmentRes.error ? 0 : (needsEnrichmentRes.count ?? 0)

  const countryCount = countryCountRaw ?? 0
  const logMap = new Map((refreshLog ?? []).map(r => [r.key, r.updated_at as string]))
  const dataLastChanged  = logMap.get('data_last_changed') ?? null
  const viewsLastRefreshed = logMap.get('last_refreshed') ?? null
  const datasetBuiltAt = logMap.get('dataset_built_at') ?? null

  // ── Dataset orders + DB size + inbox preview ────────────────────────────────
  // Three independent reads — run them concurrently rather than as a waterfall.
  // The DB-stats RPC and inbox table may not exist on every env, so each fails
  // soft to a neutral default and the corresponding card hides gracefully.
  const SUSPICIOUS_DOWNLOADS_THRESHOLD = 10
  const dbLimitGb = Number(process.env.SUPABASE_DB_LIMIT_GB ?? '8')
  const dbLimitBytes = dbLimitGb * 1024 * 1024 * 1024

  const [datasetOrdersRes, dbStats, inboxResult] = await Promise.all([
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
    (async () => {
      try {
        const { data: inbox } = await supabase
          .from('inbox_preview')
          .select('uid, from_name, from_address, subject, snippet, received_at, is_unread, fetched_at')
          .order('received_at', { ascending: false })
          .limit(5)
        if (inbox && inbox.length > 0) {
          return {
            rows: inbox.map(r => ({
              uid: Number(r.uid),
              fromName: r.from_name ?? null,
              fromAddress: r.from_address ?? null,
              subject: r.subject ?? null,
              snippet: r.snippet ?? '',
              receivedAt: r.received_at ?? null,
              isUnread: Boolean(r.is_unread),
            })),
            fetchedAt: (inbox[0].fetched_at ?? null) as string | null,
          }
        }
      } catch {
        // table not yet migrated — card hides gracefully
      }
      return {
        rows: [] as import('./admin-dashboard-client').InboxRow[],
        fetchedAt: null as string | null,
      }
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
  const inboxRows = inboxResult.rows
  const inboxFetchedAt = inboxResult.fetchedAt

  return (
    <AdminDashboardClient
      bookCount={bookCount ?? 0}
      newsCount={newsCount ?? 0}
      banCount={banCount ?? 0}
      countryCount={countryCount}
      reviewQueuePending={reviewQueuePending}
      approvedLast7Days={approvedLast7Days}
      needsEnrichment={needsEnrichment}
      dbSizeBytes={dbSizeBytes}
      dbLimitBytes={dbLimitBytes}
      pageviewsSizeBytes={pageviewsSizeBytes}
      pageviewsRows={pageviewsRows}
      dataLastChanged={dataLastChanged}
      viewsLastRefreshed={viewsLastRefreshed}
      datasetStats={datasetStats}
      inboxRows={inboxRows}
      inboxFetchedAt={inboxFetchedAt}
    />
  )
}
