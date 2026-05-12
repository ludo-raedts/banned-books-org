-- ============================================================================
-- Sprint A — Taak 2 / Migratie B
-- Backfill van Model 3-kolommen op books en verification_status op ban_sources.
--
-- This migration is PURELY DATA: bestaande rijen worden gewijzigd.
--   - Geen ALTER TABLE / CREATE TABLE / CREATE INDEX
--   - Geen wijzigingen aan schema-shape
--   - Alle UPDATEs zijn idempotent (WHERE-clauses voorkomen herhaalde writes)
--
-- Voorvereisten:
--   - Migratie A (20260512074200_model3_and_import_queue) is toegepast
--   - Productie-data lokaal geseed via scripts/seed-local-from-prod.ts
--     vóór `supabase db reset` (anders raakt deze migratie 0 rijen lokaal
--     en is "applies cleanly" geen bewijs van correctheid)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ban_sources — verification_status backfill
-- ----------------------------------------------------------------------------

-- Step 1a: rijen met [archive pending] suffix → 'pending' + strip suffix.
update ban_sources
   set verification_status = 'pending',
       source_name = regexp_replace(source_name, ' \[archive pending\]$', '')
 where source_name like '% [archive pending]'
   and verification_status is null;

-- Step 1b: alle overige rijen zonder verification_status → 'unverified'.
update ban_sources
   set verification_status = 'unverified'
 where verification_status is null;


-- ----------------------------------------------------------------------------
-- 2. books — Model 3 backfill voor Engelstalige originelen
-- ----------------------------------------------------------------------------

update books
   set title_native = title,
       title_native_script = 'latin'
 where original_language = 'en'
   and title_native is null;


-- ----------------------------------------------------------------------------
-- 3. books — Model 3 backfill voor Franse originelen
-- ----------------------------------------------------------------------------

update books
   set title_native = title,
       title_native_script = 'latin'
 where original_language = 'fr'
   and title_native is null;


-- ----------------------------------------------------------------------------
-- Andere talen worden NIET geraakt door deze migratie.
-- ----------------------------------------------------------------------------
