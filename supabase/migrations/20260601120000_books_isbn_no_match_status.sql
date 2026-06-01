-- enrich-isbn left guard-rejected rows (low title-similarity / edition
-- language-mismatch) permanently unstamped, on the theory they'd retry once
-- OL/GB metadata improved. In practice these rows almost never resolve — the
-- matches are wildly wrong ("Club 17" → "Tom Sawyer") — so the same ~80% of
-- the pending pool got fully re-queried (OL + 400ms + edition fetch) on every
-- sweep. That is the bulk of the ISBN step's runtime.
--
-- Introduce a third status, 'no_match', distinct from 'not_found':
--   not_found = lookup ran, NO candidate at all (or prefilter-unsearchable).
--   no_match  = lookup ran, got candidate(s) but none passed the confidence
--               guards (low title-similarity or edition language-mismatch).
-- Both stamp isbn_checked_at, so the row leaves the eligible pool. Keeping
-- them as a separate value lets a future re-sweep target only 'no_match' rows
-- if a metadata-improvement retry is ever wanted, without re-running misses.
--
-- Dup-collisions (candidate ISBN already on another row) remain unstamped:
-- a real match was found and the clashing row may later be reassigned.

ALTER TABLE "public"."books"
    DROP CONSTRAINT "books_isbn_status_check";

ALTER TABLE "public"."books"
    ADD CONSTRAINT "books_isbn_status_check"
    CHECK ("isbn_status" = ANY (ARRAY['valid'::text, 'not_found'::text, 'no_match'::text]));

COMMENT ON COLUMN "public"."books"."isbn_status" IS
    'valid = isbn13 populated and verified by OL/GB; not_found = lookup ran but no candidate at all (true miss or prefilter-rejected unsearchable title); no_match = candidate(s) found but none passed the title-similarity / edition-language guards. Dup-collisions stay unstamped so they retry if the clashing row is reassigned.';
