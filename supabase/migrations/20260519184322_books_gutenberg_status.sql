-- Mirror the bookshop_* / archive_org_* pattern for Project Gutenberg lookups
-- so a 'not_found' verdict becomes permanent and the script can stop
-- re-querying the same misses on every sweep.
--
-- Backfill: books that already have a gutenberg_id are obviously 'valid' and
-- need a checked_at timestamp so they drop out of the eligible pool. Books
-- with gutenberg_id NULL stay unmarked — those have either never been queried
-- or were queried and missed; either way the next sweep will check them once
-- more (with the new persistent-miss semantics from this commit forward).

ALTER TABLE "public"."books"
    ADD COLUMN "gutenberg_status" text,
    ADD COLUMN "gutenberg_checked_at" timestamp with time zone;

ALTER TABLE "public"."books"
    ADD CONSTRAINT "books_gutenberg_status_check"
    CHECK ("gutenberg_status" = ANY (ARRAY['valid'::text, 'not_found'::text]));

CREATE INDEX "idx_books_gutenberg_status"
    ON "public"."books" USING btree ("gutenberg_status")
    WHERE ("gutenberg_status" IS NOT NULL);

-- Backfill known-valid rows so the next enrich run doesn't re-query them.
UPDATE "public"."books"
SET "gutenberg_status" = 'valid',
    "gutenberg_checked_at" = now()
WHERE "gutenberg_id" IS NOT NULL;

COMMENT ON COLUMN "public"."books"."gutenberg_status" IS
    'valid = match found and stored in gutenberg_id; not_found = lookup ran but Gutendex returned no acceptable copyright=false match.';
COMMENT ON COLUMN "public"."books"."gutenberg_checked_at" IS
    'When the Gutendex lookup last ran for this book. NULL means never checked.';
