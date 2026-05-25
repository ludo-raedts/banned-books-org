-- Pre-compute the top-50 most-banned book_ids per reason so the homepage
-- can power the "Why books get banned" section without paginating the full
-- ban_reason_links table (45k rows / ~3.4 MB egress per render).
--
-- The 5 homepage reasons (lgbtq, sexual, political, religious, racial) only
-- need ~40 candidates each — top 50 here gives headroom for the cover-valid
-- + cross-section dedup filter to drop weak entries without exhausting the
-- pool. /reasons sub-pages may grow into this view later for the same
-- reason, hence not limiting to the homepage subset.
--
-- 11 reasons × 50 rows = 550-row payload ≈ 7 KB egress, refreshed by the
-- existing hourly refresh_all_materialized_views() cron.

CREATE MATERIALIZED VIEW IF NOT EXISTS "public"."mv_reason_top_books" AS
WITH "ranked" AS (
  SELECT
    "r"."slug"      AS "reason_slug",
    "b"."book_id"   AS "book_id",
    COUNT(*)::int   AS "ban_count",
    ROW_NUMBER() OVER (PARTITION BY "r"."slug" ORDER BY COUNT(*) DESC, "b"."book_id") AS "rn"
  FROM "public"."bans" "b"
    JOIN "public"."ban_reason_links" "brl" ON "brl"."ban_id"    = "b"."id"
    JOIN "public"."reasons"          "r"   ON "r"."id"          = "brl"."reason_id"
  GROUP BY "r"."slug", "b"."book_id"
)
SELECT "reason_slug", "book_id", "ban_count", "rn"::int AS "rank"
  FROM "ranked"
 WHERE "rn" <= 50
WITH NO DATA;

-- Required for REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX "idx_mv_reason_top_books_pk"
    ON "public"."mv_reason_top_books" USING "btree" ("reason_slug", "rank");

-- The most common query is "give me the top-N for a single slug" — this
-- index covers it cheaply.
CREATE INDEX "idx_mv_reason_top_books_slug_rank"
    ON "public"."mv_reason_top_books" USING "btree" ("reason_slug", "rank");

-- Initial load (subsequent refreshes go through the cron).
REFRESH MATERIALIZED VIEW "public"."mv_reason_top_books";

-- Grants follow the same lockdown convention as mv_book_scope_counts /
-- mv_ban_counts after 20260520180000_lockdown_anon_admin_surface: only
-- service_role reads the MV directly. Site code uses adminClient() which
-- bypasses RLS/grants. Anon never sees it.
GRANT ALL ON TABLE "public"."mv_reason_top_books" TO "service_role";

COMMENT ON MATERIALIZED VIEW "public"."mv_reason_top_books" IS
    'Top-50 book_ids per reason_slug ranked by total ban_reason_links count. Powers the homepage "Why books get banned" section without paginating 45k ban_reason_links rows on every revalidation. Refreshed hourly by refresh_all_materialized_views().';


-- Add the new MV to the hourly refresh routine.
CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_books_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_authors_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_book_scope_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_reason_top_books;

  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('last_refreshed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
END;
$$;
