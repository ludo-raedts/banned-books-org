-- Add a free-text editorial summary of how a given book has been censored.
-- Surfaces on the homepage Book-of-the-day callout (and, later, the book
-- detail header). Nullable — when NULL the homepage falls back to a
-- template generated from the joined ban data.

ALTER TABLE "public"."books"
  ADD COLUMN IF NOT EXISTS "censorship_summary" TEXT;

COMMENT ON COLUMN "public"."books"."censorship_summary" IS
  'Editorial 1–2 sentence summary of where/when/how this book has been censored. Shown on the homepage Book-of-the-day card and the book detail page. NULL means "fall back to template" on the public surface.';
