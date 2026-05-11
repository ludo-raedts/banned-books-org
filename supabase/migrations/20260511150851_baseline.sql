-- ─────────────────────────────────────────────────────────────────────────────
-- Baseline of the public schema as it lives in production on
-- supabase project eapmnfvgfeyclywyiiza (banned-books).
--
-- Generated from `supabase db dump --schema public` on the linked
-- production database, then stripped of:
--   • Session-config noise (most SET statements, search_path config)
--     EXCEPT check_function_bodies=false, which is load-bearing:
--     pg_dump orders functions before tables they reference, and
--     admin_db_stats() casts 'public.pageviews'::regclass at create time.
--   • ALTER ... OWNER TO ... (52 statements; Supabase manages ownership)
--   • COMMENT ON SCHEMA "public" (pg_dump boilerplate)
--   • ALTER DEFAULT PRIVILEGES (Supabase-managed defaults)
--
-- Extensions are not emitted by --schema public. Restored here to match
-- production exactly:
--   pg_trgm 1.6 in public (used by 2 trigram indexes)
--   vector  0.8.0 in public (used by news_items.embedding vector(1536))
-- pgcrypto / pg_stat_statements / uuid-ossp / supabase_vault are
-- Supabase-managed defaults and not reproduced here.
-- ─────────────────────────────────────────────────────────────────────────────

SET check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "vector"  WITH SCHEMA "public";


CREATE SCHEMA IF NOT EXISTS "public";

CREATE OR REPLACE FUNCTION "public"."admin_db_stats"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT jsonb_build_object(
    'db_size_bytes',        pg_database_size(current_database()),
    'pageviews_size_bytes', COALESCE(pg_total_relation_size('public.pageviews'), 0),
    'pageviews_rows',       (SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.pageviews'::regclass)
  );
$$;

CREATE OR REPLACE FUNCTION "public"."fn_touch_data_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('data_last_changed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."refresh_all_materialized_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ban_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_books_rising;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_authors_rising;

  INSERT INTO mv_refresh_log (key, updated_at)
  VALUES ('last_refreshed', now())
  ON CONFLICT (key) DO UPDATE SET updated_at = now();
END;
$$;

CREATE TABLE IF NOT EXISTS "public"."affiliate_partners" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "url_template" "text",
    "commission_pct" numeric(4,2),
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."affiliate_partners" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."affiliate_partners_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."authors" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "birth_year" smallint,
    "death_year" smallint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "bio" "text",
    "birth_country" "text",
    "photo_url" "text"
);

ALTER TABLE "public"."authors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."authors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."ban_reason_links" (
    "ban_id" bigint NOT NULL,
    "reason_id" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."ban_source_links" (
    "ban_id" bigint NOT NULL,
    "source_id" bigint NOT NULL,
    "locator" "text"
);

CREATE TABLE IF NOT EXISTS "public"."ban_sources" (
    "id" bigint NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_type" "text",
    "accessed_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."ban_sources" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ban_sources_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."bans" (
    "id" bigint NOT NULL,
    "book_id" bigint NOT NULL,
    "country_code" character(2) NOT NULL,
    "scope_id" bigint NOT NULL,
    "action_type" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "region" "text",
    "institution" "text",
    "year_started" smallint,
    "year_ended" smallint,
    "actor" "text",
    "description" "text",
    "confidence" "text" DEFAULT 'reported'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bans_action_type_check" CHECK (("action_type" = ANY (ARRAY['banned'::"text", 'challenged'::"text", 'removed'::"text", 'restricted'::"text", 'blocked'::"text"]))),
    CONSTRAINT "bans_confidence_check" CHECK (("confidence" = ANY (ARRAY['verified'::"text", 'reported'::"text", 'unverified'::"text"]))),
    CONSTRAINT "bans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'rescinded'::"text", 'historical'::"text", 'unclear'::"text"])))
);

ALTER TABLE "public"."bans" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."bans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."bbw_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "promo_start" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    CONSTRAINT "bbw_config_id_check" CHECK (("id" = 1))
);

CREATE TABLE IF NOT EXISTS "public"."bbw_featured_selections" (
    "year" integer NOT NULL,
    "book_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "custom_blurb" "text",
    "pinned" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."book_authors" (
    "book_id" bigint NOT NULL,
    "author_id" bigint NOT NULL,
    "role" "text" DEFAULT 'author'::"text"
);

CREATE TABLE IF NOT EXISTS "public"."books" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "original_language" character(2),
    "first_published_year" smallint,
    "description" "text",
    "isbn13" "text",
    "openlibrary_work_id" "text",
    "cover_url" "text",
    "ai_drafted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "genres" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "gutenberg_id" integer,
    "description_book" "text",
    "description_ban" "text",
    "censorship_context" "text",
    "cover_status" "text",
    "cover_checked_at" timestamp with time zone,
    "warning_level" "text" DEFAULT 'none'::"text" NOT NULL,
    "inclusion_rationale" "text",
    "extended_context" "text",
    "bookshop_status" "text",
    "bookshop_checked_at" timestamp with time zone,
    "bookshop_isbn13" "text",
    CONSTRAINT "books_bookshop_status_check" CHECK (("bookshop_status" = ANY (ARRAY['valid'::"text", 'not_found'::"text"]))),
    CONSTRAINT "books_cover_status_check" CHECK (("cover_status" = ANY (ARRAY['valid'::"text", 'rejected_placeholder'::"text", 'manual_override'::"text"]))),
    CONSTRAINT "books_warning_level_check" CHECK (("warning_level" = ANY (ARRAY['none'::"text", 'context'::"text", 'extended'::"text"])))
);

ALTER TABLE "public"."books" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."books_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."content_blocks" (
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "placeholder_brief" "text" NOT NULL,
    "body_markdown" "text",
    "body_html" "text",
    "status" "text" DEFAULT 'placeholder'::"text" NOT NULL,
    "notes" "text",
    "last_edited_by" "text",
    "last_edited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_blocks_status_check" CHECK (("status" = ANY (ARRAY['placeholder'::"text", 'draft'::"text", 'published'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."countries" (
    "code" character(2) NOT NULL,
    "name_en" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text"
);

CREATE TABLE IF NOT EXISTS "public"."cover_search_attempts" (
    "book_id" bigint NOT NULL,
    "last_searched_at" timestamp with time zone DEFAULT "now"(),
    "attempts" integer DEFAULT 1,
    "sources_tried" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."dataset_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_session_id" "text" NOT NULL,
    "email" "text",
    "amount_cents" integer,
    "currency" "text",
    "paid_at" timestamp with time zone,
    "download_token" "text",
    "download_token_expires_at" timestamp with time zone,
    "downloads_count" integer DEFAULT 0 NOT NULL,
    "last_downloaded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."description_search_attempts" (
    "book_id" bigint NOT NULL,
    "last_searched_at" timestamp with time zone DEFAULT "now"(),
    "attempts" integer DEFAULT 1,
    "sources_tried" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."editorial_publish_log" (
    "id" bigint NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin_user" "text",
    "content_type" "text" NOT NULL,
    "content_key" "text" NOT NULL,
    "action" "text" NOT NULL,
    "notes" "text"
);

CREATE SEQUENCE IF NOT EXISTS "public"."editorial_publish_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."editorial_publish_log_id_seq" OWNED BY "public"."editorial_publish_log"."id";

CREATE TABLE IF NOT EXISTS "public"."inbox_preview" (
    "id" bigint NOT NULL,
    "uid" bigint NOT NULL,
    "from_name" "text",
    "from_address" "text",
    "subject" "text",
    "snippet" "text",
    "received_at" timestamp with time zone,
    "is_unread" boolean DEFAULT false NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS "public"."inbox_preview_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."inbox_preview_id_seq" OWNED BY "public"."inbox_preview"."id";

CREATE MATERIALIZED VIEW "public"."mv_ban_counts" AS
 SELECT "country_code",
    "count"(*) AS "total_bans",
    "count"(*) FILTER (WHERE ("status" = 'active'::"text")) AS "active_bans"
   FROM "public"."bans"
  GROUP BY "country_code"
  WITH NO DATA;

CREATE TABLE IF NOT EXISTS "public"."reasons" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "description" "text"
);

CREATE MATERIALIZED VIEW "public"."mv_country_reason_counts" AS
 SELECT "b"."country_code",
    "r"."slug" AS "reason_slug",
    "count"(*) AS "total_bans",
    "count"(*) FILTER (WHERE ("b"."status" = 'active'::"text")) AS "active_bans"
   FROM (("public"."bans" "b"
     JOIN "public"."ban_reason_links" "brl" ON (("brl"."ban_id" = "b"."id")))
     JOIN "public"."reasons" "r" ON (("r"."id" = "brl"."reason_id")))
  GROUP BY "b"."country_code", "r"."slug"
  WITH NO DATA;

CREATE TABLE IF NOT EXISTS "public"."mv_refresh_log" (
    "key" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."pageviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "path" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" bigint NOT NULL,
    "country" "text",
    "referrer_host" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "visitor_hash" "text",
    CONSTRAINT "pageviews_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['book'::"text", 'author'::"text"])))
);

CREATE MATERIALIZED VIEW "public"."mv_top_authors_rising" AS
 WITH "this_week" AS (
         SELECT "pageviews"."entity_id",
            ("count"(DISTINCT "pageviews"."visitor_hash"))::integer AS "visitors"
           FROM "public"."pageviews"
          WHERE (("pageviews"."entity_type" = 'author'::"text") AND ("pageviews"."visitor_hash" IS NOT NULL) AND ("pageviews"."viewed_at" >= ("now"() - '7 days'::interval)))
          GROUP BY "pageviews"."entity_id"
        ), "prev_week" AS (
         SELECT "pageviews"."entity_id",
            ("count"(DISTINCT "pageviews"."visitor_hash"))::integer AS "visitors"
           FROM "public"."pageviews"
          WHERE (("pageviews"."entity_type" = 'author'::"text") AND ("pageviews"."visitor_hash" IS NOT NULL) AND ("pageviews"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pageviews"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "pageviews"."entity_id"
        )
 SELECT "tw"."entity_id",
    "tw"."visitors" AS "this_week",
    COALESCE("pw"."visitors", 0) AS "prev_week",
    ((("tw"."visitors" - COALESCE("pw"."visitors", 0)))::double precision / (GREATEST(COALESCE("pw"."visitors", 0), 1))::double precision) AS "growth"
   FROM ("this_week" "tw"
     LEFT JOIN "prev_week" "pw" USING ("entity_id"))
  WHERE (("tw"."visitors" >= 2) AND ("tw"."visitors" > COALESCE("pw"."visitors", 0)))
  ORDER BY ((("tw"."visitors" - COALESCE("pw"."visitors", 0)))::double precision / (GREATEST(COALESCE("pw"."visitors", 0), 1))::double precision) DESC
 LIMIT 50
  WITH NO DATA;

CREATE MATERIALIZED VIEW "public"."mv_top_books_rising" AS
 WITH "this_week" AS (
         SELECT "pageviews"."entity_id",
            ("count"(DISTINCT "pageviews"."visitor_hash"))::integer AS "visitors"
           FROM "public"."pageviews"
          WHERE (("pageviews"."entity_type" = 'book'::"text") AND ("pageviews"."visitor_hash" IS NOT NULL) AND ("pageviews"."viewed_at" >= ("now"() - '7 days'::interval)))
          GROUP BY "pageviews"."entity_id"
        ), "prev_week" AS (
         SELECT "pageviews"."entity_id",
            ("count"(DISTINCT "pageviews"."visitor_hash"))::integer AS "visitors"
           FROM "public"."pageviews"
          WHERE (("pageviews"."entity_type" = 'book'::"text") AND ("pageviews"."visitor_hash" IS NOT NULL) AND ("pageviews"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pageviews"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "pageviews"."entity_id"
        )
 SELECT "tw"."entity_id",
    "tw"."visitors" AS "this_week",
    COALESCE("pw"."visitors", 0) AS "prev_week",
    ((("tw"."visitors" - COALESCE("pw"."visitors", 0)))::double precision / (GREATEST(COALESCE("pw"."visitors", 0), 1))::double precision) AS "growth"
   FROM ("this_week" "tw"
     LEFT JOIN "prev_week" "pw" USING ("entity_id"))
  WHERE (("tw"."visitors" >= 2) AND ("tw"."visitors" > COALESCE("pw"."visitors", 0)))
  ORDER BY ((("tw"."visitors" - COALESCE("pw"."visitors", 0)))::double precision / (GREATEST(COALESCE("pw"."visitors", 0), 1))::double precision) DESC
 LIMIT 50
  WITH NO DATA;

CREATE TABLE IF NOT EXISTS "public"."news_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "auto_publish" boolean DEFAULT false NOT NULL,
    "dedup_threshold" double precision DEFAULT 0.85 NOT NULL,
    "dedup_window_days" integer DEFAULT 14 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    CONSTRAINT "news_config_id_check" CHECK (("id" = 1))
);

CREATE TABLE IF NOT EXISTS "public"."news_items" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "published_at" timestamp with time zone,
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "summary" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "published_week" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "public"."vector"(1536),
    "auto_published" boolean DEFAULT false NOT NULL,
    "source_language" character(2) DEFAULT 'en'::"bpchar" NOT NULL,
    "original_title" "text",
    "original_summary" "text",
    CONSTRAINT "news_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'rejected'::"text"])))
);

ALTER TABLE "public"."news_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."news_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."purchase_links" (
    "id" bigint NOT NULL,
    "book_id" bigint NOT NULL,
    "partner_id" bigint,
    "country_code" character(2),
    "format_type" "text" DEFAULT 'print'::"text",
    "url" "text" NOT NULL,
    "is_affiliate" boolean DEFAULT false,
    "priority" smallint DEFAULT 10,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."purchase_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."purchase_links_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."reading_club_classics" (
    "book_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "custom_blurb" "text",
    "discussion_questions" "jsonb",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."reading_club_currently_challenged" (
    "year" integer NOT NULL,
    "position" integer NOT NULL,
    "title" "text" NOT NULL,
    "author" "text" NOT NULL,
    "challenge_count" integer,
    "book_id" bigint,
    "bookshop_url" "text",
    "discussion_questions" "jsonb",
    "source_url" "text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."reading_club_international" (
    "book_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "custom_blurb" "text",
    "discussion_questions" "jsonb",
    "pinned" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."reading_club_theme_books" (
    "theme_slug" "text" NOT NULL,
    "book_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "custom_blurb" "text",
    "discussion_questions" "jsonb",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."reading_club_themes" (
    "slug" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."reasons" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reasons_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."scopes" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "label_en" "text" NOT NULL
);

ALTER TABLE "public"."scopes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."scopes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE OR REPLACE VIEW "public"."v_top_authors_all_time" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE ("pv"."entity_type" = 'author'::"text")
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_authors_last_week" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."entity_type" = 'author'::"text") AND ("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_authors_this_week" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."entity_type" = 'author'::"text") AND ("pv"."viewed_at" >= ("now"() - '7 days'::interval)))
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_banned_authors" AS
 SELECT "ba"."author_id" AS "entity_id",
    "count"("bn"."id") AS "total_bans",
    "count"(DISTINCT "b"."id") AS "banned_books"
   FROM (("public"."book_authors" "ba"
     JOIN "public"."books" "b" ON (("b"."id" = "ba"."book_id")))
     JOIN "public"."bans" "bn" ON (("bn"."book_id" = "b"."id")))
  GROUP BY "ba"."author_id"
  ORDER BY ("count"("bn"."id")) DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_banned_books" AS
 SELECT "book_id" AS "entity_id",
    "count"("id") AS "total_bans"
   FROM "public"."bans" "bn"
  GROUP BY "book_id"
  ORDER BY ("count"("id")) DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_books_all_time" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE ("pv"."entity_type" = 'book'::"text")
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_books_last_week" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."entity_type" = 'book'::"text") AND ("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_books_this_week" AS
 SELECT "entity_id",
    "views"
   FROM ( SELECT "pv"."entity_id",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."entity_type" = 'book'::"text") AND ("pv"."viewed_at" >= ("now"() - '7 days'::interval)))
          GROUP BY "pv"."entity_id") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 100;

CREATE OR REPLACE VIEW "public"."v_top_countries_last_week" AS
 SELECT "country",
    "views"
   FROM ( SELECT "pv"."country",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "pv"."country") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC NULLS LAST
 LIMIT 50;

CREATE OR REPLACE VIEW "public"."v_top_countries_this_week" AS
 SELECT "country",
    "views"
   FROM ( SELECT "pv"."country",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE ("pv"."viewed_at" >= ("now"() - '7 days'::interval))
          GROUP BY "pv"."country") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC NULLS LAST
 LIMIT 50;

CREATE OR REPLACE VIEW "public"."v_top_referrers_last_week" AS
 SELECT "referrer_host",
    "views"
   FROM ( SELECT "pv"."referrer_host",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)) AND ("pv"."referrer_host" IS NOT NULL))
          GROUP BY "pv"."referrer_host") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 50;

CREATE OR REPLACE VIEW "public"."v_top_referrers_this_week" AS
 SELECT "referrer_host",
    "views"
   FROM ( SELECT "pv"."referrer_host",
            "count"(DISTINCT "pv"."visitor_hash") AS "views"
           FROM "public"."pageviews" "pv"
          WHERE (("pv"."viewed_at" >= ("now"() - '7 days'::interval)) AND ("pv"."referrer_host" IS NOT NULL))
          GROUP BY "pv"."referrer_host") "t"
  WHERE ("views" > 0)
  ORDER BY "views" DESC
 LIMIT 50;

CREATE OR REPLACE VIEW "public"."v_weekly_totals" AS
 SELECT "views_this_week",
    "views_last_week",
    "pageviews_this_week",
    "pageviews_last_week"
   FROM ( SELECT "count"(DISTINCT "pv"."visitor_hash") FILTER (WHERE ("pv"."viewed_at" >= ("now"() - '7 days'::interval))) AS "views_this_week",
            "count"(DISTINCT "pv"."visitor_hash") FILTER (WHERE (("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)))) AS "views_last_week",
            "count"(*) FILTER (WHERE ("pv"."viewed_at" >= ("now"() - '7 days'::interval))) AS "pageviews_this_week",
            "count"(*) FILTER (WHERE (("pv"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("pv"."viewed_at" < ("now"() - '7 days'::interval)))) AS "pageviews_last_week"
           FROM "public"."pageviews" "pv") "totals";

ALTER TABLE ONLY "public"."editorial_publish_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."editorial_publish_log_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."inbox_preview" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."inbox_preview_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."affiliate_partners"
    ADD CONSTRAINT "affiliate_partners_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."affiliate_partners"
    ADD CONSTRAINT "affiliate_partners_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."ban_reason_links"
    ADD CONSTRAINT "ban_reason_links_pkey" PRIMARY KEY ("ban_id", "reason_id");

ALTER TABLE ONLY "public"."ban_source_links"
    ADD CONSTRAINT "ban_source_links_pkey" PRIMARY KEY ("ban_id", "source_id");

ALTER TABLE ONLY "public"."ban_sources"
    ADD CONSTRAINT "ban_sources_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ban_sources"
    ADD CONSTRAINT "ban_sources_source_url_key" UNIQUE ("source_url");

ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bbw_config"
    ADD CONSTRAINT "bbw_config_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bbw_featured_selections"
    ADD CONSTRAINT "bbw_featured_selections_pkey" PRIMARY KEY ("year", "book_id");

ALTER TABLE ONLY "public"."book_authors"
    ADD CONSTRAINT "book_authors_pkey" PRIMARY KEY ("book_id", "author_id");

ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_isbn13_key" UNIQUE ("isbn13");

ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."content_blocks"
    ADD CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("slug");

ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code");

ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."cover_search_attempts"
    ADD CONSTRAINT "cover_search_attempts_pkey" PRIMARY KEY ("book_id");

ALTER TABLE ONLY "public"."dataset_orders"
    ADD CONSTRAINT "dataset_orders_download_token_key" UNIQUE ("download_token");

ALTER TABLE ONLY "public"."dataset_orders"
    ADD CONSTRAINT "dataset_orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."dataset_orders"
    ADD CONSTRAINT "dataset_orders_stripe_session_id_key" UNIQUE ("stripe_session_id");

ALTER TABLE ONLY "public"."description_search_attempts"
    ADD CONSTRAINT "description_search_attempts_pkey" PRIMARY KEY ("book_id");

ALTER TABLE ONLY "public"."editorial_publish_log"
    ADD CONSTRAINT "editorial_publish_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."inbox_preview"
    ADD CONSTRAINT "inbox_preview_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."mv_refresh_log"
    ADD CONSTRAINT "mv_refresh_log_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."news_config"
    ADD CONSTRAINT "news_config_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."news_items"
    ADD CONSTRAINT "news_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."news_items"
    ADD CONSTRAINT "news_items_source_url_key" UNIQUE ("source_url");

ALTER TABLE ONLY "public"."pageviews"
    ADD CONSTRAINT "pageviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."purchase_links"
    ADD CONSTRAINT "purchase_links_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reading_club_classics"
    ADD CONSTRAINT "reading_club_classics_pkey" PRIMARY KEY ("book_id");

ALTER TABLE ONLY "public"."reading_club_currently_challenged"
    ADD CONSTRAINT "reading_club_currently_challenged_pkey" PRIMARY KEY ("year", "position");

ALTER TABLE ONLY "public"."reading_club_international"
    ADD CONSTRAINT "reading_club_international_pkey" PRIMARY KEY ("book_id");

ALTER TABLE ONLY "public"."reading_club_theme_books"
    ADD CONSTRAINT "reading_club_theme_books_pkey" PRIMARY KEY ("theme_slug", "book_id");

ALTER TABLE ONLY "public"."reading_club_themes"
    ADD CONSTRAINT "reading_club_themes_pkey" PRIMARY KEY ("slug");

ALTER TABLE ONLY "public"."reasons"
    ADD CONSTRAINT "reasons_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reasons"
    ADD CONSTRAINT "reasons_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."scopes"
    ADD CONSTRAINT "scopes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."scopes"
    ADD CONSTRAINT "scopes_slug_key" UNIQUE ("slug");

CREATE INDEX "idx_authors_display_name_trgm" ON "public"."authors" USING "gin" ("display_name" "public"."gin_trgm_ops");

CREATE UNIQUE INDEX "idx_authors_slug" ON "public"."authors" USING "btree" ("slug");

CREATE INDEX "idx_ban_reason_links_ban_id" ON "public"."ban_reason_links" USING "btree" ("ban_id");

CREATE INDEX "idx_ban_reason_links_reason_id" ON "public"."ban_reason_links" USING "btree" ("reason_id");

CREATE INDEX "idx_bans_book_id" ON "public"."bans" USING "btree" ("book_id");

CREATE INDEX "idx_bans_country_code" ON "public"."bans" USING "btree" ("country_code");

CREATE INDEX "idx_bans_country_status" ON "public"."bans" USING "btree" ("country_code", "status");

CREATE INDEX "idx_bans_status" ON "public"."bans" USING "btree" ("status");

CREATE INDEX "idx_bans_year_started" ON "public"."bans" USING "btree" ("year_started");

CREATE INDEX "idx_bbw_featured_published" ON "public"."bbw_featured_selections" USING "btree" ("year") WHERE ("published_at" IS NOT NULL);

CREATE INDEX "idx_bbw_featured_year_position" ON "public"."bbw_featured_selections" USING "btree" ("year", "position");

CREATE INDEX "idx_book_authors_author_id" ON "public"."book_authors" USING "btree" ("author_id");

CREATE INDEX "idx_book_authors_book_id" ON "public"."book_authors" USING "btree" ("book_id");

CREATE INDEX "idx_books_bookshop_status" ON "public"."books" USING "btree" ("bookshop_status") WHERE ("bookshop_status" IS NOT NULL);

CREATE INDEX "idx_books_context_null" ON "public"."books" USING "btree" ("id") WHERE ("censorship_context" IS NULL);

CREATE INDEX "idx_books_cover_null" ON "public"."books" USING "btree" ("id") WHERE ("cover_url" IS NULL);

CREATE INDEX "idx_books_cover_status" ON "public"."books" USING "btree" ("cover_status") WHERE ("cover_status" IS NOT NULL);

CREATE INDEX "idx_books_desc_null" ON "public"."books" USING "btree" ("id") WHERE ("description_book" IS NULL);

CREATE UNIQUE INDEX "idx_books_slug" ON "public"."books" USING "btree" ("slug");

CREATE INDEX "idx_books_title_trgm" ON "public"."books" USING "gin" ("title" "public"."gin_trgm_ops");

CREATE INDEX "idx_books_unclassified" ON "public"."books" USING "btree" ("id") WHERE (("inclusion_rationale" IS NULL) AND ("warning_level" = 'none'::"text"));

CREATE INDEX "idx_books_warning_level" ON "public"."books" USING "btree" ("warning_level") WHERE ("warning_level" <> 'none'::"text");

CREATE INDEX "idx_content_blocks_status" ON "public"."content_blocks" USING "btree" ("status");

CREATE UNIQUE INDEX "idx_countries_code" ON "public"."countries" USING "btree" ("code");

CREATE INDEX "idx_dataset_orders_email" ON "public"."dataset_orders" USING "btree" ("email");

CREATE INDEX "idx_dataset_orders_paid_at" ON "public"."dataset_orders" USING "btree" ("paid_at" DESC);

CREATE INDEX "idx_dataset_orders_token" ON "public"."dataset_orders" USING "btree" ("download_token");

CREATE INDEX "idx_editorial_log_occurred" ON "public"."editorial_publish_log" USING "btree" ("occurred_at" DESC);

CREATE INDEX "idx_editorial_log_type_key" ON "public"."editorial_publish_log" USING "btree" ("content_type", "content_key");

CREATE INDEX "idx_inbox_preview_received_at" ON "public"."inbox_preview" USING "btree" ("received_at" DESC);

CREATE UNIQUE INDEX "idx_mv_ban_counts_cc" ON "public"."mv_ban_counts" USING "btree" ("country_code");

CREATE UNIQUE INDEX "idx_mv_country_reason_counts_pk" ON "public"."mv_country_reason_counts" USING "btree" ("country_code", "reason_slug");

CREATE UNIQUE INDEX "idx_mv_top_authors_rising_pk" ON "public"."mv_top_authors_rising" USING "btree" ("entity_id");

CREATE UNIQUE INDEX "idx_mv_top_books_rising_pk" ON "public"."mv_top_books_rising" USING "btree" ("entity_id");

CREATE INDEX "idx_pageviews_entity" ON "public"."pageviews" USING "btree" ("entity_type", "entity_id");

CREATE INDEX "idx_pageviews_entity_type_id" ON "public"."pageviews" USING "btree" ("entity_type", "entity_id");

CREATE INDEX "idx_pageviews_entity_type_viewed_at" ON "public"."pageviews" USING "btree" ("entity_type", "viewed_at");

CREATE INDEX "idx_pageviews_viewed_at" ON "public"."pageviews" USING "btree" ("viewed_at" DESC);

CREATE INDEX "idx_pageviews_viewed_at_visitor_hash" ON "public"."pageviews" USING "btree" ("viewed_at", "visitor_hash");

CREATE INDEX "idx_rc_cc_published" ON "public"."reading_club_currently_challenged" USING "btree" ("year") WHERE ("published_at" IS NOT NULL);

CREATE INDEX "idx_rc_classics_position" ON "public"."reading_club_classics" USING "btree" ("position");

CREATE INDEX "idx_rc_classics_published" ON "public"."reading_club_classics" USING "btree" ("book_id") WHERE ("published_at" IS NOT NULL);

CREATE INDEX "idx_rc_intl_position" ON "public"."reading_club_international" USING "btree" ("position");

CREATE INDEX "idx_rc_intl_published" ON "public"."reading_club_international" USING "btree" ("book_id") WHERE ("published_at" IS NOT NULL);

CREATE INDEX "idx_rc_theme_books_position" ON "public"."reading_club_theme_books" USING "btree" ("theme_slug", "position");

CREATE INDEX "idx_rc_theme_books_published" ON "public"."reading_club_theme_books" USING "btree" ("theme_slug") WHERE ("published_at" IS NOT NULL);

CREATE INDEX "news_items_source_language_idx" ON "public"."news_items" USING "btree" ("source_language");

CREATE OR REPLACE TRIGGER "trg_ban_reason_links_data_changed" AFTER INSERT OR DELETE OR UPDATE ON "public"."ban_reason_links" FOR EACH STATEMENT EXECUTE FUNCTION "public"."fn_touch_data_changed"();

CREATE OR REPLACE TRIGGER "trg_bans_data_changed" AFTER INSERT OR DELETE OR UPDATE ON "public"."bans" FOR EACH STATEMENT EXECUTE FUNCTION "public"."fn_touch_data_changed"();

ALTER TABLE ONLY "public"."ban_reason_links"
    ADD CONSTRAINT "ban_reason_links_ban_id_fkey" FOREIGN KEY ("ban_id") REFERENCES "public"."bans"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ban_reason_links"
    ADD CONSTRAINT "ban_reason_links_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "public"."reasons"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ban_source_links"
    ADD CONSTRAINT "ban_source_links_ban_id_fkey" FOREIGN KEY ("ban_id") REFERENCES "public"."bans"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ban_source_links"
    ADD CONSTRAINT "ban_source_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ban_sources"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code");

ALTER TABLE ONLY "public"."bans"
    ADD CONSTRAINT "bans_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id");

ALTER TABLE ONLY "public"."bbw_featured_selections"
    ADD CONSTRAINT "bbw_featured_selections_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."book_authors"
    ADD CONSTRAINT "book_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."book_authors"
    ADD CONSTRAINT "book_authors_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cover_search_attempts"
    ADD CONSTRAINT "cover_search_attempts_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."description_search_attempts"
    ADD CONSTRAINT "description_search_attempts_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."purchase_links"
    ADD CONSTRAINT "purchase_links_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."purchase_links"
    ADD CONSTRAINT "purchase_links_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."affiliate_partners"("id");

ALTER TABLE ONLY "public"."reading_club_classics"
    ADD CONSTRAINT "reading_club_classics_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reading_club_currently_challenged"
    ADD CONSTRAINT "reading_club_currently_challenged_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reading_club_international"
    ADD CONSTRAINT "reading_club_international_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reading_club_theme_books"
    ADD CONSTRAINT "reading_club_theme_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reading_club_theme_books"
    ADD CONSTRAINT "reading_club_theme_books_theme_slug_fkey" FOREIGN KEY ("theme_slug") REFERENCES "public"."reading_club_themes"("slug") ON DELETE CASCADE;

ALTER TABLE "public"."affiliate_partners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."authors" ENABLE ROW LEVEL SECURITY;

-- ban_reason_links: RLS enabled without policies. Admin-only
-- access via service-role key. Anon reads blocked by design.
ALTER TABLE "public"."ban_reason_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ban_source_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ban_sources" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."book_authors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;

-- cover_search_attempts: RLS enabled without policies. Internal
-- enrichment-throttling table; never exposed publicly.
ALTER TABLE "public"."cover_search_attempts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."news_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read affiliate_partners" ON "public"."affiliate_partners" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read authors" ON "public"."authors" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read ban_source_links" ON "public"."ban_source_links" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read ban_sources" ON "public"."ban_sources" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read bans" ON "public"."bans" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read book_authors" ON "public"."book_authors" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read books" ON "public"."books" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read countries" ON "public"."countries" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read published news" ON "public"."news_items" FOR SELECT TO "anon" USING (("status" = 'published'::"text"));

CREATE POLICY "public read purchase_links" ON "public"."purchase_links" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read reasons" ON "public"."reasons" FOR SELECT TO "anon" USING (true);

CREATE POLICY "public read scopes" ON "public"."scopes" FOR SELECT TO "anon" USING (true);

ALTER TABLE "public"."purchase_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reasons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."scopes" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_db_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_db_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_db_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_db_stats"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fn_touch_data_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_touch_data_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_touch_data_changed"() TO "service_role";

GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_all_materialized_views"() TO "service_role";

GRANT ALL ON TABLE "public"."affiliate_partners" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_partners" TO "service_role";

GRANT ALL ON SEQUENCE "public"."affiliate_partners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."affiliate_partners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."affiliate_partners_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."authors" TO "anon";
GRANT ALL ON TABLE "public"."authors" TO "authenticated";
GRANT ALL ON TABLE "public"."authors" TO "service_role";

GRANT ALL ON SEQUENCE "public"."authors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."authors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."authors_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."ban_reason_links" TO "anon";
GRANT ALL ON TABLE "public"."ban_reason_links" TO "authenticated";
GRANT ALL ON TABLE "public"."ban_reason_links" TO "service_role";

GRANT ALL ON TABLE "public"."ban_source_links" TO "anon";
GRANT ALL ON TABLE "public"."ban_source_links" TO "authenticated";
GRANT ALL ON TABLE "public"."ban_source_links" TO "service_role";

GRANT ALL ON TABLE "public"."ban_sources" TO "anon";
GRANT ALL ON TABLE "public"."ban_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."ban_sources" TO "service_role";

GRANT ALL ON SEQUENCE "public"."ban_sources_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ban_sources_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ban_sources_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."bans" TO "anon";
GRANT ALL ON TABLE "public"."bans" TO "authenticated";
GRANT ALL ON TABLE "public"."bans" TO "service_role";

GRANT ALL ON SEQUENCE "public"."bans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bans_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."bbw_config" TO "anon";
GRANT ALL ON TABLE "public"."bbw_config" TO "authenticated";
GRANT ALL ON TABLE "public"."bbw_config" TO "service_role";

GRANT ALL ON TABLE "public"."bbw_featured_selections" TO "anon";
GRANT ALL ON TABLE "public"."bbw_featured_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."bbw_featured_selections" TO "service_role";

GRANT ALL ON TABLE "public"."book_authors" TO "anon";
GRANT ALL ON TABLE "public"."book_authors" TO "authenticated";
GRANT ALL ON TABLE "public"."book_authors" TO "service_role";

GRANT ALL ON TABLE "public"."books" TO "anon";
GRANT ALL ON TABLE "public"."books" TO "authenticated";
GRANT ALL ON TABLE "public"."books" TO "service_role";

GRANT ALL ON SEQUENCE "public"."books_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."books_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."books_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."content_blocks" TO "anon";
GRANT ALL ON TABLE "public"."content_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."content_blocks" TO "service_role";

GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";

GRANT ALL ON TABLE "public"."cover_search_attempts" TO "anon";
GRANT ALL ON TABLE "public"."cover_search_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."cover_search_attempts" TO "service_role";

GRANT ALL ON TABLE "public"."dataset_orders" TO "anon";
GRANT ALL ON TABLE "public"."dataset_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."dataset_orders" TO "service_role";

GRANT ALL ON TABLE "public"."description_search_attempts" TO "anon";
GRANT ALL ON TABLE "public"."description_search_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."description_search_attempts" TO "service_role";

GRANT ALL ON TABLE "public"."editorial_publish_log" TO "anon";
GRANT ALL ON TABLE "public"."editorial_publish_log" TO "authenticated";
GRANT ALL ON TABLE "public"."editorial_publish_log" TO "service_role";

GRANT ALL ON SEQUENCE "public"."editorial_publish_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."editorial_publish_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."editorial_publish_log_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."inbox_preview" TO "anon";
GRANT ALL ON TABLE "public"."inbox_preview" TO "authenticated";
GRANT ALL ON TABLE "public"."inbox_preview" TO "service_role";

GRANT ALL ON SEQUENCE "public"."inbox_preview_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inbox_preview_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inbox_preview_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."mv_ban_counts" TO "anon";
GRANT ALL ON TABLE "public"."mv_ban_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_ban_counts" TO "service_role";

GRANT ALL ON TABLE "public"."reasons" TO "anon";
GRANT ALL ON TABLE "public"."reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."reasons" TO "service_role";

GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "anon";
GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_country_reason_counts" TO "service_role";

GRANT ALL ON TABLE "public"."mv_refresh_log" TO "anon";
GRANT ALL ON TABLE "public"."mv_refresh_log" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_refresh_log" TO "service_role";

GRANT ALL ON TABLE "public"."pageviews" TO "anon";
GRANT ALL ON TABLE "public"."pageviews" TO "authenticated";
GRANT ALL ON TABLE "public"."pageviews" TO "service_role";

GRANT ALL ON TABLE "public"."mv_top_authors_rising" TO "anon";
GRANT ALL ON TABLE "public"."mv_top_authors_rising" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_top_authors_rising" TO "service_role";

GRANT ALL ON TABLE "public"."mv_top_books_rising" TO "anon";
GRANT ALL ON TABLE "public"."mv_top_books_rising" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_top_books_rising" TO "service_role";

GRANT ALL ON TABLE "public"."news_config" TO "anon";
GRANT ALL ON TABLE "public"."news_config" TO "authenticated";
GRANT ALL ON TABLE "public"."news_config" TO "service_role";

GRANT ALL ON TABLE "public"."news_items" TO "anon";
GRANT ALL ON TABLE "public"."news_items" TO "authenticated";
GRANT ALL ON TABLE "public"."news_items" TO "service_role";

GRANT ALL ON SEQUENCE "public"."news_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."news_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."news_items_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."purchase_links" TO "anon";
GRANT ALL ON TABLE "public"."purchase_links" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_links" TO "service_role";

GRANT ALL ON SEQUENCE "public"."purchase_links_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchase_links_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchase_links_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."reading_club_classics" TO "anon";
GRANT ALL ON TABLE "public"."reading_club_classics" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_club_classics" TO "service_role";

GRANT ALL ON TABLE "public"."reading_club_currently_challenged" TO "anon";
GRANT ALL ON TABLE "public"."reading_club_currently_challenged" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_club_currently_challenged" TO "service_role";

GRANT ALL ON TABLE "public"."reading_club_international" TO "anon";
GRANT ALL ON TABLE "public"."reading_club_international" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_club_international" TO "service_role";

GRANT ALL ON TABLE "public"."reading_club_theme_books" TO "anon";
GRANT ALL ON TABLE "public"."reading_club_theme_books" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_club_theme_books" TO "service_role";

GRANT ALL ON TABLE "public"."reading_club_themes" TO "anon";
GRANT ALL ON TABLE "public"."reading_club_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_club_themes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."reasons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reasons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reasons_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."scopes" TO "anon";
GRANT ALL ON TABLE "public"."scopes" TO "authenticated";
GRANT ALL ON TABLE "public"."scopes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."scopes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."scopes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."scopes_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_authors_all_time" TO "anon";
GRANT ALL ON TABLE "public"."v_top_authors_all_time" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_authors_all_time" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_authors_last_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_authors_last_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_authors_last_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_authors_this_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_authors_this_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_authors_this_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_banned_authors" TO "anon";
GRANT ALL ON TABLE "public"."v_top_banned_authors" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_banned_authors" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_banned_books" TO "anon";
GRANT ALL ON TABLE "public"."v_top_banned_books" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_banned_books" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_books_all_time" TO "anon";
GRANT ALL ON TABLE "public"."v_top_books_all_time" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_books_all_time" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_books_last_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_books_last_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_books_last_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_books_this_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_books_this_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_books_this_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_countries_last_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_countries_last_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_countries_last_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_countries_this_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_countries_this_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_countries_this_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_referrers_last_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_referrers_last_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_referrers_last_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_top_referrers_this_week" TO "anon";
GRANT ALL ON TABLE "public"."v_top_referrers_this_week" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_referrers_this_week" TO "service_role";

GRANT ALL ON TABLE "public"."v_weekly_totals" TO "anon";
GRANT ALL ON TABLE "public"."v_weekly_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."v_weekly_totals" TO "service_role";

