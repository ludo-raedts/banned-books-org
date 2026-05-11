-- 020_repair_schema.sql — pure-additive repair of schema drift.
--
-- Background: most of the relational schema (link tables, vocabularies, all
-- product tables) was created directly in Supabase Studio without a
-- corresponding migration file. As of 2026-05-11 the production DB has 9
-- tables and 55 columns that were never declared in migrations 001-019.
--
-- This migration brings supabase/migrations/ in line with production by
-- creating the missing tables and adding the missing columns. It is:
--
--   - idempotent          (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
--   - non-destructive     (no DROP, no ALTER COLUMN TYPE)
--   - safe on production  (every statement is a no-op when production state
--                          already matches)
--
-- What is OUT OF SCOPE for this migration:
--   1. Reverse drift (8 columns declared in 001_initial_schema.sql that no
--      longer exist in production: authors.name, ban_sources.ban_id,
--      ban_sources.url, bans.country_id, books.author_id, countries.id/name/
--      created_at). They stay as dead columns on a fresh dev DB. Cleanup is
--      a Sprint B task in a clearly-marked 099_cleanup_legacy_columns.sql.
--   2. Type changes on legacy PK columns (books.id, authors.id, bans.id,
--      ban_sources.id were declared as uuid in 001 but are bigint identity
--      in production). The diagnostic does not detect type drift; a fresh
--      dev DB will have uuid PKs and the app will not work against it.
--      A separate migration must address this — it requires destructive
--      DDL and is intentionally out of scope here.
--
-- Generated initially by scripts/diagnose-schema-drift.ts on 2026-05-11
-- then hand-augmented per docs/sprint-a/step-0-findings.md.

-- ════════════════════════════════════════════════════════════════════════
-- 1. EXTENSIONS — finding #6
-- ════════════════════════════════════════════════════════════════════════
-- The production schema silently depends on these. Without them, embeddings
-- (news_items.embedding), search (pg_trgm indexes), and slug backfill
-- (unaccent) all fail with cryptic "function does not exist" errors.

CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ════════════════════════════════════════════════════════════════════════
-- 2. SLUG HELPER — finding #1
-- ════════════════════════════════════════════════════════════════════════
-- Mirrors the corrected slugify() in src/lib/imports/slugify.ts: strip
-- combining marks via unaccent(), lowercase, drop apostrophes, collapse
-- non-alphanumerics to hyphens, trim. Idempotent; safe to re-create.

CREATE OR REPLACE FUNCTION app_slugify(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(s, ''))),
        $regex$['` ]$regex$, '', 'g'
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  )
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. UNDECLARED TABLES — 9 tables that exist in production but have no
--    CREATE TABLE statement in any migration.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reasons (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug      text NOT NULL,
  label_en  text NOT NULL,
  description text,
  CONSTRAINT reasons_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS scopes (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug      text NOT NULL,
  label_en  text NOT NULL,
  CONSTRAINT scopes_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS book_authors (
  book_id   bigint NOT NULL,
  author_id bigint NOT NULL,
  role      text DEFAULT 'author',
  PRIMARY KEY (book_id, author_id),
  CONSTRAINT book_authors_book_id_fkey   FOREIGN KEY (book_id)   REFERENCES books(id)   ON DELETE CASCADE,
  CONSTRAINT book_authors_author_id_fkey FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ban_reason_links (
  ban_id    bigint NOT NULL,
  reason_id bigint NOT NULL,
  PRIMARY KEY (ban_id, reason_id),
  CONSTRAINT ban_reason_links_ban_id_fkey    FOREIGN KEY (ban_id)    REFERENCES bans(id)    ON DELETE CASCADE,
  CONSTRAINT ban_reason_links_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES reasons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ban_source_links (
  ban_id    bigint NOT NULL,
  source_id bigint NOT NULL,
  locator   text,
  PRIMARY KEY (ban_id, source_id),
  CONSTRAINT ban_source_links_ban_id_fkey    FOREIGN KEY (ban_id)    REFERENCES bans(id)         ON DELETE CASCADE,
  CONSTRAINT ban_source_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES ban_sources(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affiliate_partners (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug            text NOT NULL,
  name            text NOT NULL,
  url_template    text,
  commission_pct  numeric(4, 2),
  active          boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT now(),
  CONSTRAINT affiliate_partners_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS purchase_links (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id         bigint NOT NULL,
  partner_id      bigint,
  country_code    character(2),
  format_type     text DEFAULT 'print',
  url             text NOT NULL,
  is_affiliate    boolean DEFAULT false,
  priority        smallint DEFAULT 10,
  active          boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_links_book_id_fkey    FOREIGN KEY (book_id)    REFERENCES books(id)              ON DELETE CASCADE,
  CONSTRAINT purchase_links_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES affiliate_partners(id) ON DELETE NO ACTION
);

CREATE TABLE IF NOT EXISTS news_items (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title             text NOT NULL,
  source_name       text NOT NULL,
  source_url        text NOT NULL,
  published_at      timestamp with time zone,
  fetched_at        timestamp with time zone DEFAULT now(),
  summary           text,
  status            text DEFAULT 'draft',
  published_week    date,
  created_at        timestamp with time zone DEFAULT now(),
  embedding         vector(1536),
  auto_published    boolean NOT NULL DEFAULT false,
  source_language   character(2) NOT NULL DEFAULT 'en',
  original_title    text,
  original_summary  text,
  CONSTRAINT news_items_source_url_key UNIQUE (source_url),
  CONSTRAINT news_items_status_check CHECK (status IN ('draft', 'published', 'rejected'))
);

CREATE TABLE IF NOT EXISTS pageviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path          text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     bigint NOT NULL,
  country       text,
  referrer_host text,
  viewed_at     timestamp with time zone DEFAULT now(),
  visitor_hash  text,
  CONSTRAINT pageviews_entity_type_check CHECK (entity_type IN ('book', 'author'))
);

-- ════════════════════════════════════════════════════════════════════════
-- 4. MISSING COLUMNS ON DECLARED TABLES
-- ════════════════════════════════════════════════════════════════════════
-- Three-step pattern for NOT NULL columns:
--   step 1: ADD COLUMN IF NOT EXISTS y type [DEFAULT expr];   (nullable)
--   step 2: UPDATE x SET y = <backfill> WHERE y IS NULL;       (backfill — no-op on prod)
--   step 3: ALTER TABLE x ALTER COLUMN y SET NOT NULL;         (enforce)
--
-- On production: step 1 is no-op (column exists), step 2 is no-op (no NULL
-- rows), step 3 is no-op (already NOT NULL).
-- On fresh dev DB: tables are empty, step 2 matches no rows, step 3 succeeds.

-- ── authors ─────────────────────────────────────────────
ALTER TABLE authors ADD COLUMN IF NOT EXISTS slug text;
UPDATE authors SET slug = app_slugify(display_name)
  WHERE slug IS NULL AND display_name IS NOT NULL;
ALTER TABLE authors ALTER COLUMN slug SET NOT NULL;

ALTER TABLE authors ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE authors ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE authors ADD COLUMN IF NOT EXISTS birth_year     smallint;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS death_year     smallint;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS birth_country  text;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS photo_url      text;

-- ── bans ─────────────────────────────────────────────
ALTER TABLE bans ADD COLUMN IF NOT EXISTS country_code  character(2);
ALTER TABLE bans ALTER COLUMN country_code SET NOT NULL;

ALTER TABLE bans ADD COLUMN IF NOT EXISTS scope_id      bigint;
ALTER TABLE bans ALTER COLUMN scope_id SET NOT NULL;

ALTER TABLE bans ADD COLUMN IF NOT EXISTS region         text;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS institution    text;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS year_started   smallint;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS year_ended     smallint;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS actor          text;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS description    text;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS confidence     text DEFAULT 'reported';

-- ── ban_sources ─────────────────────────────────────────────
ALTER TABLE ban_sources ADD COLUMN IF NOT EXISTS source_url   text;
ALTER TABLE ban_sources ALTER COLUMN source_url SET NOT NULL;

-- UNIQUE on source_url: idempotent — adds the constraint only if it doesn't
-- already exist. No-op on production where the constraint is already there;
-- needed on a fresh dev DB so it has the same bug-profile as production.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ban_sources_source_url_key'
      AND conrelid = 'public.ban_sources'::regclass
  ) THEN
    ALTER TABLE ban_sources ADD CONSTRAINT ban_sources_source_url_key UNIQUE (source_url);
  END IF;
END $$;

ALTER TABLE ban_sources ADD COLUMN IF NOT EXISTS source_type  text;
ALTER TABLE ban_sources ADD COLUMN IF NOT EXISTS accessed_at  date;

-- ── books ─────────────────────────────────────────────
ALTER TABLE books ADD COLUMN IF NOT EXISTS slug text;
UPDATE books SET slug = app_slugify(title)
  WHERE slug IS NULL AND title IS NOT NULL;
ALTER TABLE books ALTER COLUMN slug SET NOT NULL;

ALTER TABLE books ADD COLUMN IF NOT EXISTS original_language    character(2);
-- Default existing rows to English to match the post-hoc Studio convention.
UPDATE books SET original_language = 'en' WHERE original_language IS NULL;

ALTER TABLE books ADD COLUMN IF NOT EXISTS first_published_year smallint;
ALTER TABLE books ADD COLUMN IF NOT EXISTS description          text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn13               text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS openlibrary_work_id  text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url            text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS ai_drafted           boolean DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS gutenberg_id         integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS description_book     text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS description_ban      text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS censorship_context   text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_checked_at     timestamp with time zone;
ALTER TABLE books ADD COLUMN IF NOT EXISTS warning_level        text DEFAULT 'none';
ALTER TABLE books ALTER COLUMN warning_level SET NOT NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS inclusion_rationale  text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS extended_context     text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS bookshop_checked_at  timestamp with time zone;
-- Note: production has `genres text[] not null default '{}'` from migration
-- 002. Already declared, not repeated here.

-- ── countries ─────────────────────────────────────────────
ALTER TABLE countries ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE countries ALTER COLUMN name_en SET NOT NULL;

ALTER TABLE countries ADD COLUMN IF NOT EXISTS slug text;
UPDATE countries SET slug = app_slugify(name_en)
  WHERE slug IS NULL AND name_en IS NOT NULL;
ALTER TABLE countries ALTER COLUMN slug SET NOT NULL;
