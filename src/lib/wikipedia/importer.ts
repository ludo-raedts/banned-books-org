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
import {
  commitNewBanForBook,
  commitParsedRow,
  type AddBanInput,
  type CommitInput,
} from '../imports/review-commit'
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

  // Baseline quality gates that both auto-paths share. The only difference
  // between auto_approve and auto_add_ban is whether dedup found an existing
  // book to attach the new ban to.
  const baselineEligible =
    flags.length === 0 &&
    reason.slug !== null &&
    reason.confidence === 'high' &&
    row.year !== null &&
    row.authors.length >= 1

  if (baselineEligible && dedup.kind === 'none') {
    return { mode: 'auto_approve', row, reason }
  }
  if (baselineEligible && dedup.kind === 'duplicate') {
    return { mode: 'auto_add_ban', row, reason, dedup }
  }
  return { mode: 'review', row, reason, dedup, quality_flags: flags }
}

export type CommitResult =
  | { mode: 'auto_approve'; book_id: number; ban_id: number }
  | { mode: 'review'; review_queue_id: number }
  | { mode: 'auto_add_ban'; book_id: number; ban_id: number; created: boolean }

export async function commitDecision(
  sb: Sb,
  pg: Client,
  ctx: ImporterContext,
  section: SectionConfig,
  decision: ImportDecision,
): Promise<CommitResult> {
  if (decision.mode === 'auto_approve') {
    return commitAutoApprove(sb, pg, ctx, section, decision)
  }
  if (decision.mode === 'auto_add_ban') {
    return commitAutoAddBan(sb, pg, ctx, section, decision)
  }
  return commitReview(sb, ctx, section, decision)
}

// ----------------------------------------------------------------------------
// Auto-approve path
// ----------------------------------------------------------------------------

async function commitAutoApprove(
  sb: Sb,
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

  const countryCode = section.country_code ?? ctx.sourceConfig.country_code
  if (!countryCode) {
    throw new Error(
      `commitAutoApprove: no country_code resolved for section ${section.heading} ` +
        `(neither section.country_code nor sourceConfig.country_code is set)`,
    )
  }

  const input: CommitInput = {
    title: row.title,
    title_native: row.title_native ?? null,
    title_transliterated: row.title_transliterated ?? null,
    title_english_meaningful: row.title_english_meaningful ?? null,
    authors: row.authors,
    year: row.year,
    country_code: countryCode,
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

  // Idempotency: if a previous run of this source left a `pending_review` row
  // in the queue for this same source_row_id (e.g. because the reason was
  // unmapped at the time), mark it approved with the resulting book/ban IDs
  // instead of leaving an orphan. Failure is non-fatal — the book/bans are
  // real, only the queue marker stays stale.
  const titleSlug = slugify(row.title || 'untitled')
  const sourceRowId = `${row.source_anchor}#${titleSlug}`
  const { error: queueUpdateErr } = await sb
    .from('import_review_queue')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'wikipedia-auto-approve',
      approved_book_id: result.book_id,
      approved_bans: result.ban_ids,
    })
    .eq('source_slug', ctx.sourceConfig.source_slug)
    .eq('source_row_id', sourceRowId)
    .eq('status', 'pending_review')
  if (queueUpdateErr) {
    console.error(
      `  [warn] queue cleanup failed for ${sourceRowId}: ${queueUpdateErr.message}`,
    )
  }

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
// Auto-add-ban path: dedup found an existing book, add a new ban to it
// ----------------------------------------------------------------------------

async function commitAutoAddBan(
  sb: Sb,
  pg: Client,
  ctx: ImporterContext,
  section: SectionConfig,
  decision: Extract<ImportDecision, { mode: 'auto_add_ban' }>,
): Promise<CommitResult> {
  const { row, reason, dedup } = decision
  if (reason.slug === null) {
    throw new Error('commitAutoAddBan: reason.slug is null (gate logic should have prevented this)')
  }
  if (row.year === null) {
    throw new Error('commitAutoAddBan: row.year is null (gate logic should have prevented this)')
  }

  const countryCode = section.country_code ?? ctx.sourceConfig.country_code
  if (!countryCode) {
    throw new Error(
      `commitAutoAddBan: no country_code resolved for section ${section.heading}`,
    )
  }

  const input: AddBanInput = {
    book_id: dedup.book_id,
    country_code: countryCode,
    scope_slug: section.scope_default,
    action_type: section.action_type_default,
    ban_status: section.status_default,
    year: row.year,
    reason_slug: reason.slug,
    description_ban: formatBanDescription(row),
    source_url: wikipediaSourceUrl(ctx.page, row.source_anchor),
    source_name: `Wikipedia: ${ctx.page.replace(/_/g, ' ')}`,
    source_type: ctx.sourceConfig.source_type,
  }

  const result = await commitNewBanForBook(input, pg)

  // Mirror commitAutoApprove's queue cleanup: if a prior run left a pending
  // review row for this same source_row_id, mark it approved with the
  // resolved book/ban IDs. Non-fatal on failure.
  const titleSlug = slugify(row.title || 'untitled')
  const sourceRowId = `${row.source_anchor}#${titleSlug}`
  const { error: queueUpdateErr } = await sb
    .from('import_review_queue')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'wikipedia-auto-add-ban',
      approved_book_id: dedup.book_id,
      approved_bans: [result.ban_id],
    })
    .eq('source_slug', ctx.sourceConfig.source_slug)
    .eq('source_row_id', sourceRowId)
    .eq('status', 'pending_review')
  if (queueUpdateErr) {
    console.error(
      `  [warn] queue cleanup failed for ${sourceRowId}: ${queueUpdateErr.message}`,
    )
  }

  return {
    mode: 'auto_add_ban',
    book_id: dedup.book_id,
    ban_id: result.ban_id,
    created: result.created,
  }
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

  // source_context: resolved per-section configuration captured at insert
  // time so the admin /import-review approve flow can reconstruct
  // country_code / source_url / source_name / scope / action / status even
  // if the WIKIPEDIA_SOURCES registry is later renamed, removed, or — most
  // commonly — not yet deployed to production when an older queue row is
  // reviewed. getQueueSourceContext falls back to these values when its
  // primary `findWikipediaSourceConfig` lookup misses.
  const resolvedCountryCode =
    section.country_code ?? ctx.sourceConfig.country_code ?? null
  const sourceContext = {
    country_code: resolvedCountryCode,
    source_url: sourceUrl,
    source_name: `Wikipedia: ${ctx.page.replace(/_/g, ' ')}`,
    source_type: ctx.sourceConfig.source_type,
    section_heading: section.heading,
    scope_default: section.scope_default,
    action_type_default: section.action_type_default,
    status_default: section.status_default,
  }

  const agreementDetails = {
    source: 'wikipedia',
    page: ctx.page,
    revid: ctx.revid,
    section_anchor: row.source_anchor,
    parsed_row: row,
    quality_flags,
    reason_mapping: reason,
    dedup_check: dedup.kind === 'none' ? null : dedup,
    source_context: sourceContext,
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
