-- Performance indexes for banned-books.org
-- Run in Supabase SQL editor.
-- All use IF NOT EXISTS — safe to re-run.
-- Adapted to actual schema: country_code (char 2), status (text), year_started (int), display_name (text)

-- ── bans table ───────────────────────────────────────────────────────────────

-- Every country page filters bans by country_code — most-hit query
CREATE INDEX IF NOT EXISTS idx_bans_country_code
  ON bans(country_code);

-- Every book detail page joins bans by book_id
CREATE INDEX IF NOT EXISTS idx_bans_book_id
  ON bans(book_id);

-- Active vs historical filtering (status = 'active' | 'historical')
CREATE INDEX IF NOT EXISTS idx_bans_status
  ON bans(status);

-- Timeline/history queries filter and sort by year_started
CREATE INDEX IF NOT EXISTS idx_bans_year_started
  ON bans(year_started);

-- Composite: country page with active/historical split
CREATE INDEX IF NOT EXISTS idx_bans_country_status
  ON bans(country_code, status);

-- ── books table ──────────────────────────────────────────────────────────────

-- Every book page does eq('slug', ...) — should already be unique but add explicit index
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_slug
  ON books(slug);

-- Admin/enrichment queries filter by cover_url IS NULL, description_book IS NULL
CREATE INDEX IF NOT EXISTS idx_books_cover_null
  ON books(id) WHERE cover_url IS NULL;

CREATE INDEX IF NOT EXISTS idx_books_desc_null
  ON books(id) WHERE description_book IS NULL;

CREATE INDEX IF NOT EXISTS idx_books_context_null
  ON books(id) WHERE censorship_context IS NULL;

-- ── authors table ────────────────────────────────────────────────────────────

-- Every author page does eq('slug', ...)
CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_slug
  ON authors(slug);

-- ── countries table ──────────────────────────────────────────────────────────

-- code is already UNIQUE (from schema) — this is a no-op but documents intent
CREATE UNIQUE INDEX IF NOT EXISTS idx_countries_code
  ON countries(code);

-- ── junction tables ──────────────────────────────────────────────────────────

-- ban_reason_links: both join directions
CREATE INDEX IF NOT EXISTS idx_ban_reason_links_ban_id
  ON ban_reason_links(ban_id);

CREATE INDEX IF NOT EXISTS idx_ban_reason_links_reason_id
  ON ban_reason_links(reason_id);

-- book_authors: both join directions
CREATE INDEX IF NOT EXISTS idx_book_authors_book_id
  ON book_authors(book_id);

CREATE INDEX IF NOT EXISTS idx_book_authors_author_id
  ON book_authors(author_id);

-- ── Full-text search ─────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Title search (used in book browser filter)
CREATE INDEX IF NOT EXISTS idx_books_title_trgm
  ON books USING gin(title gin_trgm_ops);

-- Author name search
CREATE INDEX IF NOT EXISTS idx_authors_display_name_trgm
  ON authors USING gin(display_name gin_trgm_ops);

-- ── Materialized view: stats page counts ────────────────────────────────────
-- Refresh after bulk imports: REFRESH MATERIALIZED VIEW mv_ban_counts;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ban_counts AS
SELECT
  country_code,
  COUNT(*)                                   AS total_bans,
  COUNT(*) FILTER (WHERE status = 'active')  AS active_bans
FROM bans
GROUP BY country_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ban_counts_cc
  ON mv_ban_counts(country_code);

-- Usage example (countries index page, replacing the full bans fetch):
-- SELECT c.code, c.name_en, c.description, m.total_bans, m.active_bans
-- FROM countries c
-- JOIN mv_ban_counts m ON m.country_code = c.code
-- WHERE m.total_bans > 0
-- ORDER BY m.total_bans DESC;
