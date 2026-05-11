-- ── admin_db_stats() ─────────────────────────────────────────────────────────
-- Returns physical DB size and the pageviews table size + row count, used by
-- the admin dashboard to flag risk of hitting Supabase plan limits.
-- Call via: supabase.rpc('admin_db_stats')

CREATE OR REPLACE FUNCTION admin_db_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'db_size_bytes',        pg_database_size(current_database()),
    'pageviews_size_bytes', COALESCE(pg_total_relation_size('public.pageviews'), 0),
    'pageviews_rows',       (SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.pageviews'::regclass)
  );
$$;

REVOKE ALL ON FUNCTION admin_db_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_db_stats() TO service_role;
