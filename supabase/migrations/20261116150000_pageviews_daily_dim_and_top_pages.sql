-- Admin /admin/stats: date-range filters for the country / referrer breakdowns
-- and a "top pages" drill-down (by referrer and/or country).
--
-- DISK-IO ASSESSMENT (checked with EXPLAIN (ANALYZE, BUFFERS), work_mem=8MB):
--   * A range-scoped `count(DISTINCT visitor_hash) GROUP BY country` over the
--     full 90-day pageviews table (154k rows) sorts (country, visitor_hash) and
--     spills 11.8 MB to temp — the exact pattern behind the July/Nov Disk-IO
--     incidents. So the breakdowns are NOT computed on the raw table per request.
--   * Instead they are pre-aggregated per UTC day into pageviews_daily_dim
--     (same idea as pageviews_daily): the hourly refresh scans ~2 days of raw
--     rows (a few thousand; no spill), and a range query sums a few hundred
--     tiny rows. visitor_hash is salted per day, so "visitors" for a range is
--     the SUM of daily-unique visitors — identical to what count(DISTINCT
--     visitor_hash) over the range returns.
--   * admin_top_pages uses count(*) only (HashAggregate, ~2 MB, 120 ms, no
--     spill) and is cached 5 min per filter combination by the page.

CREATE TABLE public.pageviews_daily_dim (
    day        date    NOT NULL,
    dim        text    NOT NULL CHECK (dim IN ('country', 'referrer')),
    key        text    NOT NULL,           -- '' = unknown country / no referrer
    visitors   integer NOT NULL,
    pageviews  integer NOT NULL,
    PRIMARY KEY (day, dim, key)
);

ALTER TABLE public.pageviews_daily_dim ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pageviews_daily_dim FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pageviews_daily_dim TO service_role;

-- Upsert the UTC days p_from..p_to (inclusive). Cron calls it for
-- (yesterday, today), because writes can straddle the midnight boundary.
CREATE FUNCTION public.refresh_pageviews_daily_dim(p_from date, p_to date) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  INSERT INTO pageviews_daily_dim (day, dim, key, visitors, pageviews)
  SELECT (viewed_at AT TIME ZONE 'UTC')::date, 'country', coalesce(country, ''),
         count(DISTINCT visitor_hash)::integer, count(*)::integer
  FROM pageviews
  WHERE viewed_at >= (p_from::timestamp AT TIME ZONE 'UTC')
    AND viewed_at <  ((p_to + 1)::timestamp AT TIME ZONE 'UTC')
  GROUP BY (viewed_at AT TIME ZONE 'UTC')::date, coalesce(country, '')
  UNION ALL
  SELECT (viewed_at AT TIME ZONE 'UTC')::date, 'referrer', coalesce(referrer_host, ''),
         count(DISTINCT visitor_hash)::integer, count(*)::integer
  FROM pageviews
  WHERE viewed_at >= (p_from::timestamp AT TIME ZONE 'UTC')
    AND viewed_at <  ((p_to + 1)::timestamp AT TIME ZONE 'UTC')
  GROUP BY (viewed_at AT TIME ZONE 'UTC')::date, coalesce(referrer_host, '')
  ON CONFLICT (day, dim, key) DO UPDATE
    SET visitors  = EXCLUDED.visitors,
        pageviews = EXCLUDED.pageviews;
$$;

REVOKE ALL ON FUNCTION public.refresh_pageviews_daily_dim(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_pageviews_daily_dim(date, date) TO service_role;

-- One-time backfill, one UTC day at a time (keeps each sort tiny, no spill).
DO $$
DECLARE d date;
BEGIN
  FOR d IN
    SELECT g::date
    FROM generate_series(
      (SELECT (min(viewed_at) AT TIME ZONE 'UTC')::date FROM pageviews),
      (now() AT TIME ZONE 'UTC')::date,
      interval '1 day') g
  LOOP
    PERFORM public.refresh_pageviews_daily_dim(d, d);
  END LOOP;
END $$;

-- Top pages in [p_from, p_to), optionally narrowed to one referrer and/or one
-- country. NULL = no filter; '' = "no referrer" / "unknown country".
CREATE FUNCTION public.admin_top_pages(
    p_from timestamptz,
    p_to timestamptz,
    p_referrer text DEFAULT NULL,
    p_country text DEFAULT NULL,
    p_limit integer DEFAULT 25
) RETURNS TABLE (entity_type text, entity_id bigint, path text, pageviews bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  SELECT pv.entity_type, pv.entity_id, pv.path, count(*) AS pageviews
  FROM pageviews pv
  WHERE pv.viewed_at >= p_from
    AND pv.viewed_at <  p_to
    AND (p_referrer IS NULL
         OR (p_referrer = '' AND pv.referrer_host IS NULL)
         OR pv.referrer_host = p_referrer)
    AND (p_country IS NULL
         OR (p_country = '' AND pv.country IS NULL)
         OR pv.country = p_country)
  GROUP BY pv.entity_type, pv.entity_id, pv.path
  ORDER BY pageviews DESC, pv.path
  LIMIT least(greatest(p_limit, 1), 100);
$$;

REVOKE ALL ON FUNCTION public.admin_top_pages(timestamptz, timestamptz, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_pages(timestamptz, timestamptz, text, text, integer) TO service_role;
