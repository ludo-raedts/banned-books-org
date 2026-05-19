-- Track which books have been checked against archive.org and what was found.
-- Mirrors the bookshop_* pattern: a 'not_found' verdict prevents re-checking
-- on every enrich-all run, while NULL checked_at means "still to do".

ALTER TABLE "public"."books"
    ADD COLUMN "archive_org_id" text,
    ADD COLUMN "archive_org_status" text,
    ADD COLUMN "archive_org_checked_at" timestamp with time zone;

ALTER TABLE "public"."books"
    ADD CONSTRAINT "books_archive_org_status_check"
    CHECK ("archive_org_status" = ANY (ARRAY['valid'::text, 'not_found'::text]));

CREATE INDEX "idx_books_archive_org_status"
    ON "public"."books" USING btree ("archive_org_status")
    WHERE ("archive_org_status" IS NOT NULL);

COMMENT ON COLUMN "public"."books"."archive_org_id" IS
    'archive.org identifier (the path segment after /details/), e.g. ''39002086320026.med.yale.edu''. NULL when status=not_found.';
COMMENT ON COLUMN "public"."books"."archive_org_status" IS
    'valid = match found and stored in archive_org_id; not_found = lookup ran but no acceptable match.';
COMMENT ON COLUMN "public"."books"."archive_org_checked_at" IS
    'When the archive.org lookup last ran for this book. NULL means never checked.';
