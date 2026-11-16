-- /admin/stats "Last 24h": hourly traffic, window totals and per-dimension
-- breakdown computed directly from the raw pageviews table for a short window.
--
-- DISK-IO: a 24 h window is ~3k rows (index scan on idx_pageviews_viewed_at),
-- so the count(DISTINCT visitor_hash) sorts are a few hundred kB — nowhere near
-- the 11.8 MB spill of the 90-day country query (see 20261116150000), which is
-- why the longer ranges read the daily rollups instead. These functions are not
-- meant for windows beyond a few days; p_to - p_from is capped at 3 days.
--
-- visitor_hash is salted per UTC day: "visitors" here is unique within the
-- window, and a window that crosses 00:00 UTC can count one person twice.

CREATE FUNCTION public.admin_hourly_traffic(
    p_from timestamptz,
    p_to timestamptz,
    p_referrer text DEFAULT NULL,
    p_country text DEFAULT NULL
) RETURNS TABLE (hour timestamptz, visitors bigint, pageviews bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  SELECT date_trunc('hour', pv.viewed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS hour,
         count(DISTINCT pv.visitor_hash) AS visitors,
         count(*) AS pageviews
  FROM pageviews pv
  WHERE pv.viewed_at >= p_from
    AND pv.viewed_at <  least(p_to, p_from + interval '3 days')
    AND (p_referrer IS NULL
         OR (p_referrer = '' AND pv.referrer_host IS NULL)
         OR pv.referrer_host = p_referrer)
    AND (p_country IS NULL
         OR (p_country = '' AND pv.country IS NULL)
         OR pv.country = p_country)
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE FUNCTION public.admin_window_totals(
    p_from timestamptz,
    p_to timestamptz,
    p_referrer text DEFAULT NULL,
    p_country text DEFAULT NULL
) RETURNS TABLE (visitors bigint, pageviews bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  SELECT count(DISTINCT pv.visitor_hash) AS visitors, count(*) AS pageviews
  FROM pageviews pv
  WHERE pv.viewed_at >= p_from
    AND pv.viewed_at <  least(p_to, p_from + interval '3 days')
    AND (p_referrer IS NULL
         OR (p_referrer = '' AND pv.referrer_host IS NULL)
         OR pv.referrer_host = p_referrer)
    AND (p_country IS NULL
         OR (p_country = '' AND pv.country IS NULL)
         OR pv.country = p_country);
$$;

CREATE FUNCTION public.admin_window_dim(
    p_dim text,
    p_from timestamptz,
    p_to timestamptz,
    p_limit integer DEFAULT 50
) RETURNS TABLE (key text, visitors bigint, pageviews bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  SELECT CASE WHEN p_dim = 'country' THEN coalesce(pv.country, '')
              ELSE coalesce(pv.referrer_host, '') END AS key,
         count(DISTINCT pv.visitor_hash) AS visitors,
         count(*) AS pageviews
  FROM pageviews pv
  WHERE pv.viewed_at >= p_from
    AND pv.viewed_at <  least(p_to, p_from + interval '3 days')
    AND p_dim IN ('country', 'referrer')
  GROUP BY 1
  ORDER BY visitors DESC, key
  LIMIT least(greatest(p_limit, 1), 500);
$$;

REVOKE ALL ON FUNCTION public.admin_hourly_traffic(timestamptz, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_window_totals(timestamptz, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_window_dim(text, timestamptz, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hourly_traffic(timestamptz, timestamptz, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_window_totals(timestamptz, timestamptz, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_window_dim(text, timestamptz, timestamptz, integer) TO service_role;
