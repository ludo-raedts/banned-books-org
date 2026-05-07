-- ─────────────────────────────────────────────────────────────────────────────
-- Visitor counting (privacy-safe, GDPR-compliant)
--
-- Adds visitor_hash to pageviews and redefines aggregation views to count
-- COUNT(DISTINCT visitor_hash) instead of COUNT(*).
--
-- visitor_hash is computed in the application layer:
--   sha256(daily_salt || ip || user_agent)
-- where daily_salt rotates every 24h. The IP is never stored — only the
-- irreversible hash. This means:
--   • bot/scraper scraping 1000 pages in a day → counted as 1 visitor that day
--   • same person visiting Mon and Tue → counted as 2 (different daily salts)
--   • COUNT(DISTINCT visitor_hash) over a week ≈ sum of daily-unique visitors
--
-- Old rows (pre-013) have NULL visitor_hash and are excluded from DISTINCT
-- counts. After ~7 days of new traffic, weekly metrics stabilise.
--
-- Views are dropped and recreated (rather than CREATE OR REPLACE) because
-- CREATE OR REPLACE VIEW only succeeds when the new query produces the same
-- columns in the same order and types as the existing view; we change the
-- shape of v_weekly_totals (extra columns) and have seen Postgres reject
-- replacements on the others, so a clean rebuild is simpler and safer.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pageviews
  ADD COLUMN IF NOT EXISTS visitor_hash TEXT;

-- Composite index for COUNT(DISTINCT visitor_hash) over time-windowed queries
CREATE INDEX IF NOT EXISTS idx_pageviews_viewed_at_visitor_hash
  ON pageviews(viewed_at, visitor_hash);


-- ── Drop old views (CASCADE in case of unknown dependencies) ─────────────────
DROP VIEW IF EXISTS v_weekly_totals             CASCADE;
DROP VIEW IF EXISTS v_top_books_this_week       CASCADE;
DROP VIEW IF EXISTS v_top_books_last_week       CASCADE;
DROP VIEW IF EXISTS v_top_authors_this_week     CASCADE;
DROP VIEW IF EXISTS v_top_authors_last_week     CASCADE;
DROP VIEW IF EXISTS v_top_books_all_time        CASCADE;
DROP VIEW IF EXISTS v_top_authors_all_time      CASCADE;
DROP VIEW IF EXISTS v_top_countries_this_week   CASCADE;
DROP VIEW IF EXISTS v_top_countries_last_week   CASCADE;
DROP VIEW IF EXISTS v_top_referrers_this_week   CASCADE;
DROP VIEW IF EXISTS v_top_referrers_last_week   CASCADE;


-- ── v_weekly_totals ───────────────────────────────────────────────────────────
-- Headline visitor count + raw pageview count for sub-display.
CREATE VIEW v_weekly_totals AS
SELECT
  COUNT(DISTINCT visitor_hash) FILTER (
    WHERE viewed_at >= now() - INTERVAL '7 days'
  )::bigint AS views_this_week,
  COUNT(DISTINCT visitor_hash) FILTER (
    WHERE viewed_at >= now() - INTERVAL '14 days'
      AND viewed_at <  now() - INTERVAL '7 days'
  )::bigint AS views_last_week,
  COUNT(*) FILTER (
    WHERE viewed_at >= now() - INTERVAL '7 days'
  )::bigint AS pageviews_this_week,
  COUNT(*) FILTER (
    WHERE viewed_at >= now() - INTERVAL '14 days'
      AND viewed_at <  now() - INTERVAL '7 days'
  )::bigint AS pageviews_last_week
FROM pageviews;


-- ── v_top_books_this_week / last_week ─────────────────────────────────────────
CREATE VIEW v_top_books_this_week AS
SELECT entity_id, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE entity_type = 'book'
  AND viewed_at  >= now() - INTERVAL '7 days'
GROUP BY entity_id
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 100;

CREATE VIEW v_top_books_last_week AS
SELECT entity_id, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE entity_type = 'book'
  AND viewed_at  >= now() - INTERVAL '14 days'
  AND viewed_at  <  now() - INTERVAL '7 days'
GROUP BY entity_id
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 100;


-- ── v_top_authors_this_week / last_week ───────────────────────────────────────
CREATE VIEW v_top_authors_this_week AS
SELECT entity_id, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE entity_type = 'author'
  AND viewed_at  >= now() - INTERVAL '7 days'
GROUP BY entity_id
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 100;

CREATE VIEW v_top_authors_last_week AS
SELECT entity_id, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE entity_type = 'author'
  AND viewed_at  >= now() - INTERVAL '14 days'
  AND viewed_at  <  now() - INTERVAL '7 days'
GROUP BY entity_id
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 100;


-- ── v_top_books_all_time / v_top_authors_all_time ─────────────────────────────
-- Note: with daily-rotating salt, "all-time" is sum of daily-unique visits.
-- Still suppresses single-day scrapers vs raw COUNT(*).
CREATE VIEW v_top_books_all_time AS
SELECT entity_id, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE entity_type = 'book'
GROUP BY entity_id
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 100;

CREATE VIEW v_top_authors_all_time AS
SELECT entity_id, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE entity_type = 'author'
GROUP BY entity_id
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 100;


-- ── v_top_countries_this_week / last_week ─────────────────────────────────────
CREATE VIEW v_top_countries_this_week AS
SELECT country, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE viewed_at >= now() - INTERVAL '7 days'
GROUP BY country
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC NULLS LAST
LIMIT 50;

CREATE VIEW v_top_countries_last_week AS
SELECT country, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE viewed_at >= now() - INTERVAL '14 days'
  AND viewed_at <  now() - INTERVAL '7 days'
GROUP BY country
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC NULLS LAST
LIMIT 50;


-- ── v_top_referrers_this_week / last_week ─────────────────────────────────────
CREATE VIEW v_top_referrers_this_week AS
SELECT referrer_host, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE viewed_at    >= now() - INTERVAL '7 days'
  AND referrer_host IS NOT NULL
GROUP BY referrer_host
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 50;

CREATE VIEW v_top_referrers_last_week AS
SELECT referrer_host, COUNT(DISTINCT visitor_hash)::bigint AS views
FROM pageviews
WHERE viewed_at    >= now() - INTERVAL '14 days'
  AND viewed_at    <  now() - INTERVAL '7 days'
  AND referrer_host IS NOT NULL
GROUP BY referrer_host
HAVING COUNT(DISTINCT visitor_hash) > 0
ORDER BY views DESC
LIMIT 50;
