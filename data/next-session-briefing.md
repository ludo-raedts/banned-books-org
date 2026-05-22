# Next-session briefing: PEN America longitudinal coverage

> Paste this whole file at the start of a fresh Claude Code conversation
> to bootstrap context. Supersedes earlier post-Kasseler / post-2024-25
> briefings.

## Status as of 2026-05-20 (verified against DB the next morning)

### PEN America per-academic-year coverage matrix

US-school book bans total **10,388** in DB across two PEN-sourced ingestion
paths. The 2024-25 academic year is the only one with per-district
granularity; everything older is at aggregate level (NULL region, NULL
institution) and is materially incomplete relative to what PEN published.

| Academic year | Bans in DB | Source | Granularity | Net gap vs PEN's published count |
|---|---|---|---|---|
| pre-2021 historical sample | 325 | source 190 | aggregate | n/a — curated sample, no full-year corpus |
| 2021-22 | 16 | source 190 | aggregate | ~2,500 missing (PEN cited 2,571 instances) |
| 2022-23 | 6 | source 190 | aggregate | ~3,300 missing (PEN cited 3,362 instances) |
| 2023 (year ambiguous) | 4 | source 190 | aggregate | — |
| 2023-24 | 1,149 | source 190 | aggregate | ~8,900 missing (PEN's 2023-24 sheet has 10,048 rows) |
| 2024-25 | 6,674 + 2,213 overlap | sources 2068 + 190 | **per-district** + aggregate | ~200 short of PEN's published 6,870 — acceptable overlap-count gap |

- **Source 190** (`https://pen.org/book-bans/` — generic landing URL): 3,714 bans across 3,703 books, almost 100% aggregate.
- **Source 2068** (`https://pen.org/book-bans/pen-america-index-of-school-book-bans-2024-2025/`): 6,674 bans, 3,701 books, all per-district.

### How source 190 was populated (undocumented archaeology — needs follow-up)

The April 24 seed script [scripts/add-pen-america-books.ts](../scripts/add-pen-america-books.ts) docstring says "PEN America's school book ban index (2021-2024)", with `MIN_COUNT=5` and `MAX_BOOKS=600` — so it loads books with ≥5 ban instances, ranked. Books table got ~552 books from that seed run, but only ~345 ban-rows landed on source 190 from the April run itself.

**The bulk of source 190 (3,101 of its 3,714 bans) was added in a single wave on 2026-05-03 that is not documented in any committed script or earlier briefing.** Best guess: a re-run with relaxed thresholds OR an aggregate-level dump from a different PEN report. Worth tracking down (`git log --since=2026-05-02 --until=2026-05-04`, check stash/untracked scripts) before further PEN imports so any granular re-import doesn't fight an opaque legacy state.

### The May 20 per-district 2024-25 import

[scripts/import-pen.ts](../scripts/import-pen.ts) — committed 2026-05-20 (commit `adce1a3`). Processes [data/pen-2024-25.csv](pen-2024-25.csv) (6,239 rows, 10 "Professionally Weeded" skipped, 35 deduped). 6,674 new bans across 126 new books at per-district granularity (region=state, institution=district). Schema migration that unlocked this: [20260520112552_bans_unique_per_location.sql](../supabase/migrations/20260520112552_bans_unique_per_location.sql) — extended `bans_unique_per_scope` to include `(region, institution)` with `NULLS NOT DISTINCT`.

### Open follow-ups — substantial, not blocking

Three PEN per-district reimports are still available. Each is the same multi-hour shape as the May 20 2024-25 run (not "30 min easy" — that earlier framing was wrong; net add per year is thousands of bans + many new books):

1. ~~**PEN 2023-24**~~ — **DONE 2026-05-22**. 10,051 new per-district bans inserted across 2,603 new books + 1,332 new authors via [scripts/import-pen-2023-24.ts](../scripts/import-pen-2023-24.ts) and source 2131 (`https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/`). Two runs (first run had 5 transient socket-failure batches dropping 500 bans; idempotent re-run recovered them with 0 errors). `bans.actor` populated from PEN's `Initiating Action` column for all 10,051 rows — first time we have this granularity. AY 2023-24 still has 1,149 aggregate-level source-190 bans (year_started=2024, region=NULL) standing alongside the new per-district rows — `--cleanup-aggregates` task (#4 below) collapses those.

2. **PEN 2022-23** — ~3,300 new bans. Sheet has 9 columns, no Secondary Author / Translator: `https://docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/`.

3. **PEN 2021-22** — ~2,500 new bans. `https://docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/`.

4. **`--cleanup-aggregates` pass** — once one or more granular reimports land, the **3,388 aggregate-level source-190 bans** across AY 2021-22 / 2022-23 / 2023-24 / 2024-25 become structurally redundant. Build a script that either collapses each aggregate row onto its granular sibling (merge sources, drop the aggregate row) or marks it `status='superseded'`. The pre-2021 historical sample (325 bans) stays — those have no granular replacement coming.

5. **Identify the May 3 wave** — 3,101 source-190 bans were added 2026-05-03 by a process not in any current script (per follow-up archaeology above). Find the script in git history / stash / untracked files, document it, decide re-run vs sunset.

6. **8 files contain stale comments** referencing the old `(book_id, country_code, year_started, scope_id)` unique-constraint shape (src/lib/wikipedia/dedup.ts, types.ts, importer.test.ts; scripts/_audit_soft_dupe_bans.ts, _check_ban_dupes.ts, merge-soft-dupe-bans.ts, import-wikipedia-list.ts, src/lib/imports/review-commit.ts). Functionally safe — the SELECT-then-INSERT pattern still works for NULL region/institution callers via NULLS NOT DISTINCT semantics. Worth a sweep at some point.

## What banned-books.org is

A public reference catalogue at banned-books.org documenting books
banned/challenged across jurisdictions and time. Stack: Postgres (Supabase)
→ Next.js 16 (Cache Components, App Router). Imports go through
`src/lib/imports/` (LLM-extraction pipeline) and `src/lib/wikipedia/`
(wikitext-table bulk parser). Per-row provenance is stored in
`ban_sources` / `ban_source_links`, surfaced on `/sources`.

## What was done in the session ending 2026-05-20 (PEN-activation thread)

No commits. Two findings landed in [data/upstream-sources-inventory.md](upstream-sources-inventory.md):

1. **Beacon for Freedom of Expression — DEAD.** `search.beaconforfreedom.org`
   returns `ECONNREFUSED`; apex `beaconforfreedom.org` 301-redirects to a
   sushi restaurant (domain lapsed and was re-sold). Inventory updated with
   "do not re-investigate" marker.
2. **PEN America — provenance IS recorded.** Earlier assumption ("never
   productively used") was wrong. The April 24 seed script
   ([scripts/add-pen-america-books.ts](../scripts/add-pen-america-books.ts))
   did write `ban_sources` + `ban_source_links` for all 552 books. The
   `/sources` page already lists PEN America. Inventory updated.

## Reference: how 2024-25 was extracted (Airtable HAR workaround)

> This section documents the workaround used to get the 2024-25 CSV.
> Preserved as reference in case 2024-25 ever needs a fresh pull or a
> future PEN year switches to the same Airtable distribution. **The
> 2023-24 / 2022-23 / 2021-22 sheets do NOT need any of this** — they
> are direct Google Sheets CSV exports.

PEN America publishes the 2024–25 dataset via an Airtable share
(`https://airtable.com/app65Z4deDTfu09DF/shrYIla3tzPLFbOKL/tblOfbXlidYy2MwhJ?viewControls=on`).
Ludo tested the export but downloaded **PDF instead of CSV**: 783 pages,
55 MB, and the PDF's text layer literally contains Unicode ellipses
(`District = "Higley U…"`, `Date = "August …"`). Unusable for import.

Airtable itself is behind PerimeterX, so neither WebFetch nor `curl` can
reach `/v0.3/view/{shrId}/downloadCsv` programmatically (returns 403 with
a PX challenge). The CSV must come from a real browser session.

**RESOLVED 2026-05-20:** 2024-25 data extracted via DevTools HAR save.
Ludo exported a HAR from the live Airtable share; the
`readSharedViewData` response (1.45 MB base64-msgpack) contains the full
dataset. Python parser at the bottom of this section reconstructs cells
from Airtable's typed-streaming format and resolves all `sel...` IDs.

**Outputs saved to repo:**
- [data/pen-america-2024-25.csv](pen-america-2024-25.csv) — 6,239 rows, 11 columns
- [data/pen-america-2024-25.json](pen-america-2024-25.json) — same data, explicit nulls

**Schema**: `record_id, title, author, secondary_authors, illustrators,
translators, series, state, district, date, ban_status`. The
`Initiating Action` column from 2023-24 is **absent** from 2024-25.

**Caveats to handle in the importer:**
- Row count 6,239 vs PEN's published 6,870 (this view appears to be the
  title-sorted index of three; the 631-row gap is likely overlap counting
  across the three indices). Not a blocker.
- 590 rows have `state='Nation'` — statewide/federal bans without a
  specific district. Map to `bans.region='Nation', bans.institution=NULL`
  or flag for review.
- 10 rows have `ban_status='Banned - Professionally Weeded'` — PEN labels
  this routine library curation, **skip during import** (not an
  ideological ban).
- Date format varies: mostly "Month YYYY", some AY ranges
  ("July 2024-June 2025", "January-June 2025", "24-25"). Parser must
  extract `year_started` from both forms.

If we ever need to refresh 2024-25 data, the extraction recipe is:
1. Ludo saves a fresh HAR from `airtable.com/.../shrYIla3tzPLFbOKL`.
2. `jq -r '.log.entries[] | select(.request.url | contains("readSharedViewData")) | .response.content.text' airtable.com.har | base64 -d > /tmp/pen.msgpack`
3. Python with `msgpack` (installed via `pip3 install --user msgpack`)
   stream-unpacks and parses (script preserved below).

The 2023-24 / 2022-23 / 2021-22 sheets remain programmatically
downloadable from Google Sheets without HAR gymnastics.

<details><summary>Extraction script (Python, ~50 lines)</summary>

```python
import msgpack, json, csv
from collections import Counter

with open('/tmp/pen.msgpack', 'rb') as f:
    msgs = list(msgpack.Unpacker(f, raw=False, max_buffer_size=200_000_000))

# Build sel-ID → display-name map. Pattern in metadata: (70, 'sel<17>', 'Display', 'colorName').
sel_map = {}
for i in range(len(msgs)-3):
    if (msgs[i] == 70
        and isinstance(msgs[i+1], str) and msgs[i+1].startswith('sel') and len(msgs[i+1]) == 17
        and isinstance(msgs[i+2], str)
        and isinstance(msgs[i+3], str) and 1 <= len(msgs[i+3]) <= 30 and ' ' not in msgs[i+3]):
        sel_map.setdefault(msgs[i+1], msgs[i+2])

def cell(x): return x if isinstance(x, str) else None
def selv(x):
    if isinstance(x, str) and x.startswith('sel') and len(x) == 17:
        return sel_map.get(x, f"<unresolved:{x}>")
    return None

# Each record is 14 sequential elements: 84, 'rec<17>', timestamp, 85, title, author,
# secondary, illustrator, translator, series, state, district, date, ban_status.
records, seen = [], set()
for i in range(len(msgs)-13):
    if (msgs[i] == 84
        and isinstance(msgs[i+1], str) and msgs[i+1].startswith('rec') and len(msgs[i+1]) == 17
        and msgs[i+3] == 85
        and msgs[i+1] not in seen):
        seen.add(msgs[i+1])
        records.append({
            'record_id': msgs[i+1],
            'title': cell(msgs[i+4]), 'author': cell(msgs[i+5]),
            'secondary_authors': cell(msgs[i+6]), 'illustrators': cell(msgs[i+7]),
            'translators': cell(msgs[i+8]),
            'series': selv(msgs[i+9]) if isinstance(msgs[i+9], str) else None,
            'state': selv(msgs[i+10]), 'district': selv(msgs[i+11]),
            'date': selv(msgs[i+12]), 'ban_status': selv(msgs[i+13]),
        })

with open('data/pen-america-2024-25.json', 'w') as f:
    json.dump(records, f, ensure_ascii=False, indent=1)
with open('data/pen-america-2024-25.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(records[0].keys()))
    w.writeheader(); w.writerows(records)
```
</details>

## What we DO have (verified pulls)

- **2023–24 sheet** — `https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/export?format=csv&gid=0`
  → HTTP 200, 1.37 MB, **10,048 rows**, schema confirmed:
  `Title, Author, Secondary Author(s), Illustrator(s), Translator(s),
   Series Name, State, District, Date of Challenge/Removal,
   Ban Status, Initiating Action`
- **2022–23 sheet** — `docs.google.com/spreadsheets/d/1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM/`
  (slightly older schema — 9 cols, no Secondary Author / Translator)
- **2021–22 sheet** — `docs.google.com/spreadsheets/d/1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8/`

These three are all publicly downloadable as CSV without auth. **If the
2024–25 CSV export is blocked, we can still run 2023–24 (a ~20× expansion
over the April seed's 552 rows) and pick up 2024–25 later.**

## Reusable PEN-import recipe (executed for 2024-25; same shape for 2023-24 / 2022-23 / 2021-22)

The current canonical importer is [scripts/import-pen.ts](../scripts/import-pen.ts) — committed for 2024-25. For older AYs, fork it (or extend with a `--year=YYYY-YY` flag) and swap the CSV path + source URL. Mapping rules are stable across PEN years:

- **Scope**: refresh + backfill (~10K new bans from 2023–24 alone)
- **Location**: `scripts/` one-off (Legifrance shape: dry-run default,
  `--apply` flag, `--year=YYYY-YY` arg so same script handles all years)
- **Granularity**: one `bans` row per (book × state × district) — the full
  PEN granularity. No schema migration needed: `bans` already has `region`
  (state), `institution` (district), `actor` (initiating action),
  `year_started`.
- **Mapping** (locked):
  - `bans.country_code = 'US'`
  - `bans.scope_id = school`
  - `bans.region = State`
  - `bans.institution = District`
  - `bans.year_started` ← parse from Date column (month-year or AY format)
  - `bans.actor = Initiating Action`
  - `bans.action_type` ← `"Banned" → 'banned'`,
    `"Banned pending investigation" → 'restricted'`,
    unknowns → review queue
  - `bans.status = 'active'`, `bans.confidence = 'reported'`
- **Provenance**: one `ban_sources` per import run with
  `source_name = 'PEN America Index of School Book Bans {year}'`,
  `source_url = 'https://pen.org/book-bans/pen-america-index-of-school-book-bans-{year}/'`,
  `verification_status = 'unverified'`.
- **Book resolution**: normalize `"Aciman, André"` → `"André Aciman"`;
  lookup by `(title, author_slug)`; create books row if missing.
- **Dedup vs. April seed's 552 rows**: those have `region=NULL,
  institution=NULL`. Leave them alone during granular import (different
  natural key). Plan a separate `--cleanup-aggregates` pass once granular
  data is verified — out of scope for first run.

## What NOT to do

- Don't re-investigate Beacon (domain dead, 2026-05-20 verified).
- Don't try to bypass pen.org or Airtable Cloudflare/PerimeterX from a
  script. CSV must come from a browser session.
- Don't extract from `~/Downloads/Airtable - Grid view.pdf` — ellipsis
  truncation is baked into the text layer.
- Don't re-attempt Kasseler ingest (denied 2026-05-20).

## Reference files

- [data/upstream-sources-inventory.md](upstream-sources-inventory.md) —
  full inventory of 23 Kasseler upstreams + Beacon marked dead + PEN notes
- [scripts/add-pen-america-books.ts](../scripts/add-pen-america-books.ts) —
  the April seed script (552 books); reference for the existing PEN rows'
  shape
- [src/lib/imports/source-registry.ts](../src/lib/imports/source-registry.ts) —
  `pen_america` entry already configured (`tier='high-volume'`, `default_scope='school'`)
- [src/app/sources/page.tsx:47-50](../src/app/sources/page.tsx) — PEN
  entry on `/sources` page, matches `pen.org/book-bans` URL pattern
- [supabase/migrations/20260511150851_baseline.sql:137-154](../supabase/migrations/20260511150851_baseline.sql) —
  `bans` table schema (no migration needed for PEN granularity)
