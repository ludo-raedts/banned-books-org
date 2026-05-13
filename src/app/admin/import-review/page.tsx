import { adminClient } from '@/lib/supabase'
import ImportReviewListClient, { type QueueListItem, type QueueStatus } from './list-client'

export const dynamic = 'force-dynamic'

type AgreementDetails = {
  source?: string
  page?: string
  revid?: number
  section_anchor?: string
  parsed_row?: {
    title?: string
    title_native?: string | null
    title_english_meaningful?: string | null
    authors?: string[]
    year?: number | null
    state?: string | null
    notes_raw?: string
    source_anchor?: string
  }
  quality_flags?: string[]
  dedup_check?: { kind: string; book_id?: number; similarity?: number } | null
}

type RawQueueRow = {
  id: number
  source_slug: string
  source_url: string | null
  status: QueueStatus
  agreement_details: AgreementDetails | null
  created_at: string
}

export default async function ImportReviewPage() {
  const sb = adminClient()

  // Paginate through the whole queue. Supabase caps at 1000/request; we sort
  // by id so .range() is deterministic across pages (per
  // feedback_supabase_pagination memory).
  let all: RawQueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, source_url, status, agreement_details, created_at')
      .order('id', { ascending: false })
      .range(offset, offset + 999)
    if (error) {
      throw new Error(`import-review list: ${error.message}`)
    }
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as RawQueueRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  const [reasonsRes, scopesRes] = await Promise.all([
    sb.from('reasons').select('slug, label_en').order('label_en', { ascending: true }),
    sb.from('scopes').select('slug, label_en').order('label_en', { ascending: true }),
  ])
  if (reasonsRes.error) throw new Error(`import-review reasons: ${reasonsRes.error.message}`)
  if (scopesRes.error) throw new Error(`import-review scopes: ${scopesRes.error.message}`)
  const reasons = (reasonsRes.data ?? []) as Array<{ slug: string; label_en: string }>
  const scopes = (scopesRes.data ?? []) as Array<{ slug: string; label_en: string }>

  const items: QueueListItem[] = all.map(r => {
    const parsed = r.agreement_details?.parsed_row ?? null
    const dedup = r.agreement_details?.dedup_check ?? null
    return {
      id: r.id,
      source_slug: r.source_slug,
      source_url: r.source_url,
      status: r.status,
      title: parsed?.title ?? '',
      authors: parsed?.authors ?? [],
      year: parsed?.year ?? null,
      state: parsed?.state ?? null,
      section_anchor: parsed?.source_anchor ?? r.agreement_details?.section_anchor ?? '',
      quality_flags: r.agreement_details?.quality_flags ?? [],
      dedup_kind: dedup?.kind ?? null,
      dedup_book_id: dedup?.book_id ?? null,
    }
  })

  const counts: Record<QueueStatus, number> = {
    pending_review: 0,
    approved: 0,
    rejected: 0,
    deferred: 0,
  }
  for (const it of items) counts[it.status]++

  const sourceSlugs = Array.from(new Set(items.map(i => i.source_slug))).sort()

  // Flag counts across the *pending* set — the most useful denominator for an
  // operator who's about to triage. Counts shift as rows are approved/rejected
  // so they always reflect "what's still left to look at".
  const flagCounts = new Map<string, number>()
  for (const it of items) {
    if (it.status !== 'pending_review') continue
    for (const flag of it.quality_flags) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1)
    }
  }
  const flagOptions = Array.from(flagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([flag, count]) => ({ flag, count }))

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
            Step 2 of 4 · Import pipeline
          </p>
          <h1 className="text-2xl font-bold">Review queue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {counts.pending_review.toLocaleString('en')} pending,{' '}
            {counts.approved.toLocaleString('en')} approved,{' '}
            {counts.rejected.toLocaleString('en')} rejected,{' '}
            {counts.deferred.toLocaleString('en')} deferred
          </p>
        </div>
        <a
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          ← Admin dashboard
        </a>
      </div>

      {/* Pipeline-context banner — answers "has this been through GPT yet?" */}
      <div className="mb-6 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
        <p className="font-medium mb-1">These items have been verified by two LLMs, not enriched.</p>
        <p className="text-xs leading-relaxed text-blue-800/90 dark:text-blue-100/80">
          Gemini-2.5-pro (Pass A) and GPT-4o (Pass B) ran on each row to check field agreement and gate decisions —
          the LLM outputs only drive routing. <strong>Approval creates bare <code className="font-mono text-[11px]">books</code> and{' '}
          <code className="font-mono text-[11px]">bans</code> rows</strong> with the metadata you confirm in the form.
          Covers, descriptions, ban context, and reason classifications are filled afterward by running{' '}
          <a href="/admin/scripts#after-approval" className="font-mono text-[11px] underline hover:no-underline">enrich-all.ts</a>.
        </p>
      </div>

      <ImportReviewListClient
        items={items}
        sourceSlugs={sourceSlugs}
        flagOptions={flagOptions}
        statusCounts={counts}
        reasons={reasons}
        scopes={scopes}
      />
    </main>
  )
}
