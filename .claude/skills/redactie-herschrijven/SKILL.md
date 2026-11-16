---
name: redactie-herschrijven
description: Editorial rewrite of the sourced, factual censorship histories (books.censorship_context, status source_verified) into readable, search-friendly prose WITHOUT adding or losing a fact. Builds a fact pack per book, drafts the rewrite, runs a mechanical fact gate, and publishes only human-approved drafts as narrative_curated with the sources kept. Use when the user asks to rewrite/improve/SEO-polish the factual book texts, or says /redactie-herschrijven.
---

# Redactie: herschrijven met behoud van feiten

Why this exists: the sourced histories (`source_verified`) are literal-quote safe but read like extracts ("The novel was placed on the Index in 1834."). The site was judged thin; richer prose helps readers and search, but the project has been burned by AI text that invents context (see memory: thin ban-text overhaul, ungrounded descriptions). So the rule is: **the rewrite may change wording, order and rhythm; it may never change what is claimed.**

## Hard rules (the fact contract)
1. **Only facts in the pack.** The pack (`data/redactie/packs/<slug>.json`) holds: current sourced text, the verbatim source quotes, the book's ban rows (country, year, end, status, scope, institution, note), title, author, first published year. Nothing else may appear: no outside knowledge, no "context", no motives, no consequences, no adjectives of judgement.
2. **Keep every dated event** of the current text, with its year and actor/place; do not merge two events into a claim neither source makes. Keep hedges ("reported", "no date given", "sources differ") — hedges are facts about the evidence.
3. **Measure words stay exact**: banned ≠ challenged ≠ removed ≠ restricted ≠ prosecuted ≠ listed on the Index ≠ seized. Say what the source says (a prosecution of a publisher is not a ban of a book; a film ban is not a book ban).
4. **Never delete a source, never invent one.** `censorship_context_sources` stays as is.
5. **No numbers or capitalised names that are not in the pack** (the gate enforces this).
6. Do not add place names the pack lacks (not even obvious ones like "United States" for a US library): the gate treats them as new facts. Describe the actor as the sources do ("the Cincinnati Public Library").
7. If the current text is a single thin sentence and the pack has nothing more: write a clean 1–2 sentence version or **leave it** (report "no safe expansion"). Do not pad to hit a length.

## SEO and reader craft (allowed, within the contract)
- First sentence: **title + the main event + place + year** in natural language ("The Satanic Verses was banned in India on 5 October 1988, …"). This mirrors how people search ("why was X banned in Y").
- 60–120 words when the facts support it; shorter is fine. Chronological order; one event per sentence; vary sentence openings; plain verbs.
- Use the country and the reason words the sources use (do not add reasons we only inferred).
- Name the actor (ministry, court, school board, library, customs) — specific beats generic.
- No keyword stuffing, no repeated title more than twice, no filler ("it is worth noting", "broader trend", "sparked debate").
- Optional extras written to the draft file only (never invented facts): `meta_description` (≤155 chars, factual, includes title + country/year) and `link_hints` (country/reason hub slugs that the facts justify).

## Procedure
1. **Pick books**: default the top-100 list (`data/top100-check/dossier.json`) with `censorship_context_status='source_verified'`; or `--slugs`.
2. **Pack**: `pnpm tsx --env-file=.env.local scripts/redactie-pack.ts --slugs=a,b` (or `--top100`) → `data/redactie/packs/<slug>.json`.
3. **Draft**: for each pack write `data/redactie/drafts/<slug>.json` = `{ "slug", "text", "meta_description", "link_hints": [], "changes": "one line: what was restructured", "approved": false }`. Draft in batches of ~10; read the pack, not the web.
4. **Gate**: `pnpm tsx --env-file=.env.local scripts/redactie-gate.ts --slugs=...` prints per draft PASS/WARN/FAIL. FAIL (new number/name, lost year, banned-word drift, length, padding phrase) → fix the draft. WARN → read it and decide. Also flags near-duplicate phrasing across drafts (templated text is what Google discounts: vary structure per book).
5. **Human review**: show the user old vs new side by side for a sample (all, for the first batch). Only the user sets `"approved": true` (or tells you which slugs to approve).
6. **Publish**: `pnpm tsx --env-file=.env.local scripts/redactie-publish.ts --slugs=... --apply` (dry-run by default). It re-runs the gate, writes `censorship_context = text`, moves the literal text to `censorship_context_unsourced`, keeps `censorship_context_sources`, sets status `narrative_curated`, and busts the page caches. Log it in `docs/experiments/source-pilot-2026-11/events.md` when a book is one of the 108 measurement URLs or the panel — those pages should not be edited in a batch without a deliberate decision.
7. Commit + push (stage explicitly: scripts, `data/redactie/` drafts/packs).

## Do not
- Do not rewrite books that are not `source_verified` (their text is unsourced and hidden anyway).
- Do not touch ban rows, years or statuses here; row problems go to the source-check workflow (data/top100-check).
- Do not auto-approve. Do not publish on the 108 URLs or the source-pilot panel without the user's explicit yes.
- Do not run the generator "creatively" to fill thin books; thin books need research (see scripts/publish-hand-sourced-history.ts), not prose.
