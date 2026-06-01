# Firecrawl + Perplexity import roadmap

> Prepared 2026-05-29 after the Singapore proof-of-concept (43 → 48 bans).
> Tracks the next-session scale-out for systematically growing banned-books.org
> via the proven Firecrawl scrape + Perplexity primary-source verification
> pattern.

## Methodology

The Singapore pipeline established a repeatable four-step cycle:

1. **Wikipedia section scrape** — `firecrawl scrape <list-page> --format markdown --only-main-content` against EN Wikipedia's "List of books banned by governments" (per-country section). Yields the canonical curated subset.
2. **Perplexity primary-source research** — ask Perplexity for "welke boeken zijn verboden of verboden geweest in {country}? Geef lijst met bronnen". Returns supplementary entries with direct primary-source URLs (gov press releases, national newspapers).
3. **Consolidate to JSON** — combine Wikipedia + Perplexity into `data/{country}-batch{N}.json` with per-entry `source_locator` carrying the most authoritative URL.
4. **Apply via generic importer** — reuse `scripts/import-singapore-wiki.ts` (supports `--input=PATH`, per-entry `source_locator`, `Anonymous` author fallback to placeholder id 33).

## Reusable scripts (already built)

| Script | Pattern | Use for |
|---|---|---|
| `scripts/import-singapore-wiki.ts` | Per-country Wikipedia + primary-source overlay | Wikipedia-section style imports |
| `scripts/import-fsem-russia.ts` | Curated subset from a single large official list | Government registries (FSEM-like) |
| `scripts/import-pen-belarus-soviet.ts` | Multi-batch with `--input` arg | Historical period sub-batches |
| `scripts/import-apm-biblioteca.ts` | PDF extraction + per-page locator | Local-PDF based catalogs |
| `scripts/_parse_apm_pdf.py` | pdfplumber with font detection + column slicing | Generic PDF parser template |

## Coverage delta (current DB vs Wikipedia coverage)

### Snapshot 2026-06-02 — global coverage

**Headline:** **111 countries** with ≥1 ban, **28,653 total bans**, **13,978 books**, **8,601 authors**. Multi-agent parallel work since the original roadmap has dramatically expanded coverage beyond what the original Tier-1/2/3 tables anticipated. New historical country codes added: **SU** (Soviet Union, 25), **DD** (East Germany / DDR, 8) — and via 80+ ISO country codes covering Africa, Caucasus, Central Asia, and the Pacific.

**The original Tier-1 list has largely closed.** Iran 54→57, China 60→60, Saudi Arabia 18→27, Pakistan 11→21, Egypt 9→24, Indonesia 9→29, Bangladesh 7→8, Lebanon 8→8. Several of these were addressed via direct Firecrawl Tier-1 searches (Egypt batch1, Pakistan batch1, Indonesia batch1+2), others by parallel-agent activity in subsequent sessions.

### Severely underrepresented jurisdictions (Tier 1 — now updated)

These remain the largest impact-per-effort gaps relative to known censorship history:

| Country | Code | Current bans | Notes |
|---|---|---:|---|
| **China** | CN | 60 | Industrial-scale censorship; PEN America China Reading Room + Article 19 China desk + Foreign Correspondents Club Hong Kong = strong Tier-1 stack. Estimated still ≥10× under-represented. |
| **Saudi Arabia** | SA | 27 | Wahhabi censorship; LGBT/feminism/religious-dissent bans. SaudiCensorship.org, Arabic primary press largely untapped. |
| **India** | IN | 135 | Already decent (Indian Kanoon case law) but Hindutva-era 2014+ bans on academic / historical works under-covered. |
| **North Korea** | KP | 6 | DPRK book-bans hard to research; Bandi case + recent defector accounts via RFA Korea. |
| **Cuba** | CU | 21 | Newly opened by parallel-agent work; Castro/Soviet era + recent Decree 349 cases. |
| **Bangladesh** | BD | 8 | Blasphemy law + Islamist street-pressure cases (Taslima Nasrin, etc.). |
| **Bahrain / Qatar / UAE** | BH/QA/AE | 1/6/8 | Gulf monarchies; Article 19 MENA + Index on Censorship Gulf coverage. |

### Moderately covered (Tier 2 — now achievable via direct Firecrawl)

| Country | Code | Current | Notes |
|---|---|---:|---|
| Hong Kong | HK | **635** | Massive expansion since national-security law 2020. Independent Firecrawl import landed via parallel-agent work. |
| Soviet Union | SU | 25 | Historical code now in use — Stalin / Brezhnev era bans pre-1991. |
| Czechoslovakia | CS | 23 | Historical code (separate from CZ=9 / SK=0); covers 1948-1992 communist era. |
| East Germany | DD | 8 | Polunbi-style DDR catalog partially landed via parallel work (was deprioritized "te groot" in original roadmap). |
| Yugoslavia | YU | 21 | Legacy code; successor states RS=1 / HR=0 / SI=0 / BA=1 / XK=0 still need split. |
| Romania | RO | 14 | Ceaușescu-era; HRW + Paul Goma archive. |
| Zimbabwe | ZW | 14 | Ian Smith Rhodesia → Mugabe; Mushakavanhu/Frederikse sources documented. |
| Tanzania, Kenya, Nigeria, Uganda, Algeria, Sudan, Morocco | TZ/KE/NG/UG/DZ/SD/MA | 9-16 each | African press cluster (allafrica, nation.africa, monitor.co.ug, theeastafrican) substantially scraped. |
| Myanmar, Cuba, Vietnam | MM/CU/VN | 5/21/33 | Authoritarian-state cluster. |
| Latvia, Lithuania, Estonia | LV/LT/EE | 2/1/1 | Baltic Soviet-occupation era — still very thin. |

### Remaining zero-coverage / very-low countries

- **Slovakia** (SK), **Kosovo** (XK), **Cyprus** (CY), **Liberia** (LR), **Papua New Guinea** (PG): 0 each
- **Croatia** (HR), **Slovenia** (SI): 0 (Yugoslavia successor split unresolved)
- **Senegal** (SN): 0
- **Bolivia** (BO), **Ecuador** (EC): 0 each (Andean dictatorship-era under-covered)

## Concrete next-session plan

### Phase 1 — Tier-1 Wikipedia sweeps (~half day)

> **Status 2026-06-02**: Phase 1 is **substantially done** through 2026-05-29/06-01 sweeps. Iran, Egypt, Indonesia, Pakistan, Hungary, Italy, Poland, Czechoslovakia, Ukraine, Japan, Philippines, Chile, Uruguay, Brazil all landed via the methodology below. The original 5-country Tier-1 list has been completed or upgraded; **China, Saudi Arabia, India** remain as the highest-impact untackled Tier-1 cases — each plausibly yielding 10-30 new bans via direct Firecrawl Tier-1 search (PEN America China Reading Room, SaudiCensorship.org, India HRW / Indian Express).

Five Tier-1 countries with the highest expected yield. For each: Firecrawl-scrape the Wikipedia section, parse table to JSON, dry-run, apply.

| # | Country | URL anchor | Est. new entries | Status |
|---|---|---|---:|---|
| 1 | Iran | #Iran | ~10-20 (Wiki + Perplexity) | ✅ done (2026-05-29) |
| 2 | China | #China | ~30-50 | ⏸ open |
| 3 | Saudi Arabia | #Saudi_Arabia | ~10-15 | ⏸ open |
| 4 | India | #India (regex missed — manual check needed) | ~20-30 | partial (135 already; +20-30 more open) |
| 5 | Egypt | #Egypt | ~5-10 | ✅ done (2026-05-29) |

URLs to scrape (all from same global list):

```
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#China
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#Saudi_Arabia
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#India
```

(In practice we scrape the full list once — already cached at `/tmp/lobbg.md` 1475 lines — and parse per country.)

### Phase 2 — Perplexity overlay (~2-3 hrs per country)

For each Tier-1 country, run a Perplexity research query to:
- Verify Wikipedia's entries against primary sources
- Identify post-Wikipedia bans (recent decisions not yet on Wikipedia)
- Document primary-source URLs (national newspapers, official gazettes)

Template prompt:
```
welke boeken zijn verboden of verboden geweest in {COUNTRY}? Geef een lijst
van boeken met titel, auteur, jaar van ban, reden, en primary-source URL
(officiële overheidsbron of nieuwsartikel — geen Wikipedia).
```

### Phase 3 — Big-source paths (later)

After the Wikipedia + Perplexity sweep, the next investment becomes scraping the structured ban-registries themselves:

- **Russia FSEM** (minjust.gov.ru) — ~5,500 entries via Firecrawl-crawl + book-filter. **Status as of 2026-06-01: partial sample done.** 45 entries already imported directly from minjust.gov.ru (in addition to 44 from the Wikipedia overview). A full crawl would target the remaining ~5,000 entries; conservative book-yield estimate 1,500-2,000 after filtering out leaflets/audio/video.
- **PEN America Index of School Book Bans** (registry already in source-registry, importer not built) — 5,000+ US school bans (vs. our 20,776 — but with district granularity)
- **US Prison FOIA** (TX, KS, VA, CA, SC, WA, NC) — combined 50,000+ records
- **South Korea military banned books** — 23-book 2008 list + 19-book 2011 list (per Wiki, not all in DB)
- **DDR Polunbi** — explicitly deprioritized by user ("lijst te groot") but ~10K records achievable in batches

### Phase 4 — NGO monitoring overlays (next quarter)

- **PEN International cases-per-country** (cited writers + their banned works)
- **Article 19 country reports** (Index on Censorship affiliate)
- **HRW country reports** mentioning banned books
- **RSF Press Freedom Index** countries — cross-reference for book-specific cases

## Notes / quirks

- **What Islam Is All About** (book 7378) has `year_started=1997` (publication year) but the actual SG ban was 2018 per primary sources. Pre-existing data-quality issue — fixable via a small title-override mini-script if prioritized.
- **Madonna's "Sex"** is stored under title "Madonna Erotica" (book 12249) — pre-existing parser quirk. Can be corrected via `title_override` field in any future import touching it.
- **Wikipedia regex misses** — my count for India/Israel/Taiwan/Ukraine/Uzbekistan came up as 0 due to format variation (`_[link](url)_` vs `| _Title`). Manual inspection needed for these.
- **Yugoslavia successor states**: most legacy Yugoslavia bans don't map cleanly to current country codes (RS/HR/SI/BA/XK). Wikipedia keeps them under "Yugoslavia" (we have 15). Splitting requires editorial judgment per book.

## Lessons from the Iran probe (2026-05-29)

Tried the standard pipeline on Iran (already 54 bans, expected modest growth).
Three learnings worth carrying forward:

### Learning 1 — Wikipedia comprehensive lists often already imported

Iran's coverage came almost entirely from a one-off Wikipedia bulk-parse of
[Book censorship in Iran](https://en.wikipedia.org/wiki/Book_censorship_in_Iran).
36 of 39 Wikipedia entries already in DB. **Check your existing-coverage delta
BEFORE running the Wikipedia step** — for already-imported countries the
Perplexity-overlay is the only value-add.

Pre-flight query template:
```sql
SELECT bs.source_name, COUNT(*)
FROM bans b
JOIN ban_source_links bsl ON bsl.ban_id = b.id
JOIN ban_sources bs ON bs.id = bsl.source_id
WHERE b.country_code = 'XX'
GROUP BY bs.source_name
ORDER BY 2 DESC;
```

### Learning 2 — Perplexity is weak on non-Latin-script jurisdictions

Iran Perplexity-pass yielded 6 entries, **4 already in DB**, only 2 genuinely
new (Khosrow and Shirin + Zhuan Falun). Source quality was poor: blogspot
posts + secondary Dutch aggregators (oneworld.nl, oba.nl). One source URL
was literally `banned-books.org` — Perplexity citing our own site back to us.

Reason: Iran's recent bans are documented in Persian-language primary
sources (Tasnim News, Mehr News, IRNA, plus Persian-language opposition
media). Perplexity's English-indexed knowledge has weak coverage of these.

**Better source-stack for non-Latin-script jurisdictions:**

| Tier | Source | Coverage |
|---|---|---|
| 1 | PEN International cases database (en.pen-international.org/case-list) | All countries, writer-centric |
| 1 | Article 19 country reports (article19.org/country/{slug}/) | Strong on legal/structural framing |
| 1 | Index on Censorship country pages (indexoncensorship.org) | Editorially curated cases |
| 2 | IranWire (`iranwire.com/en/`) — Iran-specific | English archive of Iranian dissident journalism |
| 2 | Radio Farda (`radiofarda.com`) | Persian + English translations |
| 2 | RFA / RFE/RL country desks | China, Iran, Cuba, Vietnam, North Korea |
| 3 | HRW + Amnesty country reports | Annual snapshots |
| 3 | Reporters Without Borders (RSF) annual reports | Press-freedom-cited cases |

When prompting Perplexity for these jurisdictions, **explicitly require Tier-1
URLs** ("alleen PEN International / Article 19 / Index on Censorship") and
exclude blogspots/aggregators/Wikipedia.

### Learning 3 — Non-Latin titles need post-import cleanup

The earlier Wikipedia bulk-parse stored transliterated Persian as primary
title (e.g. `āyāt-e sheytāni`). Per project doctrine the English meaningful
translation should be primary; transliteration goes to
`books.title_transliterated`; `books.title_native_script` records the script
family. Cleanup script
([scripts/cleanup-iran-titles.ts](../scripts/cleanup-iran-titles.ts)) is now
the template for similar fixups on Chinese / Arabic / Cyrillic imports
(China, Iran, Saudi Arabia, Egypt, Russia historic).

For the four IR records where the canonical English-titled book already
existed, [scripts/merge-iran-duplicates.ts](../scripts/merge-iran-duplicates.ts)
demonstrates the safe-merge pattern: reassign bans from obsolete →
canonical, delete book_authors + obsolete book row, preserve all
source-link attribution on the ban_id.

### Implication for next-session candidates

- **China** and **Saudi Arabia** should both expect Latin-vs-native title
  mismatches from any Wikipedia-style import. Plan time for cleanup similar
  to Iran's. Use the IR cleanup script as template — change `Arabic` →
  `Han` / `Arabic` / `Cyrillic` as appropriate, refresh the hardcoded
  translation map.
- **India, Egypt, Pakistan, Indonesia** mostly publish English-language
  bans (or English-equivalents readily available), so title cleanup will
  be lighter.
- **Wikipedia first, Perplexity only if needed**: for Iran the Wikipedia
  list already covered nearly everything. The Perplexity step's value is
  highest for very-recent bans (post-2020) and primary-source attribution
  — not for finding new titles.

## Russia — extended status (2026-06-01)

After the original FSEM batch1 (Wikipedia overview, 44 entries) several other
ingestion paths into Russia landed via separate dialogs / batches. Current
RU coverage is **137 bans** with multi-source provenance:

| Source | Citations | Path |
|---|---:|---|
| minjust.gov.ru (official FSEM, Firecrawl-scraped) | 45 | Path B (partial — 45 of ~5,500) |
| Wikipedia: Federal List of Extremist Materials | 44 | Path A (original batch1) |
| Wikipedia: List of books banned by governments | 17 | Bulk import |
| theins.press (independent Russian press) | 9 | Independent-press wave |
| Meduza (English) | 5 | Independent-press wave |
| The Moscow Times | 5 | Independent-press wave |
| HRW (World Report 2024 + 2025 + Russia desk) | 6 | Tier-1 NGO |
| Index on Censorship | 3 | Tier-1 NGO |
| PEN International / Amnesty / PEN America | 4 | Tier-1 NGO |
| Tsarist + Soviet-era long-tail Wikipedia entries | ~8 | Pre-imported |

Year coverage now spans 1885–2026, with strong concentration on the post-
Ukraine-war repression wave: 2022:13, 2023:19, 2024:23, 2025:15, 2026:5.

**Remaining open work on Russia:**

1. **Full FSEM crawl** — Path B completion. 45 of ~5,500 minjust.gov.ru
   entries done; the rest is mechanical (same Firecrawl-scrape pattern,
   ~50 entries per page, ~110 pages). Conservative book-yield 1,500-2,000
   after filtering out leaflets/audio/video.
2. **Memorial archive (Wayback)** — Memorial was banned in 2021; its
   archive of Soviet-era dissidents and specific banned titles lives
   only as Wayback snapshots now.
3. **Tsarist-era expansion** — only 3 entries (1885-1888) for a regime
   that ran centralized censorship 1804-1917 (Ustav o tsenzure 1804,
   Reformatory Statute 1828, Reformed Statute 1865 etc).

Path C (~5,500 records) is the highest-yield remaining single investment
in the entire roadmap if appetite returns.

## Status

- ✅ Singapore proof-of-concept committed (commit `f521c5c`, batch1 + batch2 = 31 + 6 = 37 new bans)
- ✅ Russia FSEM batch1 committed (commit `8bd8a5d`, 44 entries) — and subsequent independent batches grew RU to **137 bans** (see "Russia — extended status" above)
- ✅ Iran probe + cleanup committed (commit `9dd34ed`, +2 new bans, 31 renames, 4 duplicate merges)
- ✅ Indonesia (batch1 + batch2 = 8 new bans, 2010 Constitutional Court ban-law strike-down captured)
- ✅ Egypt (4 cases via Firecrawl Tier-1: Metro, Naji, Abu Zayd, Foda)
- ✅ Pakistan (Shame + Military Inc.)
- ✅ Hungary (Meseország + Hamvas + Konrád)
- ✅ Italy (2015 Venice Brugnaro 49-book children's ban)
- ✅ Poland (Szpilman 1946 + Michnik 1980s)
- ✅ Czechoslovakia/Czechia (6 normalization-era dissidents: Kundera, Havel, Hrabal ×3, Vaculík)
- ✅ Ukraine (Stus + 2015 Russian-nationalist wave: Dugin, Limonov, Glazyev)
- ✅ Philippines (2022 KWF/NTF-ELCAC red-tagging additions)
- ✅ Chile + Uruguay (1986 Valparaíso burning of García Márquez + Petkoff, Benedetti)
- ✅ Brazil (Freire + Marighella)
- ✅ Generic per-country importer ready (`import-singapore-wiki.ts` reads `country_code` from JSON)
- ✅ Non-Latin title cleanup template ready (`cleanup-iran-titles.ts`)
- ✅ Safe-merge duplicate template ready (`merge-iran-duplicates.ts`)

### Parallel-agent batches (landed in 2026-05-29..2026-06-02 sessions)

Multi-agent workstreams have substantially expanded coverage beyond the original roadmap forecast. **111 countries, 28,653 bans, 13,978 books, 8,601 authors.** Notable parallel-agent additions:

- **Hong Kong: 635 bans** — new largest non-US/MY/FR jurisdiction. Post-NSL 2020 wave.
- **Soviet Union (SU): 25 bans** — new historical code, separates Stalin/Brezhnev-era from Russian Federation
- **East Germany (DDR/DD): 8 bans** — was deprioritized "te groot" originally; partial DDR coverage now landed
- **Czechoslovakia (CS): 23 bans** — alongside Czechia (9) + Slovakia (0). Full normalization-era cohort.
- **Cuba (CU): 21 bans** — newly opened. Castro/Soviet era + recent Decree 349 cases.
- **Africa cluster expanded** — Tanzania 16, Nigeria 15, Kenya 10, Sudan 10, Algeria 9, Uganda 9, Morocco 12, Zimbabwe 14, Libya 6, Tunisia 6, Mozambique 2, Angola 2, Cameroon 2, Ethiopia 5, Malawi 3, Somalia 3
- **Caucasus / Central Asia opened** — Azerbaijan 2, Kazakhstan 4, Tajikistan 4, Turkmenistan 1, Uzbekistan 1
- **DPRK (KP): 6 bans** — newly opened; Bandi case + recent defector accounts via RFA Korea
- **Latvia/Lithuania/Estonia + Baltic expansion** — LV 2, LT 1, EE 1 (still very thin)
- **Burma/Myanmar (MM): 5 bans** — newly opened post-2021 coup wave

### Remaining open work

- ⏸ **Tier-1 final**: China, Saudi Arabia, India deeper Hindutva-era — direct Firecrawl Tier-1 search candidate
- ⏸ **Tier-2 European post-communist**: Bulgaria (10), Albania (6), Romania (14) — could each grow 2-3×
- ⏸ **Yugoslavia successor-state split**: 21 YU-legacy bans → split editorial judgment per book to RS/HR/SI/BA/XK
- ⏸ **Big-source paths**: Russia FSEM full crawl (≥1,500 books), PEN America registry, US Prison FOIA (50,000+), Memorial Wayback archive
- ⏸ **South America regional gap**: Bolivia 0, Ecuador 0 — and PY 5 / VE 3 / CO 4 / PE 3 all still <10
- ⏸ **Baltic states deepening**: LV 2 / LT 1 / EE 1 — Soviet-occupation era badly under-documented
- ⏸ **Caucasus/Central Asia deepening**: AZ 2 / KZ 4 / TJ 4 / TM 1 / UZ 1 — most have richer Soviet + post-Soviet ban histories
- ⏸ **Outstanding zero-coverage**: Slovakia, Kosovo, Cyprus, Liberia, Croatia, Slovenia, Senegal, Papua New Guinea
- ⏸ **Cleanup pile**: Fonseca "Feliz Ano Novo" / "Happy New Year" PT-EN duplicate; "What Islam Is All About" year-fix; Madonna "Sex" / "Madonna Erotica" title-restore
