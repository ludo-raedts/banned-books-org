# Source import readiness: Berlin.de, New Zealand OFLC, Portugal Estado Novo

> **Status: research only. DO NOT IMPORT YET.**
> This document is source discovery, source evaluation, and an import-readiness
> assessment. No records were imported, no Supabase rows were written, no
> migrations were created, no production-writing scripts were added. All findings
> below come from public web sources verified to load on 2026-06-17.

## Executive summary

| Source area | Recommendation |
|---|---|
| **1. Nazi Germany / Berlin.de** | **Ready for pilot.** A genuine, downloadable, **CC-BY-licensed** structured dataset (4,764 rows, JSON/CSV/XML/XLS) with per-entry author/title/publisher/year and a precise provenance anchor (1938 list + page number). The only real work is filtering out ~585 author-wide "Sämtliche Schriften" blanket rows and reviewing ~556 author-less aggregate rows. This is the clear front-runner. |
| **2. New Zealand / OFLC** | **Promising but needs manual verification.** Data is public, login-free, and cleanly book-filterable (`Medium = Book`), with a correct legal vocabulary (objectionable = ban; R13/R16/R18 = restriction). But there is **no API, no bulk export, no data.govt.nz dataset** — every title is a manual lookup/scrape, and the statutory register backend is session-gated. Suited to a small, hand-verified pilot, not an automated feed. |
| **3. Portugal / Estado Novo** | **Promising but needs manual verification.** Two complementary text-based (not scanned) sources: the Brandão ~900-row table (clean but blog-hosted, with an ambiguous edition-or-ban year) and the more durable Alvim academic bibliography (~508 positively-identified titles, full ISBD). Per-title verification against PORBASE/BNP is required before any year/edition is asserted. |

**Bottom line:** Tackle **Berlin.de first** (it is genuinely pilot-ready), then **Portugal**, then **New Zealand**. Detailed ranking in the final section.

---

## Scoring table

| Source area | Public accessibility | Official / scholarly authority | Structured data availability | Book-level precision | Ban-context clarity | Import risk | Recommended next step |
|---|---|---|---|---|---|---|---|
| **Berlin.de (Nazi 1938 list)** | High | High | High | High | High | Low–Medium | Pilot the CC-BY JSON; filter blanket + author-less rows |
| **NZ OFLC** | High | High | Low | High (via `Medium=Book`) | High (objectionable vs R-rating) | Medium | Hand-verify a curated set; import only `objectionable` as bans |
| **Portugal (Estado Novo)** | Medium (blog host) / High (E-LIS) | High (provenance documented) | Medium | Medium–High | Medium (year ambiguity) | Medium | Parse Brandão seed; verify each title vs PORBASE/Alvim |

Ratings: High / Medium / Low / Unknown.

---

## 1. Nazi Germany / Berlin.de

### Public source URLs found
- **Narrative/context page (essay only, not data):**
  `https://www.berlin.de/geschichte/nationalsozialismus/verbannte-buecher/`
- **Searchable database UI ("Liste der verbannten Bücher"):**
  `https://www.berlin.de/verbannte-buecher/suche/`
- **Berlin Open Data dataset record (license + downloads):**
  `https://daten.berlin.de/datensaetze/simple_search_wwwberlindeverbanntebuechersuche`
- **Direct structured downloads (all verified HTTP 200; empty `q=` returns the full 4,764-row dataset in one call):**
  - CSV: `https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.csv?q=`
  - JSON: `https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.json?q=`
  - XML: `https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.xml?q=`
  - XLS: `https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.xls?q=`
- **Academic derivative (enriched, per-entry source citations incl. page number):**
  `https://verbrannte-und-verbannte.de/` — code/DB at `https://github.com/burki/codingdavinci`; example entry `https://verbrannte-und-verbannte.de/list/593`
- **Original digitized scans (page images / OCR source — NOT structured):**
  - ULB Bonn, Vol. 2 (Stand 31.12.1938): `https://digitale-sammlungen.ulb.uni-bonn.de/periodical/structure/7601450`
  - ULB Münster (1935/36/38 editions): `https://sammlungen.ulb.uni-muenster.de/hd/periodical/titleinfo/2539887`
  - HathiTrust catalog: `https://catalog.hathitrust.org/Record/002201939`
- **Discovery aid only (not a primary citation):**
  `https://de.wikipedia.org/wiki/Liste_verbotener_Autoren_während_der_Zeit_des_Nationalsozialismus`

### Source owner / authority
- **Publisher:** BerlinOnline GmbH (operator of the official Berlin.de portal) via the Berlin Open Data platform `daten.berlin.de`. Government-affiliated, stable, citeable.
- **License:** **Creative Commons Attribution (CC-BY)** — explicitly stated on the open-data record. Compatible with import + attribution.
- **Underlying authority:** the original 1938 Nazi *"Liste des schädlichen und unerwünschten Schrifttums"* (Reichsschrifttumskammer / Gestapa), digitized and OCR'd; scans independently held by ULB Bonn, ULB Münster, HathiTrust for verification.
- **Language:** German (field names are English; values are German).

### What the source contains
A true tabular dataset of **4,764 entries** (verified `count`), returned in a single well-formed JSON/CSV response. Verified columns:
`id`, `ssflag`, `pagenumberinocrdocument`, `authorfirstname`, `authorlastname`, `title`, `firsteditionpublisher`, `firsteditionpublicationplace`, `firsteditionpublicationyear`, `secondeditionpublisher`, `secondeditionpublicationplace`, `secondeditionpublicationyear`, `additionalinfos`, `ocrresult`.

- **Individual titles:** yes — 4,757 of 4,764 non-empty.
- **Authors:** yes — split into first/last name; **556 entries have no author** (anonymous works / publisher aggregates / title-only entries).
- **Year/date:** `firsteditionpublicationyear` populated on **4,127 / 4,764 (~87%)**; 630 entries have a title but no year.
- **Ban/censorship context:** all rows trace to the **1938 edition ("Stand vom 31. Dezember 1938")**. `pagenumberinocrdocument` gives the original list page and `ocrresult` is the raw OCR line — both excellent citation anchors. (Berlin.de notes the DB currently equals the original 1938 list entries; pseudonym entries and periodical publications were already excluded from the published DB — good for a books catalogue.)
- **Non-book material:** mostly pre-excluded (periodicals/pseudonyms). Residual non-book risk is in the author-less aggregate rows.

### Distinguishing ban types
No clean type enum, but type is reliably inferable from `title` / `additionalinfos`:
- **Author-wide blanket ("all works"):** **561** rows with `title` containing "Sämtliche Schriften" (e.g. `Brecht, Bertold: Sämtliche Schriften.`, empty publisher/year), plus ~24 `additionalinfos` "Sämtliche …" variants ("Sämtl. Ausgaben", "Sämtliche Veröffentlichungen", etc.). Note: some even ban works *about* an author (`Stalin … Sämtliche Schriften von und über ~`).
- **Individual book bans:** the majority — real title + first-edition publisher/place/year.
- **Anonymous / aggregate:** the 556 author-less rows (anonymous titles, thematic aggregates, multi-volume series) — review case-by-case.
- **`ssflag`** is present in the schema but **0 across all 4,764 public rows** — NOT usable as a discriminator. Use the title/`additionalinfos` "Sämtliche" patterns instead.

### Suggested mapping to banned-books.org fields
- `books.title` ← `title`; `books.publication_year` ← `firsteditionpublicationyear` (verify per data-quality doctrine).
- `authors` ← `authorfirstname` + `authorlastname`.
- `bans` ← one ban per row: country = Germany, year/era = Nazi 1938 list, `warning_level = none` (these are censorship **victims**, mirroring existing Liste-Otto handling).
- `ban_sources` / `ban_source_links` ← Berlin.de CC-BY dataset + the precise "1938 list, page N" anchor; optional ULB Bonn scan as corroboration.
- Optional `reasons`/`scopes`: reason = Nazi censorship; scope = national.

### Import risks
- **Blanket/author-level contamination** if "Sämtliche" rows are not filtered (use existing `is_blanket_works` doctrine).
- **Framing risk:** this is a denial/victim list — must not be presented as endorsed bans.
- **Do NOT conflate with the post-war "Liste der auszusondernden Literatur"** (`https://de.wikipedia.org/wiki/Liste_der_auszusondernden_Literatur`, full text `http://www.polunbi.de/bibliothek/1946-nslit.html`, scan `https://catalog.hathitrust.org/Record/102102438`). That is a **different 1946–52 Soviet-zone list that removed *Nazi/militarist* propaganda** — importing it would mislabel Nazi propaganda as censorship victims. Out of scope / separate provenance.
- ~13% missing years; German-language values need careful handling.

### Recommended pilot size
**~200–400 book-level rows** for a first pilot (e.g. high-recognition authors with title + year + publisher), drawn from the ~3,500–4,100 clean book-level subset (4,764 total minus ~585 blanket minus the 556 author-less under review).

### Recommended filters
1. Require a concrete `title`.
2. Drop rows whose `title` or `additionalinfos` matches `Sämtliche|Sämtl\.` (blanket → exclude or model as author-level).
3. Hold the 556 author-less rows for manual review.
4. Prefer rows with a `firsteditionpublicationyear` for the pilot.

### Example records found (citations)
1. **Paul Albrecht — *Ein Mahnwort an die deutschen Arbeiter*** (Berlin: Birkner, 1908), id 1401, p.2 — individual book ban. `https://www.berlin.de/verbannte-buecher/suche/index.php/index/all.json?q=Albrecht`
2. **Bertold Brecht — *Sämtliche Schriften*** (no publisher/year), id 5755, p.16 — author-wide blanket → **EXCLUDE**. (`q=Brecht`)
3. **Friedrich Beyer — *Sergeant Albrecht, Unteroffizier Schmelz, Else u. andere Menschen*** (Zeulenroda: Sporn, 1931), id 2710, p.11 — individual book ban.
4. **Walter Schoenstedt — *Sämtliche Schriften*** cited to "Liste des schädlichen und unerwünschten Schrifttum, Stand vom 31. Dezember 1938, S. 130." `https://verbrannte-und-verbannte.de/list/593`

### Final recommendation
**Ready for pilot.** Highest-quality of the three: official, open-licensed, genuinely structured, book-level, with a precise citation anchor. The blanket/author-less filtering is straightforward and aligns with existing doctrine. **Start here.**

---

## 2. New Zealand / Classification Office / OFLC

### Public source URLs found
| URL | What it is | State |
|---|---|---|
| `https://www.classificationoffice.govt.nz/find-a-rating/` | Consumer-facing search/browse tool; **no login**; has a `Medium` filter incl. **Book**. Most usable surface. | Loads ✓ |
| `https://register.classificationoffice.govt.nz/` | The statutory **Register of Classification Decisions** (ASP.NET app). Publicly searchable per official guidance, **but** session/viewstate-gated — plain fetches return "session expired" / "system error". | Loads but session-gated |
| `https://www.classificationoffice.govt.nz/classification-info/what-we-classify/books/` | Official explainer on how books are classified + status meanings. | Loads ✓ |
| `https://www.classificationoffice.govt.nz/news/significant-decisions/` | Editorial highlights — only one **book** (Into the River); rest film/streaming. | Loads ✓ |
| `https://www.nzlii.org/nz/legis/consol_act/fvapca1993414/` | NZLII mirror of the Films, Videos, and Publications Classification Act 1993 (legislation.govt.nz returns 403 to fetchers). | Loads ✓ |
| `https://www.dia.govt.nz/Classification-in-New-Zealand` | DIA enforcement role (Customs/Police/DIA enforce; Office decides). | Referenced |
| `https://en.wikipedia.org/wiki/List_of_books_banned_in_New_Zealand` | **Discovery aid only** (CC-BY-SA) — candidate list of historically banned/restricted NZ books. | Loads ✓ |

**No API, no bulk/downloadable register, and no data.govt.nz dataset were found** (searched and confirmed absent).

### Source owner / authority
Classification Office of New Zealand (Te Mana Whakaatu / OFLC) — independent Crown entity; enforcement by DIA/Customs/Police. Authoritative and official. Statutory basis: **Films, Videos, and Publications Classification Act 1993.**

### What the source contains
A searchable library of classification decisions across all media. For books, per-title fields available from "Find a rating" entries and **Notice-of-Decision PDFs**: **title, author, medium/format, classification, decision date, descriptive note, OFLC reference number.**

- **Individual titles:** yes.
- **Authors:** yes (per decision / PDF).
- **Year/date:** production year + decision date(s) available.
- **Ban/censorship context:** yes, with precise legal vocabulary (below).
- **Non-book material:** present in bulk (films, games, posters, DVDs, online/digital) — but separable via the `Medium` field.

### Status vocabulary (critical distinction)
Under the 1993 Act:
- **Objectionable = BANNED** (the NZ legal term for a full ban). If objectionable, it is illegal to supply, import, or possess. → **the only status to map as a true ban.**
- **Restricted: R13 / R16 / R18 (and RP/age variants)** = age restriction, **not a ban**; the book stays legally available to adults. → record as "age-restricted," never as a ban.
- **Unrestricted: G / PG / M** = not censored (M is advisory only).

Scale: ~1,300 books banned or restricted in total; **two-thirds classified before 1987** (legacy Indecent Publications Tribunal era). Genuinely *objectionable* (fully banned) books are a smaller subset (1960s–70s sexual material plus modern items such as the Christchurch manifesto and a meth-manufacture manual).

### Can books be separated from other media?
**Yes — cleanly.** "Find a rating" exposes a **`Medium`** filter with values including Online, Digital, DCP, Blu-ray, DVD, Games, Computer File, CD, VHS, **Book**, **Poster**, etc. `Medium = Book` is the clean separator. **Caveats:** magazines/periodicals may surface as Book-medium or their own category (need a books-only pass per existing `_audit_non_book_media.ts` doctrine); "Computer File"/"Online"/"Digital" objectionable items (e.g. terrorist material) must be excluded.

### Stable URLs / extraction
- **Consumer decision pages:** readable slug pattern `https://www.classificationoffice.govt.nz/find-a-rating/quick-takes/<title-slug>/` — but "quick takes" are editorial highlights, not every title.
- **Notice-of-Decision PDFs:** keyed by OFLC reference, e.g. `https://www.classificationoffice.govt.nz/documents/266/1500261.000_Into_the_River_2012_-_Section_381_Notice_of_Decision.pdf` (verified). The numeric `/documents/<n>/` segment is **not predictable** — PDFs must be discovered via search/register.
- **Board of Review** decisions on a separate Lotus Notes host (`dia.govt.nz/pubforms.nsf/...`).
- The legal register's internal screens (`/Pages/Screens/DDA/DDASearchResults.aspx`) are **session-bound** and error on direct hits.
- **Net: manual / browser-driven scraping per title.** No enumerable feed.

### Suggested mapping to banned-books.org fields
- `books` ← title / author / production year (medium = Book only).
- `bans` ← only `objectionable` decisions → ban (country = New Zealand). Record `R13/R16/R18` separately as age-restriction, not a ban.
- `ban_sources`/`ban_source_links` ← the Notice-of-Decision PDF or register/decision URL per title.
- Optional `reasons`/`scopes`: reason from the descriptive note; scope = national.

### Import risks
- **Mislabeling restrictions as bans** (the biggest risk — most "restricted" books are age-rated, not banned).
- **No machine-readable feed** → every title manual; register backend fragile/session-gated.
- **Legacy data quality** — two-thirds pre-1987 with uneven author/year metadata.
- **Non-book leakage** (magazines/periodicals/digital) needs a books-only filter.
- legislation.govt.nz and some PDFs return 403 to plain fetchers (use NZLII mirror; PDFs need a browser UA).

### Recommended pilot size
**~20–60 hand-verified titles.** Start from the Wikipedia candidate list + OFLC significant decisions, confirm each against `register.classificationoffice.govt.nz` / `find-a-rating` `Medium=Book`, and cite the Notice-of-Decision PDF or register URL.

### Recommended filters
1. `Medium = Book` only.
2. Import only `objectionable` as a ban; tag R13/R16/R18 as age-restriction.
3. Exclude magazines/periodicals/digital-only objectionable items.
4. Note current vs historic status (e.g. Into the River is now unrestricted — a censorship *event*, not a current ban).

### Example records found (citations)
1. **Into the River — Ted Dawe (2012):** M/Unrestricted (2013) → R14 (Board of Review, 2013) → Unrestricted (2015) → **interim restriction order Sep 2015** (briefly illegal to supply — de-facto temporary ban) → Unrestricted (Board, Oct 2015). OFLC refs 1300727.000 / 1500261.000. PDF: `https://www.classificationoffice.govt.nz/documents/266/1500261.000_Into_the_River_2012_-_Section_381_Notice_of_Decision.pdf`; editorial: `https://www.classificationoffice.govt.nz/news/significant-decisions/into-the-river/`. *Net current status: unrestricted.*
2. **The 120 Days of Sodom — Marquis de Sade — R18 (OFLC 1998)** — restriction, not a ban. (Wikipedia cross-ref.)
3. **American Psycho — Bret Easton Ellis — R18 (OFLC 2014)** — restriction. (Wikipedia cross-ref.)
4. **Candy — Terry Southern & Mason Hoffenberg — banned (objectionable), IPT 1969** — genuine historic ban (verify current status against register).
   Also flagged currently *objectionable*: the Christchurch terrorist manifesto and *Secrets of Methamphetamine Manufacture* (8th ed.).

### Final recommendation
**Promising but needs manual verification.** Authoritative and book-separable with correct legal vocabulary, but no automated feed and a fragile register — best as a small curated, hand-verified pilot importing only genuine `objectionable` bans.

---

## 3. Portugal / Estado Novo

### Public source URLs found
**Primary (official, censorship-archive provenance):**
- **Comissão do Livro Negro sobre o Regime Fascista — "Livros proibidos no Regime Fascista"** (Presidência do Conselho de Ministros, May 1981, ~124 pp). The official government inventory, compiled from the censorship apparatus (Direcção dos Serviços de Censura / Direcção-Geral de Informação). **No free digitization located** (no purl.pt / archive.org / BND copy surfaced). It is the upstream both secondary sources derive from.
- **PORBASE / Biblioteca Nacional de Portugal catalogue** (canonical per-title verification): `https://porbase.bnportugal.gov.pt/` and `https://www.bnportugal.gov.pt/` — both live.

**Secondary / derived (the two usable data files):**
| Source | URL | Host stability | Structure |
|---|---|---|---|
| **José Brandão, "Livros Proibidos nos Anos da Ditadura de 1933 a 1974"** (seed PDF, ~900 rows) | `https://bibliblogue.wordpress.com/wp-content/uploads/2012/04/200412livrosproibidos33_74.pdf` (seed `https://bibliblogue.files.wordpress.com/2012/04/200412livrosproibidos33_74.pdf` 302-redirects here) | **Low** (WordPress blog) | Clean 4-column table |
| **Maria Luísa Alvim, "Livros Portugueses Proibidos no Regime Fascista: Bibliografia"** (Braga, 1992) | `http://eprints.rclis.org/9342/1/livros_proibidos.pdf` (landing `http://eprints.rclis.org/9342/`) | **Higher** (E-LIS open-access LIS archive) | Full ISBD catalogue records |

**Contextual only (no usable per-title data):** Expresso 2012 press piece "Os 900 livros que o Estado Novo censurou"; Almanaque Republicano blog `https://arepublicano.blogspot.com/2012/04/livros-proibidos-no-regime-fascista.html`; Gulbenkian library page (403 to fetch).

### Source owner / authority
- **Brandão list:** secondary compilation (~900 titles, the largest single compilation) on a personal blog — low host stability but real text.
- **Alvim bibliography:** academic, hosted on E-LIS (more durable); **508 titles positively identified**, full ISBD.
- **Provenance:** documented back to the **Comissão do Livro Negro** list → July-1974 publishers/booksellers list → communications from the **Direcção dos Serviços de Censura** / **Direcção-Geral de Informação** naming books as banned. So both compilations trace to official censorship records, but as **secondary compilations, not direct archive scans.**
- **Language:** Portuguese throughout.

### What the sources contain (per title)
**Brandão PDF** — strict 4-column alphabetical table: `TÍTULO | AUTOR | EDITOR (publisher) | DATA`.
- `DATA` = "data da edição ou da proibição" — **edition OR ban date, not disambiguated per row.**
- Author stored "Surname, Firstname".
- 95 rows carry `(*)` = special prohibition (varying Metrópole/Colónias, or changed status).
- Portuguese editions only (no Brazilian/foreign-provenance). Start year 1933 = Decreto n.º 22 469 (prior censorship of books).
- No ISBN, no edition statement, no pagination.

**Alvim bibliography** — full **ISBD(M)** records (author / title / place : publisher, year / pagination / series), CDU subject classes, library holdings, entry-date notes. Far richer, but only 508 titles located (~927 left unlocated).

- **Individual titles:** yes. **Authors:** yes. **Year:** present but **ambiguous (edition vs ban)**. **Publisher:** yes (Brandão). **Official per-title ban date / ISBN / edition:** absent in Brandão.

### Primary vs secondary; extraction reliability
- **Brandão PDF: text-based, not scanned** (HTTP 200, application/pdf, 168.7 KB, 21 pages, PDFCreator/Ghostscript). `pdftotext -layout` yields a clean ~901-row 4-column extraction — **no OCR needed**; minor wrap/column-boundary heuristics required.
- **Alvim PDF: text-based** (pdfeTeX, 56 pp) but **two-column interleaved** — messier to parse into clean records; best as a verification/enrichment reference, not a bulk parse target.

### Suggested mapping to banned-books.org fields
- `books` ← title (PT) / author (normalize "Surname, First" → "First Surname") / publisher.
- `bans` ← country = Portugal, era = Estado Novo, legal basis = Decreto 22 469 / prior censorship; carry the `(*)` special-prohibition flag.
- `ban_sources`/`ban_source_links` ← Brandão + Alvim as compilation sources **plus a per-title PORBASE/BNP record** as verification (do not anchor the permanent citation on the wordpress URL).
- `books.publication_year` ← treat `DATA` as edition-or-ban-year (ambiguous) and re-verify against PORBASE before asserting.

### Import risks
- **Blog-host instability** (wordpress PDF can vanish) → anchor citations on E-LIS (Alvim) + BNP/PORBASE.
- **Year ambiguity** (edition vs ban) → never assert an official ban date from `DATA` alone.
- **Secondary provenance** → cross-check per title; do not present as a direct archive extract.
- Parsing wrapped rows / collapsed columns needs care.

### Recommended pilot size
**~50–150 titles** drawn from the overlap of Brandão **and** Alvim (records with full ISBD detail and CDU class) — the most reliably verifiable subset — with PORBASE confirmation per title.

### Recommended filters
1. Parse Brandão as the seed; prefer rows confirmable in Alvim or PORBASE.
2. Keep the `(*)` special-prohibition flag.
3. Exclude any non-book or foreign-edition residue.
4. Mark year as unverified until cross-checked.

### Example records found (citations)
1. **O Amante de Lady Chatterley — D. H. Lawrence** — ed. Panorama, 1970. Brandão PDF; verify PORBASE `https://porbase.bnportugal.gov.pt/`.
2. **O Anti-Cristo — Friedrich Nietzsche** (trad. Carlos Grifo) — Lisboa: Presença, 1973, 136 p. — in **both** Brandão and Alvim. `http://eprints.rclis.org/9342/1/livros_proibidos.pdf`.
3. **Abc de Castro Alves (*) — Jorge Amado** — Europa-América, 1971 — special prohibition. Brandão PDF.
4. **Antologia de Poesia Portuguesa Erótica e Satírica — Natália Correia** — Afrodite, 1965 (famous censorship case). Brandão PDF; verify PORBASE/BNP.

### Final recommendation
**Promising but needs manual verification.** Best bulk seed of the three after Berlin (clean text, ~900 rows), with documented provenance — but secondary, blog-hosted, and with an ambiguous year requiring per-title PORBASE verification.

---

## Import-route decision (2026-06-17)

> Decision recorded, not yet implemented. Still **do not import**.

**Route.** All three sources go through the standard new-source route in
`scripts/README.md` §1 (Stap 0–5), **not** a bespoke importer and **not** the
legacy LLM queue ([[project_import_queue_decommission]]). The reusable core is
the shared commit-lib `commitParsedRow` / `commitNewBanForBook`
(`src/lib/imports/review-commit.ts`); a new script is a thin reader that feeds a
normalized `data/<bron>-<datum>.json` into those functions.
- **Berlin & Portugal:** government/national JSON batch → template
  `import-africa-criminalization-bans.ts`.
- **New Zealand:** too small/manual for the bulk route — existing `objectionable`
  titles already in the DB via `add-ala-2025.ts` style (ban-only, no book
  creation); genuinely new titles via a hand-built JSON. `R13/R16/R18` are
  age-restrictions, never written as bans.

**The cross-language dedup gap (the load-bearing issue).** Match-before-create
(Stap 2) relies on `title_english_meaningful` as the cross-language match signal.
Berlin supplies **German titles only**; Portugal **Portuguese titles only** — no
English work title. The match tiers (exact slug → pg_trgm fuzzy → English-title
slug) cannot connect "Im Westen nichts Neues" to an existing "All Quiet on the
Western Front" row, so a foreign-titled duplicate of a book already in the
catalogue gets minted. The Stap 4 safety nets do **not** cover this: 
`_audit_cross_script_dupes.ts` is non-Latin-author only, and
`_audit_spanish_edition_dupes.ts` is gated on a Spanish title + `original_language='en'`.
German and Portuguese are Latin-script and not Spanish → they fall through both.

**Decision = Option A (prevent at the source).** At Stap 0, enrich each row with
its **English work title** via Wikidata — the reverse of `enrich-native-titles.ts`
(German/Portuguese title → English label/work) — and write it to
`title_english_meaningful` so match-before-create resolves against existing
English-titled rows. Rejected Option B (a new Latin-script cross-language
detector for Stap 4) because the README doctrine is explicitly to stop the dupe
class **at the source**, not to catch it after insert. Dupe risk concentrates on
well-known authors (Mann, Brecht, Remarque, Marx, Freud) already in the catalogue;
obscure interwar authors are likely net-new.

**Order:** Berlin first (after wiring Option A), then Portugal (with mandatory
per-title PORBASE year verification), then New Zealand.

### Stap-0 build result (2026-06-17) + a finding that lowers Option-A cost

Built read-only via `scripts/build-berlin-verbannte-stage0.ts` (no DB writes).
Partition of the 4,764 CC-BY rows:

| Bucket | Rows | Disposition |
|---|---|---|
| **book** (clean book-level) | **3,606** (3,585 with year) | import seed → `data/berlin-verbannte-1938-2026-06-17.json` |
| blanket ("Sämtliche…") | 607 | EXCLUDE → model as author-level |
| authorless (anon/aggregate) | 551 | HOLD for manual review → excluded sidecar |

**Finding:** the high-recognition authors that would collide with existing
English-titled catalogue rows — Mann, Marx, Freud, Kafka, Remarque, Brecht,
Feuchtwanger, Zweig — are **almost all in the blanket "Sämtliche Schriften"
bucket** (banned author-wide, by title-less entry), so they are already excluded
from the book-level seed. The 3,606 seed rows are predominantly obscure
individual titles. Consequence: the cross-language dedup risk on the seed is
**lower** than first assumed, and the Option-A English-title enrichment will be
**low-yield but still worth running** to catch the minority of individual titles
that do have English editions.

**Wikidata path validated:** `Im Westen nichts Neues` → Q207332 (P31 = literary
work) → English title "All Quiet on the Western Front"; the 1930/1979/2022 film
entities (P31 = film) are correctly gated out by the written-work + author gate.
The first-40-rows pilot returned 0 English titles — the correct result for
genuinely obscure works with no English edition (a null English title = likely a
net-new German work = low dedup risk).

**Remaining:** the full `--enrich-english` sweep over 3,606 rows is a ~90-min
resumable terminal job (checkpoints every row to
`data/source-research/berlin-english-title-cache.json`), then review the 551
authorless rows + decide blanket modeling, then write the thin importer. Still
**do not import.**

---

## Proposed future import approach

> All three are **future plans only** — not implemented here.

### Berlin.de (Nazi 1938 list)
- **Fetch:** one HTTPS GET to the CC-BY JSON endpoint (`.../all.json?q=`), full 4,764-row dataset. No auth.
- **Parse:** direct JSON → row objects (stable schema). No OCR.
- **Dedup risks:** existing German-language / Liste-Otto authors already in the catalogue (e.g. cross-language author rows); same-author multiple editions; second-edition columns. Apply match-before-create on author + normalized title.
- **Extractable fields:** title, author (first/last), publisher, place, year, 1938-list page anchor.
- **Needs enrichment:** ISBNs/covers (post-import), English descriptions, reasons.
- **Exclude:** ~561 "Sämtliche Schriften" + ~24 `additionalinfos` "Sämtliche" variants (blanket/author-level); review 556 author-less aggregates; never co-import the post-war "Liste der auszusondernden Literatur."
- **Routing:** clean book-level rows can go to `import_review_queue` for a sampled visual/spot check; blanket and author-less rows → **manual CSV for review**, not auto-queued.

### New Zealand OFLC
- **Fetch:** browser-driven scraping of "Find a rating" with `Medium=Book` (the register backend is session-gated; the consumer tool is the practical surface). Per-title Notice-of-Decision PDFs fetched with a real UA.
- **Parse:** HTML result rows → title/author/classification/date; PDF parse for decision detail/citation.
- **Dedup risks:** title-collision with existing catalogue books; multiple decisions per title (re-classification history — e.g. Into the River) must collapse to one book with a decision timeline, not many bans.
- **Extractable fields:** title, author, classification, decision date, OFLC ref, descriptive note, decision URL.
- **Needs enrichment:** publication year/ISBN/cover; reason mapping from descriptive note.
- **Exclude:** all non-Book media; magazines/periodicals; digital-only objectionable items; do not map R-ratings as bans.
- **Routing:** **manual CSV for review only** (small, hand-verified set) — not an automated queue.

### Portugal (Estado Novo)
- **Fetch:** download Brandão PDF (cache locally); `pdftotext -layout`. Optionally parse Alvim from E-LIS.
- **Parse:** column-boundary heuristics on the 4-column table; handle wrapped rows; extract `(*)` flag.
- **Dedup risks:** Brandão↔Alvim overlap; multiple editions of one work; author name-form normalization ("Surname, First").
- **Extractable fields:** title, author, publisher, ambiguous year, special-prohibition flag.
- **Needs enrichment:** disambiguated/verified publication year (PORBASE), official ban date (not in source), ISBN/cover, English description.
- **Exclude:** non-book residue, foreign-provenance editions, rows not confirmable in Alvim/PORBASE for the pilot.
- **Routing:** **manual CSV for review** with PORBASE cross-check per row before any queue insertion.

---

## Suggested source-registry entries

> Prose/pseudocode only. **Do not change `src/lib/imports/source-registry.ts`.**

**Berlin.de — Nazi 1938 list**
- source key: `berlin_verbannte_buecher_1938`
- default country code: `DE`
- default scope: national
- default action type: ban (censorship victim; `warning_level=none`)
- expected source type: structured open dataset (CC-BY JSON/CSV)
- expected confidence: high (official + open license + page-anchored provenance)
- archive strategy: snapshot the CC-BY JSON + retain `pagenumberinocrdocument` + (optional) ULB Bonn scan URL
- review gate level: low for clean book-level rows (sampled check); **high/manual** for blanket + author-less rows

**New Zealand OFLC**
- source key: `nz_oflc_register`
- default country code: `NZ`
- default scope: national
- default action type: ban **only** when classification = objectionable; otherwise age-restriction (separate)
- expected source type: manual/browser-scraped decisions + Notice-of-Decision PDFs (no API)
- expected confidence: medium (authoritative but manual, legacy-data variance)
- archive strategy: store the decision/register URL + Notice-of-Decision PDF per title + OFLC ref
- review gate level: **high / fully manual** (small curated pilot)

**Portugal — Estado Novo**
- source key: `pt_estado_novo_brandao`
- default country code: `PT`
- default scope: national
- default action type: ban (prior-censorship; carry special-prohibition flag)
- expected source type: secondary text PDF compilation (Brandão) + academic ISBD bibliography (Alvim) + PORBASE verification
- expected confidence: medium (secondary provenance, ambiguous year)
- archive strategy: cache Brandão PDF locally; anchor citations on E-LIS (Alvim) + per-title PORBASE/BNP record (not the wordpress URL)
- review gate level: **high / manual** with mandatory PORBASE cross-check

---

## Risks and open questions

1. **Berlin — author-less rows (556):** how many are genuine single books vs aggregates? Needs a manual review pass before counting toward the importable total.
2. **Berlin — blanket modeling:** reuse `is_blanket_works` for "Sämtliche" rows, or exclude entirely? (Doctrine suggests isolate, not delete.)
3. **Berlin — second-edition columns:** import as separate editions or collapse to one book? (Recommend collapse.)
4. **Berlin — CC-BY attribution string** must be wired into `ban_sources` exactly.
5. **NZ — register access:** the statutory register is session-gated; can the consumer "Find a rating" tool alone provide complete-enough coverage, or is browser-session interaction with the register required?
6. **NZ — restriction vs ban policy:** does banned-books.org want to record R13/R16/R18 age-restrictions at all, or only `objectionable` bans? Affects scope and schema (is there an age-restriction concept distinct from ban?).
7. **NZ — magazines/periodicals** leakage under `Medium=Book` needs the existing non-book-media audit.
8. **NZ — historic status drift** (Into the River): model decision history as a timeline, not multiple bans.
9. **Portugal — year ambiguity:** every `DATA` value must be re-verified against PORBASE before publication year is asserted.
10. **Portugal — host durability:** confirm a stable mirror for Brandão (E-LIS Alvim is durable; the wordpress Brandão PDF is not).
11. **Portugal — official 1981 volume** not digitized — should we seek it at BNP/ANTT for true archival citation, or is the documented secondary provenance sufficient?
12. **All three — language/enrichment:** German and Portuguese titles need the existing native-title / description-QA pipelines; English descriptions will be enrichment, not source data.
13. **All three — dedup against existing catalogue** (cross-language author rows already a known issue).

---

## Final recommendation

**Tackle in this order:**

1. **Berlin.de (Nazi 1938 list) — FIRST.** The only genuinely pilot-ready source: official, CC-BY-licensed, truly structured (one JSON call → 4,764 rows), book-level, page-anchored provenance, low/medium risk. Filtering blanket + author-less rows is straightforward and matches existing doctrine. Best effort-to-value ratio by a wide margin.

2. **Portugal (Estado Novo) — SECOND.** A clean ~900-row text table (no OCR) with documented provenance and a durable academic cross-check (Alvim/E-LIS) plus PORBASE verification. Medium effort: parsing + per-title year verification. Strong catalogue value (currently likely under-represented country).

3. **New Zealand OFLC — THIRD.** Authoritative and book-separable, but no automated feed, a fragile register, and the legal subtlety that most "restricted" titles are age-rated, not banned. Worth doing as a small, hand-verified pilot of genuine `objectionable` bans — but the highest manual cost per record, so last.

> **Reminder: do not import yet.** This document is for deciding which source becomes the next import project. No code in this report writes to the database.
