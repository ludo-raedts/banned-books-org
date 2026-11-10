-- Title/author search over the register entries (/search shows register hits
-- when the catalogue has few or no matches; src/lib/registers.ts
-- searchRegisterEntries).
--
-- Without an index the query is three ILIKEs over ~35k rows: ~240 ms on a good
-- moment, 10 s when the instance's CPU is throttled (measured 2026-11-10), and
-- it runs once per uncached query string. One stored, generated search column
-- with a trigram GIN index turns it into an index lookup.
--
-- Disk-IO: adding the stored column rewrites the 10 MB table once (brief
-- exclusive lock, no temp spill); the GIN index is a few MB. No per-request
-- aggregation, no sort beyond a 6-row top-N.

ALTER TABLE "public"."register_entries"
  ADD COLUMN IF NOT EXISTS "search_text" text
  GENERATED ALWAYS AS (
    lower(coalesce("printed_author", '') || ' ' || coalesce("author_display", '') || ' ' || "title")
  ) STORED;

CREATE INDEX IF NOT EXISTS "idx_register_entries_search_trgm"
  ON "public"."register_entries" USING gin ("search_text" "public"."gin_trgm_ops");
