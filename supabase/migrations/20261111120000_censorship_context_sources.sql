-- Source record for books.censorship_context.
--
-- The censorship history was written by an LLM from memory and had no source
-- column at all (UX review 2026-11-11: 1984 said the Soviet ban ended in 1988
-- in the ban text and 1990 in the history). scripts/verify-censorship-context.ts
-- now replaces a text only when every sentence rests on a passage that occurs
-- literally on a cited page. This migration gives that result a place to live:
--
--   censorship_context_sources     jsonb  [{url, title, quote}] — the pages and
--                                         the verbatim passages the text rests on
--   censorship_context_checked_at  timestamptz — when the verification ran
--   censorship_context_check_note  text   why a text was NOT replaced
--                                         ("no_quotes: …", "record_conflict: …"),
--                                         or which sourced events our ban rows lack
--   censorship_context_unsourced   text   the unsourced text that was replaced,
--                                         kept so nothing is lost and the swap
--                                         can be undone
--
-- and a new status 'source_verified' (machine-checked against cited sources;
-- distinct from 'narrative_curated' = a person wrote or vetted it).
--
-- Disk-IO: four nullable columns without a default are catalog-only (no table
-- rewrite). The status constraint is re-added NOT VALID and validated in a
-- second step, so the one sequential scan of books (~29k rows, no sort, no
-- temp file) runs under SHARE UPDATE EXCLUSIVE instead of ACCESS EXCLUSIVE.
-- No index: the page reads these by primary key / slug, and the only bulk
-- reader is the verification script itself.

alter table public.books
  add column if not exists censorship_context_sources jsonb,
  add column if not exists censorship_context_checked_at timestamptz,
  add column if not exists censorship_context_check_note text,
  add column if not exists censorship_context_unsourced text;

alter table public.books drop constraint if exists books_censorship_context_status_check;
alter table public.books
  add constraint books_censorship_context_status_check check (
    censorship_context_status is null
    or censorship_context_status in (
      'narrative_curated',
      'source_verified',                -- added 2026-11-11: every sentence matched to a cited passage
      'insufficient_evidence',
      'pending_review',
      'flagged',
      'auto_rejected_low_groundedness'
    )
  ) not valid;
alter table public.books validate constraint books_censorship_context_status_check;

-- A text may only carry 'source_verified' while its sources are stored with it.
alter table public.books drop constraint if exists books_censorship_context_sources_check;
alter table public.books
  add constraint books_censorship_context_sources_check check (
    censorship_context_status is distinct from 'source_verified'
    or (
      censorship_context is not null
      and case when jsonb_typeof(censorship_context_sources) = 'array'
               then jsonb_array_length(censorship_context_sources) > 0
               else false end
    )
  ) not valid;
alter table public.books validate constraint books_censorship_context_sources_check;

comment on column public.books.censorship_context_status is
  'Curation state of censorship_context. NULL = legacy/unknown. narrative_curated = a person wrote or vetted it. source_verified = rewritten by scripts/verify-censorship-context.ts from passages that occur literally on the pages in censorship_context_sources. insufficient_evidence = deliberately left empty (re-enrichment must skip). auto_rejected_low_groundedness = gate rejected last GPT attempt (do not retry). pending_review = unsourced AI text awaiting verification. flagged = suspect.';
comment on column public.books.censorship_context_sources is
  'JSON array [{url, title, quote}]: the cited pages and the verbatim passages a source_verified censorship_context rests on.';
comment on column public.books.censorship_context_checked_at is
  'When scripts/verify-censorship-context.ts last checked this text against sources (set for both outcomes).';
comment on column public.books.censorship_context_check_note is
  'Outcome note of the last source check: why the text was not replaced, or which sourced events the ban rows do not hold.';
comment on column public.books.censorship_context_unsourced is
  'The unsourced AI-written censorship_context that a source_verified text replaced. Never shown on the site.';
