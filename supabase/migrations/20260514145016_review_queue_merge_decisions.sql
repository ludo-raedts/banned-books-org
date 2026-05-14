-- Audit-trail for merge decisions made from the import-review UI.
-- Stores the per-field winners, slug aliases added, and ban action taken
-- when a review-queue row is merged into an existing book.
--
-- Shape (informal):
--   {
--     "target_book_id": 1234,
--     "field_winners": { "title": "pass_b", "description": "existing", ... },
--     "array_selections": { "genres": ["political", "satire"] },
--     "aliases_added": [{ "slug": "...", "source": "title_native" }],
--     "ban_action": { "kind": "create" | "enrich_existing" | "skip", ... },
--     "dedup_check_at_merge": { "kind": "possible_duplicate", "similarity": 0.72, ... }
--   }

ALTER TABLE import_review_queue
  ADD COLUMN IF NOT EXISTS merge_decisions jsonb;

COMMENT ON COLUMN import_review_queue.merge_decisions IS
  'Per-field winners and merge actions chosen by the editor when this row was merged into an existing book. NULL for rows approved via the non-merge path.';
