import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { WIKIPEDIA_SOURCES } from '@/lib/wikipedia/config'
import DetailClient, { type DetailViewData } from './detail-client'

export const dynamic = 'force-dynamic'

type QueueStatus = 'pending_review' | 'approved' | 'rejected' | 'deferred'

type ParsedRowShape = {
  title?: string
  title_native?: string | null
  title_english_meaningful?: string | null
  authors?: string[]
  year?: number | null
  state?: string | null
  notes_raw?: string
  source_anchor?: string
  quality_flags?: string[]
}

type AgreementDetails = {
  source?: string
  page?: string
  revid?: number
  section_anchor?: string
  parsed_row?: ParsedRowShape
  quality_flags?: string[]
  reason_mapping?: { slug: string | null; confidence: string }
  dedup_check?: { kind: string; book_id?: number; similarity?: number; match_type?: string } | null
}

type RawQueueRow = {
  id: number
  source_slug: string
  source_row_id: string
  source_url: string | null
  status: QueueStatus
  agreement_details: AgreementDetails | null
  pass_a_provider: string
  raw_input: unknown
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  approved_book_id: number | null
  approved_bans: unknown
}

export default async function ImportReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (!Number.isFinite(id)) notFound()

  const sb = adminClient()

  const { data: row, error } = await sb
    .from('import_review_queue')
    .select('id, source_slug, source_row_id, source_url, status, agreement_details, pass_a_provider, raw_input, created_at, reviewed_at, reviewed_by, review_notes, approved_book_id, approved_bans')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`detail fetch: ${error.message}`)
  if (!row) notFound()

  const queueRow = row as unknown as RawQueueRow
  const parsed = queueRow.agreement_details?.parsed_row ?? {}
  const dedup = queueRow.agreement_details?.dedup_check ?? null
  const reasonSuggestion = queueRow.agreement_details?.reason_mapping ?? null

  // Resolve possible duplicate's existing book for the editor.
  let duplicateBook: { slug: string; title: string; first_published_year: number | null } | null = null
  if (dedup?.book_id) {
    const dupRes = await sb
      .from('books')
      .select('slug, title, first_published_year')
      .eq('id', dedup.book_id)
      .maybeSingle()
    if (!dupRes.error && dupRes.data) {
      duplicateBook = dupRes.data as unknown as typeof duplicateBook
    }
  }

  const [reasonsRes, scopesRes] = await Promise.all([
    sb.from('reasons').select('slug, label_en').order('label_en', { ascending: true }),
    sb.from('scopes').select('slug, label_en').order('label_en', { ascending: true }),
  ])
  if (reasonsRes.error) throw new Error(`reasons fetch: ${reasonsRes.error.message}`)
  if (scopesRes.error) throw new Error(`scopes fetch: ${scopesRes.error.message}`)

  // Pick a default scope for the form prefill. Wikipedia config's section
  // defaults are the most accurate seed; falling back to 'government' covers
  // historical / non-wiki sources.
  const wikiCfg = findWikipediaConfig(queueRow.source_slug)
  const sectionDefault = wikiCfg?.sections.find(
    s => s.heading.toLowerCase().replace(/\s+/g, '_') === parsed.source_anchor ||
         (parsed.source_anchor && parsed.source_anchor.toLowerCase().includes(s.heading.toLowerCase().replace(/\s+/g, '_'))),
  ) ?? wikiCfg?.sections[0] ?? null

  const detail: DetailViewData = {
    id: queueRow.id,
    source_slug: queueRow.source_slug,
    source_url: queueRow.source_url,
    status: queueRow.status,
    created_at: queueRow.created_at,
    reviewed_at: queueRow.reviewed_at,
    reviewed_by: queueRow.reviewed_by,
    page: queueRow.agreement_details?.page ?? null,
    revid: queueRow.agreement_details?.revid ?? null,
    section_anchor: parsed.source_anchor ?? queueRow.agreement_details?.section_anchor ?? '',
    parsed: {
      title: parsed.title ?? '',
      title_native: parsed.title_native ?? null,
      title_english_meaningful: parsed.title_english_meaningful ?? null,
      authors: parsed.authors ?? [],
      year: parsed.year ?? null,
      state: parsed.state ?? null,
      notes_raw: parsed.notes_raw ?? '',
    },
    quality_flags: queueRow.agreement_details?.quality_flags ?? [],
    dedup: dedup ? {
      kind: dedup.kind,
      book_id: dedup.book_id ?? null,
      similarity: dedup.similarity ?? null,
    } : null,
    duplicate_book: duplicateBook,
    reason_suggestion: reasonSuggestion,
    section_defaults: sectionDefault ? {
      action_type: sectionDefault.action_type_default,
      scope_slug: sectionDefault.scope_default,
      ban_status: sectionDefault.status_default,
    } : null,
    approved_book_id: queueRow.approved_book_id,
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a
          href="/admin/import-review"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← Back to review queue
        </a>
      </div>
      <DetailClient
        data={detail}
        reasons={(reasonsRes.data ?? []) as Array<{ slug: string; label_en: string }>}
        scopes={(scopesRes.data ?? []) as Array<{ slug: string; label_en: string }>}
      />
    </main>
  )
}

function findWikipediaConfig(sourceSlug: string) {
  for (const cfg of Object.values(WIKIPEDIA_SOURCES)) {
    if (cfg.source_slug === sourceSlug) return cfg
  }
  return null
}
