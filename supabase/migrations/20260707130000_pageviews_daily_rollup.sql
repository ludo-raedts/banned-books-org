-- ============================================================================
-- pageviews_daily: pre-aggregated per-day traffic rollup for the admin
-- Traffic chart (30-day visitors + pageviews time series).
--
-- Why a plain rollup table and not a materialized view:
--   • Raw pageviews rows are pruned after 90 days (/api/cron/cleanup-pageviews),
--     so any view over the raw table silently loses history. This table keeps
--     it forever at ~365 rows/year.
--   • A matview refresh re-aggregates its whole window every run; this table
--     is upserted incrementally — only the last 2 UTC days are recomputed, so
--     refresh cost is bounded by daily traffic volume, not table size.
--
-- Disk-IO check (2026-07-07, 22.9k rows / 7.6MB raw table), per the migration
-- doctrine (EXPLAIN, watch for seq-scan + disk sorts):
--   • Incremental refresh: Index Scan on idx_pageviews_viewed_at → 118 rows,
--     35kB in-memory quicksort, ~6ms. No seq scan, no temp spill.
--   • One-time backfill below: seq scan + 1.8MB in-memory quicksort, ~314ms —
--     well under authenticator work_mem (8MB) and the ~8s statement timeout.
--   No new index needed: idx_pageviews_viewed_at covers the refresh predicate.
--
-- Day boundary is UTC, matching the per-day visitor_hash salt in
-- /api/pageview (toISOString date). count(DISTINCT visitor_hash) is only
-- valid *within* one day — the same visitor hashes differently on different
-- days — which is exactly why the rollup stores per-day numbers and the UI
-- must never sum "visitors" across days.
-- ============================================================================

CREATE TABLE public.pageviews_daily (
    day date PRIMARY KEY,
    visitors integer NOT NULL,
    pageviews integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Admin-only surface, same lockdown as the other admin tables (see
-- 20260520180000): RLS on with no policies, no anon/authenticated grants.
-- service_role bypasses RLS.
ALTER TABLE public.pageviews_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pageviews_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pageviews_daily TO service_role;

-- Incremental upsert of the last 2 UTC days. Yesterday is recomputed too
-- because writes can straddle the midnight boundary between cron runs; days
-- older than that are immutable. Called hourly from /api/cron/refresh-views.
CREATE FUNCTION public.refresh_pageviews_daily() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  INSERT INTO pageviews_daily (day, visitors, pageviews, updated_at)
  SELECT (viewed_at AT TIME ZONE 'UTC')::date AS day,
         count(DISTINCT visitor_hash)::integer AS visitors,
         count(*)::integer AS pageviews,
         now()
  FROM pageviews
  WHERE viewed_at >= (((now() AT TIME ZONE 'UTC')::date - 1)::timestamp AT TIME ZONE 'UTC')
  GROUP BY 1
  ON CONFLICT (day) DO UPDATE
    SET visitors   = EXCLUDED.visitors,
        pageviews  = EXCLUDED.pageviews,
        updated_at = EXCLUDED.updated_at;
$$;

REVOKE ALL ON FUNCTION public.refresh_pageviews_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_pageviews_daily() TO service_role;

-- One-time backfill over the full raw table (already bounded at 90 days of
-- history by the cleanup cron).
INSERT INTO public.pageviews_daily (day, visitors, pageviews)
SELECT (viewed_at AT TIME ZONE 'UTC')::date,
       count(DISTINCT visitor_hash)::integer,
       count(*)::integer
FROM public.pageviews
GROUP BY 1
ON CONFLICT (day) DO UPDATE
  SET visitors   = EXCLUDED.visitors,
      pageviews  = EXCLUDED.pageviews,
      updated_at = now();
