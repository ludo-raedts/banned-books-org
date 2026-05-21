-- Add a "distinct books banned" metric next to "total ban records" in the
-- per-country materialized views. PEN America records bans at school-district
-- granularity, so total_bans inflates the United States: 1 book × 50 districts
-- = 50 rows. distinct_books treats that as 1 banned title and is the fairer
-- ranking metric for country/leaderboard surfaces. total_bans stays as a
-- supporting "documented ban events" number.
--
-- Postgres can't ALTER a materialized view to add a column, so we drop and
-- recreate. The view names, column types of existing columns, and unique
-- indexes are preserved so refresh_all_materialized_views() and existing
-- callers keep working. Grants must be re-issued after DROP.

DROP MATERIALIZED VIEW IF EXISTS "public"."mv_ban_counts";

CREATE MATERIALIZED VIEW "public"."mv_ban_counts" AS
 SELECT "country_code",
    "count"(*) AS "total_bans",
    "count"(*) FILTER (WHERE ("status" = 'active'::"text")) AS "active_bans",
    "count"(DISTINCT "book_id") AS "distinct_books",
    "count"(DISTINCT "book_id") FILTER (WHERE ("status" = 'active'::"text")) AS "distinct_active_books"
   FROM "public"."bans"
  GROUP BY "country_code"
  WITH DATA;

CREATE UNIQUE INDEX "idx_mv_ban_counts_cc"
    ON "public"."mv_ban_counts" USING "btree" ("country_code");

GRANT ALL ON TABLE "public"."mv_ban_counts" TO "anon";
GRANT ALL ON TABLE "public"."mv_ban_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_ban_counts" TO "service_role";


DROP MATERIALIZED VIEW IF EXISTS "public"."mv_country_reason_counts";

CREATE MATERIALIZED VIEW "public"."mv_country_reason_counts" AS
 SELECT "b"."country_code",
    "r"."slug" AS "reason_slug",
    "count"(*) AS "total_bans",
    "count"(*) FILTER (WHERE ("b"."status" = 'active'::"text")) AS "active_bans",
    "count"(DISTINCT "b"."book_id") AS "distinct_books",
    "count"(DISTINCT "b"."book_id") FILTER (WHERE ("b"."status" = 'active'::"text")) AS "distinct_active_books"
   FROM (("public"."bans" "b"
     JOIN "public"."ban_reason_links" "brl" ON (("brl"."ban_id" = "b"."id")))
     JOIN "public"."reasons" "r" ON (("r"."id" = "brl"."reason_id")))
  GROUP BY "b"."country_code", "r"."slug"
  WITH DATA;

CREATE UNIQUE INDEX "idx_mv_country_reason_counts_pk"
    ON "public"."mv_country_reason_counts" USING "btree" ("country_code", "reason_slug");

GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "anon";
GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "service_role";

COMMENT ON COLUMN "public"."mv_ban_counts"."total_bans" IS
    'Number of ban records. Inflated for the US because PEN America records bans at school-district granularity. Use for "documented ban events" copy, not for country rankings.';
COMMENT ON COLUMN "public"."mv_ban_counts"."distinct_books" IS
    'Number of distinct books with at least one ban in this country. Canonical metric for country rankings and leaderboards — not distorted by per-district reporting.';
