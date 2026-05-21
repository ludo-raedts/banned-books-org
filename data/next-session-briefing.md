# Next-session briefing: post-PEN-2024-25 import

> Paste this whole file at the start of a fresh Claude Code conversation
> to bootstrap context. Supersedes the 2026-05-20 post-Kasseler briefing.

## Status as of 2026-05-20 (PM)

**PEN America 2024-25 import is COMPLETE.** 6,674 new bans inserted across
126 new books at per-district granularity (region=state, institution=district).
3,949 → ~10,623 US-school bans in DB. Source: `data/pen-2024-25.csv` (6,719 rows,
10 "Professionally Weeded" skipped, 35 deduped). Importer:
[scripts/import-pen.ts](../scripts/import-pen.ts). Schema migration that made
this possible: [20260520112552_bans_unique_per_location.sql](../supabase/migrations/20260520112552_bans_unique_per_location.sql)
— extended the `bans_unique_per_scope` constraint to include `(region, institution)`
with `NULLS NOT DISTINCT`.

**Open follow-ups (not blocking):**
- `--cleanup-aggregates` pass: the 552 April-seed bans (NULL region/institution)
  are now stale relative to the granular data. Build a separate script to
  collapse them or delete those superseded by granular siblings.
- 2023-24 import: same pipeline works with the 2023-24 Google Sheet
  (`https://docs.google.com/spreadsheets/d/1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8/export?format=csv&gid=0`).
  Has the extra `Initiating Action` column → map to `bans.actor`.
- 8 files contain stale comments referencing the old `(book_id, country_code, year_started, scope_id)`
  unique-constraint shape (src/lib/wikipedia/dedup.ts, types.ts, importer.test.ts;
  scripts/_audit_soft_dupe_bans.ts, _check_ban_dupes.ts, merge-soft-dupe-bans.ts,
  import-wikipedia-list.ts, src/lib/imports/review-commit.ts). Functionally safe
  — the SELECT-then-INSERT pattern still works for NULL region/institution callers
  via NULLS NOT DISTINCT semantics. Worth a sweep at some point.

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

## Where we left off — Airtable PDF dead-end

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

## Plan for next session — `scripts/import-pen-america-school-bans.ts`

Confirmed with Ludo this session:

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
