-- ── mv_country_reason_counts ──────────────────────────────────────────────────
-- Pre-aggregated ban counts per country per reason.
-- Replaces the 3-query chain on the countries filter page.
-- Refresh: call refresh_all_materialized_views() after bulk imports.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_country_reason_counts AS
SELECT
  b.country_code,
  r.slug                                          AS reason_slug,
  COUNT(*)                                        AS total_bans,
  COUNT(*) FILTER (WHERE b.status = 'active')     AS active_bans
FROM bans b
JOIN ban_reason_links brl ON brl.ban_id = b.id
JOIN reasons r            ON r.id = brl.reason_id
GROUP BY b.country_code, r.slug;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_country_reason_counts_pk
  ON mv_country_reason_counts(country_code, reason_slug);


-- ── mv_refresh_log ────────────────────────────────────────────────────────────
-- Tracks when the source data last changed and when views were last refreshed.

CREATE TABLE IF NOT EXISTS mv_refresh_log (
  key        TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial rows so they always exist
INSERT INTO mv_refresh_log (key, updated_at)
VALUES
  ('data_last_changed', now()),
  ('last_refreshed',    now())
ON CONFLICT (key) DO NOTHING;


-- ── Data-change trigger ───────────────────────────────────────────────────────
-- Updates data_last_changed whenever bans or ban_reason_links are modified.

CREATE OR REPLACE FUNCTION fn_touch_data_changed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('data_last_changed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bans_data_changed            ON bans;
DROP TRIGGER IF EXISTS trg_ban_reason_links_data_changed ON ban_reason_links;

CREATE TRIGGER trg_bans_data_changed
  AFTER INSERT OR UPDATE OR DELETE ON bans
  FOR EACH STATEMENT EXECUTE FUNCTION fn_touch_data_changed();

CREATE TRIGGER trg_ban_reason_links_data_changed
  AFTER INSERT OR UPDATE OR DELETE ON ban_reason_links
  FOR EACH STATEMENT EXECUTE FUNCTION fn_touch_data_changed();


-- ── refresh_all_materialized_views() ─────────────────────────────────────────
-- Refreshes all views concurrently and records the timestamp.
-- Call via Supabase RPC: supabase.rpc('refresh_all_materialized_views')

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;

  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('last_refreshed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
END;
$$;
