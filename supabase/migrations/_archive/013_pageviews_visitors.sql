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
-- All view bodies are wrapped in a subquery and use table aliases / fully
-- qualified column references to avoid any ambiguity with same-named functions
-- or extension columns. Earlier attempts with bare column names hit a
-- spurious "must appear in GROUP BY" error in Supabase's editor.
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
CREATE VIEW v_weekly_totals AS
SELECT * FROM (
  SELECT
    COUNT(DISTINCT pv.visitor_hash) FILTER (
      WHERE pv.viewed_at >= now() - INTERVAL '7 days'
    )::bigint AS views_this_week,
    COUNT(DISTINCT pv.visitor_hash) FILTER (
      WHERE pv.viewed_at >= now() - INTERVAL '14 days'
        AND pv.viewed_at <  now() - INTERVAL '7 days'
    )::bigint AS views_last_week,
    COUNT(*) FILTER (
      WHERE pv.viewed_at >= now() - INTERVAL '7 days'
    )::bigint AS pageviews_this_week,
    COUNT(*) FILTER (
      WHERE pv.viewed_at >= now() - INTERVAL '14 days'
        AND pv.viewed_at <  now() - INTERVAL '7 days'
    )::bigint AS pageviews_last_week
  FROM pageviews pv
) totals;


-- ── v_top_books_this_week / last_week ─────────────────────────────────────────
CREATE VIEW v_top_books_this_week AS
SELECT t.entity_id, t.views FROM (
  SELECT pv.entity_id AS entity_id,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.entity_type = 'book'
    AND pv.viewed_at  >= now() - INTERVAL '7 days'
  GROUP BY pv.entity_id
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 100;

CREATE VIEW v_top_books_last_week AS
SELECT t.entity_id, t.views FROM (
  SELECT pv.entity_id AS entity_id,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.entity_type = 'book'
    AND pv.viewed_at  >= now() - INTERVAL '14 days'
    AND pv.viewed_at  <  now() - INTERVAL '7 days'
  GROUP BY pv.entity_id
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 100;


-- ── v_top_authors_this_week / last_week ───────────────────────────────────────
CREATE VIEW v_top_authors_this_week AS
SELECT t.entity_id, t.views FROM (
  SELECT pv.entity_id AS entity_id,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.entity_type = 'author'
    AND pv.viewed_at  >= now() - INTERVAL '7 days'
  GROUP BY pv.entity_id
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 100;

CREATE VIEW v_top_authors_last_week AS
SELECT t.entity_id, t.views FROM (
  SELECT pv.entity_id AS entity_id,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.entity_type = 'author'
    AND pv.viewed_at  >= now() - INTERVAL '14 days'
    AND pv.viewed_at  <  now() - INTERVAL '7 days'
  GROUP BY pv.entity_id
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 100;


-- ── v_top_books_all_time / v_top_authors_all_time ─────────────────────────────
CREATE VIEW v_top_books_all_time AS
SELECT t.entity_id, t.views FROM (
  SELECT pv.entity_id AS entity_id,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.entity_type = 'book'
  GROUP BY pv.entity_id
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 100;

CREATE VIEW v_top_authors_all_time AS
SELECT t.entity_id, t.views FROM (
  SELECT pv.entity_id AS entity_id,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.entity_type = 'author'
  GROUP BY pv.entity_id
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 100;


-- ── v_top_countries_this_week / last_week ─────────────────────────────────────
CREATE VIEW v_top_countries_this_week AS
SELECT t.country, t.views FROM (
  SELECT pv.country AS country,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.viewed_at >= now() - INTERVAL '7 days'
  GROUP BY pv.country
) t
WHERE t.views > 0
ORDER BY t.views DESC NULLS LAST
LIMIT 50;

CREATE VIEW v_top_countries_last_week AS
SELECT t.country, t.views FROM (
  SELECT pv.country AS country,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.viewed_at >= now() - INTERVAL '14 days'
    AND pv.viewed_at <  now() - INTERVAL '7 days'
  GROUP BY pv.country
) t
WHERE t.views > 0
ORDER BY t.views DESC NULLS LAST
LIMIT 50;


-- ── v_top_referrers_this_week / last_week ─────────────────────────────────────
CREATE VIEW v_top_referrers_this_week AS
SELECT t.referrer_host, t.views FROM (
  SELECT pv.referrer_host AS referrer_host,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.viewed_at    >= now() - INTERVAL '7 days'
    AND pv.referrer_host IS NOT NULL
  GROUP BY pv.referrer_host
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 50;

CREATE VIEW v_top_referrers_last_week AS
SELECT t.referrer_host, t.views FROM (
  SELECT pv.referrer_host AS referrer_host,
         COUNT(DISTINCT pv.visitor_hash)::bigint AS views
  FROM pageviews pv
  WHERE pv.viewed_at    >= now() - INTERVAL '14 days'
    AND pv.viewed_at    <  now() - INTERVAL '7 days'
    AND pv.referrer_host IS NOT NULL
  GROUP BY pv.referrer_host
) t
WHERE t.views > 0
ORDER BY t.views DESC
LIMIT 50;
