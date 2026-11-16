-- admin_top_pages: called through a SECURITY DEFINER function the planner can't
-- inline, and the unfiltered 90-day case (154k rows) then sorts instead of
-- hash-aggregating and spills ~5.4 MB to temp (measured with EXPLAIN ANALYZE,
-- work_mem=8MB). A function-local work_mem keeps it in memory; it is cached
-- 5 min per filter combination by /admin/stats, so it runs rarely.
ALTER FUNCTION public.admin_top_pages(timestamptz, timestamptz, text, text, integer)
  SET work_mem = '24MB';
