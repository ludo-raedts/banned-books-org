-- Stores an alternative isbn13 that resolves on Bookshop.org's affiliate
-- deep-link path, found via Open Library cross-reference for books whose
-- canonical isbn13 returned 404 on Bookshop.
--
-- Filled by scripts/cross-reference-bookshop-isbn.ts. When this column is
-- non-NULL, getBookshopUrl uses it instead of books.isbn13 — keeping the
-- canonical isbn13 untouched (still used for covers, OG metadata, etc.).
--
-- bookshop_status semantics after this migration:
--   valid     → either books.isbn13 OR books.bookshop_isbn13 resolves on
--               Bookshop. Use whichever is non-NULL (prefer
--               bookshop_isbn13).
--   not_found → neither isbn13 nor any alternative we tried resolved.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS bookshop_isbn13 TEXT;
