# Upstream sources inventory — post-Kasseler-denial

> Compiled 2026-05-20. Owner: Ludo Raedts.

## Why this file exists

Die Kasseler Liste (Roßbach U. Kassel / Gassner UBC; aggregator of 158,266 rows)
denied republication permission on 2026-05-20: their Austrian partner project
(Bachleitner / Vienna, 1750–1848 corpus) granted them "present, not redistribute"
rights only, with a hard 1% reuse cap on the full corpus. The local CSV download
was destroyed at request; **no Kasseler data was ever imported into the database**.

But Kasseler is mostly an aggregator — every row in its `Source` column points to
an underlying upstream. The aggregate metadata about WHICH upstreams Kasseler
cites is itself not their dataset and well below the 1% reuse threshold, so this
inventory (compiled while the local copy still existed) is academically
permissible. Each upstream below has been examined for accessibility
independently of Kasseler.

## Triage table — 23+ distinct upstreams cited by Kasseler

| Upstream | Records in Kasseler | Our status | Accessibility |
|---|---|---|---|
| Opus Dei (2003): Index der verbotenen Bücher (Italian Vatican Index) | 31,874 | not used | ⛔ Restricted — copyrighted modern book |
| Österreichische Listen verbotener Bücher 1750–1848 (Bachleitner/Vienna) | 30,712 | not used | ⛔ Restricted — the reason Kasseler can't redistribute |
| DDR Volksbildung lijsten (Eastern bloc, two related projects) | ~29,500 | not used | ❓ Possibly public-domain (DDR govt docs); needs research |
| TDCJ Texas prisons spreadsheet (FOIA) | 10,223 | not used | ✓ Likely accessible — US Public Information Act |
| Texas Civil Rights Project archive | 11,811 | not used | ✓ Likely accessible — published report, US public records |
| bookstoprisoners.net Kansas | 7,431 | not used | ✓ Likely accessible — publicly hosted spreadsheet |
| bookstoprisoners.net Virginia | 4,821 | not used | ✓ Likely accessible |
| Wolfgang Both — Verbannte Bücher Berlin (Nazi-era) | 4,733 | not used | ❓ Berliner Senat-funded; needs license check |
| Catholic Church: Index Librorum Prohibitorum Vatican 1948 | 4,330 | ✓ partial via Wiki | ✓ Public-domain by age (75+ yr EU); we have Wiki version |
| Books to prisoners (Feb-2023 linked list) | 3,169 | not used | ✓ Likely accessible |
| Books to Prisoners (additional linked list) | 1,820 | not used | ✓ Likely accessible |
| South Carolina prisons | 1,693 | not used | ✓ Likely accessible — US PIA records |
| California prisons | 1,621 | not used | ✓ Likely accessible — US PIA records |
| NZ Office of Film and Literature Classification | 1,307 | ✓ in use | n/a — already imported via wikipedia-nz |
| Beslaglagte bøker (Norway WW2) | 1,118 | not used | ❓ Nasjonalbiblioteket — needs license check |
| PEN America banned-books report | 1,114 | ⌛ source registered, unused | ✓ Free public Index of School Book Bans |
| Washington state prisons | 982 | not used | ✓ Likely accessible — US PIA records |
| Livros Proibidos dos Anos da Ditadura 1933–74 (Portugal) | 892 | not used | ❓ Bibliographic work — needs license check |
| bookstoprisoners.net South Carolina (extra file) | 824 | not used | ✓ Likely accessible |
| Karaca, Emin: *Vaaay Kitabin Basina Gelenler!* (Istanbul 2013) | 758 | not used | ⛔ Copyrighted Turkish book; titles citeerbaar individueel |
| ASKI Greek Social History Archives (junta-era) | 729 | not used | ❓ Academic body — needs license check |
| Comisión Provincial de la Memoria Córdoba (Argentina junta) | 668 | not used | ❓ Argentine HR archive — possibly CC |

Plus implicit: **Beacon for Freedom of Expression** (search.beaconforfreedom.org)
— Michelle Tisdel / Norwegian Library, 2003-present. Mentioned in fewer-than-top-25
Kasseler rows but per McDonald's note at theliteraturepolice.com, Beacon holds
**~14,500 South African records** alone and is the upstream behind ~half of
Kasseler's SA section. Globally probably 50,000+ records.
**STATUS: DEAD (verified 2026-05-20).** `search.beaconforfreedom.org` returns
`ECONNREFUSED`; the apex `beaconforfreedom.org` 301-redirects to an unrelated
sushi-restaurant site, indicating the domain lapsed and was re-registered.
Wayback snapshots may exist but cannot be scraped programmatically — and
licensing would still need to be sorted with the original rights-holders even
if archived data were recoverable. **Do not re-investigate.**

## Per-source action notes

### Tier 1 — likely accessible, high payoff

**Beacon for Freedom of Expression** — `search.beaconforfreedom.org` — **DEAD as of 2026-05-20**
- Norwegian Library project, Michelle Tisdel, 2003-(presumed dead)
- Cross-jurisdictional, 50,000+ records estimated globally
- McDonald (Literature Police): "neither complete nor especially reliable" — quality caveat
- Verification 2026-05-20: search subdomain `ECONNREFUSED`; apex domain redirects to a sushi restaurant (domain lapsed and re-sold)
- Status: **dead — do not re-investigate**. Any recovery would require scraping Wayback snapshots + locating original rights-holders for licensing — disproportionate effort vs. building US prison / PEN America paths.

**PEN America Index of School Book Bans** — `pen.org/banned-books`
- US K-12 school book challenges + removals; published quarterly
- Already registered in [src/lib/imports/source-registry.ts](../src/lib/imports/source-registry.ts) as `pen_america`, tier='high-volume', never productively used
- Likely 5,000+ US school-removal records since 2021
- Status: **infrastructure ready, importer not built**
- Next: Build `scripts/import-pen-america-csv.ts` that loads their public dataset; dedup against existing 4,000+ US bans

**US prison-system FOIA spreadsheets** — `bookstoprisoners.net` + state DOC reports
- Multiple state DOCs (TX, KS, VA, CA, SC, WA, NC) with public-records-based banned-books lists
- TDCJ alone: 22,000+ records (per Kasseler tally)
- All US-public-records-based → Public-Information-Act protected; redistribution generally OK with attribution
- Status: **not yet investigated**
- Next: Inventory the actual URLs at bookstoprisoners.net + each state DOC; build a per-state CSV importer

### Tier 2 — likely restricted but worth verifying

**Wolfgang Both — Verbannte Bücher Berlin** — `berlin.de/geschichte/nationalsozialismus/verbannte-buecher/`
- Nazi-era + DDR-era prohibited literature database
- 4,700+ records in Kasseler's sample
- Berliner Senat-funded; needs explicit licensing check
- Both is acknowledged advisor on McDonald's Literature Police project — same network, possibly receptive
- Next: WebFetch site + send Wolfgang Both an inquiry email

**Beslaglagte bøker (Norway)** — Nasjonalbiblioteket
- WW2-era seized books from German occupation
- 1,100+ records in Kasseler
- Norwegian government / national library; likely permissive but needs check

**DIDOC — Dawit Isaak Database of Censorship** — `didoc.dh.gu.se`
- Pilot academic database, Omeka-S + Linked Open Data; ~160 curated titles (from ~1,200 in the wider Dawit Isaak-biblioteket collection in Malmö)
- Partners: GRIDH (U. Gothenburg), Lund University, Swedish PEN, Svenska Akademien, Crafoord-stiftelsen
- Event-model fields (ban type / reason / location) align cleanly with our `reasons` / `scopes` schema
- Paper: DHNB, https://journals.uio.no/dhnbpub/article/view/13025
- Per-record permalinks exist (`/item/<id>`); Omeka-S default exposes `/api/items` (JSON-LD) — not verified open yet
- License: **not stated on site** — must be clarified before any ingest
- **Outreach sent 2026-05-25** to dawitisaakbiblioteket@malmo.se (+ cc GRIDH) — asking license, access modality, attribution model, scope exclusions
- Status: **awaiting reply** — re-poke after 2026-06-08 if no response

**ASKI** (Greece junta), **Memoria Provincial Córdoba** (Argentina junta), **Livros Proibidos** (Portugal)
- All academic / human-rights-archive bodies
- Each ~700–900 records — bounded, useful Latin-script corpus for jurisdictions where we have ~zero

### Tier 3 — restricted, off-limits for bulk

**Opus Dei Italian Index 2003**, **Bachleitner Vienna 1750–1848**, **Karaca Turkey 2013**
- All copyrighted academic/commercial publications
- Individual titles citeerbaar via standard academic attribution; bulk reuse out of scope

## Three concrete next-step paths

1. ~~**Beacon poll**~~ — done 2026-05-20: dead domain, scrubbed.
2. **PEN America activate** (~2 hrs). Infrastructure in place; build CSV loader; dry-run against existing US bans. Note: also a back-fill candidate — the 552 books seeded by `scripts/add-pen-america-books.ts` (Apr 2026) appear to lack proper `ban_sources` provenance; an activation pass can both add new records and back-fill provenance on the existing seed set.
3. **Kasseler-as-index** (per-lookup). For specific titles we want to identify upstream for, lookup via Kasseler's web UI (well under 1%). Don't ingest from Kasseler; ingest from the upstream they cite.

## Discarded paths (from session ending 2026-05-20)

- **Direct Kasseler bulk-ingest** — denied by Gassner.
- ~~**Russia via Wikipedia bulk parser**~~ — initial route was dropped because `Censorship_in_Russia` has no wikitable. **Superseded 2026-05-28** by direct ingest of the Минюст RSS feed at https://minjust.gov.ru/ru/subscription/rss/extremist_materials/ (Federal List of Extremist Materials, 5,467 items, ~498 book-like). 46 recent (≥2022) Минюст entries + 9 hand-curated article cases imported via [scripts/import-russia-bans.ts](../scripts/import-russia-bans.ts); RU bans 34 → 88. Remaining Минюст backlog (~440 items, mostly Jehovah's-Witnesses 2020 mass-bans + older religious tracts) intentionally deferred to keep the dataset balanced toward the journalistic 2022-2026 narrative. Cyrillic→slug transliteration uses an inline BGN/PCGN map in the importer.
- **Australia / South Africa via dedicated Wikipedia list pages** — both redirect to sections within `List_of_books_banned_by_governments`, which we already imported (May 14).
- **France via Legifrance pipeline (Cloudflare-bypass)** — superseded by ChatGPT-discovery workflow used 2026-05-19; 31 arrêtés already in DB via [scripts/import-legifrance-json.ts](../scripts/import-legifrance-json.ts).
