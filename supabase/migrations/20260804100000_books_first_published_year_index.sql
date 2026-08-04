-- Index on books.first_published_year to support year-range filters.
--
-- /banned-classics step 1 runs
--   select id from books
--    where first_published_year < 1970 and first_published_year is not null
--    order by id
-- With no supporting index this full-scans the (now ~20k-row) books table:
-- ~4.7s for a single 1000-row page. During `next build` the page is prerendered
-- while 3 workers hammer Supabase concurrently, so that 4.7s tips past the 8s
-- statement_timeout (57014) and fails the whole deploy. Catalogue growth crossed
-- the tipping point; the query itself is unchanged.
--
-- A partial btree (excluding the many NULL-year rows — foreign imports, undated
-- titles) is small (~200KB over ~5k non-null rows) and drops step 1 to ~0.1s.
-- Single-column btree on occasional-write table: no temp-spill / Disk-IO risk.

begin;

create index if not exists idx_books_first_published_year
  on public.books (first_published_year)
  where first_published_year is not null;

commit;
