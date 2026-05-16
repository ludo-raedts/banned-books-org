-- "Anonymous" / "Unknown" / "Various" placeholder-author records
-- aggregate unrelated books and skew SEO surfaces:
--   - Homepage "most banned author" highlight (Anonymous = 6th currently)
--   - Person JSON-LD on /authors/anonymous (claims a 22-book oeuvre)
--   - Direct-answer lead ("Anonymous has 22 books banned in 8 countries")
--   - Author OG card ("22 books · 24 bans across 8 countries")
--
-- None of those represent reality — Anonymous is not a person, it's a
-- bucket. Flag the records so consumers can opt-out of treating them as
-- entities for ranking/SEO purposes. Catalogue navigation
-- (/authors/anonymous, "More books by Anonymous" chips on book detail)
-- stays untouched — anonymously-authored books are still legitimate
-- catalogue entries, just not author-attributable for promotional copy.
--
-- Sweep the placeholder vocabulary in one go. The current corpus only
-- contains "Anonymous" (id=33), but future imports could introduce
-- "Various", "Unknown", "Uncredited" etc.; the bulk WHERE saves a
-- separate migration when that happens.

alter table public.authors
  add column if not exists is_placeholder boolean not null default false;

update public.authors set is_placeholder = true
  where lower(trim(display_name)) in (
    'anonymous',
    'anon',
    'unknown',
    'various',
    'various authors',
    'uncredited',
    'no author',
    'author unknown',
    'n/a',
    'na'
  );

comment on column public.authors.is_placeholder is
  'Marks generic Anonymous/Unknown/Various entries that aggregate unrelated books. Excluded from highlight aggregates, SEO leads, Person JSON-LD, and OG ban-summary lines on author detail.';

-- Partial index for the common query "list authors, exclude placeholders".
create index if not exists authors_real_idx on public.authors (id)
  where is_placeholder = false;
