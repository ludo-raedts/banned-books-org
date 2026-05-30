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

### Severely underrepresented jurisdictions (Tier 1)

These countries are major censorship jurisdictions but we have minimal documentation:

| Country | Code | Current bans | Wiki entries | Notes |
|---|---|---:|---:|---|
| **Iran** | IR | 54 | 4 | Theocratic state, decades of book bans; Wiki underrepresents. Tier-1 target. |
| **China** | CN | 60 | 36 | Industrial-scale censorship; Wiki has 36 entries but PEN America China Reading Room has hundreds. |
| **Saudi Arabia** | SA | 18 | 3 | Wahhabi censorship; LGBT/feminism/religious-dissent bans. Tier-1. |
| **Pakistan** | PK | 11 | 5 | Blasphemy law + political. |
| **Egypt** | EG | 9 | 2 | Cairo Institute for HR Studies + Mada Masr + EIPR document. |
| **Indonesia** | ID | 9 | 3 | PKI / atheism bans, KPI documentation. |
| **Bangladesh** | BD | 7 | 5 | Secular vs Islamist censorship. |
| **Lebanon** | LB | 8 | 4 | Hezbollah/Israel-related bans. |

### Moderately underrepresented (Tier 2)

| Country | Code | Current | Wiki | Notes |
|---|---|---:|---:|---|
| Vietnam | VN | 27 | 15 | Communist Party censorship. |
| Israel | IL | 26 | (regex miss) | Mostly Palestinian/Arab content. |
| Yugoslavia successor states | YU/RS/HR/SI/BA/XK | 0-15 | 15 | Post-war breakup era. |
| Turkey | TR | 13 | (not in list) | Erdoğan-era press + book censorship; Karaca 2013 catalog cited in upstream-sources-inventory. |
| South Korea | KR | 18 | 9 | 2008 + 2011 military bans + recent sex-ed bans. |
| Italy | IT | 17 | 2 | Index Librorum + fascist-era. |
| Brazil | BR | 11 | 1 | Military dictatorship era. |
| Portugal | PT | 11 | 2 | Salazar/Caetano "Livros Proibidos" — 892 records (Kasseler-cited upstream, see inventory). |

### Zero-coverage candidates (Tier 3)

Some countries have zero bans despite known censorship history:

- **Uzbekistan** (UZ): 0 — Karimov-era censorship documented
- **Liberia** (LR): 0 — civil-war era
- **Palestinian Territories** (PS): 0 — Hamas + PA bans
- **Slovakia** (SK), **Kosovo** (XK), **Cyprus** (CY): 0
- **Croatia** (HR), **Slovenia** (SI): 0 — post-Yugoslavia successor states
- **Senegal** (SN), **Papua New Guinea** (PG): 0

## Concrete next-session plan

### Phase 1 — Tier-1 Wikipedia sweeps (~half day)

Five Tier-1 countries with the highest expected yield. For each: Firecrawl-scrape the Wikipedia section, parse table to JSON, dry-run, apply.

| # | Country | URL anchor | Est. new entries |
|---|---|---|---:|
| 1 | Iran | #Iran | ~10-20 (Wiki + Perplexity) |
| 2 | China | #China | ~30-50 |
| 3 | Saudi Arabia | #Saudi_Arabia | ~10-15 |
| 4 | India | #India (regex missed — manual check needed) | ~20-30 |
| 5 | Egypt | #Egypt | ~5-10 |

URLs to scrape (all from same global list):

```
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#Iran
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#China
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#Saudi_Arabia
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#India
https://en.wikipedia.org/wiki/List_of_books_banned_by_governments#Egypt
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

- **Russia FSEM** (minjust.gov.ru) — 5,500 entries via Firecrawl-crawl + book-filter → 500-1,500 new bans
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

## Status

- ✅ Singapore proof-of-concept committed (commit `f521c5c`, batch1 + batch2 = 31 + 6 = 37 new bans)
- ✅ Russia FSEM batch1 committed (commit `8bd8a5d`, 44 entries)
- ✅ Iran probe + cleanup committed (commit `9dd34ed`, +2 new bans, 31 renames, 4 duplicate merges)
- ✅ Generic per-country importer ready (`import-singapore-wiki.ts` reads `country_code` from JSON)
- ✅ Non-Latin title cleanup template ready (`cleanup-iran-titles.ts`)
- ✅ Safe-merge duplicate template ready (`merge-iran-duplicates.ts`)
- ⏸ Tier-1 sweep deferred (Iran probe consumed the Tier-1 budget; remaining: China, Saudi Arabia, India, Egypt, Pakistan, Indonesia)
