-- Track which static URLs each IndexNow submission included.
--
-- Before this column, the delta endpoint only looked at `books`/`authors`
-- rows with `created_at > last_successful_submission.submitted_at`. New
-- static pages (top-list destinations added during the homepage redesign,
-- e.g. /trending-banned-books, /most-banned-authors) were therefore
-- invisible to "Submit new pages" — the only way to ping them was a full
-- bulk re-submit of all 9k+ URLs.
--
-- With this column the bulk and delta endpoints record their static URL
-- set per run, and the next delta call diffs `current - last submitted
-- static set` so newly-introduced static pages get picked up automatically.
-- NULL = legacy row from before this migration (treat as "unknown"; the
-- delta endpoint falls back to submitting the full current set on the
-- first call after deploy to re-baseline).

alter table public.indexnow_submissions
  add column if not exists static_urls jsonb;
