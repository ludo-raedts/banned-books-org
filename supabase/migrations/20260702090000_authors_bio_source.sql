-- ----------------------------------------------------------------------------
-- authors: bio source attribution (parallel to books.description_source_*)
-- ----------------------------------------------------------------------------
--
-- Books show a "Source: Wikipedia ↗" line under description_book, driven by
-- description_source_type/_url (m20260528150000). Author bios had no such
-- provenance at all: the Wikipedia/OpenLibrary enrichers wrote `bio` bare, and
-- a hand-pasted bio in the admin editor was indistinguishable from either.
-- These two columns close that gap; the author page renders the same
-- attribution component when they're set.
--
-- Backfill is deliberately NOT attempted: existing bios don't record where
-- they came from, and guessing would fabricate provenance. Same doctrine as
-- books — legacy rows show nothing, new/edited bios get attributed.
--
--   bio_source_type  'wikipedia' | 'openlibrary' | 'manual'. Stamped by
--                    enrich-author-bios.ts (wikipedia), enrich-author-ol.ts
--                    (openlibrary), and the admin PATCH route (derived from
--                    the supplied source URL's host, else 'manual').
--   bio_source_url   the page the text came from; the attribution links here.

alter table authors add column if not exists bio_source_type text;
alter table authors add column if not exists bio_source_url text;

alter table authors drop constraint if exists authors_bio_source_type_check;
alter table authors add constraint authors_bio_source_type_check
  check (bio_source_type is null
         or bio_source_type in ('wikipedia', 'openlibrary', 'manual'));

comment on column authors.bio_source_type is
  'Provenance of `bio`: wikipedia | openlibrary | manual. NULL = legacy bio '
  'with unrecorded origin (renders no attribution). Stamped by the bio '
  'enrichers and the admin author editor.';
comment on column authors.bio_source_url is
  'URL of the page `bio` was sourced from; the author-page attribution line '
  'links here. NULL for legacy or unsourced manual bios.';

-- PostgREST caches the schema; nudge a reload so the admin editor and author
-- page see the new columns immediately.
notify pgrst, 'reload schema';
