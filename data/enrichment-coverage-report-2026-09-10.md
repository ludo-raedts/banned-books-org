# Enrichment coverage report — 2026-09-10

Catalogue: **20306 books** (7968 non-English originals).
Before: 2026-09-09T10:58:21.540Z · After: 2026-09-10T06:20:33.725Z

| Dimension | Before | After | Δ rows | Before % | After % | Remaining gap |
|---|---:|---:|---:|---:|---:|---:|
| ISBN13 | 10280 | 10292 | +12 | 50.6% | 50.7% | 10014 |
| Cover | 9850 | 10053 | +203 | 48.5% | 49.5% | 10253 |
| Description | 9624 | 9625 | +1 | 47.4% | 47.4% | 10681 |
| Native title (non-EN) | 831 | 831 | +0 | 10.6% | 10.4% | 7137 |

_CourtListener: live render-time feed (`src/lib/courtlistener.ts`), not a per-book column — excluded from coverage by design._

## Confidence audit & rollback

Threshold 0.5 · applied=true.
Reverted **0** low-confidence/invalid writes (native-title 0, cover 0, isbn 0).

## Run

Started 2026-09-09T10:58:18.680Z. Sources launched concurrently (process-isolated — a quota stop or crash in one never aborts the others):

- **OL harvest (cover/year/isbn, exact-key, free)** — pid 78581, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260909T105818680Z/ol-harvest.log`
- **GB harvest (orphan isbn/cover, daily-cap-aware)** — pid 78582, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260909T105818680Z/gb-harvest.log`
- **Native titles (Wikidata, non-English)** — pid 78583, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260909T105818680Z/native-titles.log`
- **Kobo ebook links (Rakuten Product Search)** — pid 78584, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20260909T105818680Z/kobo-links.log`
