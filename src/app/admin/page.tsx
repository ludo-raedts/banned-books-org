import { adminClient } from '@/lib/supabase'
import AdminDashboardClient from './admin-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = adminClient()

  const [
    { count: bookCount },
    { count: newsCount },
    { count: banCount },
    reviewQueueRes,
    { data: countryRows },
    { data: refreshLog },
  ] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('news_items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('bans').select('*', { count: 'exact', head: true }),
    supabase.from('import_review_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('bans').select('country_code').range(0, 9999),
    supabase.from('mv_refresh_log').select('key, updated_at'),
  ])
  // `import_review_queue` is new (Sprint A Task 2A); fail soft so the page
  // still renders if the migration hasn't run on a given env.
  const reviewQueuePending = reviewQueueRes.error ? 0 : (reviewQueueRes.count ?? 0)

  const countryCount = new Set((countryRows ?? []).map(r => r.country_code)).size
  const logMap = new Map((refreshLog ?? []).map(r => [r.key, r.updated_at as string]))
  const dataLastChanged  = logMap.get('data_last_changed') ?? null
  const viewsLastRefreshed = logMap.get('last_refreshed') ?? null
  const datasetBuiltAt = logMap.get('dataset_built_at') ?? null

  // ── Dataset orders & download stats ──────────────────────────────────────────
  // Suspicious threshold: a single order should not need to download more than
  // ~5–10 times in 30 days. >10 plausibly means the link was shared.
  const SUSPICIOUS_DOWNLOADS_THRESHOLD = 10
  const { data: datasetOrders } = await supabase
    .from('dataset_orders')
    .select('amount_cents, currency, paid_at, downloads_count')
  const datasetOrderRows = datasetOrders ?? []
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

  // ── DB size (Supabase plan-limit watch) ──────────────────────────────────────
  // Limit defaults to 8 GB (Pro tier). Override with SUPABASE_DB_LIMIT_GB.
  let dbSizeBytes: number | null = null
  let pageviewsSizeBytes: number | null = null
  let pageviewsRows: number | null = null
  try {
    const { data: stats } = await supabase.rpc('admin_db_stats')
    if (stats && typeof stats === 'object') {
      dbSizeBytes = Number((stats as Record<string, unknown>).db_size_bytes ?? 0) || null
      pageviewsSizeBytes = Number((stats as Record<string, unknown>).pageviews_size_bytes ?? 0)
      pageviewsRows = Number((stats as Record<string, unknown>).pageviews_rows ?? 0)
    }
  } catch {
    // RPC not yet deployed — card hides the size row gracefully
  }
  const dbLimitGb = Number(process.env.SUPABASE_DB_LIMIT_GB ?? '8')
  const dbLimitBytes = dbLimitGb * 1024 * 1024 * 1024

  // ── Inbox preview (last 5 mails, refreshed hourly by cron) ───────────────────
  let inboxRows: import('./admin-dashboard-client').InboxRow[] = []
  let inboxFetchedAt: string | null = null
  try {
    const { data: inbox } = await supabase
      .from('inbox_preview')
      .select('uid, from_name, from_address, subject, snippet, received_at, is_unread, fetched_at')
      .order('received_at', { ascending: false })
      .limit(5)
    if (inbox && inbox.length > 0) {
      inboxRows = inbox.map(r => ({
        uid: Number(r.uid),
        fromName: r.from_name ?? null,
        fromAddress: r.from_address ?? null,
        subject: r.subject ?? null,
        snippet: r.snippet ?? '',
        receivedAt: r.received_at ?? null,
        isUnread: Boolean(r.is_unread),
      }))
      inboxFetchedAt = inbox[0].fetched_at ?? null
    }
  } catch {
    // table not yet migrated — card hides gracefully
  }

  return (
    <AdminDashboardClient
      bookCount={bookCount ?? 0}
      newsCount={newsCount ?? 0}
      banCount={banCount ?? 0}
      countryCount={countryCount}
      reviewQueuePending={reviewQueuePending}
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
