// Helpers that turn an import_review_queue row + an editor overlay into a
// CommitInput, then commit it. Shared between the single-row approve endpoint
// (/api/admin/import-review/[id]/approve) and the bulk endpoint
// (/api/admin/import-review/bulk).
//
// Why the split:
//   - commitParsedRow() (in review-commit.ts) is the pure DB write.
//   - approveQueueRow() (here) layers on top: it commits AND marks the queue
//     row approved with the resulting book/ban IDs, so manual and auto paths
//     converge on identical queue-state semantics.
//   - getQueueSourceContext() resolves source_url / source_name / country_code
//     / source_type from a queue row's source_slug — the form doesn't ask the
//     editor to retype these because they're per-source constants.

import type { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WIKIPEDIA_SOURCES } from '../wikipedia/config'
import type { SourceConfig } from '../wikipedia/types'
import { commitParsedRow, type CommitInput, type CommitResult } from './review-commit'

export type QueueSourceContext = {
  country_code: string
  source_url: string
  source_name: string
  source_type: string
}

export function findWikipediaSourceConfig(sourceSlug: string): SourceConfig | null {
  for (const cfg of Object.values(WIKIPEDIA_SOURCES)) {
    if (cfg.source_slug === sourceSlug) return cfg
  }
  return null
}

// Subset of agreement_details.source_context — see `commitReview` in
// src/lib/wikipedia/importer.ts. Captured at queue-insert time so the
// approve flow has self-contained context even if WIKIPEDIA_SOURCES later
// renames/removes the slug, or if the deployed bundle simply doesn't yet
// know about a slug used by a queue row written from a newer import job.
type StoredSourceContext = {
  country_code?: string | null
  source_url?: string | null
  source_name?: string | null
  source_type?: string | null
  section_heading?: string | null
  scope_default?: string | null
  action_type_default?: 'banned' | 'restricted' | 'challenged' | null
  status_default?: 'active' | 'historical' | null
}

export function getQueueSourceContext(
  sourceSlug: string,
  agreementDetails: unknown,
  queueSourceUrl: string | null,
): QueueSourceContext {
  const agreement = (agreementDetails ?? {}) as {
    page?: string
    section_anchor?: string
    parsed_row?: { source_anchor?: string }
    source_context?: StoredSourceContext
  }
  const stored = agreement.source_context ?? {}
  const wikiCfg = findWikipediaSourceConfig(sourceSlug)

  // Configured path: WIKIPEDIA_SOURCES has this slug. Re-derive context from
  // the live config so a slug rename / country-code fix in config.ts takes
  // effect immediately without backfill.
  if (wikiCfg) {
    const page = agreement.page ?? wikiCfg.page
    const sectionAnchor =
      agreement.parsed_row?.source_anchor ?? agreement.section_anchor ?? ''
    const sourceUrl =
      queueSourceUrl ?? `https://en.wikipedia.org/wiki/${page}#${sectionAnchor}`
    const sourceName = `Wikipedia: ${page.replace(/_/g, ' ')}`
    const matchingSection = wikiCfg.sections.find(
      s => s.heading.replace(/ /g, '_') === sectionAnchor,
    )
    const country_code = matchingSection?.country_code ?? wikiCfg.country_code
    if (!country_code) {
      // Live config exists but the section's country_code isn't resolvable.
      // Fall through to stored context if it has one; otherwise error.
      if (stored.country_code) {
        return {
          country_code: stored.country_code,
          source_url: stored.source_url ?? sourceUrl,
          source_name: stored.source_name ?? sourceName,
          source_type: stored.source_type ?? wikiCfg.source_type,
        }
      }
      throw new Error(
        `getQueueSourceContext: no country_code for source '${sourceSlug}' ` +
          `section '${sectionAnchor}' (neither section nor source defines one, and no stored context)`,
      )
    }
    return {
      country_code,
      source_url: sourceUrl,
      source_name: sourceName,
      source_type: wikiCfg.source_type,
    }
  }

  // Fallback path: WIKIPEDIA_SOURCES doesn't know about this slug (most
  // commonly: a queue row inserted by a newer import-pipeline build whose
  // config.ts is not yet deployed in this bundle). Use the source_context
  // that the importer stored on the queue row.
  if (stored.country_code && stored.source_url && stored.source_name) {
    return {
      country_code: stored.country_code,
      source_url: queueSourceUrl ?? stored.source_url,
      source_name: stored.source_name,
      source_type: stored.source_type ?? 'wikipedia',
    }
  }

  throw new Error(
    `No source-config found for slug '${sourceSlug}' AND no source_context ` +
      `in agreement_details. Add the slug to src/lib/wikipedia/config.ts and ` +
      `redeploy, or backfill agreement_details.source_context for this row.`,
  )
}

// Helper for /admin/import-review form prefilling: derive
// (action_type, scope_slug, ban_status) for a queue row, preferring live
// SectionConfig defaults and falling back to the stored snapshot in
// agreement_details.source_context if the slug or section is unknown.
export function getQueueSectionDefaults(
  sourceSlug: string,
  agreementDetails: unknown,
): {
  action_type: 'banned' | 'restricted' | 'challenged'
  scope_slug: string
  ban_status: 'active' | 'historical'
} | null {
  const agreement = (agreementDetails ?? {}) as {
    section_anchor?: string
    parsed_row?: { source_anchor?: string }
    source_context?: StoredSourceContext
  }
  const stored = agreement.source_context ?? {}
  const sectionAnchor =
    agreement.parsed_row?.source_anchor ?? agreement.section_anchor ?? ''
  const wikiCfg = findWikipediaSourceConfig(sourceSlug)
  if (wikiCfg) {
    const sec =
      wikiCfg.sections.find(s => s.heading.replace(/ /g, '_') === sectionAnchor)
      ?? wikiCfg.sections[0]
    if (sec) {
      return {
        action_type: sec.action_type_default,
        scope_slug: sec.scope_default,
        ban_status: sec.status_default,
      }
    }
  }
  if (
    stored.action_type_default
    && stored.scope_default
    && stored.status_default
  ) {
    return {
      action_type: stored.action_type_default,
      scope_slug: stored.scope_default,
      ban_status: stored.status_default,
    }
  }
  return null
}

export type ApproveOverlay = {
  title: string
  title_native?: string | null
  title_english_meaningful?: string | null
  original_language?: string | null
  authors: string[]
  year: number
  first_published_year?: number | null
  reason_slug: string
  action_type: 'banned' | 'restricted' | 'challenged'
  scope_slug: string
  ban_status: 'active' | 'historical'
  description_book?: string | null
  description_ban?: string | null
  inclusion_rationale: string
}

export function buildCommitInput(
  overlay: ApproveOverlay,
  ctx: QueueSourceContext,
): CommitInput {
  return {
    title: overlay.title,
    title_native: overlay.title_native ?? null,
    title_english_meaningful: overlay.title_english_meaningful ?? null,
    original_language: overlay.original_language ?? null,
    authors: overlay.authors,
    year: overlay.year,
    first_published_year: overlay.first_published_year ?? null,
    country_code: ctx.country_code,
    scope_slug: overlay.scope_slug,
    action_type: overlay.action_type,
    ban_status: overlay.ban_status,
    reason_slug: overlay.reason_slug,
    description_book: overlay.description_book ?? null,
    description_ban: overlay.description_ban ?? null,
    inclusion_rationale: overlay.inclusion_rationale,
    source_url: ctx.source_url,
    source_name: ctx.source_name,
    source_type: ctx.source_type,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSb = SupabaseClient<any, 'public', any>

/**
 * Run the full single-row approve flow: commit to DB, mark queue row approved.
 *
 * Errors:
 *   - commitParsedRow throws → queue row stays as `pending_review`; caller
 *     surfaces the error to the UI.
 *   - queue-update fails AFTER commit succeeds → returns a partial-success
 *     result with `queue_update_error`. The books/bans rows are real; only
 *     the queue marker is stale.
 */
export async function approveQueueRow(
  queueId: number,
  overlay: ApproveOverlay,
  ctx: QueueSourceContext,
  pg: Client,
  sb: AdminSb,
  reviewedBy: string,
): Promise<CommitResult & { queue_update_error?: string }> {
  const input = buildCommitInput(overlay, ctx)
  const result = await commitParsedRow(input, pg)

  const { error: updateErr } = await sb
    .from('import_review_queue')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      approved_book_id: result.book_id,
      approved_bans: result.ban_ids,
    })
    .eq('id', queueId)

  if (updateErr) {
    return { ...result, queue_update_error: updateErr.message }
  }
  return result
}
