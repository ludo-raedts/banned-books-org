-- Author enrichment from the Open Library Authors API
-- (scripts/enrich-author-ol.ts). Two plumbing columns:
--
--   openlibrary_author_id — the resolved OL author OLID (e.g. "OL23919A"),
--     cached so a re-run fetches /authors/<olid>.json directly instead of
--     re-resolving the author from their books' work records.
--   ol_checked_at — sticky gate: when the OL author enricher last ran for this
--     author (hit or miss). NULL means never checked. Mirrors the
--     photo_v2_checked_at / gutenberg_checked_at pattern so misses become
--     sticky and default runs make monotone progress over the ~8.7k authors.
--
-- Bio / birth_year / death_year / birth_country / name_native already exist —
-- the enricher fills those existing columns, so no new data columns are needed
-- (year precision; full birth/death dates are intentionally out of scope).

ALTER TABLE "public"."authors"
    ADD COLUMN IF NOT EXISTS "openlibrary_author_id" text,
    ADD COLUMN IF NOT EXISTS "ol_checked_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_authors_ol_checked_at"
    ON "public"."authors" USING btree ("ol_checked_at")
    WHERE ("ol_checked_at" IS NULL);

COMMENT ON COLUMN "public"."authors"."openlibrary_author_id" IS
    'Resolved Open Library author OLID (e.g. OL23919A), cached by enrich-author-ol.ts so re-runs fetch the author record directly instead of re-resolving from book work records.';

COMMENT ON COLUMN "public"."authors"."ol_checked_at" IS
    'When enrich-author-ol.ts last ran for this author (hit or miss). NULL means never checked. Used to skip already-probed authors in default mode; --recheck bypasses this.';
