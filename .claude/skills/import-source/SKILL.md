---
name: import-source
description: End-to-end import of a new banned-books source (URL or file) via the standard §1 pipeline — normalise to stage-0, match-before-create, dry-run, apply after approval, dedup sweep, integrity audit, enrichment kickoff, commit with counts. Use when the user hands over a new source of banned/censored books, or says /import-source.
---

# Import a new source, end to end

You are given a source (URL, file, or description) of banned/censored books.
Execute the standard route in `scripts/README.md` §1 (Stap 0–5) **completely**,
stopping only at the two decision points marked ⏸. Everything else runs
without asking. Read §1 of scripts/README.md FIRST — it is the source of
truth; this skill is the checklist that drives it.

## Ground rules (non-negotiable)

- **Reuse, never rebuild**: stage-0 template `scripts/build-portugal-estado-novo-stage0.ts`;
  importer templates per the §1 table (`add-ala-2025` / `import-africa` /
  `import-nipissing` / `import-pen`; newest examples `import-berlin-verbannte.ts`,
  `import-ireland-censorship.ts`). A new script is a thin reader feeding
  `commitParsedRow` / `commitNewBanForBook` (`src/lib/imports/review-commit.ts`).
- **Match-before-create is mandatory** via `matchExistingBook`
  (`src/lib/imports/verifier.ts`); supply `title_english_meaningful` for
  foreign-language titles. Ambiguous matches → hold as `needs_review` in the
  seed file (Berlin pattern). Never create blindly. (This path is now covered
  by tests: `src/lib/imports/__tests__/verifier.test.ts`.)
- **Books only** (scope gate: `src/lib/imports/extraction-prompt.ts`) — no
  periodicals/films/audio/pamphlets. Doubtful entries: investigate, don't import.
- **Licensing check up front**: is the source redistributable (public records,
  CC, government gazette)? If unclear, stop and ask — see the Kasseler
  precedent in `data/upstream-sources-inventory.md`.
- **Ban year ≠ publication year.** `first_published_year` only when the source
  really gives it, else NULL (PT rule; the PEN stamped-years incident).

## Step 0 — normalise

Fetch/parse the source and write `data/<bron>-<datum>.json`: one row per
**book × jurisdiction × ban-event**, fields `title`, `authors`, `country_code`,
`year` (ban year), `scope_slug`, `action_type`, `reason_slug`, `source_url`,
`source_name`, plus `title_english_meaningful` for foreign editions when
derivable (Wikidata reverse lookup, cf. `build-berlin-verbannte-stage0.ts
--enrich-english`). Show the user 5 sample rows + the total count.

## Step 1–2 — importer + dry-run

Pick the template from the §1 table (don't write new machinery). Run the
read-only count BEFORE, then the dry-run. Produce the dry-run report:
new books / bans-on-existing / needs_review / skipped, with exact counts.

⏸ **Decision point 1 — apply approval.** Present the counts and 5–10 sample
matches (especially fuzzy ones). Wait for explicit approval before `--apply`.

## Step 3 — apply + count

`--apply`, then the read-only count AFTER. Report exact row deltas
(books +N, bans +M) — CLAUDE.md rule.

## Step 4 — mandatory post-import sweeps

```
npx tsx --env-file=.env.local scripts/_audit_cross_script_dupes.ts
npx tsx --env-file=.env.local scripts/_audit_spanish_edition_dupes.ts
npx tsx --env-file=.env.local scripts/_audit_cross_language_dupes.ts
npx tsx --env-file=.env.local scripts/audit-integrity.ts
```

Fold confirmed dupes via the merge scripts (§3; DELETE-dupe-before-enrich
order, see `scripts/merge-paren-suffix-dupes.ts`). `audit-integrity.ts` must
exit 0 before you continue. Fresh KDN/Malaysia material: also run
`scripts/_audit_mojibake_authors.ts`.

⏸ **Decision point 2 — needs_review rows.** Present the held rows with your
per-row recommendation (match X / create / drop). Resolve per the user's
verdict; never blanket-resolve.

## Step 5 — enrichment + wrap-up

- Kick off `nohup npx tsx --env-file=.env.local scripts/enrich-all.ts --apply &`
  **only when no deploy is running** (memory: enrich↔deploy collision), or
  hand the user the ready-made command if the run would outlive the session.
  Its end-of-run hook busts the detail-page caches automatically.
- Document the new script (if any) in `scripts/README.md` §1 and register the
  source in `src/lib/imports/source-registry.ts` when it will recur.
- Commit + push with exact counts in the message; then `/ship` conventions
  apply (integrity audit already green from step 4).

## Report format

End with: source name + license basis, rows in stage-0, books created, bans
added, dupes merged, needs_review resolved/open, integrity status, enrichment
status, commit hash.
