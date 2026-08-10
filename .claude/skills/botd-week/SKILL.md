---
name: botd-week
description: Weekly pre-flight for the upcoming book-of-the-day picks — audit the next week's books + authors for data gaps and fix them with grounded, hand-quality enrichment. Use when the user asks to check/prepare the upcoming books of the day, or on the weekly Monday schedule.
---

# Weekly book-of-the-day pre-flight

Goal: every book that will be "banned book of the day" in the coming week — and its author(s) — looks hand-curated: a real grounded bio, socials/Wikidata links, birthday fields, solid descriptions. This replaces the user checking each day's pick manually.

## Step 1 — audit

```
pnpm tsx --env-file=.env.local scripts/audit-botd-week.ts
```

This prints the picks for today..+7 (deterministic; it also freezes them in `bluesky_daily_picks`, so what you audit is what will run) with per-book and per-author gaps. If everything is clean: report that and stop.

## Step 2 — fix author gaps (the common case)

Work per author, one at a time. **Namesake discipline is the #1 rule** — this project has been burned repeatedly by same-name-wrong-person data (see memory: author-bio contamination, impossible-year namesakes).

1. **Identify on Wikidata**: `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<name>&language=en&format=json`. Confirm it is OUR author: description must match (writer/poet/novelist), and birth year (P569) must match `authors.birth_year` when we have one. If ambiguous → skip and list for user review, never guess.
2. **Pull links** from the entity JSON (`Special:EntityData/<QID>.json`): P856 website, P2002 X/Twitter, P2003 Instagram, P2013 Facebook, P214 VIAF. URL formats (match `scripts/enrich-author-links.ts`): `https://x.com/<u>`, `https://www.instagram.com/<u>/`, `https://www.facebook.com/<id>`, `https://viaf.org/viaf/<id>`. Historical authors have no socials — VIAF + wikidata_id are still worth writing.
3. **Bio** (when MISSING, TEMPLATE, or THIN): fetch the English Wikipedia article (WebFetch), write 2–4 paragraphs in the site's established style (see e.g. authors/kwame-alexander after 2026-07-06): birth line with date/place, path into writing, best-known works with years and major awards, closing sentence on censorship **grounded only in our own bans data for that author** (query `book_authors` → `books` → `bans` first). Every fact must come from the fetched article or our DB — no memory-only facts; if Wikipedia doesn't state it, leave it out.
4. **Bio UNSTAMPED but decent**: spot-check the existing bio against Wikipedia (contamination check — does it describe the right person?). If correct, stamp `bio_source_type='wikipedia'` + `bio_source_url`. If it's the wrong person, rewrite per step 3.
5. **Write one UPDATE per author** with: `bio`, `bio_source_type`, `bio_source_url`, `wikidata_id`, `website_url`, `social_links`, `birth_month`/`birth_day` (from Wikipedia/Wikidata P569), and stamp `links_checked_at` (ISO now). Only include fields you actually verified. Print the row BEFORE and AFTER (project doctrine) and the exact row count.
6. **Photos**: only fill `photo_url` from Wikimedia Commons after visually plausible identification, and only hosts passing `isAllowedImageUrl()` (src/lib — ALLOWED_IMAGE_HOSTS). Never overwrite existing photos for barbara-dee or michelle-levy (permission-managed). When unsure, list for user review instead.

Skip authors flagged `IS_PLACEHOLDER`.

## Step 3 — fix book gaps

Book-side gaps are rarer (the rotation's eligibility gate requires cover + ban description). When they appear:

- `description_ban THIN` / book description gaps: check the ban's `ban_source_links` and the book's Wikipedia page; improve only with grounded text and set `description_source_type`/`description_source_url`. **Never** use the retired `enrich-descriptions-gpt` path (confabulation).
- `no ISBN`: look up on Bookshop.org; verify the edition matches (right title AND author, not a study guide) before setting `bookshop_isbn13`.
- `cover_url MISSING` (shouldn't happen): use the cover ladder in `scripts/enrich-covers*.ts` for that one book id; verify visually via the montage habit before writing.
- `first_published_year NULL`: fill only from Wikipedia/Wikidata, watch the placeholder-year trap (e.g. Iran 1979 batch).

## Step 4 — verify & report

- If a dev server is running (try `curl -s -o /dev/null -w "%{http_code}" http://localhost:3030/` then 3000), spot-check one or two updated `/authors/<slug>` pages render the new bio + links.
- Re-run the audit script; the picks you fixed should now be clean (birthday fields you can't source may legitimately remain open).
- Final message: per day — title, what was fixed (with row counts), what is left open for user review and why. DB-only changes need no commit; commit+push only if repo files changed.
