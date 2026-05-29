-- Track where each book's description came from so future enrichment runs
-- (and the public UI) can show "Source: Wikipedia" attribution and so
-- audit tools can tell verified-from-source descriptions apart from
-- llm-synthesised ones. Introduced after the 2026-05-28 hallucination
-- cleanup, which wiped CONTRADICTED ai_drafted descriptions: the new
-- enrich-descriptions-v2 pipeline writes both columns whenever it sets
-- description_book.

alter table public.books
  add column if not exists description_source_url  text,
  add column if not exists description_source_type text;

-- Allowed values reflect the v2 enrichment ladder. NULL is allowed for
-- legacy rows whose source we haven't recorded.
alter table public.books drop constraint if exists books_description_source_type_check;
alter table public.books
  add constraint books_description_source_type_check check (
    description_source_type is null
    or description_source_type in (
      'wikipedia',            -- literal extract from English Wikipedia
      'wikipedia_translated', -- non-English Wikipedia, LLM-translated to EN
      'openlibrary',          -- literal extract from OL works API
      'google_books',         -- literal extract from Google Books
      'llm_grounded_multi',   -- LLM synthesised from ≥ 2 source extracts
      'llm_grounded_single',  -- LLM paraphrased from 1 source (too long/technical for literal)
      'manual'                -- human-curated text
    )
  );

comment on column public.books.description_source_url is
  'URL of the primary external source that produced description_book. Set by the v2 enrichment pipeline.';
comment on column public.books.description_source_type is
  'Provenance label for description_book. NULL = legacy/unknown. wikipedia / openlibrary / google_books = literal extract. llm_grounded_* = LLM synthesised from cited source(s). manual = human edit.';

create index if not exists books_description_source_type_idx
  on public.books (description_source_type)
  where description_source_type is not null;
