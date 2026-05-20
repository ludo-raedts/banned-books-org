-- Lock down the admin RPCs and materialized views that PostgREST currently
-- exposes to anon/authenticated, and pin search_path on the remaining
-- public functions Supabase advisor flagged on 2026-05-17.
--
-- Site has no Supabase Auth flows: every read/write goes through
-- adminClient() (service_role) via src/lib/supabase.ts. browserClient() and
-- serverClient() exist but have zero callsites. service_role bypasses these
-- grants, so revoking from anon/authenticated/public is a no-op for the app.
--
-- Three blocks:
--   1. RPCs: revoke EXECUTE on the two SECURITY DEFINER functions. Anyone
--      with the project URL could call POST /rest/v1/rpc/refresh_all_materialized_views
--      and DoS the DB with 4× REFRESH MATERIALIZED VIEW CONCURRENTLY, or
--      read pageviews row count + db size via admin_db_stats.
--   2. Materialized views: revoke ALL from anon/authenticated. The recent
--      mv_ban_counts migration (20260520130000) re-granted these — we drop
--      them back to service_role-only.
--   3. Functions: pin search_path = pg_catalog, public on the three public
--      functions that lacked it. Trigger functions reference unqualified
--      mv_refresh_log / now(), so an empty search_path would break them;
--      pg_catalog,public keeps them working while preventing a malicious
--      schema from shadowing names.

revoke execute on function "public"."admin_db_stats"()                 from "anon", "authenticated", public;
revoke execute on function "public"."refresh_all_materialized_views"() from "anon", "authenticated", public;

revoke all on table "public"."mv_ban_counts"            from "anon", "authenticated";
revoke all on table "public"."mv_country_reason_counts" from "anon", "authenticated";
revoke all on table "public"."mv_top_authors_rising"    from "anon", "authenticated";
revoke all on table "public"."mv_top_books_rising"      from "anon", "authenticated";

alter function "public"."refresh_all_materialized_views"() set search_path = pg_catalog, public;
alter function "public"."fn_touch_data_changed"()          set search_path = pg_catalog, public;
alter function "public"."set_updated_at"()                 set search_path = pg_catalog, public;
