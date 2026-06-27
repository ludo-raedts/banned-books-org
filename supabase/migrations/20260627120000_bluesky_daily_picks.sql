-- ----------------------------------------------------------------------------
-- bluesky_daily_picks
-- ----------------------------------------------------------------------------
--
-- The FROZEN "banned book of the day" plan: one row per UTC date pinning the
-- chosen book. Without this, the daily pick was recomputed on every render from
-- a deterministic index over the *current* eligible pool — so any data edit
-- (filling a cover/description, gating a book) resized or reordered the pool and
-- silently shifted the pick for every upcoming date. That made the /admin/bluesky
-- "upcoming" queue unstable: you could research a title, edit the DB, and watch
-- the queue reshuffle.
--
-- Now the picker writes its deterministic choice here the first time it resolves
-- a present/future date (write-on-read), and reads it back forever after. Data
-- edits no longer move a date once it has been frozen. Past dates (before the
-- pick was ever resolved) are NOT frozen — they fall back to the deterministic
-- compute, so we never invent a retroactive history.
--
-- Editing the plan: the /admin/bluesky "skip" action deletes any frozen rows
-- pointing at the skipped book (today onward) so those dates re-roll. A future
-- methodology change (e.g. push an author's book on their birthday) can simply
-- upsert a specific (pick_date, book_id) row — the stored pick always wins.
--
-- Service-role only: the picker and the admin API both use the service-role
-- client, which bypasses RLS. RLS is enabled with no policy so anon /
-- authenticated roles get nothing (advisor-clean). The picker treats a missing
-- table / empty result as "not frozen", so it is safe to deploy the code before
-- this migration is applied.

create table if not exists bluesky_daily_picks (
  pick_date   date primary key,
  book_id     bigint not null references books(id) on delete cascade,
  source      text not null default 'auto',
  created_at  timestamptz not null default now()
);

-- The skip action and any future "what dates use this book" lookups filter by
-- book_id; a small index keeps those cheap.
create index if not exists bluesky_daily_picks_book_id_idx
  on bluesky_daily_picks (book_id);

alter table bluesky_daily_picks enable row level security;

comment on table bluesky_daily_picks is
  'Frozen Bluesky banned-book-of-the-day plan: one row per UTC date pinning the '
  'chosen book so data edits no longer shift the rotation. Read/written by '
  'src/lib/bluesky-post.ts (write-on-read for present/future dates); skip action '
  'in /api/admin/bluesky-exclude deletes rows for a skipped book. '
  'source=auto (deterministic pick) | manual (editor override). '
  'Service-role only (RLS on, no policy).';
