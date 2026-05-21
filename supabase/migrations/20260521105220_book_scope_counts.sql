-- Per-(book, scope) ban-row breakdown — splits raw COUNT(*) into the three
-- distinct dimensions that get mixed in the bans table:
--
--   district_events  : COUNT(*) WHERE institution IS NOT NULL
--                      → PEN America 2024-25 per-district granular data
--   state_events     : COUNT(*) WHERE region IS NOT NULL AND institution IS NULL
--                      → state/region-level events without district info
--   aggregate_events : COUNT(*) WHERE region IS NULL AND institution IS NULL
--                      → Wikipedia / ALA / legacy seed rows; 1 row = "the book
--                        was historically banned somewhere", no granularity
--   total_events     : COUNT(*) — kept for back-compat with copy that says
--                      "X documented events" but rankings should NOT use it
--                      because district granularity inflates relative to
--                      aggregate sources (~3.9k rows on school scope).
--
-- Existing v_top_banned_books / mv_ban_counts have the same inflation issue
-- (see comments on mv_ban_counts.total_bans) — this MV lets consumers rank
-- on (district_events + state_events) which is the granular-only count
-- without losing the 232 books whose only school-ban row is an aggregate
-- (Catcher in the Rye, Maus, Gatsby, etc. — deleting those rows would erase
-- them from /scope/school entirely, which is why we keep them and rank
-- around them instead).
--
-- Refreshed via refresh_all_materialized_views() (updated below to include
-- this MV). REFRESH CONCURRENTLY requires the unique index.

CREATE INDEX IF NOT EXISTS "idx_bans_scope_id"
    ON "public"."bans" USING "btree" ("scope_id");

CREATE MATERIALIZED VIEW IF NOT EXISTS "public"."mv_book_scope_counts" AS
 SELECT "book_id",
        "scope_id",
        COUNT(*) FILTER (WHERE "institution" IS NOT NULL)                              AS "district_events",
        COUNT(*) FILTER (WHERE "region" IS NOT NULL AND "institution" IS NULL)         AS "state_events",
        COUNT(*) FILTER (WHERE "region" IS NULL    AND "institution" IS NULL)          AS "aggregate_events",
        COUNT(*)                                                                       AS "total_events"
   FROM "public"."bans"
  WHERE "scope_id" IS NOT NULL
  GROUP BY "book_id", "scope_id"
  WITH DATA;

CREATE UNIQUE INDEX "idx_mv_book_scope_counts_pk"
    ON "public"."mv_book_scope_counts" USING "btree" ("book_id", "scope_id");

-- Secondary index for the common scope-page query: top-N for a given scope.
CREATE INDEX "idx_mv_book_scope_counts_scope_rank"
    ON "public"."mv_book_scope_counts" USING "btree"
       ("scope_id", "district_events" DESC, "state_events" DESC, "aggregate_events" DESC);

-- Grants align with the lockdown in 20260520180000: only service_role can
-- read this MV directly. The site reads it via adminClient() (service_role),
-- which bypasses RLS/grants. Anon never sees the MV — consistent with the
-- treatment of mv_ban_counts / mv_country_reason_counts after the lockdown.
GRANT ALL ON TABLE "public"."mv_book_scope_counts" TO "service_role";

COMMENT ON COLUMN "public"."mv_book_scope_counts"."district_events" IS
    'Number of bans with institution set (PEN America-style per-district granularity). Canonical metric for ranking books within school scope.';
COMMENT ON COLUMN "public"."mv_book_scope_counts"."state_events" IS
    'Bans with region set but institution null (state/region-level events without district info). Used as tiebreaker after district_events.';
COMMENT ON COLUMN "public"."mv_book_scope_counts"."aggregate_events" IS
    'Bans with both region and institution null (Wikipedia / ALA / legacy seed). 1 row = "documented somewhere", no granularity. Used as final tiebreaker so classics like Catcher in the Rye, Maus, Gatsby still surface.';
COMMENT ON COLUMN "public"."mv_book_scope_counts"."total_events" IS
    'Sum of district + state + aggregate events. Provided for back-compat copy ("X documented events") but DO NOT rank on this column — district granularity inflates per-book counts relative to aggregate sources.';


-- Add the new MV to the refresh routine. Keep CREATE OR REPLACE so the
-- function body is the only diff — other callers stay valid.
CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_books_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_authors_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_book_scope_counts;

  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('last_refreshed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
END;
$$;
