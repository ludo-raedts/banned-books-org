-- /recently-added: the newest N books or authors with the country and source of
-- their first recorded ban. One call per ISR revalidate (24 h).
--
-- DISK-IO: the inner subquery sorts books/authors by created_at and keeps
-- p_limit rows (capped at 1000) BEFORE the lateral joins run, so the joins touch
-- at most 1000 rows. The sort itself is ~21k narrow rows — no temp spill.
-- Per-row lookups hit bans(book_id), ban_source_links(ban_id) and
-- book_authors(book_id) via their existing indexes/PKs.
--
-- "Source" = first source linked to the book's earliest ban. There is no batch
-- column; the page derives a batch as (added date, source).

CREATE FUNCTION public.recently_added(
    p_kind text,
    p_limit integer DEFAULT 500
) RETURNS TABLE (
    id bigint,
    slug text,
    title text,
    author_name text,
    author_slug text,
    country_code text,
    country_name text,
    country_slug text,
    source_name text,
    added_at timestamptz
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
  WITH lim AS (SELECT least(greatest(coalesce(p_limit, 500), 1), 1000) AS n),
  newest_books AS (
    SELECT b.id, b.slug, b.title, b.created_at
    FROM books b
    WHERE p_kind = 'books'
      AND NOT b.is_gated
      AND NOT b.is_blanket_works
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT (SELECT n FROM lim)
  ),
  newest_authors AS (
    SELECT a.id, a.slug, a.display_name AS title, a.created_at
    FROM authors a
    WHERE p_kind = 'authors'
      AND NOT coalesce(a.is_placeholder, false)
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT (SELECT n FROM lim)
  ),
  picked AS (
    SELECT nb.id, nb.slug, nb.title, nb.created_at, nb.id AS ref_book_id FROM newest_books nb
    UNION ALL
    SELECT na.id, na.slug, na.title, na.created_at, ab.book_id AS ref_book_id
    FROM newest_authors na
    LEFT JOIN LATERAL (
      SELECT ba.book_id
      FROM book_authors ba
      JOIN books bk ON bk.id = ba.book_id AND NOT bk.is_gated
      WHERE ba.author_id = na.id
      ORDER BY bk.id
      LIMIT 1
    ) ab ON true
  )
  SELECT p.id, p.slug, p.title,
         au.display_name AS author_name,
         au.slug AS author_slug,
         ban.country_code::text,
         c.name_en AS country_name,
         c.slug AS country_slug,
         src.source_name,
         p.created_at AS added_at
  FROM picked p
  LEFT JOIN LATERAL (
    SELECT a2.display_name, a2.slug
    FROM book_authors ba2
    JOIN authors a2 ON a2.id = ba2.author_id
    WHERE ba2.book_id = p.ref_book_id
    ORDER BY (ba2.role = 'author') DESC, a2.id
    LIMIT 1
  ) au ON p_kind = 'books'
  LEFT JOIN LATERAL (
    SELECT bn.id, bn.country_code
    FROM bans bn
    WHERE bn.book_id = p.ref_book_id
    ORDER BY bn.id
    LIMIT 1
  ) ban ON true
  LEFT JOIN countries c ON c.code = ban.country_code
  LEFT JOIN LATERAL (
    SELECT s.source_name
    FROM ban_source_links l
    JOIN ban_sources s ON s.id = l.source_id
    WHERE l.ban_id = ban.id
    ORDER BY s.id
    LIMIT 1
  ) src ON true
  ORDER BY p.created_at DESC, p.id DESC;
$$;

REVOKE ALL ON FUNCTION public.recently_added(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recently_added(text, integer) TO service_role;
