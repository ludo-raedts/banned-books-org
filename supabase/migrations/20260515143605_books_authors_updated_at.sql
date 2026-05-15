-- Add `updated_at` to `books` and `authors` so the sitemap can emit an
-- accurate <lastmod> per entity, which in turn makes the IndexNow delta
-- endpoint (api/admin/indexnow-delta) re-submit only URLs that actually
-- changed since the previous submission. Without an updated_at column the
-- sitemap had to fall back to created_at, which never moves after the
-- initial insert — so cover/description enrichment, slug-alias additions,
-- bio fills etc. were all invisible to crawlers.
--
-- Design:
--   - Default value `now()` so any INSERT without an explicit timestamp gets
--     a sensible mark.
--   - For existing rows: initialise to created_at, not now(), so the first
--     post-migration sitemap snapshot matches the historical reality (no
--     fake "everything just changed" signal that would cost us a re-crawl
--     burst).
--   - A BEFORE UPDATE trigger bumps the column on every UPDATE. Using a
--     trigger (rather than relying on application code to set it) means
--     downstream callers — psql, the Supabase Studio, ad-hoc scripts, the
--     enrichment pipeline — all get the bump for free without needing a
--     coordinated change.

-- ── books.updated_at ────────────────────────────────────────────────────────
alter table public.books
  add column if not exists updated_at timestamptz not null default now();

update public.books
  set updated_at = created_at
  where updated_at >= created_at - interval '1 second'  -- only freshly-added rows
    and updated_at <= now();
-- The condition above is a no-op safety net: if the migration runs twice
-- (idempotency for `add column if not exists`), the second run will skip
-- rows whose updated_at has drifted past created_at via real UPDATE traffic.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row
  execute function public.set_updated_at();

-- ── authors.updated_at ──────────────────────────────────────────────────────
alter table public.authors
  add column if not exists updated_at timestamptz not null default now();

update public.authors
  set updated_at = created_at
  where updated_at >= created_at - interval '1 second'
    and updated_at <= now();

drop trigger if exists authors_set_updated_at on public.authors;
create trigger authors_set_updated_at
  before update on public.authors
  for each row
  execute function public.set_updated_at();

-- Index to support sitemap pagination by lastmod for future IndexNow
-- "books changed since timestamp X" lookups.
create index if not exists books_updated_at_idx on public.books (updated_at desc);
create index if not exists authors_updated_at_idx on public.authors (updated_at desc);
