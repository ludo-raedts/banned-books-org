-- v_top_books_all_time / _this_week / _last_week aggregate pageviews by entity_id
-- without checking that the entity still exists in books. When a book is deleted
-- or merged away, its pageviews remain (for analytics) and the view keeps
-- returning the orphaned entity_id. Downstream the API hydrates by .in('id', …)
-- and the orphan silently disappears, so a page of 48 IDs hydrates to 47 rows.
--
-- Fix: INNER JOIN books in the subquery so orphans are filtered out at the
-- view boundary. Pageviews data is preserved (analytics keep the row history).
--
-- v_top_banned_books does not need this — bans.book_id has ON DELETE CASCADE.
--
-- security_invoker=true is preserved by CREATE OR REPLACE VIEW (it only resets
-- reloptions on DROP+CREATE). Same pattern as 20260521111210_top_banned_views_granular_split.sql.

CREATE OR REPLACE VIEW "public"."v_top_books_all_time" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM ("public"."pageviews" "pv"
             JOIN "public"."books" "b" ON (("b"."id" = "pv"."entity_id")))
          WHERE ("pv"."entity_type" = 'book'::"text")
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_books_this_week" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM ("public"."pageviews" "pv"
             JOIN "public"."books" "b" ON (("b"."id" = "pv"."entity_id")))
          WHERE (("pv"."entity_type" = 'book'::"text") AND ("pv"."viewed_at" >= ("now"() - '7 days'::interval)))
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_books_last_week" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM ("public"."pageviews" "pv"
             JOIN "public"."books" "b" ON (("b"."id" = "pv"."entity_id")))
          WHERE (("pv"."entity_type" = 'book'::"text") AND ("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;
