-- Literary-award metadata for books and authors (scripts/enrich-awards.ts).
--
-- Two new `awards` JSONB columns, one per table, because the two prizes we
-- track live at different levels:
--
--   authors.awards — the Nobel Prize in Literature is awarded for an author's
--     whole body of work (the oeuvre), never a single title, so it is an
--     AUTHOR attribute.
--   books.awards — the Pulitzer Prize is awarded to a specific work, so it is
--     a BOOK attribute.
--
-- Each column holds a JSON array of award objects. Shape:
--   [{ "award": "Nobel Prize in Literature", "year": 1993 },
--    { "award": "Pulitzer Prize", "category": "Fiction", "year": 1988 }]
-- `category` is omitted for Nobel (single category) and carries the Pulitzer
-- sub-prize ("Fiction" / "Novel" / "Special Citation") otherwise. A JSONB array
-- (mirroring the existing genres[] pattern) keeps the schema open to further
-- prizes (Booker, National Book Award) without another migration.
--
-- Populated from a hand-verified overlap of the Nobel API (CC0) and Wikidata
-- SPARQL against the catalogue — see data/award-overlap.md. ~47 Nobel authors,
-- ~26 Pulitzer-winning books at time of writing.

ALTER TABLE "public"."authors"
    ADD COLUMN IF NOT EXISTS "awards" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."books"
    ADD COLUMN IF NOT EXISTS "awards" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Partial GIN indexes: only the handful of award-bearing rows are indexed,
-- so a hub query ("all books/authors with any award") and containment lookups
-- stay cheap without bloating the index with thousands of empty arrays.
CREATE INDEX IF NOT EXISTS "idx_authors_awards"
    ON "public"."authors" USING gin ("awards")
    WHERE ("awards" <> '[]'::jsonb);

CREATE INDEX IF NOT EXISTS "idx_books_awards"
    ON "public"."books" USING gin ("awards")
    WHERE ("awards" <> '[]'::jsonb);

COMMENT ON COLUMN "public"."authors"."awards" IS
    'JSON array of literary awards held by this author, author-level prizes only (Nobel Prize in Literature). Shape: [{award, year}]. Populated by scripts/enrich-awards.ts from the Nobel API; see data/award-overlap.md.';

COMMENT ON COLUMN "public"."books"."awards" IS
    'JSON array of literary awards won by this specific work (Pulitzer Prize). Shape: [{award, category, year}]. Populated by scripts/enrich-awards.ts from Wikidata; see data/award-overlap.md.';
