-- ----------------------------------------------------------------------------
-- 1. Enable RLS on author_slug_aliases  (Supabase advisor: rls_disabled_in_public, CRITICAL)
-- ----------------------------------------------------------------------------
--
-- The original migration (20260613110000_author_slug_aliases) created the table
-- without RLS, leaving it readable AND writable by the anon key. This mirrors
-- the exact same gap that was already fixed for book_slug_aliases in
-- 20260520160000_book_slug_aliases_enable_rls — that follow-up was just never
-- repeated for the author mirror. A bad actor with the project URL could poison
-- alias rows and 301-redirect /authors/<popular-slug> to the wrong author_id.
--
-- All real access to this table runs through adminClient() (service_role),
-- which bypasses RLS, so no SELECT/INSERT policies are needed:
--   - src/app/authors/[slug]/page.tsx  (alias -> canonical 308 lookup)
--   - scripts/merge-*.ts  (author merges inserting alias rows)
-- Anon clients never query author_slug_aliases directly.

alter table "public"."author_slug_aliases" enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Drop duplicate indexes  (Supabase Performance Advisor: duplicate_index, WARN)
-- ----------------------------------------------------------------------------
--
-- The baseline dump (20260511150851_baseline) emitted, for several tables, a
-- standalone index identical to the one already backing a UNIQUE/PRIMARY KEY
-- constraint. The constraint-backed index is load-bearing (enforces uniqueness)
-- and must stay; the standalone duplicate is pure redundancy — wasted disk +
-- cache and doubled write-maintenance cost. We drop only the standalone copies.
--
-- Plain DROP INDEX (not CONCURRENTLY) because this file runs in a transaction;
-- DROP is fast and the ACCESS EXCLUSIVE lock is momentary. Still, prefer to
-- apply this when the database is not under load.
--
--   authors    : keep authors_slug_key  (UNIQUE constraint on slug)  -> drop idx_authors_slug
--   books      : keep books_slug_key     (UNIQUE constraint on slug)  -> drop idx_books_slug
--   countries  : keep countries_pkey     (PRIMARY KEY on code)        -> drop idx_countries_code
--   pageviews  : two identical hand indexes on (entity_type, entity_id),
--                neither backs a constraint -> keep idx_pageviews_entity,
--                drop idx_pageviews_entity_type_id

drop index if exists "public"."idx_authors_slug";
drop index if exists "public"."idx_books_slug";
drop index if exists "public"."idx_countries_code";
drop index if exists "public"."idx_pageviews_entity_type_id";
