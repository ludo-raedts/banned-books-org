-- Clears the 6 Security Advisor errors flagged on 2026-06-02:
--   5 × security_definer_view  +  1 × rls_disabled_in_public
--
-- ── Part 1: re-apply security_invoker to 5 views ───────────────────────────
-- 20260520170000_views_security_invoker.sql set security_invoker=true on all
-- 13 public views. Two later migrations then recreated 5 of them with
-- CREATE OR REPLACE VIEW, each carrying a comment asserting that the
-- reloption is "preserved". That assertion is WRONG: verified against prod on
-- 2026-06-02, the recreated views had empty reloptions while the untouched 8
-- still carried {security_invoker=true}. CREATE OR REPLACE VIEW resets
-- reloptions unless you respecify them. The advisor re-flagged exactly these 5.
--
--   recreated by 20260521111210_top_banned_views_granular_split.sql:
--     v_top_banned_books, v_top_banned_authors
--   recreated by 20260526130000_top_books_views_filter_orphans.sql:
--     v_top_books_all_time, v_top_books_this_week, v_top_books_last_week
--
-- Going forward: any CREATE OR REPLACE VIEW on these MUST include
-- WITH (security_invoker = true), or re-apply it as below.

alter view "public"."v_top_banned_books"   set (security_invoker = true);
alter view "public"."v_top_banned_authors"  set (security_invoker = true);
alter view "public"."v_top_books_all_time"  set (security_invoker = true);
alter view "public"."v_top_books_this_week" set (security_invoker = true);
alter view "public"."v_top_books_last_week" set (security_invoker = true);

-- ── Part 2: enable RLS on reading_club_young_readers ───────────────────────
-- 20260526120000_reading_club_young_readers.sql created the table with anon
-- GRANTs but no RLS — the only reading_club_* table missing it (the five
-- siblings all have RLS on + a single public SELECT policy). The public
-- /reading-club young-readers pages read this table through serverClient()
-- (anon), so it needs the same SELECT-for-public policy, not an admin-only
-- lockdown. Matches the sibling policy verbatim (USING (true); the app layer
-- applies the published_at filter for non-admin reads).

alter table "public"."reading_club_young_readers" enable row level security;

create policy "Public can read reading club young readers"
    on "public"."reading_club_young_readers"
    for select
    to public
    using (true);
