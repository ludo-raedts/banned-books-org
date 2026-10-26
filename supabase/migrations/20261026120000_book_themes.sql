-- ============================================================================
-- book_themes — what a BOOK is about, separate from why a ban happened.
--
-- A ban's reason (ban_reason_links) is what the banning authority or source
-- states; PEN America and Magnusson record none. PEN's own analysis instead
-- reports the share of banned titles that FEATURE certain people/themes
-- (2024–25: 39% LGBTQ+ characters or people; 2023–24: 36% characters or
-- people of color). This table holds that book-level layer, so the site can
-- say "this book features LGBTQ+ characters" without claiming it was the
-- reason for a ban. Pages: /themes/[slug].
--
--   theme    'lgbtq' | 'poc'  (PEN's two headline categories)
--   evidence verbatim quote from the material the classification saw
--            (blurb / Open Library subjects / title) — checked by the script
--   source   how it was established: 'llm_grounded' (scripts/classify-book-
--            themes.ts, evidence-verified) | 'manual'
--
-- Small table (~a few thousand rows), PK lookup + theme index. No matview.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."book_themes" (
  "book_id"    bigint      NOT NULL REFERENCES "public"."books"("id") ON DELETE CASCADE,
  "theme"      text        NOT NULL CONSTRAINT "book_themes_theme_check" CHECK (theme IN ('lgbtq', 'poc')),
  "evidence"   text,
  "source"     text        NOT NULL DEFAULT 'llm_grounded'
                           CONSTRAINT "book_themes_source_check" CHECK (source IN ('llm_grounded', 'manual')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("book_id", "theme")
);

CREATE INDEX IF NOT EXISTS "idx_book_themes_theme" ON "public"."book_themes" ("theme", "book_id");

ALTER TABLE "public"."book_themes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read book_themes" ON "public"."book_themes" FOR SELECT TO "anon" USING (true);
GRANT SELECT ON "public"."book_themes" TO "anon", "authenticated";
GRANT ALL ON "public"."book_themes" TO "service_role";

COMMENT ON TABLE "public"."book_themes" IS
  'Book-level themes (what the book features), not ban reasons. Evidence-verified classification; see scripts/classify-book-themes.ts.';
