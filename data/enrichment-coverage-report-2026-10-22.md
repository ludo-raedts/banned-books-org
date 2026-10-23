# Enrichment coverage report — 2026-10-22

Catalogue: **20934 books** (7968 non-English originals).
Before: 2026-10-22T15:16:09.088Z · After: 2026-10-22T16:11:11.312Z

| Dimension | Before | After | Δ rows | Before % | After % | Remaining gap |
|---|---:|---:|---:|---:|---:|---:|
| ISBN13 | 10590 | 10590 | +0 | 50.6% | 50.6% | 10344 |
| Cover | 10553 | 10553 | +0 | 50.4% | 50.4% | 10381 |
| Description | 9827 | 9852 | +25 | 46.9% | 47.1% | 11082 |
| Native title (non-EN) | 836 | 836 | +0 | 10.5% | 10.5% | 7132 |

_CourtListener: live render-time feed (`src/lib/courtlistener.ts`), not a per-book column — excluded from coverage by design._

## Confidence audit & rollback

Threshold 0.5 · applied=true.
Reverted **23** low-confidence/invalid writes (native-title 0, cover 0, isbn 0).

## Run

Started 2026-10-22T15:15:58.423Z. Sources launched concurrently (process-isolated — a quota stop or crash in one never aborts the others):

- **OL harvest (cover/year/isbn, exact-key, free)** — pid 50307, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261022T151558423Z/ol-harvest.log`
- **GB harvest (orphan isbn/cover, daily-cap-aware)** — pid 50308, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261022T151558423Z/gb-harvest.log`
- **Native titles (Wikidata, non-English)** — pid 50309, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261022T151558423Z/native-titles.log`
- **Kobo ebook links (Rakuten Product Search)** — pid 50310, log `/Users/ludoraedts/projects/banned-books-org/data/enrich-run/20261022T151558423Z/kobo-links.log`
