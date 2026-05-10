-- Pre-aggregated rising-this-week lists for the homepage RisingWidget.
-- Replaces a paginated full scan of pageviews per request (~900-1200ms per
-- pageview, scales with traffic) with hourly-refreshed materialized snapshots
-- that the widget can read in ~50ms.  Trade-off: rising lists are up to 1h
-- stale, which is invisible at this granularity.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_books_rising AS
WITH this_week AS (
  SELECT entity_id, COUNT(DISTINCT visitor_hash)::int AS visitors
  FROM pageviews
  WHERE entity_type = 'book' AND visitor_hash IS NOT NULL
    AND viewed_at >= now() - interval '7 days'
  GROUP BY entity_id
),
prev_week AS (
  SELECT entity_id, COUNT(DISTINCT visitor_hash)::int AS visitors
  FROM pageviews
  WHERE entity_type = 'book' AND visitor_hash IS NOT NULL
    AND viewed_at >= now() - interval '14 days'
    AND viewed_at <  now() - interval '7 days'
  GROUP BY entity_id
)
SELECT
  tw.entity_id,
  tw.visitors                                AS this_week,
  COALESCE(pw.visitors, 0)                   AS prev_week,
  (tw.visitors - COALESCE(pw.visitors, 0))::float
    / GREATEST(COALESCE(pw.visitors, 0), 1)  AS growth
FROM this_week tw
LEFT JOIN prev_week pw USING (entity_id)
WHERE tw.visitors >= 2
  AND tw.visitors > COALESCE(pw.visitors, 0)
ORDER BY growth DESC
LIMIT 50;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_books_rising_pk
  ON mv_top_books_rising(entity_id);


CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_authors_rising AS
WITH this_week AS (
  SELECT entity_id, COUNT(DISTINCT visitor_hash)::int AS visitors
  FROM pageviews
  WHERE entity_type = 'author' AND visitor_hash IS NOT NULL
    AND viewed_at >= now() - interval '7 days'
  GROUP BY entity_id
),
prev_week AS (
  SELECT entity_id, COUNT(DISTINCT visitor_hash)::int AS visitors
  FROM pageviews
  WHERE entity_type = 'author' AND visitor_hash IS NOT NULL
    AND viewed_at >= now() - interval '14 days'
    AND viewed_at <  now() - interval '7 days'
  GROUP BY entity_id
)
SELECT
  tw.entity_id,
  tw.visitors                                AS this_week,
  COALESCE(pw.visitors, 0)                   AS prev_week,
  (tw.visitors - COALESCE(pw.visitors, 0))::float
    / GREATEST(COALESCE(pw.visitors, 0), 1)  AS growth
FROM this_week tw
LEFT JOIN prev_week pw USING (entity_id)
WHERE tw.visitors >= 2
  AND tw.visitors > COALESCE(pw.visitors, 0)
ORDER BY growth DESC
LIMIT 50;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_authors_rising_pk
  ON mv_top_authors_rising(entity_id);


-- Extend refresh_all_materialized_views() to cover the new MVs.
-- The hourly /api/cron/refresh-views cron calls this function via RPC, so the
-- existing admin "Refresh now" button transparently refreshes the new ones too.
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_books_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_authors_rising;

  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('last_refreshed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
END;
$$;
