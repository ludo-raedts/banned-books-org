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

  await pg.query('BEGIN')
  try {
    // 1. Authors
    const authorIds: number[] = []
    for (const name of row.authors) {
      authorIds.push(await upsertAuthor(pg, name))
    }

    // 2. Scope
    const scopeId = await resolveScope(pg, section.scope_default)

    // 3. Book
    const slug = slugify(row.title)
    const inclusionRationale = `Wikipedia bulk import: ${ctx.page} rev ${ctx.revid}`
    const bookRes = await pg.query(
      `insert into books (title, slug, inclusion_rationale, ai_drafted)
       values ($1, $2, $3, false)
       returning id`,
      [row.title, slug, inclusionRationale],
    )
    const bookId = bookRes.rows[0].id as number

    // 4. book_authors join
    for (const aid of authorIds) {
      await pg.query(
        `insert into book_authors (book_id, author_id) values ($1, $2) on conflict do nothing`,
        [bookId, aid],
      )
    }

    // 5. Reason slug → id
    const reasonRes = await pg.query('select id from reasons where slug = $1', [reason.slug])
    if (reasonRes.rows.length === 0) {
      throw new Error(`commitAutoApprove: unknown reason slug '${reason.slug}'`)
    }
    const reasonId = reasonRes.rows[0].id as number

    // 6. Ban. State (when present, only for state-bans sections) prepends to
    //    description so the per-ban context survives without a new column.
    const description = formatBanDescription(row)
    const banRes = await pg.query(
      `insert into bans (book_id, country_code, scope_id, action_type, status,
                         year_started, year_ended, description)
       values ($1, $2, $3, $4, $5, $6, null, $7)
       returning id`,
      [
        bookId,
        ctx.sourceConfig.country_code,
        scopeId,
        section.action_type_default,
        section.status_default,
        row.year,
        description,
      ],
    )
    const banId = banRes.rows[0].id as number

    // 7. ban_sources (upsert on URL — multiple bans can share a source URL)
    const sourceUrl = wikipediaSourceUrl(ctx.page, row.source_anchor)
    const sourceName = `Wikipedia: ${ctx.page.replace(/_/g, ' ')}`
    const sourceRes = await pg.query(
      `insert into ban_sources (source_name, source_url, source_type,
                                verification_status, accessed_at)
       values ($1, $2, $3, 'unverified', now())
       on conflict (source_url) do update
         set source_name = excluded.source_name,
             source_type = excluded.source_type,
             accessed_at = now()
       returning id`,
      [sourceName, sourceUrl, ctx.sourceConfig.source_type],
    )
    const sourceId = sourceRes.rows[0].id as number

    // 8. ban_source_links join
    await pg.query(
      `insert into ban_source_links (ban_id, source_id) values ($1, $2) on conflict do nothing`,
      [banId, sourceId],
    )

    // 9. ban_reason_links
    await pg.query(
      `insert into ban_reason_links (ban_id, reason_id) values ($1, $2) on conflict do nothing`,
      [banId, reasonId],
    )

    await pg.query('COMMIT')
    return { mode: 'auto_approve', book_id: bookId, ban_id: banId }
  } catch (err) {
    await pg.query('ROLLBACK')
    throw err
  }
}

async function upsertAuthor(pg: Client, displayName: string): Promise<number> {
  const slug = slugify(displayName)
  const ins = await pg.query(
    `insert into authors (display_name, slug) values ($1, $2)
     on conflict (slug) do nothing
     returning id`,
    [displayName, slug],
  )
  if (ins.rows.length > 0) return ins.rows[0].id as number
  const sel = await pg.query('select id from authors where slug = $1', [slug])
  if (sel.rows.length === 0) {
    throw new Error(`upsertAuthor: insert+select for '${displayName}' (${slug}) produced no row`)
  }
  return sel.rows[0].id as number
}

async function resolveScope(pg: Client, slug: string): Promise<number> {
  const res = await pg.query('select id from scopes where slug = $1', [slug])
  if (res.rows.length === 0) {
    throw new Error(`resolveScope: unknown scope slug '${slug}'`)
  }
  return res.rows[0].id as number
}

function formatBanDescription(row: ParsedRow): string {
  const prefix = row.state ? `State: ${row.state}. ` : ''
  const combined = `${prefix}${row.notes_raw}`.trim()
  // Postgres `text` has no length cap, but excessively long descriptions
  // hurt admin UI rendering. Cap at 2 KB; full text remains in the source
  // URL on Wikipedia.
  return combined.length > 2000 ? combined.slice(0, 1997) + '…' : combined
}

function wikipediaSourceUrl(page: string, anchor: string): string {
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
