-- ============================================================================
-- Sprint A — Taak 3 / Commit 1
-- import_jobs: per-URL pipeline state for the multilingual book-ban importer.
--
-- One row per source URL flowing through the pipeline. The orchestrator
-- (src/lib/imports/run-import-job.ts) advances `status` + `current_phase`
-- and persists each phase's output blob (raw_html, archive_url, extraction,
-- verification, gate_decision) so a crashed run can be resumed without
-- redoing successful phases.
--
-- Outcomes:
--   - status='committed' + review_row_id IS NULL  -> direct write to books/bans
--   - status='queued'    + review_row_id NOT NULL -> punted to import_review_queue
--   - status='failed'    + error filled            -> needs operator attention
--
-- Admin-only data, mirrors RLS posture of import_review_queue.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Status enum
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'import_job_status') then
    create type import_job_status as enum (
      'pending',     -- created, not yet picked up
      'fetching',    -- HTTP fetch in progress
      'extracting',  -- LLM extraction in progress
      'verifying',   -- dimension-matching against books/authors/countries/reasons
      'gated',       -- gate evaluated; awaiting commit-step routing
      'queued',      -- punted to import_review_queue
      'committed',   -- written directly to books/bans tables
      'failed'       -- terminal error; see `error` column
    );
  end if;
end$$;


-- ----------------------------------------------------------------------------
-- 2. import_jobs table
-- ----------------------------------------------------------------------------

create table if not exists import_jobs (
  id              bigint generated always as identity primary key,

  -- Batch grouping (NULL for ad-hoc single-URL runs)
  batch_id        uuid,

  -- Source provenance
  source_url      text not null unique,
  source_type     text not null,                       -- 'legifrance' | 'pen_america' | 'france_archives' | 'manual' | ...
  tier            text not null
    check (tier in ('high-volume', 'high-stakes')),

  -- Pipeline state
  status          import_job_status not null default 'pending',
  current_phase   text,                                -- 'fetched' | 'archived' | 'extracted' | 'verified' | 'gated' | 'committed'

  -- Per-phase output blobs (filled incrementally as phases complete)
  raw_html        text,
  archive_url     text,
  archive_service text,                                -- 'wayback' | 'archive_today'
  extraction      jsonb,                               -- ExtractionResult shape from llm-extraction
  verification    jsonb,                               -- VerificationResult shape from verifier
  gate_decision   jsonb,                               -- GateDecision shape (auto_approve + reasons[])

  -- If queued: pointer to the review row
  review_row_id   bigint references import_review_queue(id) on delete set null,

  -- Terminal markers
  committed_at    timestamptz,
  error           text,
  attempts        int not null default 0,

  -- Audit
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table import_jobs is
  'Per-URL pipeline state for the Sprint A multilingual importer. See src/lib/imports/run-import-job.ts.';

comment on column import_jobs.current_phase is
  'Last successfully completed phase. The orchestrator skips already-completed phases on resume.';

comment on column import_jobs.tier is
  'Routing tier from SOURCE_REGISTRY. high-stakes sources never auto-approve regardless of gate result.';

comment on column import_jobs.review_row_id is
  'Set when the gate routed this job to import_review_queue. NULL for direct-write commits.';


-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------

-- Hot path: orchestrator polling "what is still in flight"
create index if not exists idx_import_jobs_status
  on import_jobs (status);

-- Per-batch overview ("how is batch X doing")
create index if not exists idx_import_jobs_batch
  on import_jobs (batch_id)
  where batch_id is not null;


-- ----------------------------------------------------------------------------
-- 4. RLS posture
-- ----------------------------------------------------------------------------

-- Admin-only. Service-role key is used by the orchestrator and the admin UI.
-- Mirrors import_review_queue and indexnow_submissions.
alter table import_jobs enable row level security;

-- Geen public policies.
