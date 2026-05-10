-- ─────────────────────────────────────────────────────────────────────────────
-- 023 — News pipeline: source language + originals
--
-- Adds language tracking to news_items so the pipeline can ingest non-English
-- feeds (Meduza, IranWire, RSF, China Digital Times, Article 19, HRW, PEN
-- International) and the admin can spot translated items at a glance.
--
-- Columns:
--   source_language  ISO-639-1 (en, ru, fa, …). Default 'en' so all existing
--                    rows back-fill to a sane value without a separate UPDATE.
--   original_title   raw title from the RSS feed, before translation. Kept so
--                    the editor can sanity-check the OpenAI translate-and-
--                    summarise pass against the source.
--   original_summary raw description/snippet from the feed.
--
-- Index on source_language is for the admin filter dropdown — public reads
-- are still keyed off status + published_at and don't need it.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS source_language char(2) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS original_title  text,
  ADD COLUMN IF NOT EXISTS original_summary text;

CREATE INDEX IF NOT EXISTS news_items_source_language_idx
  ON news_items (source_language);
