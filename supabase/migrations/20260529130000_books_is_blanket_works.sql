-- "Blanket-works" bans: list entries like the Liste Otto's
-- "Toutes ses œuvres" (= ALL works of an author were banned) are modelled
-- as a single pseudo-book per author, because bans.book_id is NOT NULL and
-- there is no author-level ban path. These rows are not real titles, so the
-- book-content enrichment pipelines (descriptions, covers, …) can never
-- resolve a source for them and would retry forever, emitting "NO SOURCE"
-- noise every run. This flag lets those pipelines skip them permanently.

alter table public.books
  add column is_blanket_works boolean not null default false;

-- Backfill existing Liste Otto blanket entries.
update public.books
   set is_blanket_works = true
 where title ilike 'Toutes ses œuvres%';
