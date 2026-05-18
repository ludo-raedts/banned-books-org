-- Data-quality classification for books + authors.
--
-- Three levels per record:
--   confident — automatic high-confidence: canonical-id (OpenLibrary / ISBN /
--               Gutenberg) + descriptions + at least one extra evidence
--               signal (named author, multi-country bans, source citations).
--   default   — imported, nothing wrong, no hard verification. Default state.
--   flagged   — at least one data-quality problem (placeholder cover, no
--               source citations, AI-drafted without description, etc.).
--
-- Computed offline by scripts/score-data-quality.ts. Drives the UI
-- indicators on book / author detail pages and feeds schema.org JSON-LD as
-- additionalProperty for AI-citation surfaces.
--
-- Pattern follows existing text+CHECK columns (warning_level, cover_status,
-- bookshop_status, bans.confidence) rather than introducing an enum type,
-- so that classification levels can be added without ALTER TYPE.

alter table public.books
  add column data_quality_status text not null default 'default',
  add column data_quality_evaluated_at timestamptz;

alter table public.books
  add constraint books_data_quality_status_check
    check (data_quality_status in ('confident', 'default', 'flagged'));

alter table public.authors
  add column data_quality_status text not null default 'default',
  add column data_quality_evaluated_at timestamptz;

alter table public.authors
  add constraint authors_data_quality_status_check
    check (data_quality_status in ('confident', 'default', 'flagged'));

-- Partial indexes — most rows are 'default'; only confident/flagged
-- queries benefit from indexing and they are the minority.
create index if not exists books_data_quality_status_idx
  on public.books (data_quality_status)
  where data_quality_status <> 'default';

create index if not exists authors_data_quality_status_idx
  on public.authors (data_quality_status)
  where data_quality_status <> 'default';
