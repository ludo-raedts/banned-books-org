-- Mirror the gutenberg_* / archive_org_* pattern for ISBN-13 lookups so a
-- 'not_found' verdict becomes permanent and enrich-isbn stops re-querying
-- the same misses on every sweep. Without this, every run re-checked every
-- book where isbn13 IS NULL, which is the bulk of the catalogue's
-- never-going-to-match tail (placeholder titles, pinyin-only zh, obscure
-- foreign-language editions OL/GB simply don't carry).
--
-- Backfill: books that already have an isbn13 are obviously 'valid' and need
-- a checked_at timestamp so they drop out of the eligible pool. Books with
-- isbn13 NULL stay unmarked — the next sweep will query each once more and
-- record either 'valid' or 'not_found' going forward.

ALTER TABLE "public"."books"
    ADD COLUMN "isbn_status" text,
    ADD COLUMN "isbn_checked_at" timestamp with time zone;

ALTER TABLE "public"."books"
    ADD CONSTRAINT "books_isbn_status_check"
    CHECK ("isbn_status" = ANY (ARRAY['valid'::text, 'not_found'::text]));

CREATE INDEX "idx_books_isbn_status"
    ON "public"."books" USING btree ("isbn_status")
    WHERE ("isbn_status" IS NOT NULL);

-- Backfill known-valid rows so the next enrich run doesn't re-query them.
UPDATE "public"."books"
SET "isbn_status" = 'valid',
    "isbn_checked_at" = now()
WHERE "isbn13" IS NOT NULL;

COMMENT ON COLUMN "public"."books"."isbn_status" IS
    'valid = isbn13 populated and verified by OL/GB; not_found = lookup ran but no acceptable match (true miss or prefilter-rejected unsearchable title). Dup-collisions and low-similarity/edition-mismatch rejects stay unstamped so they retry if OL/GB improve.';
COMMENT ON COLUMN "public"."books"."isbn_checked_at" IS
    'When the ISBN-13 lookup last ran for this book. NULL means never checked.';
