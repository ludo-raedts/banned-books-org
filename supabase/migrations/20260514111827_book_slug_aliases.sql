-- ----------------------------------------------------------------------------
-- book_slug_aliases
-- ----------------------------------------------------------------------------
--
-- Stores additional slugs that should resolve to a canonical book. Used by
-- the /books/[slug] route to 301-redirect alias URLs to the canonical URL.
--
-- Why a separate table instead of computed slug-lookup:
--   - PK index on slug gives O(1) alias resolution per request.
--   - Explicit conflict handling: we INSERT once at commit/backfill time
--     and let PK uniqueness reject ambiguous aliases up-front.
--   - Survives later edits to books.title_english_meaningful etc. — the
--     alias keeps redirecting even if the source field changes.
--
-- Backfill source (Phase 3c) populates from slugify(title_english_meaningful)
-- and slugify(title_native) where they differ from books.slug AND no other
-- book already owns that slug. Going-forward, the commit path
-- (review-commit.ts) inserts alias rows for any non-canonical title variant.

create table if not exists book_slug_aliases (
  slug        text primary key,
  book_id     bigint not null references books(id) on delete cascade,
  source      text not null,   -- 'title_english_meaningful' | 'title_native' | 'title_transliterated' | 'manual' | 'legacy_slug'
  created_at  timestamptz not null default now()
);

create index if not exists book_slug_aliases_book_id_idx
  on book_slug_aliases(book_id);

comment on table book_slug_aliases is
  'Non-canonical slugs that 301-redirect to a book''s canonical /books/<slug>. '
  'Resolved by the public route handler when an inbound slug does not match '
  'books.slug directly. Aliases never overlap with any books.slug — that '
  'invariant is enforced at insert time by the populating code.';

comment on column book_slug_aliases.source is
  'Which book field (or "manual"/"legacy_slug") produced this alias. Telemetry '
  'only — does not affect resolution.';
