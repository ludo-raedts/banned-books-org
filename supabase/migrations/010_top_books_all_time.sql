-- All-time top books by pageviews. Used by the homepage HighlightsStrip ("Most read all-time").
-- Mirrors the shape of v_top_books_this_week so client code can swap views easily.
-- Capped at 100 rows; pageviews stays modest because of the cleanup-pageviews cron.

CREATE OR REPLACE VIEW v_top_books_all_time AS
SELECT
  entity_id,
  COUNT(*)::bigint AS views
FROM pageviews
WHERE entity_type = 'book'
GROUP BY entity_id
ORDER BY views DESC
LIMIT 100;

CREATE OR REPLACE VIEW v_top_authors_all_time AS
SELECT
  entity_id,
  COUNT(*)::bigint AS views
FROM pageviews
WHERE entity_type = 'author'
GROUP BY entity_id
ORDER BY views DESC
LIMIT 100;
