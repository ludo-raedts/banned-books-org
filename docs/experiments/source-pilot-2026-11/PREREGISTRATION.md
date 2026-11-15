# Source pilot — pre-registration (v1, approved 2026-11-15 as an EXPLORATORY FEASIBILITY STUDY)

Question: do pages whose ban rows carry case-specific source evidence get crawled or indexed by Google
sooner than comparable pages left unchanged? Google-core size stays fixed during the pilot.

## What it can and cannot show
- Can show: a difference between two matched groups on the SAME site at the SAME time, in crawl and
  index status, caused by the page-level source changes only.
- Cannot show: whether a smaller or tighter core helps the rest of the site; whether the domain-level
  judgement changes (no control domain); whether AI text is the cause; anything about pages outside
  these three source families. A null result is weak evidence (see Power).
- The noindex arm was dropped on request: it cannot measure the effect of a smaller core on other pages.

## Population and selection (frozen in `panel.json`, seed 20261116)
- Books in the live core sitemap (`sitemap-books.xml`, 12,954 URLs on 2026-11-15) whose every ban is
  sourced from ONE of: Berlin 1938 list, Liste Otto, Brandão (Estado Novo), and whose every ban source
  link has locator = NULL (a per-case locator is obtainable from a public list).
- Excluded: the 108 baseline URLs of 2026-10-25, books with any ban citing the Index on Censorship
  homepage, `lenin-charasch`, `gaibeus`, `the-da-vinci-code`, anything gated/blanket.
- Eligible pool 202 (berlin-1938 desc+cover 92, liste-otto desc+cover 80, estado-novo desc+cover 29,
  estado-novo bans>=2 1). Drawn 120 = 60 treatment / 60 control, matched pairs randomised within
  blocks (family x route). All panel books have exactly 1 ban and description+cover (mean bans 1.00 in
  both arms); treatment arm 25 AI-grounded-single / 15 Google Books / 13 ai_consensus / 7 Open Library
  descriptions, control 22 / 11 / 16 / 6 (+3 grounded-multi, 1 Wikipedia, 1 manual). All created before
  2026-11-03.

## Baseline (M0, 2026-11-15, URL Inspection API, `inspections-baseline-2026-11-15.jsonl`)
- 120/120 panel URLs: "URL is unknown to Google", never crawled — both arms. Indexed 0/0.
- Consequence: the only measurable events are first crawl and, after that, indexing. The first-crawl base
  rate in the comparable 2026-10-25 sample was ~1 of 59 never-crawled URLs in three weeks.

## Intervention (treatment arm only; NOT applied yet)
1. Every ban row gets a per-case locator (list/page/row id) and a deep link to the specific entry where
   one exists (berlin.de entry search, wikisource list page, Brandão page).
2. A "What the source records" line limited to fields present in the source (title, author, publisher,
   list-edition year), stating that the year is the list edition, not the date of the ban act.
3. Ban-row notes and reason wording that the source does not state are removed.
4. NOT touched: description_book, cover, ISBN, ban years, status, slugs, titles — so core membership,
   sitemap and URLs stay identical and no historical claim changes without a source.
Control arm: no change. Panel pages are excluded from every other batch edit while the pilot runs.

## Timing
- M0 baseline 2026-11-15 (done). T1 (intervention live) is NOT before 2026-12-21, so the fixed
  2026-12-20 measurement of the 108 is not overlapped by the intervention. (Earlier T1 is possible if
  that overlap is accepted; decide before applying.)
- Measurements, same API, same URLs: 2026-12-20 (with the 108), T1+2w, +4w, +8w, +12w; 2027-02-14 is
  the +16-week anchor for the 108.

## Outcomes
- Primary: share of URLs with a first crawl after T1 (lastCrawlTime present). Secondary: indexed (PASS).
- Analysed intention-to-treat (all 60 v 60) and, as a sensitivity check only, among crawled URLs
  (selected by Google, so not randomised). Report counts, not just rates.
- Power: with ~1–2% base crawl rate and n=60 per arm only a very large effect is detectable. The pilot is a
  feasibility and direction check; it is not confirmatory. If Google crawls neither arm, the honest result
  is "no information".

## Crawl events — definitions and protocol
| Event | What it is | Counts as crawl? |
|---|---|---|
| Live test | "Test live URL" in Search Console: a Googlebot fetch on demand | NO. Forbidden on panel and 108 URLs. Observed 2026-11-15: for /books/1984 the API reports lastCrawlTime 14:34Z that day while the Search Console page showed 27 Oct, so a live test may move the API timestamp. |
| Reported crawl | lastCrawlTime of the INDEXED record (API / "Page indexing") | YES, if no live test or request was made on that URL since the previous measurement |
| Indexing request | "Request indexing" button / Indexing API | NO. Forbidden on panel and 108 URLs; it would change the thing measured |
Anyone who runs a live test or request on a panel/108 URL logs it in `events.md` the same day; that URL's
next timestamp is flagged and excluded from crawl counts.

## Change log during the pilot
All site-wide changes (templates, caching, imports) and all data corrections touching panel or 108 URLs go
in `events.md` with date and deploy id.

## Addendum (2026-11-15, DRAFT): second panel from "Crawled – currently not indexed"
Probe `scripts/gsc-cni-pool.ts`, results in `data/gsc/cni-pool-2026-11-15.jsonl` (gitignored), 700 core books
inspected via the URL Inspection API (excluding the 108 and the panel):
| Stratum | n | Crawled – currently not indexed | Unknown to Google | 404 |
|---|---|---|---|---|
| 350 most-banned | 350 | 287 (82%) | 61 | 2 |
| 350 random core | 350 | 82 (23%) | 267 | 1 |
- Suitable pages: 369 CNI books are verified today. Extrapolated to the core (12,953): roughly 2,900 CNI among
  the non-head books (23% of ~12.6k) plus the head. Only the 369 verified are usable until more are probed.
- Last crawl of CNI books: of 82 random-stratum CNI, 0 within 30 days, 2 within 60, 20 within 120, 62 older than
  120 days. Head: 0 / 3 within 60 / 133 within 120 / 154 older.
- Realistic recrawls: random-stratum CNI hazard ~2–3% per 60 days, so ~1–2 recrawls per 40-page arm in 12 weeks;
  head books recrawl more often (5 of 16 CNI books in the 108 in 3 weeks) but are not comparable to the tail.
  The CNI panel is therefore underpowered for a crawl-rate difference; its value is a different outcome:
  does a source-improved CNI page move to indexed after a recrawl (indexed share among recrawled).
- Proposed selection (not frozen): from the random-stratum CNI books, matched pairs on last-crawl-age bucket and
  source family, 40/40 (needs all ~80 plus a larger probe to fill the blocks). Core size unchanged.
- Status: design approved on 2026-11-15 as an exploratory feasibility study. The CNI panel is not yet frozen and no intervention is applied.

## Interpretation rule (added on approval, 2026-11-15)
This is an exploratory feasibility study, not a confirmatory test. The group sizes (60/60; 40/40 for the CNI panel)
and the expected recrawls (about 1-2% first-crawl rate per 3 weeks; about 1-2 recrawls per CNI arm in 12 weeks)
are too small for a null result to mean anything. If no visible difference appears, we do NOT conclude that
source improvements have no effect; the only valid conclusion is "no information". A positive difference is
a direction signal to be replicated, not proof.
