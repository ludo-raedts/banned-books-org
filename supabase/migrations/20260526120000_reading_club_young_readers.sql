-- Reading Club: Young Readers track.
--
-- Fifth reading-club track. Same shape as reading_club_classics
-- (book_id PK, position, custom_blurb, published_at, featured), with two
-- track-specific uplifts:
--
--   1. audience_as_published / audience_source_url — the publisher's own
--      audience categorization ("Picture book (ages 4-8)") + citation.
--      banned-books.org does NOT assign age labels; we record the
--      publisher's claim and cite it.
--
--   2. discussion_questions_book + discussion_questions_ban — two parallel
--      question sets per book. "Book" = literary discussion; "ban" =
--      censorship-specific discussion (why people tried to keep this book
--      from children). Both are jsonb string arrays, same shape as the
--      existing discussion_questions column on other tracks.
--
-- Featured + partial index mirrors 20260521190000_reading_club_featured.sql
-- so the /reading-club hub cover strip can include young-readers picks.

CREATE TABLE IF NOT EXISTS "public"."reading_club_young_readers" (
    "book_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "custom_blurb" "text",
    "audience_as_published" "text",
    "audience_source_url" "text",
    "discussion_questions_book" "jsonb",
    "discussion_questions_ban" "jsonb",
    "featured" boolean NOT NULL DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."reading_club_young_readers"
    ADD CONSTRAINT "reading_club_young_readers_pkey" PRIMARY KEY ("book_id");

ALTER TABLE ONLY "public"."reading_club_young_readers"
    ADD CONSTRAINT "reading_club_young_readers_book_id_fkey"
    FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_rc_young_readers_position"
    ON "public"."reading_club_young_readers" USING "btree" ("position");

CREATE INDEX IF NOT EXISTS "idx_rc_young_readers_published"
    ON "public"."reading_club_young_readers" USING "btree" ("book_id")
    WHERE ("published_at" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "reading_club_young_readers_featured_idx"
    ON "public"."reading_club_young_readers" ("position")
    WHERE "featured" = true;

GRANT ALL ON TABLE "public"."reading_club_young_readers" TO "anon";
GRANT ALL ON TABLE "public"."reading_club_young_readers" TO "authenticated";
GRANT ALL ON TABLE "public"."reading_club_young_readers" TO "service_role";
