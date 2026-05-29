-- Track whether censorship_context has been deliberately left empty so
-- future re-enrichment runs don't overwrite books we've decided shouldn't
-- have a narrative paragraph. Mirror of data_quality_status but scoped
-- to the censorship_context field specifically.
--
-- Introduced 2026-05-29 after the audit script identified ~22% of
-- existing censorship_context rows as either template boilerplate or
-- redundant with description_ban. Wiping those without a marker would
-- let the next v1 enrich-censorship-context-gpt.ts (or any successor)
-- refill them from the same structured ban-tuple, repeating the problem.

alter table public.books
  add column if not exists censorship_context_status text;

alter table public.books drop constraint if exists books_censorship_context_status_check;
alter table public.books
  add constraint books_censorship_context_status_check check (
    censorship_context_status is null
    or censorship_context_status in (
      'narrative_curated',     -- human-edited OR grounded-LLM from real sources; trusted
      'insufficient_evidence', -- deliberately empty; re-enrichment MUST skip
      'pending_review',        -- default; eligible for v3 grounded enrichment
      'flagged'                -- existing text is suspect; awaiting decision
    )
  );

comment on column public.books.censorship_context_status is
  'Tracks the curation state of censorship_context. NULL = legacy/unknown. insufficient_evidence = deliberately left empty (re-enrichment must skip). pending_review = eligible for grounded v3 enrichment. narrative_curated = trusted. flagged = suspect.';

-- Index only on the actionable values so the planner can quickly find
-- books that need v3 re-enrichment.
create index if not exists books_censorship_context_status_pending_idx
  on public.books (id)
  where censorship_context_status = 'pending_review';
