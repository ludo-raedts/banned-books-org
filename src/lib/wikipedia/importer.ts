// Decision logic + DB writes for parsed Wikipedia rows.
//
// Two routes per row:
//
//   auto_approve → committed directly to books / book_authors / bans /
//                  ban_sources / ban_source_links / ban_reason_links inside a
//                  single Postgres transaction (BEGIN/COMMIT per row). Mirrors
//                  src/lib/imports/committer.ts.
//
//   review       → inserted into import_review_queue (upsert on
//                  (source_slug, source_row_id) so a re-run of the same
//                  Wikipedia revid is idempotent). pass_a holds the
//                  structured ParsedRow; pass_b is empty (no second pass for
//                  this route); agreement_class='single-pass-only' is
//                  reused as the semantic label.
//
// Auto-approve gate (all must hold):
//   - quality_flags.length === 0
//   - reason.slug !== null AND reason.confidence === 'high'
//   - dedup.kind === 'none'
//   - row.year !== null
//   - row.authors.length >= 1
//
// Exact duplicates (dedup.kind === 'duplicate') are skipped entirely — no
// write, no review row. Possible_duplicate rows go to review with the
// candidate book_id surfaced so an editor can merge or reject.

import { Client } from 'pg'
import { commitParsedRow, type CommitInput } from '../imports/review-commit'
import { slugify } from '../imports/slugify'
import type { adminClient } from '../supabase'
import type {
  DedupResult,
  ImportDecision,
  ParsedRow,
  QualityFlag,
  ReasonMapping,
  SectionConfig,
  SourceConfig,
} from './types'

type Sb = ReturnType<typeof adminClient>

export type ImporterContext = {
  sourceConfig: SourceConfig
  page: string
  revid: number
}

export type DecideInput = {
  row: ParsedRow
  reason: ReasonMapping
  reasonFlags: QualityFlag[]
  dedup: DedupResult
}

export function decide(input: DecideInput): ImportDecision {
  const { row, reason, reasonFlags, dedup } = input
  const flags: QualityFlag[] = [...row.quality_flags, ...reasonFlags]
  if (dedup.kind === 'possible_duplicate') flags.push('possible_duplicate')

  const eligible =
    flags.length === 0 &&
    reason.slug !== null &&
    reason.confidence === 'high' &&
    row.year !== null &&
    row.authors.length >= 1 &&
    dedup.kind === 'none'

  if (eligible) {
    return { mode: 'auto_approve', row, reason }
  }
  return { mode: 'review', row, reason, dedup, quality_flags: flags }
}

export type CommitResult =
  | { mode: 'auto_approve'; book_id: number; ban_id: number }
  | { mode: 'review'; review_queue_id: number }
  | { mode: 'skip_duplicate'; existing_book_id: number }

export async function commitDecision(
  sb: Sb,
  pg: Client,
  ctx: ImporterContext,
  section: SectionConfig,
  decision: ImportDecision,
  dedup: DedupResult,
): Promise<CommitResult> {
  if (dedup.kind === 'duplicate') {
    return { mode: 'skip_duplicate', existing_book_id: dedup.book_id }
  }
  if (decision.mode === 'auto_approve') {
    return commitAutoApprove(pg, ctx, section, decision)
  }
  return commitReview(sb, ctx, section, decision)
}

// ----------------------------------------------------------------------------
// Auto-approve path
// ----------------------------------------------------------------------------

async function commitAutoApprove(
  pg: Client,
  ctx: ImporterContext,
  section: SectionConfig,
  decision: Extract<ImportDecision, { mode: 'auto_approve' }>,
): Promise<CommitResult> {
  const { row, reason } = decision
  if (reason.slug === null) {
    throw new Error('commitAutoApprove: reason.slug is null (gate logic should have prevented this)')
  }
  if (row.year === null) {
    throw new Error('commitAutoApprove: row.year is null (gate logic should have prevented this)')
  }

  const input: CommitInput = {
    title: row.title,
    authors: row.authors,
    year: row.year,
    country_code: ctx.sourceConfig.country_code,
    scope_slug: section.scope_default,
    action_type: section.action_type_default,
    ban_status: section.status_default,
    reason_slug: reason.slug,
    description_ban: formatBanDescription(row),
    inclusion_rationale: `Wikipedia bulk import: ${ctx.page} rev ${ctx.revid}`,
    source_url: wikipediaSourceUrl(ctx.page, row.source_anchor),
    source_name: `Wikipedia: ${ctx.page.replace(/_/g, ' ')}`,
    source_type: ctx.sourceConfig.source_type,
  }

  const result = await commitParsedRow(input, pg)
  return { mode: 'auto_approve', book_id: result.book_id, ban_id: result.ban_ids[0] }
}

export function formatBanDescription(row: ParsedRow): string {
  const prefix = row.state ? `State: ${row.state}. ` : ''
  return `${prefix}${row.notes_raw}`.trim()
}

export function wikipediaSourceUrl(page: string, anchor: string): string {
  return `https://en.wikipedia.org/wiki/${page}#${anchor}`
}

// ----------------------------------------------------------------------------
// Review path
// ----------------------------------------------------------------------------

async function commitReview(
  sb: Sb,
  ctx: ImporterContext,
  section: SectionConfig,
  decision: Extract<ImportDecision, { mode: 'review' }>,
): Promise<CommitResult> {
  const { row, reason, dedup, quality_flags } = decision

  // Stable source_row_id per source — slugified title under the section
  // anchor. Survives Wikipedia revid changes; if the same page+title comes
  // up in a later run the upsert updates the row instead of duplicating.
  const titleSlug = slugify(row.title || 'untitled')
  const sourceRowId = `${row.source_anchor}#${titleSlug}`
  const sourceUrl = wikipediaSourceUrl(ctx.page, row.source_anchor)

  const rawInput = {
    section_heading: section.heading,
    section_anchor: row.source_anchor,
    raw_cells: {
      year: row.year,
      title: row.title,
      authors: row.authors,
      state: row.state,
      notes: row.notes_raw,
    },
  }

  // 'single-pass-only' wordt hier hergebruikt voor structured-source
  // extracties. Als wiki-bulk en LLM-pipeline-failures ooit gescheiden
  // moeten worden in analytics, voeg dan een nieuwe enum-waarde toe
  // (vereist DDL).
  const agreementClass = 'single-pass-only'

  const agreementDetails = {
    source: 'wikipedia',
    page: ctx.page,
    revid: ctx.revid,
    section_anchor: row.source_anchor,
    parsed_row: row,
    quality_flags,
    reason_mapping: reason,
    dedup_check: dedup.kind === 'none' ? null : dedup,
  }

  const { data, error } = await sb
    .from('import_review_queue')
    .upsert(
      {
        source_slug: ctx.sourceConfig.source_slug,
        source_row_id: sourceRowId,
        source_url: sourceUrl,
        raw_input: rawInput,
        pass_a_provider: `wikipedia:${ctx.page}`,
        pass_a_output: row,
        pass_b_provider: 'none',
        pass_b_output: {},
        agreement_class: agreementClass,
        agreement_details: agreementDetails,
        status: 'pending_review',
      },
      { onConflict: 'source_slug,source_row_id' },
    )
    .select('id')
    .single()

  if (error) throw new Error(`commitReview: ${error.message}`)
  return { mode: 'review', review_queue_id: data.id as number }
}

export function newPgClient(): Client {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('importer: DATABASE_URL is not set')
  }
  return new Client({ connectionString })
}
