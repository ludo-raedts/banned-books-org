# Data corrections 2026-11-15 — evidence and decisions

Script: `scripts/fix-data-errors-2026-11-15.ts` (dry-run default). Old values, links and every deleted row
are in `2026-11-15-data-errors-backup.json` (taken before the first write). Origin: the Google-core
source sample of 2026-11-15 (32 dossiers; 0 ban rows contradicted, 3 books with demonstrable errors).

## lenin-charasch (book 22511) — wrong work, corrected
Evidence
- `description_source_url` = https://openlibrary.org/works/OL3473223W = Abraham Resnick, "Lenin", first published
  1987, subjects "Juvenile literature". Our blurb is that Open Library description verbatim.
- `isbn13` 9780516032603 = Resnick, "Lenin", Childrens Press, 1987 (Open Library ISBN record).
- The cover was the Google Books cover for that ISBN.
- The ban is real and untouched: Charasch, "Lenin", Orell Füssli, Zürich 1920, is in the live Berlin list
  (berlin.de/verbannte-buecher/suche/?q=Charasch); year 1938 is the list edition.
Old values (also in the backup file): isbn13 9780516032603 (isbn_status valid), description_book "A biography of the
leader of the 1917 Bolshevik Revolution …", description_source openlibrary / OL3473223W, cover_url
books.google.com/books/content?id=kwQ6bMxmXXIC…, cover_status valid, data_quality_status default.
Now: isbn13 NULL + isbn_status not_found + isbn_checked_at (enrich-isbn skips tried books unless --retry is
run), description/source NULL, cover NULL + cover_status rejected_placeholder (covers pipelines skip it),
data_quality_status flagged (descriptions v1/v2 skip flagged unless asked). Consequence: the page shows
"We only publish book descriptions backed by a citable source…"; googlebot-noindex; out of the Google core
(12,954 → 12,953, verified in the live sitemap).
Re-opening: do NOT run `enrich-isbn --retry/--retry-all` or descriptions with --include-flagged on this id
without checking the title-search namesake (Resnick) again.

## gaibeus (book 717)
- Ban 783 (PT, no year, sole source = indexoncensorship.org homepage) duplicated ban 40011 (PT 1940, José
  Brandão's list). Merged per the ban-merge doctrine: KEEP 40011, source link carried over with a locator saying it
  is a generic homepage, DELETE 783. 783's reason link (reason_id 2, basis NULL, no source) was NOT carried over;
  it is in the backup.
- `description_ban` ("…because of its socialist themes…", AI-drafted, status NULL so hidden on the page but read
  by exports) set to NULL; `inclusion_rationale` re-written to what the Brandão listing says. Evidence: the pt.wikipedia
  page has no censorship claim; a censor's report dated 15 Feb 1940 is reported to call it "not a revolutionary book"
  (secondary source, not cited on the site). Open: the outcome of the 1940 review; the year 1940 is Brandão's
  "edition-or-prohibition" year; a government list of censored books (pnl2027.gov.pt, LISTA LIVROS CENSURADOS)
  also names the title, without date or basis — candidate better source, not yet used.

## the-da-vinci-code (book 11, one of the 108 baseline URLs)
- Lebanon 2004 (ban 17): supported by Wikipedia "List of books banned by governments" (cites BBC News, 16 Sep 2004);
  source link added, note added. Original link kept.
- Iran: ban 987 said 2004; the BBC Persian report (URL dated 2006-07-26) says the ministry announced a publishing ban at the request of
  three Christian clergymen → year 2006, status active → unclear (no source for the present), BBC Persian + the
  Iran list added as sources; duplicate ban 6012 (no year, Iran list) merged in and deleted (links carried over).
- India/Nagaland 2006 (ban 13127): the India list supports Nagaland; link added; existing note unchanged.
- Jordan 2006 (959), Russia 2006 (1018), Saudi Arabia 2004 (1019), Qatar 2004 (1134), Pakistan 2004 (1135): the pages
  cited do not record these bans. Kept, `confidence='unverified'`, note "Source needed: the page cited for this ban does not
  record it." Not deleted, not re-dated. Searches found weak support only for Jordan (copies confiscated, 2005) and
  Pakistan (the FILM); nothing for Russia; Saudi/Qatar contradictory.
- `inclusion_rationale` ("including Lebanon, Jordan, Iran, Saudi Arabia, and Pakistan since 2004") narrowed to the three sourced bans.
- Page effect: fact line "10 documented bans · earliest in 2004 · 8 still active (…)" — 8 counts the unverified rows too.

## Not changed (uncertain or not demonstrably wrong)
- Singapore 1963/2015 on *The Right of Nations…* and *Twilight of World Capitalism*: the Wikipedia rows do not show the
  year or lift date; local batch file has them; origin unknown. Needs a source, not a deletion.
- *Candide* US 1929 (customs seizure, later admitted), *Divine Comedy* Kuwait 2016 (no year in ArabLit), Berlin DD rows'
  "fascist or militarist" wording, Russia #2978 title variant: noted only.
- 69 bans cite the Index on Censorship homepage as sole source (64 books, 58 in the core, 53 of those with no other
  source): a sourcing queue, not an automatic fix.
- *Novas Cartas Portuguesas*: author list has Horta only; the book is by the three Marias (incomplete, not a wrong work).
