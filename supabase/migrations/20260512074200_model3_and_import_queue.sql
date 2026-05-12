-- ============================================================================
-- Sprint A — Taak 2 / Migratie A
-- Schema additions for Model 3 multilingual books, import review queue,
-- and ban-source verification status.
--
-- This migration is PURELY ADDITIVE:
--   - No DEFAULT values that would trigger backfill on existing rows
--   - No UPDATEs/DELETEs on existing data
--   - All bestaande rijen krijgen NULL voor nieuwe kolommen
--
-- Backfill + data-migratie ([archive pending] suffix -> verification_status,
-- title_native = title for English books, etc.) gebeurt in Migratie B,
-- die los te reviewen en pauzeerbaar is.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Enum types
-- ----------------------------------------------------------------------------

-- Verification status for ban_sources. Replaces the `[archive pending]`-suffix
-- convention with a typed column. See PROJECT_CONTEXT.md §3 (ban_sources).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_status_enum') then
    create type verification_status_enum as enum (
      'verified',           -- source URL works AND archive succeeded
      'pending',            -- source exists but archive attempt failed (Cloudflare-blocked, etc.)
      'unverified',         -- never attempted to verify (historical default)
      'broken'              -- source URL returns 4xx/5xx
    );
  end if;
end$$;

-- Review status for import_review_queue.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'import_review_status') then
    create type import_review_status as enum (
      'pending_review',     -- awaiting admin decision
      'approved',           -- merged into books/bans tables
      'rejected',           -- discarded; not imported
      'deferred'            -- needs more data or editorial decision; stays in queue
    );
  end if;
end$$;


-- ----------------------------------------------------------------------------
-- 2. ban_sources.verification_status
-- ----------------------------------------------------------------------------

alter table ban_sources
  add column if not exists verification_status verification_status_enum;

comment on column ban_sources.verification_status is
  'Replaces [archive pending] suffix convention. Backfilled in Migratie B.';

-- No index for now: this column will be queried mostly via JOINs from bans,
-- not as a primary filter. Add an index in a future migration if query
-- patterns justify it.


-- ----------------------------------------------------------------------------
-- 3. books -- Model 3 multilingual columns
-- ----------------------------------------------------------------------------

-- Semantics (zie PROJECT_CONTEXT.md §7 "Model 3 rendering doctrine"):
--   - title:                    canonical h1 (often the dominant published edition)
--   - title_native:             original-language title (e.g. "Архипелаг ГУЛАГ", "Eden, Eden, Eden")
--   - title_native_script:      'latin' | 'cyrillic' | 'han' | 'arabic' | 'hangul' | ...
--   - title_transliterated:     romanized native title (e.g. "Arkhipelag GULAG"), per script-convention
--   - title_english_meaningful: literal English meaning, NULL if no divergence from `title`
alter table books
  add column if not exists title_native             text,
  add column if not exists title_native_script      text,
  add column if not exists title_transliterated     text,
  add column if not exists title_english_meaningful text;

comment on column books.title_native is
  'Original-language title (e.g. Архипелаг ГУЛАГ). NULL means same as `title` or not yet backfilled.';
comment on column books.title_native_script is
  'Script of the native title: latin | cyrillic | han | arabic | hangul | hiragana | ... NULL if unknown.';
comment on column books.title_transliterated is
  'Romanized form of title_native per script convention (BGN/PCGN for Cyrillic, Pinyin without tones for Han, etc.). NULL for Latin-script originals.';
comment on column books.title_english_meaningful is
  'Literal English meaning when `title` is non-English OR when `title` is a non-translated foreign edition. NULL when no divergence from `title`.';

-- Constraint: title_transliterated MUST be NULL for latin-script titles,
-- and SHOULD be non-NULL for non-latin scripts (enforced at app level for now,
-- not as a CHECK constraint, since we want to allow partial backfill states).
-- Editor's note: enforce in src/lib/imports/ validation, not in the DB.


-- ----------------------------------------------------------------------------
-- 4. import_review_queue
-- ----------------------------------------------------------------------------

create table if not exists import_review_queue (
  id              bigint generated always as identity primary key,

  -- Source provenance
  source_slug     text not null,         -- 'france-joubert', 'russia-memorial', 'china-hkfp', etc.
  source_row_id   text not null,         -- the row identifier within the source (CSV row #, URL slug, etc.)
  source_url      text,                  -- the citation URL for the ban itself (Legifrance, archive.org link, etc.)

  -- The raw input that fed both LLM passes (CSV row as JSON, scraped HTML excerpt, etc.)
  raw_input       jsonb not null,

  -- Two-pass LLM extraction outputs (zie src/lib/imports/llm-extraction.ts)
  pass_a_provider text  not null,        -- 'gemini-2.5-pro' | 'gemini-2.5-flash'
  pass_a_output   jsonb not null,        -- full structured extraction (Zod-validated shape)
  pass_b_provider text  not null,        -- 'gpt-4o' | 'gpt-4o-mini'
  pass_b_output   jsonb not null,

  -- Why this entry is in the queue
  agreement_class text  not null,        -- 'partial' | 'conflict' | 'single-pass-only' | 'non_latin_review_gate'
  agreement_details jsonb,               -- field-by-field diff summary for the admin UI

  -- Review state
  status          import_review_status not null default 'pending_review',

  -- Audit trail
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     text,                  -- admin identifier; 'system' for any future auto-approvals
  review_notes    text,

  -- If approved: what was created downstream
  approved_book_id bigint references books(id) on delete set null,
  approved_bans    jsonb,                -- array of created ban ids: [123, 124, 125]

  -- No double-imports of the same source row
  unique (source_slug, source_row_id)
);

comment on table import_review_queue is
  'Queue for import-pipeline entries that need admin review before being merged into books/bans. See src/lib/imports/.';

comment on column import_review_queue.agreement_class is
  'Why this row is in the queue. partial = pass A and B agree on some fields but not all. conflict = significant disagreement. single-pass-only = one pass failed. non_latin_review_gate = mandatory review per Sprint 0.5 doctrine for non-Latin-script titles.';

comment on column import_review_queue.approved_book_id is
  'On delete of the book, this becomes NULL so the audit trail remains. Preserves history of what was once approved.';


-- ----------------------------------------------------------------------------
-- 5. Indexes on import_review_queue
-- ----------------------------------------------------------------------------

-- Hot path: admin UI lists pending reviews
create index if not exists idx_import_review_queue_pending
  on import_review_queue (created_at desc)
  where status = 'pending_review';

-- Filter by source for per-source review batches
create index if not exists idx_import_review_queue_source
  on import_review_queue (source_slug, status);

-- Admin UI "recently reviewed" view
create index if not exists idx_import_review_queue_reviewed_at
  on import_review_queue (reviewed_at desc)
  where reviewed_at is not null;


-- ----------------------------------------------------------------------------
-- 6. RLS posture
-- ----------------------------------------------------------------------------

-- import_review_queue is admin-only data. No public-read policy.
-- Service-role key is used by the admin pages and the pipeline.
-- Mirror van het ban_reason_links / cover_search_attempts patroon
-- (zie PROJECT_CONTEXT.md §3 "RLS posture").
alter table import_review_queue enable row level security;

-- Geen public policies. Toegang verloopt via service-role key in admin routes.
