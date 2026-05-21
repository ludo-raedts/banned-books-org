-- v_top_banned_books / v_top_banned_authors: expose the same district-vs-aggregate
-- split that mv_book_scope_counts has, so leaderboard consumers (homepage rails,
-- most-banned-authors, highlights strip) can label badges with granular event
-- counts instead of inflated total_bans.
--
-- granular_events = ban rows with region OR institution set
--   → PEN America 2024-25 per-district + region-level events
-- aggregate_events = ban rows where both region AND institution are NULL
--   → Wikipedia / ALA / legacy seed: "documented somewhere", no granularity
-- total_bans = granular_events + aggregate_events  (unchanged; kept for back-compat)
--
-- Ranking key is unchanged — still distinct_countries DESC (books) /
-- banned_books DESC (authors) primary, with total_bans as tiebreaker. We only
-- add columns at the tail. So existing callers reading just
-- `entity_id, total_bans, banned_books` (or `distinct_countries`) keep working.
--
-- Note: CREATE OR REPLACE VIEW only allows APPENDING columns at the end;
-- it can't reorder or rename existing ones (42P16). The new columns come
-- last on purpose — do NOT insert them between the existing ones or this
-- migration will fail to apply.
--
-- security_invoker=true is preserved on both views (set in 20260520170000).

CREATE OR REPLACE VIEW "public"."v_top_banned_books" AS
 SELECT "book_id" AS "entity_id",
    "count"("id") AS "total_bans",
    "count"(DISTINCT "country_code") AS "distinct_countries",
    "count"("id") FILTER (WHERE "region" IS NOT NULL OR "institution" IS NOT NULL) AS "granular_events",
    "count"("id") FILTER (WHERE "region" IS NULL AND "institution" IS NULL)         AS "aggregate_events"
   FROM "public"."bans" "bn"
  GROUP BY "book_id"
  ORDER BY ("count"(DISTINCT "country_code")) DESC, ("count"("id")) DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_banned_authors" AS
 SELECT "ba"."author_id" AS "entity_id",
    "count"("bn"."id") AS "total_bans",
    "count"(DISTINCT "b"."id") AS "banned_books",
    "count"("bn"."id") FILTER (WHERE "bn"."region" IS NOT NULL OR "bn"."institution" IS NOT NULL) AS "granular_events",
    "count"("bn"."id") FILTER (WHERE "bn"."region" IS NULL AND "bn"."institution" IS NULL)         AS "aggregate_events"
   FROM (("public"."book_authors" "ba"
     JOIN "public"."books" "b" ON (("b"."id" = "ba"."book_id")))
     JOIN "public"."bans" "bn" ON (("bn"."book_id" = "b"."id")))
  GROUP BY "ba"."author_id"
  ORDER BY ("count"(DISTINCT "b"."id")) DESC, ("count"("bn"."id")) DESC
 LIMIT 100;

COMMENT ON COLUMN "public"."v_top_banned_books"."granular_events" IS
    'Ban rows with region or institution set (PEN per-district + region-level). Use this for "X events" badges instead of total_bans, which mixes in Wikipedia/ALA aggregate rows that represent "banned somewhere historically" rather than discrete events.';
COMMENT ON COLUMN "public"."v_top_banned_books"."aggregate_events" IS
    'Ban rows where both region and institution are NULL. Each row = one historical attestation from a source without location granularity (Wikipedia, ALA, legacy PEN seed). Not summable with granular_events as discrete events.';
COMMENT ON COLUMN "public"."v_top_banned_authors"."granular_events" IS
    'See v_top_banned_books.granular_events. Sum across all books linked to this author.';
COMMENT ON COLUMN "public"."v_top_banned_authors"."aggregate_events" IS
    'See v_top_banned_books.aggregate_events. Sum across all books linked to this author.';
