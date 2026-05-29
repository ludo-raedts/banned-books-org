-- Add era-split distinct-book metrics to the per-country materialized views,
-- powering an optional "Contemporary (2000–now)" vs "Historical (pre-2000)"
-- filter on /countries. Rationale: the catalogue mixes wildly different
-- censorship regimes — a 2020s PEN America school challenge in the US vs.
-- 1940s wartime bans in France/Germany vs. 1979 Iran. The year-2000 cut
-- cleanly separates the contemporary US-led wave (the 2020s explosion that
-- dominates raw counts) from 20th-century state censorship, letting visitors
-- re-rank countries within a coherent era instead of across all of history.
--
-- We split on year_started (99.8% filled; year_ended is 97.6% NULL so it can't
-- mark "still in effect"). status is NOT used here: 90% of rows are 'active'
-- including old bans nobody marked rescinded, so it can't discriminate eras.
-- The 54 rows with NULL year_started fall into neither bucket — they surface
-- only in the unfiltered total, which is the honest treatment.
--
-- Distinct counts intentionally don't sum to distinct_books: a title banned in
-- both 1953 and 2021 counts in both eras. Callers must not present the two as a
-- partition of the total.
--
-- Postgres can't ALTER a materialized view to add columns, so we drop and
-- recreate. View names, existing column types, and unique indexes are preserved
-- so refresh_all_materialized_views() and existing callers keep working. Grants
-- are re-issued service_role-only to preserve the anon/authenticated lockdown
-- from 20260520180000 (the site reads exclusively via adminClient()).

DROP MATERIALIZED VIEW IF EXISTS "public"."mv_ban_counts";

CREATE MATERIALIZED VIEW "public"."mv_ban_counts" AS
 SELECT "country_code",
    "count"(*) AS "total_bans",
    "count"(*) FILTER (WHERE ("status" = 'active'::"text")) AS "active_bans",
    "count"(DISTINCT "book_id") AS "distinct_books",
    "count"(DISTINCT "book_id") FILTER (WHERE ("status" = 'active'::"text")) AS "distinct_active_books",
    "count"(DISTINCT "book_id") FILTER (WHERE ("year_started" < 2000)) AS "distinct_books_historical",
    "count"(DISTINCT "book_id") FILTER (WHERE ("year_started" >= 2000)) AS "distinct_books_contemporary"
   FROM "public"."bans"
  GROUP BY "country_code"
  WITH DATA;

CREATE UNIQUE INDEX "idx_mv_ban_counts_cc"
    ON "public"."mv_ban_counts" USING "btree" ("country_code");

GRANT ALL ON TABLE "public"."mv_ban_counts" TO "service_role";


DROP MATERIALIZED VIEW IF EXISTS "public"."mv_country_reason_counts";

CREATE MATERIALIZED VIEW "public"."mv_country_reason_counts" AS
 SELECT "b"."country_code",
    "r"."slug" AS "reason_slug",
    "count"(*) AS "total_bans",
    "count"(*) FILTER (WHERE ("b"."status" = 'active'::"text")) AS "active_bans",
    "count"(DISTINCT "b"."book_id") AS "distinct_books",
    "count"(DISTINCT "b"."book_id") FILTER (WHERE ("b"."status" = 'active'::"text")) AS "distinct_active_books",
    "count"(DISTINCT "b"."book_id") FILTER (WHERE ("b"."year_started" < 2000)) AS "distinct_books_historical",
    "count"(DISTINCT "b"."book_id") FILTER (WHERE ("b"."year_started" >= 2000)) AS "distinct_books_contemporary"
   FROM (("public"."bans" "b"
     JOIN "public"."ban_reason_links" "brl" ON (("brl"."ban_id" = "b"."id")))
     JOIN "public"."reasons" "r" ON (("r"."id" = "brl"."reason_id")))
  GROUP BY "b"."country_code", "r"."slug"
  WITH DATA;

CREATE UNIQUE INDEX "idx_mv_country_reason_counts_pk"
    ON "public"."mv_country_reason_counts" USING "btree" ("country_code", "reason_slug");

GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "service_role";

COMMENT ON COLUMN "public"."mv_ban_counts"."total_bans" IS
    'Number of ban records. Inflated for the US because PEN America records bans at school-district granularity. Use for "documented ban events" copy, not for country rankings.';
COMMENT ON COLUMN "public"."mv_ban_counts"."distinct_books" IS
    'Number of distinct books with at least one ban in this country. Canonical metric for country rankings and leaderboards — not distorted by per-district reporting.';
COMMENT ON COLUMN "public"."mv_ban_counts"."distinct_books_historical" IS
    'Distinct books with at least one ban started before 2000 (NULL year_started excluded). Powers the Historical era filter on /countries. Overlaps distinct_books_contemporary for titles banned in both eras.';
COMMENT ON COLUMN "public"."mv_ban_counts"."distinct_books_contemporary" IS
    'Distinct books with at least one ban started in 2000 or later (NULL year_started excluded). Powers the Contemporary era filter on /countries.';
