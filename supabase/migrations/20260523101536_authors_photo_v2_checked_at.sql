-- Track when enrich-author-photos-v2 last ran for each author so misses
-- become sticky and the script can skip authors it has already probed,
-- instead of re-running the same fruitless Wikidata/OpenLibrary/site
-- lookups every sweep. Mirrors the gutenberg_checked_at pattern on books.

ALTER TABLE "public"."authors"
    ADD COLUMN IF NOT EXISTS "photo_v2_checked_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_authors_photo_v2_checked_at"
    ON "public"."authors" USING btree ("photo_v2_checked_at")
    WHERE ("photo_v2_checked_at" IS NULL);

COMMENT ON COLUMN "public"."authors"."photo_v2_checked_at" IS
    'When enrich-author-photos-v2 last ran for this author (hit or miss). NULL means never checked. Used to skip authors that already had a V2 sweep in the default mode; --recheck bypasses this.';
