-- Track whether a book's isbn13 resolves on Bookshop.org's affiliate
-- deep-link path (https://bookshop.org/a/{aid}/{isbn13}).
--
-- Statuses:
--   valid       — HEAD returned 2xx; safe to use for /a/{aid}/{isbn} link
--   not_found   — HEAD returned 404; isbn13 is not in Bookshop's catalogue
--                 (often because we store a foreign-edition isbn13)
--
-- NULL means we haven't probed it yet. Code falls back to /shop/{name}
-- whenever status is anything other than 'valid'. This guarantees the
-- 48-hour affiliate cookie is always set, even when we lack a US-edition
-- isbn for the book.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS bookshop_status TEXT
    CHECK (bookshop_status IN ('valid', 'not_found')),
  ADD COLUMN IF NOT EXISTS bookshop_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_books_bookshop_status
  ON books (bookshop_status)
  WHERE bookshop_status IS NOT NULL;
