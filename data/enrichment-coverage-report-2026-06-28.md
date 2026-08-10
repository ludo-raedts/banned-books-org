# Enrichment coverage report — 2026-06-28

Catalogue: **20268 books** (5453 non-English originals).
Before: 2026-06-28T15:01:39.306Z · After: 2026-06-28T18:03:00.792Z

| Dimension | Before | After | Δ rows | Before % | After % | Remaining gap |
|---|---:|---:|---:|---:|---:|---:|
| ISBN13 | 10085 | 10089 | +4 | 49.8% | 49.8% | 10179 |
| Cover | 9712 | 9789 | +77 | 47.9% | 48.3% | 10479 |
| Description | 9294 | 9294 | +0 | 45.9% | 45.9% | 10974 |
| Native title (non-EN) | 810 | 810 | +0 | 14.9% | 14.9% | 4643 |

_CourtListener: live render-time feed (`src/lib/courtlistener.ts`), not a per-book column — excluded from coverage by design._

## Confidence audit & rollback

Threshold 0.5 · applied=true.
Reverted **0** low-confidence/invalid writes (native-title 0, cover 0, isbn 0).

## Run

Started 2026-06-28T15:01:34.793Z. Sources launched concurrently (process-isolated — a quota stop or crash in one never aborts the others):

- **OL harvest (cover/year/isbn, exact-key, free)** — pid 12721, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260628T150134792Z/ol-harvest.log`
- **GB harvest (orphan isbn/cover, daily-cap-aware)** — pid 12722, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260628T150134792Z/gb-harvest.log`
- **Native titles (Wikidata, non-English)** — pid 12723, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260628T150134792Z/native-titles.log`
