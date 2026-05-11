-- Indexes for the pageviews table to speed up the views and queries
-- created in migrations 010 (v_top_*_all_time) and the rising-widget
-- (rolling 14-day window). Indexes are auto-maintained by Postgres —
-- no daily refresh job is required.
--
-- Plain CREATE INDEX (not CONCURRENTLY) so the file runs in Supabase
-- Studio's SQL editor (which wraps statements in a transaction).
-- Each index briefly blocks writes to pageviews while it builds —
-- a few seconds at most, since the cleanup cron caps the table at
-- 90 days of rows.

-- All-time aggregations (v_top_books_all_time, v_top_authors_all_time):
--   WHERE entity_type = X GROUP BY entity_id
-- A composite (entity_type, entity_id) index lets the planner do an
-- index-only scan: no heap fetch needed for the GROUP BY.
CREATE INDEX IF NOT EXISTS idx_pageviews_entity_type_id
  ON pageviews(entity_type, entity_id);

-- Rising-widget rolling-window queries:
--   WHERE entity_type = X AND viewed_at >= Y
CREATE INDEX IF NOT EXISTS idx_pageviews_entity_type_viewed_at
  ON pageviews(entity_type, viewed_at);

-- Cleanup cron (daily delete of rows older than 90 days):
--   WHERE viewed_at < cutoff
CREATE INDEX IF NOT EXISTS idx_pageviews_viewed_at
  ON pageviews(viewed_at);
