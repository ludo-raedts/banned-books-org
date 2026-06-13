-- ----------------------------------------------------------------------------
-- author_slug_aliases
-- ----------------------------------------------------------------------------
--
-- Mirror of book_slug_aliases (20260514111827) for the /authors/[slug] route.
-- Stores additional slugs that should resolve to a canonical author, so an
-- old or merged-away slug 301-redirects to the survivor's canonical URL
-- instead of 404-ing.
--
-- First use: the V. S. Naipaul author merge (scripts/merge-vs-naipaul-authors.ts)
-- folds duplicate author #8048 (slug 'v-s-naipaul') into canonical #172
-- (slug 'vs-naipaul') and inserts the dropped slug here so the old URL keeps
-- resolving. Going forward, any author merge / slug change should add a row.
--
-- Why a separate table instead of computed slug-lookup (same rationale as
-- book_slug_aliases): PK index on slug gives O(1) resolution; PK uniqueness
-- rejects ambiguous aliases at insert time; the alias survives later edits to
-- the author's display_name.

create table if not exists author_slug_aliases (
  slug        text primary key,
  author_id   bigint not null references authors(id) on delete cascade,
  source      text not null,   -- 'merge' | 'manual' | 'legacy_slug'
  created_at  timestamptz not null default now()
);

create index if not exists author_slug_aliases_author_id_idx
  on author_slug_aliases(author_id);

comment on table author_slug_aliases is
  'Non-canonical slugs that 301-redirect to an author''s canonical /authors/<slug>. '
  'Resolved by the public route handler when an inbound slug does not match '
  'authors.slug directly. Aliases never overlap with any authors.slug — that '
  'invariant is enforced at insert time by the populating code.';

comment on column author_slug_aliases.source is
  'What produced this alias ("merge"/"manual"/"legacy_slug"). Telemetry only — '
  'does not affect resolution.';
