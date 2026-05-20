-- Switch all 13 public-schema views to security_invoker so they run with the
-- privileges of the calling role rather than the view owner (postgres).
-- Supabase advisor flagged each one as security_definer_view on 2026-05-17.
--
-- Why this is safe:
--   - Every callsite uses adminClient() (service_role), which bypasses RLS
--     regardless of view mode. No app code reads these via the anon key.
--   - Underlying tables (books, authors, bans, countries, etc.) all have
--     anon SELECT policies, so if anon ever did hit a books/authors view it
--     would still work — just through anon's own permissions.
--
-- Bonus: closes a side-channel on the pageviews-derived views
-- (v_top_referrers_*, v_weekly_totals). pageviews has RLS on with no anon
-- policy; under definer mode anon could nonetheless read aggregations
-- through these views because the view owner is postgres. Under invoker
-- mode that path correctly returns zero rows for anon.

alter view "public"."v_top_authors_all_time"     set (security_invoker = true);
alter view "public"."v_top_authors_last_week"    set (security_invoker = true);
alter view "public"."v_top_authors_this_week"    set (security_invoker = true);
alter view "public"."v_top_banned_authors"       set (security_invoker = true);
alter view "public"."v_top_banned_books"         set (security_invoker = true);
alter view "public"."v_top_books_all_time"       set (security_invoker = true);
alter view "public"."v_top_books_last_week"      set (security_invoker = true);
alter view "public"."v_top_books_this_week"      set (security_invoker = true);
alter view "public"."v_top_countries_last_week"  set (security_invoker = true);
alter view "public"."v_top_countries_this_week"  set (security_invoker = true);
alter view "public"."v_top_referrers_last_week"  set (security_invoker = true);
alter view "public"."v_top_referrers_this_week"  set (security_invoker = true);
alter view "public"."v_weekly_totals"            set (security_invoker = true);
