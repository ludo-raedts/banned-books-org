-- Resolve duplicate `bans` rows that collide on
--   (book_id, country_code, year_started, scope_id)
-- by merging losers into the lowest-id row (the oldest insert), then
-- add a UNIQUE constraint so the merge endpoint and importer can rely
-- on ON CONFLICT for idempotency.
--
-- Strategy per duplicate group (option 1, "keep-oldest-merge-sources"):
--   1. Winner = MIN(id) within the group.
--   2. Move source-links from losers → winner with ON CONFLICT preserving
--      the winner's existing locator (so we don't accidentally rewrite a
--      reviewer's edit with a duplicate-import locator).
--   3. Move reason-links from losers → winner, ON CONFLICT DO NOTHING.
--   4. Backfill nullable scalar fields on the winner from the FIRST loser
--      (in id order) where the winner currently has NULL.
--   5. DELETE the losers; remaining ban_*_links rows on losers are removed
--      by the existing ON DELETE CASCADE constraint.
--
-- Generic over data shape: locally this resolves 10 known pairs; in prod
-- it resolves whatever duplicates exist when the migration runs (could be 0).

BEGIN;

DO $$
DECLARE
  dup RECORD;
  winner_id BIGINT;
  loser_ids BIGINT[];
  losers_merged INT := 0;
  groups_processed INT := 0;
BEGIN
  FOR dup IN
    SELECT
      book_id,
      country_code,
      year_started,
      scope_id,
      array_agg(id ORDER BY id) AS ids
    FROM bans
    GROUP BY book_id, country_code, year_started, scope_id
    HAVING count(*) > 1
  LOOP
    winner_id := dup.ids[1];
    loser_ids := dup.ids[2:array_length(dup.ids, 1)];
    groups_processed := groups_processed + 1;

    -- 2. Re-link sources to winner. Preserve winner's locator on conflict.
    INSERT INTO ban_source_links (ban_id, source_id, locator)
    SELECT winner_id, source_id, locator
    FROM ban_source_links
    WHERE ban_id = ANY(loser_ids)
    ON CONFLICT (ban_id, source_id)
    DO UPDATE SET locator = COALESCE(ban_source_links.locator, EXCLUDED.locator);

    -- 3. Re-link reasons to winner.
    INSERT INTO ban_reason_links (ban_id, reason_id)
    SELECT winner_id, reason_id
    FROM ban_reason_links
    WHERE ban_id = ANY(loser_ids)
    ON CONFLICT (ban_id, reason_id) DO NOTHING;

    -- 4. Backfill winner's NULL fields from the first loser (by id).
    UPDATE bans w
    SET
      region      = COALESCE(w.region,      l.region),
      institution = COALESCE(w.institution, l.institution),
      year_ended  = COALESCE(w.year_ended,  l.year_ended),
      actor       = COALESCE(w.actor,       l.actor),
      description = COALESCE(w.description, l.description)
    FROM (
      SELECT region, institution, year_ended, actor, description
      FROM bans
      WHERE id = loser_ids[1]
    ) l
    WHERE w.id = winner_id;

    -- 5. Delete losers (CASCADE removes their remaining links).
    DELETE FROM bans WHERE id = ANY(loser_ids);

    losers_merged := losers_merged + array_length(loser_ids, 1);

    RAISE NOTICE 'Group (book=%, cc=%, year=%, scope=%): kept %, merged % loser(s)',
      dup.book_id, dup.country_code, dup.year_started, dup.scope_id,
      winner_id, array_length(loser_ids, 1);
  END LOOP;

  RAISE NOTICE 'Total: % group(s) processed, % loser ban(s) removed',
    groups_processed, losers_merged;
END $$;

-- Final consistency check: no duplicates may remain.
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT count(*) INTO remaining FROM (
    SELECT 1 FROM bans
    GROUP BY book_id, country_code, year_started, scope_id
    HAVING count(*) > 1
  ) s;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % duplicate group(s) still present', remaining;
  END IF;
END $$;

-- With duplicates resolved, enforce the constraint going forward.
-- NULLs in year_started are still treated as distinct (Postgres default),
-- which is desirable: two "unknown-year" bans for the same book+country+scope
-- can coexist if both are intentional.
ALTER TABLE bans
  ADD CONSTRAINT bans_unique_per_scope
  UNIQUE (book_id, country_code, year_started, scope_id);

COMMENT ON CONSTRAINT bans_unique_per_scope ON bans IS
  'Prevents duplicate bans for the same (book, country, year_started, scope). NULL year_started values are treated as distinct.';

COMMIT;
