-- ----------------------------------------------------------------------------
-- authors: birth month/day + birthday-feature flag
-- ----------------------------------------------------------------------------
--
-- The `authors` table already stores `birth_year`, but not the month/day needed
-- to push an author's banned book on their birthday (a planned Bluesky
-- "book-of-the-day" relevance lever). We add precise month/day (kept separate
-- from birth_year, since many authors only have a year on record — a single
-- `date` column couldn't represent year-only) plus a curation flag marking the
-- ~30 authors whose birthday actually triggers a push, so the broad rotation
-- isn't crowded out.
--
-- birth_month / birth_day are filled from Wikidata P569 (CC-0), namesake-guarded
-- against the existing birth_year — see scripts/enrich-author-birthdays.ts.

alter table authors add column if not exists birth_month smallint
  check (birth_month between 1 and 12);
alter table authors add column if not exists birth_day smallint
  check (birth_day between 1 and 31);
alter table authors add column if not exists birthday_featured boolean not null default false;

comment on column authors.birth_month is
  'Month of birth (1-12) from Wikidata P569. Paired with birth_day for the '
  'Bluesky birthday-push feature. Year-only authors leave this null.';
comment on column authors.birth_day is
  'Day of birth (1-31) from Wikidata P569. See birth_month.';
comment on column authors.birthday_featured is
  'True for the curated set of authors whose birthday triggers a Bluesky '
  'book-of-the-day push (keeps the override to ~30 so the broad rotation '
  'is not crowded out). Set by scripts/enrich-author-birthdays.ts --feature.';

-- The push looks up "featured authors whose birthday is today" — a partial index
-- on (month, day) over only the featured rows keeps that lookup trivial.
create index if not exists authors_birthday_featured_idx
  on authors (birth_month, birth_day)
  where birthday_featured;
