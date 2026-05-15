import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { getQueueSectionDefaults, getQueueSourceContext } from '@/lib/imports/review-approve'
import { inferScriptAndLanguage } from '@/lib/imports/language-inference'
import DetailClient, { type DetailViewData } from './detail-client'

export const dynamic = 'force-dynamic'

type QueueStatus = 'pending_review' | 'approved' | 'rejected' | 'deferred'

type ParsedRowShape = {
  title?: string
  title_native?: string | null
  title_transliterated?: string | null
  title_english_meaningful?: string | null
  original_language?: string | null
  authors?: string[]
  year?: number | null
  state?: string | null
  notes_raw?: string
  source_anchor?: string
  quality_flags?: string[]
}

type LlmPrefillMeta = {
  model: string
  prompt_version: string
  ran_at: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  changed_fields: string[]
  notes?: string
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
  llm_prefill?: LlmPrefillMeta
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

type RawBookRow = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  first_published_year: number | null
  isbn13: string | null
  cover_url: string | null
  description: string | null
  description_book: string | null
  ai_drafted: boolean | null
  genres: string[] | null
  book_authors: Array<{ authors: { display_name: string; slug: string } | null }> | null
}

type RawBanRow = {
  id: number
  country_code: string
  year_started: number | null
  year_ended: number | null
  action_type: string
  status: string
  region: string | null
  institution: string | null
  description: string | null
  scopes: { slug: string; label_en: string } | null
  ban_source_links: Array<{
    ban_sources: { source_name: string; source_url: string } | null
  }> | null
}

export type DuplicateBookSummary = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  first_published_year: number | null
  isbn13: string | null
  cover_url: string | null
  description: string | null
  description_book: string | null
  ai_drafted: boolean | null
  genres: string[]
  authors: Array<{ display_name: string; slug: string }>
}

export type ExistingBanSummary = {
  id: number
  country_code: string
  year_started: number | null
  year_ended: number | null
  action_type: string
  status: string
  region: string | null
  institution: string | null
  description: string | null
  scope_slug: string | null
  scope_label: string | null
  sources: Array<{ name: string; url: string }>
}

export type SlugAlias = {
  slug: string
  source: string
  created_at: string
}

function toBanSummary(b: RawBanRow): ExistingBanSummary {
  return {
    id: b.id,
    country_code: b.country_code,
    year_started: b.year_started,
    year_ended: b.year_ended,
    action_type: b.action_type,
    status: b.status,
    region: b.region,
    institution: b.institution,
    description: b.description,
    scope_slug: b.scopes?.slug ?? null,
    scope_label: b.scopes?.label_en ?? null,
    sources: (b.ban_source_links ?? [])
      .map(l => l.ban_sources)
      .filter((s): s is { source_name: string; source_url: string } => s !== null)
      .map(s => ({ name: s.source_name, url: s.source_url })),
  }
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

  // Resolve possible duplicate's existing book for the editor — full shape
  // for the merge-decision panel: book fields, existing bans, slug aliases.
  // All three queries are independent; run them in parallel when a candidate
  // book_id is present.
  let duplicateBook:
    | (DuplicateBookSummary & {
        existing_bans: ExistingBanSummary[]
        slug_aliases: SlugAlias[]
      })
    | null = null
  if (dedup?.book_id) {
    const [bookRes, bansRes, aliasRes] = await Promise.all([
      sb.from('books')
        .select(
          'id, slug, title, title_native, title_transliterated, title_english_meaningful, ' +
          'original_language, first_published_year, isbn13, cover_url, ' +
          'description, description_book, ai_drafted, genres, ' +
          'book_authors(authors(display_name, slug))',
        )
        .eq('id', dedup.book_id)
        .maybeSingle(),
      sb.from('bans')
        .select(
          'id, country_code, year_started, year_ended, action_type, status, ' +
          'region, institution, description, scopes(slug, label_en), ' +
          'ban_source_links(ban_sources(source_name, source_url))',
        )
        .eq('book_id', dedup.book_id)
        .order('year_started', { ascending: true, nullsFirst: false }),
      sb.from('book_slug_aliases')
        .select('slug, source, created_at')
        .eq('book_id', dedup.book_id)
        .order('created_at', { ascending: true }),
    ])
    if (!bookRes.error && bookRes.data) {
      const b = bookRes.data as unknown as RawBookRow
      duplicateBook = {
        id: b.id,
        slug: b.slug,
        title: b.title,
        title_native: b.title_native,
        title_transliterated: b.title_transliterated,
        title_english_meaningful: b.title_english_meaningful,
        original_language: b.original_language,
        first_published_year: b.first_published_year,
        isbn13: b.isbn13,
        cover_url: b.cover_url,
        description: b.description,
        description_book: b.description_book,
        ai_drafted: b.ai_drafted,
        genres: b.genres ?? [],
        authors: (b.book_authors ?? [])
          .map(ba => ba.authors)
          .filter((a): a is { display_name: string; slug: string } => a !== null),
        existing_bans: bansRes.error
          ? []
          : ((bansRes.data ?? []) as unknown as RawBanRow[]).map(toBanSummary),
        slug_aliases: aliasRes.error
          ? []
          : ((aliasRes.data ?? []) as unknown as SlugAlias[]),
      }
    }
  }

  const [reasonsRes, scopesRes] = await Promise.all([
    sb.from('reasons').select('slug, label_en').order('label_en', { ascending: true }),
    sb.from('scopes').select('slug, label_en').order('label_en', { ascending: true }),
  ])
  if (reasonsRes.error) throw new Error(`reasons fetch: ${reasonsRes.error.message}`)
  if (scopesRes.error) throw new Error(`scopes fetch: ${scopesRes.error.message}`)

  // Pick a default scope for the form prefill. Wikipedia config's section
  // defaults are the most accurate seed; falling back to stored
  // agreement_details.source_context (written at queue-insert time) covers
  // the case where the slug isn't in this deployed bundle's WIKIPEDIA_SOURCES
  // (e.g. queue row was inserted by a newer import build).
  const sectionDefaults = getQueueSectionDefaults(
    queueRow.source_slug,
    queueRow.agreement_details,
  )

  // Pre-fill the original_language input based on the script of title_native
  // plus the source country (from WIKIPEDIA_SOURCES or the stored snapshot).
  // Wrapped in try/catch because getQueueSourceContext throws when neither
  // live config nor stored source_context has a country_code — in that case
  // we just skip the suggestion and the form starts empty (same as today).
  let inferredLanguage: string | null = null
  let inferredScript: string | null = null
  try {
    const ctx = getQueueSourceContext(
      queueRow.source_slug,
      queueRow.agreement_details,
      queueRow.source_url,
    )
    const inferred = inferScriptAndLanguage(
      parsed.title_native ?? null,
      ctx.country_code,
      parsed.state ?? null,
    )
    inferredLanguage = inferred.language
    inferredScript = inferred.script
  } catch {
    // No source context available — leave suggestions null.
  }

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
    duplicate_book: duplicateBook
      ? {
          slug: duplicateBook.slug,
          title: duplicateBook.title,
          first_published_year: duplicateBook.first_published_year,
        }
      : null,
    duplicate_book_full: duplicateBook,
    reason_suggestion: reasonSuggestion,
    section_defaults: sectionDefaults,
    // language_suggestion priority: explicit LLM pre-fill (script wrote it
     // into parsed_row.original_language) wins over deterministic
     // script+country inference. Both fall through to null when neither
     // produces a value.
    language_suggestion: parsed.original_language
      ? { language: parsed.original_language, script: inferredScript }
      : inferredLanguage
        ? { language: inferredLanguage, script: inferredScript }
        : null,
    llm_prefill: queueRow.agreement_details?.llm_prefill ?? null,
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

