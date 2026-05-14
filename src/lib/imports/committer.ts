// Commit phase of the import pipeline.
//
// Two branches, both finalised under a single Postgres transaction:
//
//   auto_approve === true  -> direct_write
//     Writes authors, book, book_authors, ban, ban_sources, ban_source_links,
//     ban_reason_links and finally flips the import_jobs row to 'committed'.
//     Mirrors the rich INSERT pattern from
//     scripts/add-books-french-validation.ts, lifted into one BEGIN/COMMIT
//     so a mid-write failure cannot leave the books table littered with
//     orphan rows.
//
//   auto_approve === false -> queued
//     Inserts a single import_review_queue row (full extraction+verification+
//     decision context as jsonb) and flips the import_jobs row to 'queued'
//     with review_row_id set.
//
// Why pg and not supabase-js: supabase-js does not expose multi-statement
// transactions. PostgREST RPCs wrap a single SQL function in an implicit
// transaction, but the commit logic — insert-then-fallback-select on author
// slug uniqueness, conditional ban_reason_links by mapped reason, source
// upsert with verification_status — is awkward to express in PL/pgSQL.
// node-postgres is already a dependency (used by diagnose-schema-drift) and
// gives us explicit BEGIN/COMMIT/ROLLBACK semantics.
//
// Connection: DATABASE_URL (pgbouncer transaction mode on port 6543).
// Transaction mode supports BEGIN/COMMIT per-transaction; only session-scoped
// state (prepared statements, temp tables) is unsupported, and we use neither.

import { Client } from 'pg'
import { slugify } from './slugify'
import type { ExtractionResult, PassesAudit } from './extraction-types'
import type { VerificationResult } from './verifier'
import type { GateDecision } from './gate'
import type { SourceConfig } from './source-registry'
import type { ArchiveResult } from './archiver'

export type CommitMode = 'direct_write' | 'queued'

export type CommitResult = {
  mode: CommitMode
  book_id: number | null
  ban_id: number | null
  review_queue_id: number | null
}

export type CommitContext = {
  jobId: number
  sourceType: string
  sourceUrl: string
  sourceConfig: SourceConfig
  extraction: ExtractionResult
  passesAudit: PassesAudit
  verification: VerificationResult
  archiveResult: ArchiveResult
  decision: GateDecision
  rawInput?: unknown
}

export async function commitJob(ctx: CommitContext): Promise<CommitResult> {
  return ctx.decision.auto_approve ? commitDirectWrite(ctx) : commitQueued(ctx)
}

// ----------------------------------------------------------------------------
// Direct-write branch
// ----------------------------------------------------------------------------

async function commitDirectWrite(ctx: CommitContext): Promise<CommitResult> {
  const { extraction, sourceConfig, sourceType, sourceUrl, archiveResult, jobId } = ctx

  if (extraction.country_code === null) {
    throw new Error('committer: country_code is null for direct-write')
  }
  if (!extraction.is_book) {
    throw new Error('committer: cannot direct-write a non-book extraction')
  }

  const client = newPgClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    // Resolve scope slug -> id (FK in bans is bigint)
    const scopeId = await resolveScope(client, sourceConfig.default_scope)

    // 1. Authors — insert-then-conflict on slug, return id. We now also
    //    forward the multilingual fields produced by normalize-extraction
    //    (name_native / name_transliterated / name_english) so the
    //    authors row gets the native script form for non-Latin authors
    //    in addition to the slug-canonical display name.
    const authorIds: number[] = []
    for (const a of extraction.authors) {
      authorIds.push(
        await upsertAuthor(client, {
          display_name: a.name,
          birth_year: a.birth_year,
          name_native: a.name_native,
          name_transliterated: a.name_transliterated,
          name_english: a.name_english,
          original_language: extraction.original_language ?? null,
        }),
      )
    }

    // 2. Book row (Model 3 fields filled where present)
    const bookSlug = slugify(extraction.title)
    const bookRes = await client.query(
      `insert into books (
         title, slug, original_language, first_published_year, ai_drafted,
         title_native, title_native_script, title_transliterated, title_english_meaningful
       )
       values ($1, $2, $3, $4, false, $5, $6, $7, $8)
       returning id`,
      [
        extraction.title,
        bookSlug,
        extraction.original_language,
        extraction.year_published,
        extraction.title_native,
        extraction.title_native_script,
        extraction.title_transliterated,
        extraction.title_english_meaningful,
      ],
    )
    const bookId = bookRes.rows[0].id as number

    // 3. book_authors join (skip silently on duplicate; same book + same
    //    author should only happen if extraction lists an author twice)
    for (const aid of authorIds) {
      await client.query(
        `insert into book_authors (book_id, author_id) values ($1, $2)
         on conflict do nothing`,
        [bookId, aid],
      )
    }

    // 4. Ban row. year_started intentionally null — we do NOT proxy from
    //    extraction.year_published (book publication != ban date).
    const banRes = await client.query(
      `insert into bans (
         book_id, country_code, scope_id, action_type, status,
         year_started, year_ended, description
       )
       values ($1, $2, $3, $4, 'active', null, null, null)
       returning id`,
      [bookId, extraction.country_code, scopeId, sourceConfig.default_action_type],
    )
    const banId = banRes.rows[0].id as number

    // 5. ban_sources upsert
    const verificationStatus =
      archiveResult.status === 'archived' ? 'verified' : 'pending'
    const sourceName = humanizeSourceType(sourceType)
    const sourceRes = await client.query(
      `insert into ban_sources (source_name, source_url, source_type, verification_status)
       values ($1, $2, $3, $4::verification_status_enum)
       on conflict (source_url) do update
         set source_name = excluded.source_name,
             source_type = excluded.source_type,
             verification_status = excluded.verification_status
       returning id`,
      [sourceName, sourceUrl, sourceType, verificationStatus],
    )
    const sourceId = sourceRes.rows[0].id as number

    // 6. ban_source_links join
    await client.query(
      `insert into ban_source_links (ban_id, source_id) values ($1, $2)
       on conflict do nothing`,
      [banId, sourceId],
    )

    // 7. ban_reason_links — one row per mapped reason slug
    for (const reasonSlug of extraction.reasons) {
      const reasonRes = await client.query(
        'select id from reasons where slug = $1',
        [reasonSlug],
      )
      if (reasonRes.rows.length === 0) {
        throw new Error(`committer: unknown reason slug '${reasonSlug}' — must exist in reasons table`)
      }
      await client.query(
        `insert into ban_reason_links (ban_id, reason_id) values ($1, $2)
         on conflict do nothing`,
        [banId, reasonRes.rows[0].id],
      )
    }

    // 8. Flip the job row inside the same transaction
    await client.query(
      `update import_jobs
         set status = 'committed',
             committed_at = now(),
             updated_at = now()
       where id = $1`,
      [jobId],
    )

    await client.query('COMMIT')
    return { mode: 'direct_write', book_id: bookId, ban_id: banId, review_queue_id: null }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

async function resolveScope(client: Client, slug: string): Promise<number> {
  const res = await client.query('select id from scopes where slug = $1', [slug])
  if (res.rows.length === 0) {
    throw new Error(`committer: unknown scope slug '${slug}' — must exist in scopes table`)
  }
  return res.rows[0].id as number
}

type UpsertAuthorInput = {
  display_name: string
  birth_year: number | null
  name_native: string | null
  name_transliterated: string | null
  name_english: string | null
  original_language: string | null
}

async function upsertAuthor(
  client: Client,
  input: UpsertAuthorInput,
): Promise<number> {
  const slug = slugify(input.display_name)
  // INSERT writes everything we know. On slug-conflict (author already
  // exists) we COALESCE-update so a richer import (e.g. one that has a
  // native-script name) fills in nulls without overwriting non-null values
  // a previous source already established. Mirrors the upsert in
  // src/lib/imports/review-commit.ts.
  const ins = await client.query(
    `insert into authors (
       display_name, slug, birth_year,
       name_native, name_transliterated, name_english, original_language
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (slug) do update set
       birth_year          = coalesce(authors.birth_year,          excluded.birth_year),
       name_native         = coalesce(authors.name_native,         excluded.name_native),
       name_transliterated = coalesce(authors.name_transliterated, excluded.name_transliterated),
       name_english        = coalesce(authors.name_english,        excluded.name_english),
       original_language   = coalesce(authors.original_language,   excluded.original_language)
     returning id`,
    [
      input.display_name,
      slug,
      input.birth_year,
      input.name_native,
      input.name_transliterated,
      input.name_english,
      input.original_language,
    ],
  )
  if (ins.rows.length > 0) return ins.rows[0].id as number
  const sel = await client.query('select id from authors where slug = $1', [slug])
  if (sel.rows.length === 0) {
    throw new Error(`committer: author upsert for '${input.display_name}' (slug ${slug}) produced no row`)
  }
  return sel.rows[0].id as number
}

function humanizeSourceType(sourceType: string): string {
  const map: Record<string, string> = {
    legifrance: 'Legifrance',
    france_archives: 'Archives nationales (France)',
    pen_america: 'PEN America',
    manual: 'Manual import',
  }
  return map[sourceType] ?? sourceType
}

// ----------------------------------------------------------------------------
// Queued branch
// ----------------------------------------------------------------------------

async function commitQueued(ctx: CommitContext): Promise<CommitResult> {
  const {
    extraction,
    passesAudit,
    verification,
    decision,
    sourceType,
    sourceUrl,
    archiveResult,
    jobId,
    rawInput,
  } = ctx

  const client = newPgClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const agreementClass = mapAgreementToReviewClass(extraction, decision)

    const queueRes = await client.query(
      `insert into import_review_queue (
         source_slug, source_row_id, source_url, raw_input,
         pass_a_provider, pass_a_output,
         pass_b_provider, pass_b_output,
         agreement_class, agreement_details,
         status
       )
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10::jsonb, 'pending_review')
       on conflict (source_slug, source_row_id) do update
         set raw_input = excluded.raw_input,
             pass_a_provider = excluded.pass_a_provider,
             pass_a_output = excluded.pass_a_output,
             pass_b_provider = excluded.pass_b_provider,
             pass_b_output = excluded.pass_b_output,
             agreement_class = excluded.agreement_class,
             agreement_details = excluded.agreement_details,
             status = 'pending_review'
       returning id`,
      [
        sourceType,
        sourceUrl,
        sourceUrl,
        rawInput == null ? '{}' : JSON.stringify({ raw: rawInput }),
        passesAudit.pass_a.provider,
        JSON.stringify(passesAudit.pass_a.output),
        passesAudit.pass_b.provider,
        JSON.stringify(passesAudit.pass_b.output),
        agreementClass,
        JSON.stringify({
          gate: decision,
          verification,
          archive: archiveResult,
          pass_errors: {
            pass_a: passesAudit.pass_a.error,
            pass_b: passesAudit.pass_b.error,
          },
        }),
      ],
    )
    const reviewId = queueRes.rows[0].id as number

    await client.query(
      `update import_jobs
         set status = 'queued',
             review_row_id = $2,
             committed_at = now(),
             updated_at = now()
       where id = $1`,
      [jobId, reviewId],
    )

    await client.query('COMMIT')
    return { mode: 'queued', book_id: null, ban_id: null, review_queue_id: reviewId }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

function mapAgreementToReviewClass(
  extraction: ExtractionResult,
  decision: GateDecision,
): string {
  // import_review_queue.agreement_class is freeform text (no CHECK), but the
  // existing comment documents 'partial' | 'conflict' | 'single-pass-only' |
  // 'non_latin_review_gate'. Preserve those values; surface the doctrine
  // override when it's the dominant reason.
  if (decision.reasons.includes('non_latin_disagreement')) {
    return 'non_latin_review_gate'
  }
  return extraction.agreement_classification
}

// ----------------------------------------------------------------------------
// Connection helper
// ----------------------------------------------------------------------------

function newPgClient(): Client {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('committer: DATABASE_URL is not set')
  }
  return new Client({ connectionString })
}
