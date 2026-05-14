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
import { slugify } from './slugify'

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

// ----------------------------------------------------------------------------
// Merge flow — enrich an existing book and add a new ban for it.
//
// Semantics:
//   - The CANONICAL book row is NEVER overwritten on fields that already have
//     a value. The overlay only fills empty/NULL scalar fields (enrichment).
//   - Non-canonical title variants (title, title_native, title_english_meaningful
//     from the form) are added to `book_slug_aliases` so old URLs keep working
//     and any of those titles can be searched against.
//   - A new ban is created for (target_book_id, country_code, year, scope_id),
//     idempotently — if a ban already exists for that scope tuple, that ban_id
//     is reused and only its source/reason links are extended.
//   - Author rows on the existing book are NOT modified. (Editor uses
//     /admin/books/{id} if author changes are needed.)
//   - The queue row is marked 'approved' with a `merge_decisions` audit trail
//     describing which fields were enriched and which aliases were added.
// ----------------------------------------------------------------------------

export type MergeOverlay = ApproveOverlay & {
  /** ID of the existing `books` row to enrich + attach the new ban to. */
  target_book_id: number
}

export type MergeResult = {
  book_id: number
  ban_id: number
  ban_created: boolean
  enriched_fields: string[]
  aliases_added: string[]
  queue_update_error?: string
}

type ExistingBookRow = {
  id: number
  slug: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  first_published_year: number | null
  description_book: string | null
}

function capDescription(text: string | null | undefined): string | null {
  if (!text) return null
  return text.length > 2000 ? text.slice(0, 1997) + '…' : text
}

export async function mergeQueueRowIntoBook(
  queueId: number,
  overlay: MergeOverlay,
  ctx: QueueSourceContext,
  pg: Client,
  sb: AdminSb,
  reviewedBy: string,
): Promise<MergeResult> {
  if (overlay.original_language && overlay.original_language.length !== 2) {
    throw new Error(
      `mergeQueueRowIntoBook: original_language must be a 2-letter ISO-639-1 code, got '${overlay.original_language}'`,
    )
  }

  let bookId = -1
  let banId = -1
  let banCreated = false
  const enrichedFields: string[] = []
  const aliasesAdded: string[] = []

  await pg.query('BEGIN')
  try {
    // 1. Lock the target book.
    const bookRes = await pg.query(
      `select id, slug, title_native, title_transliterated, title_english_meaningful,
              original_language, first_published_year, description_book
       from books where id = $1 for update`,
      [overlay.target_book_id],
    )
    if (bookRes.rows.length === 0) {
      throw new Error(`Book ${overlay.target_book_id} not found`)
    }
    const existing = bookRes.rows[0] as ExistingBookRow
    bookId = existing.id

    // 2. Enrichment: only fill scalar fields where the existing value is empty.
    type Fillable = { col: keyof ExistingBookRow; value: string | number | null }
    const candidates: Fillable[] = [
      { col: 'title_native', value: overlay.title_native ?? null },
      { col: 'title_english_meaningful', value: overlay.title_english_meaningful ?? null },
      { col: 'original_language', value: overlay.original_language ?? null },
      { col: 'first_published_year', value: overlay.first_published_year ?? null },
      { col: 'description_book', value: overlay.description_book ?? null },
    ]
    const patchEntries: Array<[string, string | number]> = []
    for (const { col, value } of candidates) {
      if (value === null || value === '') continue
      if (existing[col] !== null && existing[col] !== '') continue
      patchEntries.push([col as string, value])
      enrichedFields.push(col as string)
    }
    if (patchEntries.length > 0) {
      const setSql = patchEntries.map(([c], i) => `${c} = $${i + 2}`).join(', ')
      const values = patchEntries.map(([, v]) => v)
      await pg.query(`update books set ${setSql} where id = $1`, [bookId, ...values])
    }

    // 3. Slug aliases for any title variant from the overlay that isn't already
    //    the canonical slug AND doesn't collide with another book's canonical.
    const aliasCandidates: Array<{ slug: string; source: string }> = []
    const pushAlias = (text: string | null | undefined, source: string) => {
      if (!text) return
      const aliasSlug = slugify(text)
      if (!aliasSlug || aliasSlug === existing.slug) return
      aliasCandidates.push({ slug: aliasSlug, source })
    }
    pushAlias(overlay.title, 'merge_canonical_form')
    pushAlias(overlay.title_native, 'title_native')
    pushAlias(overlay.title_english_meaningful, 'title_english_meaningful')
    for (const c of aliasCandidates) {
      const collision = await pg.query(
        'select 1 from books where slug = $1 and id <> $2 limit 1',
        [c.slug, bookId],
      )
      if (collision.rowCount && collision.rowCount > 0) continue
      const insRes = await pg.query(
        `insert into book_slug_aliases (slug, book_id, source)
         values ($1, $2, $3)
         on conflict (slug) do nothing
         returning slug`,
        [c.slug, bookId, c.source],
      )
      if (insRes.rows.length > 0) {
        aliasesAdded.push(c.slug)
      }
    }

    // 4. Scope slug → id.
    const scopeRes = await pg.query(
      'select id from scopes where slug = $1',
      [overlay.scope_slug],
    )
    if (scopeRes.rows.length === 0) {
      throw new Error(`Unknown scope slug '${overlay.scope_slug}'`)
    }
    const scopeId = scopeRes.rows[0].id as number

    // 5. Ban: SELECT-then-INSERT for idempotency on (book, country, year, scope).
    const existingBan = await pg.query(
      `select id from bans
       where book_id = $1 and country_code = $2
         and year_started = $3 and scope_id = $4
       limit 1`,
      [bookId, ctx.country_code, overlay.year, scopeId],
    )
    if (existingBan.rows.length > 0) {
      banId = existingBan.rows[0].id as number
      banCreated = false
    } else {
      const description = capDescription(overlay.description_ban)
      const ins = await pg.query(
        `insert into bans (book_id, country_code, scope_id, action_type, status,
                           year_started, year_ended, description)
         values ($1, $2, $3, $4, $5, $6, null, $7)
         returning id`,
        [
          bookId,
          ctx.country_code,
          scopeId,
          overlay.action_type,
          overlay.ban_status,
          overlay.year,
          description,
        ],
      )
      banId = ins.rows[0].id as number
      banCreated = true
    }

    // 6. Reason slug → id.
    const reasonRes = await pg.query(
      'select id from reasons where slug = $1',
      [overlay.reason_slug],
    )
    if (reasonRes.rows.length === 0) {
      throw new Error(`Unknown reason slug '${overlay.reason_slug}'`)
    }
    const reasonId = reasonRes.rows[0].id as number

    // 7. Source + links (always extend, even on existing ban — same source can
    //    be cited by multiple bans on the same book).
    const sourceRes = await pg.query(
      `insert into ban_sources (source_name, source_url, source_type,
                                verification_status, accessed_at)
       values ($1, $2, $3, 'unverified', now())
       on conflict (source_url) do update
         set source_name = excluded.source_name,
             source_type = excluded.source_type,
             accessed_at = now()
       returning id`,
      [ctx.source_name, ctx.source_url, ctx.source_type],
    )
    const sourceId = sourceRes.rows[0].id as number
    await pg.query(
      `insert into ban_source_links (ban_id, source_id) values ($1, $2)
       on conflict do nothing`,
      [banId, sourceId],
    )
    await pg.query(
      `insert into ban_reason_links (ban_id, reason_id) values ($1, $2)
       on conflict do nothing`,
      [banId, reasonId],
    )

    await pg.query('COMMIT')
  } catch (err) {
    await pg.query('ROLLBACK')
    throw err
  }

  // 8. Outside the transaction: mark queue row approved with audit trail.
  //    Failure here is non-fatal — the book/ban are real, only the queue
  //    marker stays stale.
  const mergeDecisions = {
    target_book_id: bookId,
    enriched_fields: enrichedFields,
    aliases_added: aliasesAdded,
    ban_action: {
      kind: banCreated ? 'create' : 'enrich_existing',
      ban_id: banId,
    },
    reviewed_by: reviewedBy,
  }
  const { error: updateErr } = await sb
    .from('import_review_queue')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      approved_book_id: bookId,
      approved_bans: [banId],
      merge_decisions: mergeDecisions,
    })
    .eq('id', queueId)

  return {
    book_id: bookId,
    ban_id: banId,
    ban_created: banCreated,
    enriched_fields: enrichedFields,
    aliases_added: aliasesAdded,
    queue_update_error: updateErr?.message,
  }
}
