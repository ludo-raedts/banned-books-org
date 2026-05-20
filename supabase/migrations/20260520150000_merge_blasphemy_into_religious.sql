-- Merge the `blasphemy` reason into `religious`.
--
-- Audit on 2026-05-20: 672 religious bans vs 69 blasphemy bans; 58 of the 69
-- blasphemy links (84%) already coexist with religious on the same ban. The
-- 11 blasphemy-only rows are inconsistently labelled (e.g. Decameron on the
-- Index Librorum, Satanic Verses in KW/LK/TH) — they should be religious too.
-- Conceptually blasphemy is a legal mechanism, not a distinct motivation,
-- and the /reasons/blasphemy page text already framed it that way.

DO $$
DECLARE
  rel_id bigint;
  bla_id bigint;
BEGIN
  SELECT id INTO rel_id FROM reasons WHERE slug = 'religious';
  SELECT id INTO bla_id FROM reasons WHERE slug = 'blasphemy';

  IF bla_id IS NULL THEN
    RAISE NOTICE 'blasphemy reason not present, nothing to do';
    RETURN;
  END IF;
  IF rel_id IS NULL THEN
    RAISE EXCEPTION 'religious reason missing — refusing to merge';
  END IF;

  -- Promote every blasphemy link to religious; the 58 already-religious bans
  -- are skipped by the (ban_id, reason_id) primary key on conflict.
  INSERT INTO ban_reason_links (ban_id, reason_id)
  SELECT ban_id, rel_id
  FROM ban_reason_links
  WHERE reason_id = bla_id
  ON CONFLICT (ban_id, reason_id) DO NOTHING;

  DELETE FROM ban_reason_links WHERE reason_id = bla_id;
  DELETE FROM reasons WHERE id = bla_id;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_country_reason_counts;
