# Enrichment coverage report — 2026-10-11

Catalogue: **20781 books** (7968 non-English originals).
Before: 2026-10-10T21:13:09.668Z · After: 2026-10-11T00:35:02.317Z

| Dimension | Before | After | Δ rows | Before % | After % | Remaining gap |
|---|---:|---:|---:|---:|---:|---:|
| ISBN13 | 10292 | 10314 | +22 | 49.5% | 49.6% | 10467 |
| Cover | 10052 | 10443 | +391 | 48.4% | 50.3% | 10338 |
| Description | 9625 | 9627 | +2 | 46.3% | 46.3% | 11154 |
| Native title (non-EN) | 831 | 836 | +5 | 10.4% | 10.5% | 7132 |

_CourtListener: live render-time feed (`src/lib/courtlistener.ts`), not a per-book column — excluded from coverage by design._

## Confidence audit & rollback

Threshold 0.5 · applied=true.
Reverted **2** low-confidence/invalid writes (native-title 0, cover 0, isbn 0).

## Run

Started 2026-10-10T21:13:03.949Z. Sources launched concurrently (process-isolated — a quota stop or crash in one never aborts the others):

- **OL harvest (cover/year/isbn, exact-key, free)** — pid 67141, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261010T211303949Z/ol-harvest.log`
- **GB harvest (orphan isbn/cover, daily-cap-aware)** — pid 67142, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261010T211303949Z/gb-harvest.log`
- **Native titles (Wikidata, non-English)** — pid 67143, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261010T211303949Z/native-titles.log`
- **Kobo ebook links (Rakuten Product Search)** — pid 67144, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261010T211303949Z/kobo-links.log`
