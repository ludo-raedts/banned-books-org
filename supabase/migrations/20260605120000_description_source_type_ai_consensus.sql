-- Add the 'ai_consensus' provenance tier for description_book.
--
-- These descriptions are NOT from a single cited source. They are written only
-- when GPT-4o-mini and Gemini-2.5-flash INDEPENDENTLY produce descriptions that
-- a third judge confirms agree on concrete, specific facts (cross-model
-- consensus), and the stored text is synthesised from ONLY those agreed facts.
-- The escape hatch: either model replying "UNKNOWN" (no reliable knowledge of
-- the exact book) blocks the row entirely, so this never confabulates the long
-- tail. Validated 2026-06-05 at a 0% false-positive rate against known
-- confabulation traps.
--
-- It is a distinct, weaker tier than the grounded labels: the public UI marks it
-- "AI-generated summary, cross-checked, not from a single cited source", and
-- data-quality scoring must NOT treat it as a sourced/confident signal.

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
      'ai_consensus',         -- cross-model consensus (GPT + Gemini agree); NOT a cited source
      'manual'                -- human-curated text
    )
  );

comment on column public.books.description_source_type is
  'Provenance label for description_book. NULL = legacy/unknown. wikipedia / openlibrary / google_books = literal extract. llm_grounded_* = LLM synthesised from cited source(s). ai_consensus = cross-model consensus, NOT a cited source (weakest tier, label as AI-generated). manual = human edit.';
