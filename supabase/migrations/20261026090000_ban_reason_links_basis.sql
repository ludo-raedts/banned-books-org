-- ============================================================================
-- ban_reason_links.basis — where a ban's reason comes from.
--
-- PEN America's index and the Magnusson database record where/when/how a book
-- was removed, never why; their importers link every ban to the placeholder
-- reason 'other'. scripts/enrich-reasons.ts later replaced most of those with
-- reasons an LLM inferred from the BOOK's themes (~21.5k PEN + ~1.9k Magnusson
-- bans). The site then rendered those as the ban's reason ("banned for its
-- LGBTQ+ content"), which no source states.
--
--   'inferred' — classified from the book's content, not stated for this ban
--   NULL       — as recorded by the source / importer (unchanged behaviour)
--
-- Backfilled by scripts/backfill-reason-basis.ts (data, not schema).
-- Disk-IO: ADD COLUMN with no default is a catalog-only change (no rewrite).
-- ============================================================================

ALTER TABLE "public"."ban_reason_links"
  ADD COLUMN IF NOT EXISTS "basis" text
  CONSTRAINT "ban_reason_links_basis_check" CHECK (basis IS NULL OR basis = 'inferred');

COMMENT ON COLUMN "public"."ban_reason_links"."basis" IS
  'inferred = classified from the book''s content (LLM), not stated by the ban''s source; NULL = as recorded by the source/importer.';
