-- ============================================================================
-- Trigram GIN indexes for the multilingual book-title search.
--
-- src/lib/book-search.ts runs the `q` search as a 4-column ILIKE %term%:
--   title.ilike OR title_native.ilike OR title_transliterated.ilike
--   OR title_english_meaningful.ilike
-- Only `books.title` carried a trigram index (baseline idx_books_title_trgm),
-- so the other three columns forced a sequential scan of the full books table
-- on every search — the #4 cost in pg_stat_statements (mean ~297ms, max ~7.6s,
-- occasionally tripping statement_timeout under crawler load).
--
-- gin_trgm_ops supports LIKE/ILIKE, so these let the planner bitmap-OR all four
-- disjuncts off indexes instead of scanning. The three columns are sparse
-- (mostly NULL — only foreign-language / non-Latin works populate them), so the
-- indexes are small. books is ~19k rows; the build is sub-second.
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_books_title_native_trgm"
  ON "public"."books" USING "gin" ("title_native" "public"."gin_trgm_ops");

CREATE INDEX IF NOT EXISTS "idx_books_title_transliterated_trgm"
  ON "public"."books" USING "gin" ("title_transliterated" "public"."gin_trgm_ops");

CREATE INDEX IF NOT EXISTS "idx_books_title_english_meaningful_trgm"
  ON "public"."books" USING "gin" ("title_english_meaningful" "public"."gin_trgm_ops");
