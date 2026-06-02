# Banned Books — Open Censorship Core: Data Descriptor

- **Dataset:** Banned Books — Open Censorship Core
- **Publisher:** Banned Books (https://www.banned-books.org)
- **Creator:** Ludo Raedts
- **ORCID:** https://orcid.org/0009-0006-8358-7119
- **License:** CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/)
- **Concept DOI:** `TODO(zenodo)` — paste the version-independent concept DOI here after first publish (e.g. `10.5281/zenodo.XXXXXXX`).
- **Companion files:** `books.csv`, `authors.csv`, `bans.csv`, `ban_reasons.csv`, `ban_sources.csv`, `countries.csv`, `schema.json`, `README.md`, `LICENSE.txt`.

---

## 1. Purpose & scope

Banned Books is a catalogue of books that have been banned, restricted, or
sustainedly challenged anywhere in the world, with a source citation behind
every entry. This deposit is the **open, citeable core** of that catalogue: the
structured, verifiable facts — who banned what, where, when, why, and on whose
authority — together with the reason taxonomy and the source citations that let
a researcher check each record.

It is deliberately **not** identical to the commercial dataset sold at
`/dataset`. The split is principled:

- **Open (this deposit, CC-BY-4.0):** facts about censorship and the citations
  that ground them.
- **Commercial (separate license):** editorial prose (book and ban
  descriptions, censorship context), enrichment (ISBNs, cover images, author
  biographies and photos, edition data), and convenience formats (a single
  denormalised JSON file and a ready-to-query SQLite database).

The reason **taxonomy** (the reason *slug*, e.g. `lgbtq`, `political`) is open;
the written description paragraph that interprets a ban is commercial.

**Coverage at the snapshot used to write this descriptor** (figures move as the
catalogue grows — the deposited files are the authority):

- ~14,000 books, ~8,650 authors
- ~28,730 ban events across 119 countries (including defunct states: USSR, East
  Germany, Czechoslovakia, Yugoslavia)
- ~52,800 ban–reason links and ~28,800 ban–source citations

**Scope.** This deposit covers *books*. Records must describe a real
removal/restriction with an institutional actor and a documented decision (see
§4). The catalogue does not carry a media-type field, so non-book media are not
systematically distinguished or excluded at the schema level; the editorial
intent is books, but the data offers no hard guarantee that every row is one.

---

## 2. Data model

Six CSV tables. All join keys are public, human-readable slugs or codes; the
only surrogate key is `ban_id` (a row identifier needed because a ban has no
natural slug). `schema.json` holds the machine-readable column types.

```
authors ──< (books.author_slugs, pipe-split) >── books ──< bans >── countries
                                                            │
                                              ┌─────────────┴─────────────┐
                                         ban_reasons                 ban_sources
```

| Table | Grain | Primary key | Foreign keys |
|-------|-------|-------------|--------------|
| `books.csv` | one row per work | `slug` | `author_slugs` (pipe-`\|`-separated) → `authors.slug` |
| `authors.csv` | one row per author | `slug` | — |
| `bans.csv` | one row per ban **event** | `ban_id` | `book_slug` → `books.slug`; `country_code` → `countries.code` |
| `ban_reasons.csv` | many rows per ban | (`ban_id`,`reason_slug`) | `ban_id` → `bans.ban_id` |
| `ban_sources.csv` | many rows per ban | — | `ban_id` → `bans.ban_id` |
| `countries.csv` | one row per country | `code` | — |

**Join keys.**
- `books.author_slugs` is a pipe-separated (`|`) list — split it, then join each
  element to `authors.slug`. This carries the book↔author relationship without a
  separate join table.
- `bans.book_slug` → `books.slug`; `bans.country_code` → `countries.code`.
- `ban_reasons.ban_id` and `ban_sources.ban_id` → `bans.ban_id`.

**Conventions.** Array fields are pipe-separated (`|`). NULLs are encoded as the
empty string. Years are integers and may be negative or pre-1000 CE for ancient
works.

---

## 3. Field definitions

Authoritative, machine-readable types live in `schema.json`. Summary:

**`books.csv`** — `slug` (PK), `title` (canonical published title),
`first_published_year` (int, nullable), `original_language` (code, nullable),
`author_slugs` (pipe-separated `authors.slug`, nullable).

**`authors.csv`** — `slug` (PK), `display_name` (slug-canonical, Anglo-friendly
form), `birth_country` (code, nullable), `is_placeholder` (boolean: `true` =
aggregate / non-attributable bucket entry such as "Anonymous" or "Various
Authors" that groups unrelated works). *No biographies* — those are commercial.

**`bans.csv`** — `ban_id` (PK, surrogate), `book_slug` (FK), `country_code`
(FK), `year_started` / `year_ended` (int, nullable; `year_ended` empty if in
force/unknown), `action_type` (one of `banned`, `restricted`, `challenged`),
`status` (one of `active`, `historical`, `rescinded`), `scope` (taxonomy slug:
`school`, `government`, `prison`, …; empty if unscoped). `banned` and `active`
dominate; `challenged` and `rescinded` are smaller categories.

> **Withheld rows.** A tiny number of bans with an *indeterminate* status
> (`status = 'unclear'`; currently 2 rows) exist in the live catalogue but are
> deliberately omitted from this open export. As a result the open ban count is
> marginally lower than the headline figure on banned-books.org. The DB is not
> modified — these rows simply aren't deposited.

**`ban_reasons.csv`** — `ban_id` (FK), `reason_slug` (stable taxonomy slug),
`reason_label` (English label). Zero or more rows per ban.

**`ban_sources.csv`** — `ban_id` (FK), `source_name`, `source_url` (nullable),
`source_type` (nullable), `verification_status` (`verified` = URL works and
archived; `pending` = archive attempt failed; `broken` = URL 4xx/5xx;
`unverified` = never attempted; empty on pre-pipeline rows), `accessed_at` (ISO
date, nullable), `locator` (in-source page/row/entry id, nullable). Zero or more
rows per ban.

**`countries.csv`** — `code` (PK; ISO 3166-1 alpha-2 where applicable, custom
codes for defunct states), `name_en`.

---

## 4. Methodology — how bans are sourced and verified

Data is drawn from PEN America, the American Library Association (ALA),
Wikipedia, Reporters Without Borders, Index on Censorship, government records,
and national-press reporting. Every ban entry links to its source via
`ban_sources.csv`.

**What counts as a ban.** A broad definition: any formal removal, import
restriction, publication prohibition, or sustained challenge that results in a
book becoming unavailable through an official channel. Both *hard* bans (legally
prohibited nationwide) and *soft* bans (withdrawn from a school or library after
pressure) are included, provided there is a documented decision with an
institutional actor.

**What is excluded.** Books that are merely out of print, books a publisher
chose not to distribute, and books that are culturally stigmatised but legally
available. The restriction must have an institutional actor and a documented
decision.

**Verification.** Sources carry a `verification_status`. Archive-verification is
an ongoing process and the field is mostly unpopulated so far. At the snapshot
used here, of ~820 source rows the distribution is roughly: `unverified` ≈ 89%,
empty/`(null)` ≈ 10%, `verified` = 5 rows, `pending` = 2 rows, and `broken` = 0.
**In practical terms, filtering on `verification_status = 'verified'` currently
returns a near-empty subset (a handful of rows) and is not yet a usable quality
gate.** Treat it as a lever that becomes useful as verification runs progress,
not as something to filter on today. The catalogue is built mostly by automated
import from public sources and then enriched and reviewed; not every entry has
been individually checked by a human.

**Per-record data quality.** A composite per-record `data_quality_status`
(`confident` / `default` / `flagged`) exists in the underlying catalogue, but it
is intentionally **not** included in this open release; it is available in the
commercial dataset. The open data does not provide an equivalent quality
signal — the source citations in `ban_sources.csv` let you inspect provenance,
but they are not a substitute for the composite status.

---

## 5. How to count — distinct books vs. raw events

**Rank on distinct books or distinct countries, never on raw ban-row counts.**

`bans.csv` holds **one row per event**. A US title removed across many school
districts produces many rows; a book banned nationwide by a single government
decision appears once. PEN America's per-district granularity therefore inflates
the United States' raw row count roughly 2–3× relative to distinct titles.

- **Canonical metric for "how widely banned":** count **distinct `book_slug`**
  (and/or **distinct `country_code`**).
- **Raw `bans.csv` row counts** are supporting detail only — never a repression
  ranking.

Worked example (snapshot figures): ~28,700 raw ban rows resolve to ~14,000
distinct books — the gap is overwhelmingly US school-district events for a
smaller set of titles. A country ranking built on raw rows would massively
overstate the US relative to a ranking built on distinct banned titles.

The export is intentionally **not pre-aggregated**: every event is preserved so
researchers can choose their own grain. This section exists so they don't
mistake the event grain for a title count.

**Status semantics.** `rescinded` is a genuine category, not a synonym of
`historical`: it marks a ban that was formally *lifted in a later year* (nearly
all such rows — 51 of 52 at the current snapshot — carry a `year_ended`),
whereas `historical` simply means no longer in force without asserting a
documented reversal.

---

## 6. Known gaps and limitations

This dataset is honest about what it is not.

1. **Documentation bias — the US "counts more than it bans more."** The United
   States dominates the catalogue not because American libraries censor the most
   books, but because America *counts* them: PEN America and the ALA
   systematically record school-district removals and challenges, working with
   local journalists and librarians. No comparable reporting infrastructure
   exists elsewhere. A high US count reflects a watchful civil society; a low
   count for an authoritarian state reflects the absence of one.

2. **Authoritarian under-coverage.** Iran, China, North Korea, Saudi Arabia,
   and Belarus maintain comprehensive censorship regimes in which whole
   categories of literature are simply unavailable — but with no free press or
   civil-society watchdog, those bans rarely surface in any accessible database.
   The catalogue records only a fraction of what likely occurs in closed
   societies. **Absence of records is not evidence of freedom.**

3. **English-language reporting skew.** Sources we can index are
   disproportionately English-language, biasing coverage toward the
   Anglophone world and well-reported events.

4. **School-bans are structurally different.** A school-board removal is a local
   administrative decision, not national law; the book remains available
   elsewhere. The catalogue records both school and government bans but
   distinguishes them via `scope` and `status` — do not treat them as
   equivalent.

5. **Language / classification subset.** A subset of records carries imperfect
   `original_language` classification (automated language inference is
   error-prone for short titles and transliterated works). Treat
   `original_language` as indicative, not authoritative, for fine-grained
   linguistic analysis.

6. **Automated import, partial human review.** Most records originate from
   automated pipelines. Broad strokes (title, author, ban country) are reliable;
   narrower details may be provisional. `ban_sources.verification_status` is
   mostly `unverified` today (see §4), so it cannot yet stand in for record-level
   quality filtering.

7. **Placeholder / aggregate author entries.** A small number of `authors` rows
   are non-attributable buckets ("Anonymous", "Various Authors") that group
   unrelated works. They are flagged `is_placeholder = true`; filter them out
   before computing per-author statistics so a bucket isn't treated as a single
   author.

---

## 7. Licensing

This deposit — the open censorship core — is released under the **Creative
Commons Attribution 4.0 International License (CC-BY-4.0)**. You may share and
adapt the data for any purpose, including commercially, provided you give
attribution (see §8).

**Not included in this open release** (available under a separate commercial
license at https://www.banned-books.org/dataset):

- Editorial prose: book descriptions, ban descriptions, censorship context,
  extended context.
- Enrichment: ISBN-13, cover images and cover status, author biographies and
  photos, bookshop/edition data.
- Convenience formats: the single-file denormalised JSON and the SQLite
  database.

The principle: **facts about censorship are open; editorial prose and
convenience formats are paid.**

---

## 8. Citation guidance

Cite the **concept DOI** — the version-independent Zenodo DOI that always
resolves to the latest version — not a specific version DOI, unless you need to
pin an exact snapshot for reproducibility.

> Raedts, Ludo. *Banned Books — Open Censorship Core.* banned-books.org. Zenodo.
> CC-BY-4.0. ORCID: https://orcid.org/0009-0006-8358-7119. DOI: `TODO(zenodo)`.

When attributing in prose or visualisations: **"Banned Books
(banned-books.org), CC-BY-4.0"**, with a link to the DOI. If you publish a
ranking or aggregate, please state whether it is built on distinct books /
countries or on raw ban events (§5), so readers can interpret it correctly.
