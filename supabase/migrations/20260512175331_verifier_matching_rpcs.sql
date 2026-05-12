-- ============================================================================
-- Sprint A — Taak 3 / Commit 4 (companion migration)
-- Fuzzy-match RPCs for the import verifier.
--
-- The verifier (src/lib/imports/verifier.ts) calls these via supabase.rpc()
-- after an exact slug-lookup misses. pg_trgm similarity drives book + author
-- dimension matches; thresholds come from SOURCE_REGISTRY per source.
--
-- LIMIT 10 inside each function caps the candidate set for generic titles
-- ("The Trial", "Animal Farm") where many rows score above threshold. The
-- verifier may surface the candidates to the review queue, so a hard cap
-- keeps the JSON payload bounded.
--
-- Both functions are STABLE (same input → same output within a transaction)
-- and SECURITY INVOKER (no privilege escalation; the caller's RLS context
-- still applies — service-role key has full read).
--
-- pg_trgm and the trigram GIN indexes on books.title / authors.display_name
-- already exist (baseline migration §indexes). No extension/index work here.
-- ============================================================================


create or replace function find_book_candidates_by_title(
  q          text,
  threshold  real
)
returns table (
  id     bigint,
  title  text,
  slug   text,
  score  real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.id,
    b.title,
    b.slug,
    similarity(b.title, q) as score
  from books b
  where similarity(b.title, q) >= threshold
  order by score desc, b.id asc
  limit 10
$$;

comment on function find_book_candidates_by_title(text, real) is
  'Returns up to 10 books whose title has pg_trgm similarity >= threshold to q, score-descending. Used by src/lib/imports/verifier.ts after exact slug-lookup misses.';


create or replace function find_author_candidates_by_name(
  q          text,
  threshold  real
)
returns table (
  id            bigint,
  display_name  text,
  slug          text,
  score         real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    a.display_name,
    a.slug,
    similarity(a.display_name, q) as score
  from authors a
  where similarity(a.display_name, q) >= threshold
  order by score desc, a.id asc
  limit 10
$$;

comment on function find_author_candidates_by_name(text, real) is
  'Returns up to 10 authors whose display_name has pg_trgm similarity >= threshold to q, score-descending. Used by src/lib/imports/verifier.ts after exact slug-lookup misses.';
