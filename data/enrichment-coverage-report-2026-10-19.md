# Enrichment coverage report — 2026-10-19

Catalogue: **20934 books** (7968 non-English originals).
Before: 2026-10-19T22:49:24.342Z · After: 2026-10-19T23:53:24.003Z

| Dimension | Before | After | Δ rows | Before % | After % | Remaining gap |
|---|---:|---:|---:|---:|---:|---:|
| ISBN13 | 10468 | 10468 | +0 | 50.0% | 50.0% | 10466 |
| Cover | 10551 | 10551 | +0 | 50.4% | 50.4% | 10383 |
| Description | 9637 | 9637 | +0 | 46.0% | 46.0% | 11297 |
| Native title (non-EN) | 836 | 836 | +0 | 10.5% | 10.5% | 7132 |

_CourtListener: live render-time feed (`src/lib/courtlistener.ts`), not a per-book column — excluded from coverage by design._

## Confidence audit & rollback

Threshold 0.5 · applied=true.
Reverted **0** low-confidence/invalid writes (native-title 0, cover 0, isbn 0).

## Run

Started 2026-10-19T22:49:16.714Z. Sources launched concurrently (process-isolated — a quota stop or crash in one never aborts the others):

- **OL harvest (cover/year/isbn, exact-key, free)** — pid 20943, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261019T224916714Z/ol-harvest.log`
- **GB harvest (orphan isbn/cover, daily-cap-aware)** — pid 20944, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261019T224916714Z/gb-harvest.log`
- **Native titles (Wikidata, non-English)** — pid 20945, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261019T224916714Z/native-titles.log`
- **Kobo ebook links (Rakuten Product Search)** — pid 20946, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261019T224916714Z/kobo-links.log`
