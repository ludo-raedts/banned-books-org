-- Per-book ban aggregates for the top-list "context" labels (e.g.
-- "5 countries · 87 bans"). These are exactly the two counts v_top_banned_books
-- already produces (total_bans, distinct_countries) — but that view is LIMIT 100,
-- i.e. only the most-banned titles. The /trending-banned-books list ranks by
-- pageviews, so its books are an ARBITRARY set that need not appear in that top
-- 100; it needs the same counts for a bounded, caller-supplied id list.
--
-- Why a dedicated view instead of the embedded bans(country_code) join the page
-- used before: that join pulled EVERY ban row per book — a popular title carries
-- hundreds of PEN per-district records — into the SAME statement as the
-- book-detail fetch, just to count them in JS. statement_timeout is 8s per
-- statement on the authenticator role (service_role inherits it), and that
-- bundled statement was already ~6s cold during the build prerender. Reading the
-- counts from this view is a separate, bounded statement whose payload no longer
-- grows with a book's district-record count.
--
-- IMPORTANT: only index-bounded when filtered by a LITERAL id list — the
-- ?entity_id=in.(1,2,3) PostgREST emits pushes the predicate down to an index
-- scan on bans (book_id), ~1ms / ~550 buffers for 50 books. A subquery/CTE
-- IN-list does NOT push through the GROUP BY and degrades to a full bans scan;
-- never query this view with a correlated or subquery filter.

CREATE OR REPLACE VIEW "public"."v_book_ban_counts" AS
 SELECT "book_id" AS "entity_id",
    "count"("id") AS "total_bans",
    "count"(DISTINCT "country_code") AS "distinct_countries"
   FROM "public"."bans"
  GROUP BY "book_id";

-- Run with the caller's privileges, not the owner's (Supabase advisor doctrine;
-- see 20260520170000_views_security_invoker).
ALTER VIEW "public"."v_book_ban_counts" SET (security_invoker = true);

-- Site reads through adminClient() (service_role); anon/authenticated never
-- touch it. Same lockdown convention as mv_ban_counts after 20260520180000.
GRANT ALL ON TABLE "public"."v_book_ban_counts" TO "service_role";

COMMENT ON VIEW "public"."v_book_ban_counts" IS
    'Per-book ban aggregates (total_bans, distinct_countries) for top-list context labels. Query ONLY with a literal book_id list (?entity_id=in.(...)) so the predicate pushes down to the bans index; a subquery IN degrades to a full scan.';
