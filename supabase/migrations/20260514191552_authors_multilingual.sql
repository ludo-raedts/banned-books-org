-- ----------------------------------------------------------------------------
-- authors — multilingual name fields
-- ----------------------------------------------------------------------------
--
-- Mirrors the books.title_* shape (cf. 20260512074200_model3_and_import_queue.sql).
-- The Wikipedia bulk-parser produces bilingual author cells on the Hong Kong
-- page (e.g. "陳雲 / Chen, Yun.") and the LLM extraction pipeline emits
-- name_native / name_transliterated / name_english per AuthorExtraction;
-- both paths previously collapsed everything down to a single display_name
-- and the non-Latin half was discarded.
--
-- Going forward `display_name` remains the slug-canonical Anglo-friendly
-- form. `name_native` holds the native-script original. `name_transliterated`
-- is the BGN/PCGN-style romanisation when distinct from display_name (e.g.
-- "Chen Yun" vs "Yun Chen" anglicised). `name_english` is reserved for known
-- English-language pen names that differ from any transliteration.
--
-- `original_language` is the author's primary writing language (ISO 639-1).
-- Used by the planned author-name ladder in src/lib/enrich/_author-ladder.ts
-- to decide which form to try first against Wikidata / Wikimedia Commons.

alter table "public"."authors"
  add column if not exists "name_native"          text,
  add column if not exists "name_transliterated"  text,
  add column if not exists "name_english"         text,
  add column if not exists "original_language"    char(2);

comment on column "public"."authors"."name_native" is
  'Native-script form of the author name (e.g. "陳雲", "صادق هدایت"). NULL '
  'when the author writes in a Latin-script language or when only an '
  'anglicised form is known.';

comment on column "public"."authors"."name_transliterated" is
  'Romanisation of name_native per script convention (Pinyin without tones '
  'for Han, BGN/PCGN for Cyrillic, etc.). NULL for Latin-script originals '
  'or when the transliteration equals display_name.';

comment on column "public"."authors"."name_english" is
  'Known English pen name that differs from any transliteration. Rare; '
  'used for authors like "Lu Xun" who chose an Anglicised handle. NULL by '
  'default; display_name is the slug-canonical form regardless.';

comment on column "public"."authors"."original_language" is
  'ISO 639-1 code of the author''s primary writing language. Drives the '
  'name-variant ladder in enrichment: non-en authors try name_english '
  'before display_name before transliteration before native form.';

-- Trigram index on name_native so the same fuzzy-search infrastructure
-- already used for display_name (idx_authors_display_name_trgm) also covers
-- native-script queries from the admin search and dedup tooling.
create index if not exists "idx_authors_name_native_trgm"
  on "public"."authors"
  using "gin" ("name_native" "public"."gin_trgm_ops");

create index if not exists "idx_authors_name_transliterated_trgm"
  on "public"."authors"
  using "gin" ("name_transliterated" "public"."gin_trgm_ops");
