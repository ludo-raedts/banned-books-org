-- Authors ranked by total documented bans across all their books.
-- Used by the homepage HighlightsStrip ("Most banned author").
-- Mirrors the entity_id/views shape of the v_top_*_all_time views,
-- though the metric here is bans rather than pageviews.

CREATE OR REPLACE VIEW v_top_banned_authors AS
SELECT
  ba.author_id          AS entity_id,
  COUNT(bn.id)::bigint  AS total_bans,
  COUNT(DISTINCT b.id)::bigint AS banned_books
FROM book_authors ba
JOIN books b ON b.id = ba.book_id
JOIN bans  bn ON bn.book_id = b.id
GROUP BY ba.author_id
ORDER BY total_bans DESC
LIMIT 100;
