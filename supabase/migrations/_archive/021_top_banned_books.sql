-- Books ranked by total documented bans.
-- Used by the homepage HighlightsStrip ("Most banned book") so we can
-- avoid loading every book into the SSR process just to sort by bans.length.
-- Mirrors the entity_id shape of v_top_banned_authors (011).

CREATE OR REPLACE VIEW v_top_banned_books AS
SELECT
  bn.book_id           AS entity_id,
  COUNT(bn.id)::bigint AS total_bans
FROM bans bn
GROUP BY bn.book_id
ORDER BY total_bans DESC
LIMIT 100;
