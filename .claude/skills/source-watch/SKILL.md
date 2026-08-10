---
name: source-watch
description: Monthly delta-check of recurring banned-books sources (PEN America school-year index, Russia minjust FSEM, KDN Malaysia gazette, Utah USBE list, ALA annual lists) against the database — report only when there is something new, with a ready /import-source handoff. Use on the monthly schedule or when the user asks to check the sources.
---

# Source watch — is there anything new to import?

Check each recurring source for material we have NOT imported yet. This is a
**read-only** pass: never write to the DB. The deliverable is a short report —
"nothing new" (one line per source) or a delta with a ready-to-run
`/import-source` handoff.

For every source: fetch → estimate what's new vs. our DB (read-only count via
`npx tsx --env-file=.env.local` one-liner or an existing audit script) →
report the delta. When a fetch fails (blocked, moved), report that too; a
watch that silently skips a source is worse than none.

## Sources

1. **PEN America — Index of School Book Bans** (`https://pen.org/book-bans/`)
   We have all 4 school years through 2024–25 imported per-district (22,822
   pen.org bans). New = a NEW school-year index (typically announced in the
   fall). Check the page for a dataset newer than 2024–25. If found:
   handoff to `/import-source` with `import-pen.ts` as template.
2. **Russia — minjust FSEM** (Федеральный список экстремистских материалов,
   `https://minjust.gov.ru/ru/extremist-materials/`)
   We imported batch 1 (RU at 510 distinct books); the full list is ~5,500
   entries and a full crawl is a KNOWN open backlog — don't re-report the
   backlog as "new". New = list grown beyond the max entry number seen in
   `data/russia-minjust-batch1.json`. Template: `import-russia-bans.ts`
   (minjust rows auto-needs_review).
3. **KDN Malaysia — banned publications gazette**
   (`https://www.moha.gov.my/` penerbitan / KDN list; the historical gazette
   is already in). New = gazette orders dated after our latest MY ban year.
   Before ANY new KDN batch: run `scripts/_audit_mojibake_authors.ts`
   (memory: U+FFFD corruption) and watch the title-collision class
   (old gazette bans linked to wrong modern same-title book).
4. **Utah USBE statewide removals** (HB 29 list, usbe.utah.gov)
   We imported 36 titles on 2026-07-11 (`backfill-utah-statewide-bans.ts`).
   New = list longer than 36 / titles not among our scope_id=4 Utah rows.
5. **ALA annual lists** (`https://www.ala.org/advocacy/bkfreedom`)
   Aggregates — NOT importable as a source (memory: ALA=aggregates), but a new
   "Top 10 Most Challenged" (each spring) should be cross-checked against
   existing books: bans on already-known titles via `add-ala-2025.ts` pattern.

## Also glance at (no fetch quota — only if cheap)

- The Tier-1 backlog in `data/upstream-sources-inventory.md` (US prison lists:
  TDCJ ~10k, bookstoprisoners KS/VA/SC, CA/WA) — one-time imports, not
  recurring; mention the top item as a suggestion only if the report is
  otherwise empty.

## Report format

Per source one line: `✓ niets nieuws` / `Δ <wat> — <geschatte omvang>` /
`⚠ fetch faalde: <reden>`. For each Δ: the exact `/import-source` handoff
line (source URL + template + expected scope). No DB writes, no imports —
that goes through /import-source with its approval gates.
