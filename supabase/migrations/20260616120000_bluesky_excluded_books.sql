-- ----------------------------------------------------------------------------
-- bluesky_excluded_books
-- ----------------------------------------------------------------------------
--
-- Books an editor has manually removed from the Bluesky "banned book of the
-- day" rotation (via the /admin/bluesky "skip" button). The daily picker reads
-- this set and rerolls any date whose deterministic pick lands on an excluded
-- book, so excluding one title only changes that day — the rest of the queue
-- stays stable.
--
-- Service-role only: the picker and the admin API both use the service-role
-- client, which bypasses RLS. RLS is enabled with no policy so anon /
-- authenticated roles get nothing (advisor-clean). The picker treats a missing
-- table / empty result as "no exclusions", so it is safe to deploy the code
-- before this migration is applied.

create table if not exists bluesky_excluded_books (
  book_id     bigint primary key references books(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table bluesky_excluded_books enable row level security;

comment on table bluesky_excluded_books is
  'Books manually excluded from the Bluesky banned-book-of-the-day rotation. '
  'Read by src/lib/bluesky-post.ts; written by the /admin/bluesky skip/restore '
  'actions. Service-role only (RLS on, no policy).';
