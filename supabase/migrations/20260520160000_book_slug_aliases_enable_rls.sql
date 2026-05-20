-- Enable RLS on book_slug_aliases. The original migration
-- (20260514111827_book_slug_aliases) created the table without RLS, leaving
-- it readable AND writable by the anon key — Supabase advisor flagged it
-- as rls_disabled_in_public on 2026-05-17. A bad actor with the project URL
-- could poison alias rows and redirect /books/<popular-slug> to the wrong
-- book_id.
--
-- All real access to this table runs through adminClient() (service_role),
-- which bypasses RLS, so no SELECT/INSERT policies are needed:
--   - src/app/books/[slug]/page.tsx  (alias → canonical 308 lookup)
--   - src/lib/imports/review-commit.ts, review-approve.ts
--   - scripts/backfill-slug-aliases.ts, merge-*.ts
-- Anon clients never query book_slug_aliases directly.

alter table "public"."book_slug_aliases" enable row level security;
