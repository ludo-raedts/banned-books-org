-- Range totals per country / referrer for /admin/stats, summed from the
-- pageviews_daily_dim rollup (a few hundred tiny rows; no raw-table scan, no
-- sort spill — see 20261116150000). PostgREST would cap a plain select at 1000
-- rows, so the aggregation lives in SQL.
CREATE FUNCTION public.admin_dim_totals(
    p_dim text,
    p_from date,
    p_to date,
    p_limit integer DEFAULT 50
) RETURNS TABLE (key text, visitors bigint, pageviews bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  SELECT d.key, sum(d.visitors)::bigint AS visitors, sum(d.pageviews)::bigint AS pageviews
  FROM pageviews_daily_dim d
  WHERE d.dim = p_dim AND d.day >= p_from AND d.day <= p_to
  GROUP BY d.key
  ORDER BY visitors DESC, d.key
  LIMIT least(greatest(p_limit, 1), 500);
$$;

REVOKE ALL ON FUNCTION public.admin_dim_totals(text, date, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dim_totals(text, date, date, integer) TO service_role;
