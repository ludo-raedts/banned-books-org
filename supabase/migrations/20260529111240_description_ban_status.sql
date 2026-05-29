-- Track the curation state of description_ban ("Why it was banned" copy).
-- Parallel to censorship_context_status (20260529080000) but with a vocabulary
-- that fits the shorter field: rejections here are about LLM output quality
-- (padding tells, too-short responses), not about absence of source evidence.
--
-- Introduced 2026-05-29 so the four LLM writers
-- (autofill-ban-descriptions, enrich-ban-descriptions-gpt,
-- rewrite-descriptions-grounded, rewrite-weak-descriptions) can mark
-- rejected books once and skip them on the next sweep instead of paying
-- for the same GPT call again.
--
-- Also extends censorship_context_status to include
-- 'auto_rejected_low_groundedness', which the GPT enrichment script writes
-- whenever the censorship-context quality gate rejects an output. The
-- original constraint (20260529080000) omitted this value, so the first
-- real apply-run after ef655ef would error on a constraint-violation when
-- the gate fires. This migration fixes that gap.

-- ── description_ban_status ──────────────────────────────────────────────
alter table public.books
  add column if not exists description_ban_status text;

alter table public.books drop constraint if exists books_description_ban_status_check;
alter table public.books
  add constraint books_description_ban_status_check check (
    description_ban_status is null
    or description_ban_status in (
      'human_curated',             -- human-edited; LLM writers must never overwrite
      'auto_accepted',             -- LLM-written, passed descriptionBanQualityGate
      'auto_rejected_low_quality', -- LLM output failed the gate; do not retry
      'pending_review',            -- legacy or flagged; eligible for re-enrichment
      'flagged'                    -- text exists but is suspect; awaiting decision
    )
  );

comment on column public.books.description_ban_status is
  'Curation state of description_ban. NULL = legacy/unknown. auto_accepted = LLM-written and gate-passed. auto_rejected_low_quality = gate rejected last attempt (do not retry). human_curated = trusted. pending_review = eligible for re-enrichment. flagged = suspect.';

-- Index only on the values that drive enrichment-script filters: skip
-- rejected/curated, target pending_review/flagged.
create index if not exists books_description_ban_status_skip_idx
  on public.books (id)
  where description_ban_status in ('human_curated', 'auto_rejected_low_quality');

-- ── censorship_context_status: extend constraint ────────────────────────
-- enrich-censorship-context-gpt.ts (ef655ef) already writes
-- 'auto_rejected_low_groundedness' on gate-reject. The original constraint
-- did not include this value; drop+re-add with the extended set so the
-- write succeeds.
alter table public.books drop constraint if exists books_censorship_context_status_check;
alter table public.books
  add constraint books_censorship_context_status_check check (
    censorship_context_status is null
    or censorship_context_status in (
      'narrative_curated',
      'insufficient_evidence',
      'pending_review',
      'flagged',
      'auto_rejected_low_groundedness'  -- added 2026-05-29: gate-rejected GPT output
    )
  );

comment on column public.books.censorship_context_status is
  'Tracks the curation state of censorship_context. NULL = legacy/unknown. insufficient_evidence = deliberately left empty (re-enrichment must skip). auto_rejected_low_groundedness = gate rejected last GPT attempt (do not retry). pending_review = eligible for grounded v3 enrichment. narrative_curated = trusted. flagged = suspect.';
