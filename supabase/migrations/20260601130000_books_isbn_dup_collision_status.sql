-- enrich-isbn previously left dup-collisions (a real ISBN match was found, but
-- another row already owns that isbn13) permanently unstamped, on the theory
-- the clashing row might later be reassigned. In practice this just moved the
-- every-sweep retry residue from 'no_match' (fixed in the prior migration) to
-- the collision set: those rows got fully re-queried (OL + 400ms + edition
-- fetch) on every run forever, because nothing ever stamps them.
--
-- Resolving a collision is always a deliberate follow-up — merge the duplicate
-- book, or clear the squatting row's wrong ISBN and reset the affected row's
-- isbn_checked_at — never an automatic re-lookup. So introduce a fourth status
-- 'dup_collision' (isbn13 stays NULL, isbn_checked_at set) to drop the row out
-- of the eligible pool, while keeping it distinct from 'no_match' so a future
-- audit can find exactly the rows whose correct ISBN is parked on another row.

ALTER TABLE "public"."books"
    DROP CONSTRAINT "books_isbn_status_check";

ALTER TABLE "public"."books"
    ADD CONSTRAINT "books_isbn_status_check"
    CHECK ("isbn_status" = ANY (ARRAY['valid'::text, 'not_found'::text, 'no_match'::text, 'dup_collision'::text]));

COMMENT ON COLUMN "public"."books"."isbn_status" IS
    'valid = isbn13 populated and verified by OL/GB; not_found = lookup ran but no candidate at all (true miss or prefilter-rejected unsearchable title); no_match = candidate(s) found but none passed the title-similarity / query-coverage / author / edition-language guards; dup_collision = a valid ISBN was found but another row already owns it (resolve by merging the duplicate or clearing the squatting row, then reset isbn_checked_at).';
