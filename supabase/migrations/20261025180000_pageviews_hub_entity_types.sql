-- Pageview tracking for hub/editorial pages.
--
-- Until now only /books/[slug] and /authors/[slug] wrote pageview rows
-- (CHECK entity_type IN ('book','author')), so country, reason, essay, year,
-- search and home traffic was invisible in Postgres and the admin dashboard
-- (site audit 2026-10-25 §4.4-14). New entity types identify the page by
-- `path` and carry entity_id = 0; the existing v_top_books_* / v_top_authors_*
-- views filter on entity_type and are unaffected. v_weekly_totals /
-- pageviews_daily count every row and will rise accordingly (they are
-- "site pageviews", which is now closer to true).
--
-- Disk-IO: ALTER … ADD CONSTRAINT validates the existing ~80k rows once
-- (a single sequential scan, no temp spill); no index changes.

ALTER TABLE public.pageviews DROP CONSTRAINT IF EXISTS pageviews_entity_type_check;
ALTER TABLE public.pageviews
  ADD CONSTRAINT pageviews_entity_type_check
  CHECK (entity_type = ANY (ARRAY['book'::text, 'author'::text, 'country'::text, 'reason'::text, 'page'::text]));
