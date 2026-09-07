# Author photo audit — OpenLibrary OLID identity claims

Generated 2026-09-07T11:31:20.893Z by `scripts/_audit_author_photo_olid.ts` (read-only).

Every `authors.photo_url` of the form `covers.openlibrary.org/a/olid/<OLID>` claims to be the photo of OL author `<OLID>`. This report re-checks that claim against `/authors/<OLID>.json` (`name` / `personal_name` / `alternate_names`) with a normalised surname-token match. Nothing was written to the database.

- probed: **473**
- OK: **473**
- flagged (everything but OK): **0**
- of which photo OLID ≠ row's own `openlibrary_author_id`: **0**

> Do NOT null in bulk. Photo writes need a per-row visual/name check first, and `barbara-dee` (#3446) + `michelle-levy` (#1515) are permission-managed photos that must never be overwritten (both are self-hosted, so neither appears below).

## How these get in

`tryOpenLibrary()` in `src/lib/enrich/author-photos.ts` queries `/search/authors.json?q=<our name>` and accepts the first of up to 3 docs that has `work_count >= 1` and a HEAD-able photo — **it never compares `doc.name` to ours**. So any author whose name merely *retrieves* a photo-bearing OL record inherits that record's face: "Troy Andrews" pulled Lauran Paine, whose `alternate_names` include "Troy Howard (pseud.)". Nulling a row here is therefore only half a fix — the default enricher gate (`photo_url IS NULL AND photo_v2_checked_at IS NULL`) will skip it, but `--recheck` would re-pin the same wrong photo until that branch gets a name gate (`matchNames()` in this script is the check it lacks).

No mismatches found.
