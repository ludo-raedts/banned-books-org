-- ============================================================================
-- Split the materialized-view refresh by how often the underlying data changes.
--
-- refresh_all_materialized_views() refreshed all 5 MVs on a 30-min cron, but the
-- two classes change at very different rates:
--   • Ban-data aggregates (mv_ban_counts, mv_country_reason_counts,
--     mv_book_scope_counts) only change on an IMPORT — a few times per week.
--     Refreshing them every 30 min is wasted work.
--   • "Rising" MVs (mv_top_books_rising, mv_top_authors_rising) rank a 7-day
--     rolling pageview window, so they shift slowly — hourly is plenty.
--
-- New split: rising → hourly cron, ban-counts → daily cron. refresh_all() is
-- kept (now composing both) for the manual /api/admin/refresh-views and the
-- post-import scripts/refresh-mv.ts, which must refresh everything on demand.
-- All refreshes stay CONCURRENTLY (no read-blocking lock).
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."refresh_rising_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_books_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_authors_rising;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."refresh_ban_count_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_book_scope_counts;
END;
$$;

-- Compose both. Kept for on-demand callers (admin route, refresh-mv.ts) that
-- want a full refresh right after an import; only this path writes the log row.
CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public"
    AS $$
BEGIN
  PERFORM refresh_ban_count_materialized_views();
  PERFORM refresh_rising_materialized_views();

  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('last_refreshed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
END;
$$;

GRANT ALL ON FUNCTION "public"."refresh_rising_materialized_views"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."refresh_ban_count_materialized_views"() TO "anon", "authenticated", "service_role";
