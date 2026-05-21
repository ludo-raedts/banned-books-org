-- Re-rank the "most banned" leaderboards by geographic spread instead of raw
-- ban-record count. PEN America's per-district granularity meant a US-only
-- book banned in 200 school districts (1 country, 200 rows) outranked a
-- classic banned in 6 countries (6 rows). The new ordering puts breadth
-- first, with raw count as tiebreaker. Same fix applied to v_top_banned_authors
-- (prefer authors with many distinct banned books over one book × many
-- districts).

-- v_top_banned_books: add distinct_countries and re-order on it.
CREATE OR REPLACE VIEW "public"."v_top_banned_books" AS
 SELECT "book_id" AS "entity_id",
    "count"("id") AS "total_bans",
    "count"(DISTINCT "country_code") AS "distinct_countries"
   FROM "public"."bans" "bn"
  GROUP BY "book_id"
  ORDER BY ("count"(DISTINCT "country_code")) DESC, ("count"("id")) DESC
 LIMIT 100;

-- v_top_banned_authors: same intent — rank by banned_books (distinct books an
-- author has had banned anywhere) with total_bans as tiebreaker.
CREATE OR REPLACE VIEW "public"."v_top_banned_authors" AS
 SELECT "ba"."author_id" AS "entity_id",
    "count"("bn"."id") AS "total_bans",
    "count"(DISTINCT "b"."id") AS "banned_books"
   FROM (("public"."book_authors" "ba"
     JOIN "public"."books" "b" ON (("b"."id" = "ba"."book_id")))
     JOIN "public"."bans" "bn" ON (("bn"."book_id" = "b"."id")))
  GROUP BY "ba"."author_id"
  ORDER BY ("count"(DISTINCT "b"."id")) DESC, ("count"("bn"."id")) DESC
 LIMIT 100;
