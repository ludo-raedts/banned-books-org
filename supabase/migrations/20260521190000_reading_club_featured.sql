-- Add a `featured` flag to every reading-club track so an editor can mark
-- individual books to appear in the cover-strip on /reading-club.
--
-- One flag per track table (not a separate cross-track table) so the existing
-- admin save-track-books flow can persist it alongside custom_blurb /
-- discussion_questions without a second round-trip. The /reading-club hub
-- page does a UNION ALL across the four tables, filtered to featured=true
-- and a published cover.

ALTER TABLE "public"."reading_club_international"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."reading_club_classics"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."reading_club_currently_challenged"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."reading_club_theme_books"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes: the hub page only ever reads `featured = true` rows.
-- Tiny tables today (low tens of rows) but the partial index keeps the cost
-- flat as tracks grow.
CREATE INDEX IF NOT EXISTS "reading_club_international_featured_idx"
  ON "public"."reading_club_international" ("position")
  WHERE "featured" = true;

CREATE INDEX IF NOT EXISTS "reading_club_classics_featured_idx"
  ON "public"."reading_club_classics" ("position")
  WHERE "featured" = true;

CREATE INDEX IF NOT EXISTS "reading_club_currently_challenged_featured_idx"
  ON "public"."reading_club_currently_challenged" ("year" DESC, "position")
  WHERE "featured" = true;

CREATE INDEX IF NOT EXISTS "reading_club_theme_books_featured_idx"
  ON "public"."reading_club_theme_books" ("theme_slug", "position")
  WHERE "featured" = true;
