-- Extend the bans UNIQUE constraint to include (region, institution).
--
-- Context. The original constraint (20260514151511) was scoped to
--   (book_id, country_code, year_started, scope_id)
-- because at the time every ban was an aggregate: one row per
-- (book × country × year × scope), no sub-jurisdiction. PEN America's
-- 2024-25 dataset breaks that assumption — it tracks bans at school-district
-- granularity, so "Beloved" can be banned in 17 Florida districts in the same
-- year and we want 17 distinct rows.
--
-- New constraint includes `region` (state-equivalent) and `institution`
-- (district / school / library system). NULLS NOT DISTINCT keeps the original
-- aggregate-collision behaviour: two rows with NULL region AND NULL institution
-- for the same (book, country, year, scope) still collide, so we can't
-- accidentally create duplicate aggregate placeholders.
--
-- The 552 April-2026 PEN-seed bans (all with NULL region/institution) coexist
-- happily with the new granular rows because they differ on region/institution.
-- A separate `--cleanup-aggregates` pass on the importer can later collapse
-- those aggregates into their granular siblings.
--
-- Requires Postgres 15+ for NULLS NOT DISTINCT. Supabase runs Postgres 15.x
-- by default, so this is safe.

BEGIN;

ALTER TABLE bans
  DROP CONSTRAINT bans_unique_per_scope;

ALTER TABLE bans
  ADD CONSTRAINT bans_unique_per_scope
  UNIQUE NULLS NOT DISTINCT
  (book_id, country_code, year_started, scope_id, region, institution);

COMMENT ON CONSTRAINT bans_unique_per_scope ON bans IS
  'Prevents duplicate bans for the same (book, country, year, scope, region, institution). Aggregate rows (NULL region/institution) are still unique-per-tuple via NULLS NOT DISTINCT — two NULL/NULL aggregates for the same book+country+year+scope still collide. Granular rows with non-NULL region+institution coexist alongside any aggregate.';

COMMIT;
