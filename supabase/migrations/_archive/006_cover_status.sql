-- Track validation state of book cover URLs.
--
-- Statuses:
--   valid                — URL has been fetched/checked and is a real cover
--   rejected_placeholder — URL fetched but matched the Google Books "image not
--                          available" placeholder (cover_url left NULL)
--   manual_override      — operator deleted a cover and never wants it re-added
--                          (cover_url left NULL, do not re-enrich)

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS cover_status TEXT
    CHECK (cover_status IN ('valid', 'rejected_placeholder', 'manual_override')),
  ADD COLUMN IF NOT EXISTS cover_checked_at TIMESTAMPTZ;

-- Backfill: any existing row with a cover URL is treated as valid.
-- Per spec: do not retroactively re-validate; trust what's already there.
UPDATE books
SET cover_status = 'valid'
WHERE cover_url IS NOT NULL
  AND cover_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_books_cover_status
  ON books (cover_status)
  WHERE cover_status IS NOT NULL;
