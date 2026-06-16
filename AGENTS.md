<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vercel plugin is intentionally disabled

The Vercel Claude Code plugin is kept disabled on purpose, to avoid its ~2k-token-per-session startup dump. This is a deliberate cost choice, not a broken setup.

If the user asks a **substantive Vercel question** — pastes a deployment/build/runtime error, debugs a function, or changes Vercel config (`vercel.json`/`vercel.ts`, env vars, routing, crons, domains) — do NOT improvise a half-informed answer from memory (this Vercel may differ from training data). Instead:
1. Tell them the Vercel plugin is currently disabled, and that re-enabling it loads the accurate, up-to-date Vercel guidance/skills.
2. Give the steps: run `/plugin` → "Manage plugins" → enable `vercel@claude-plugins-official` (user scope). Then re-ask or continue.
3. Once it's enabled, answer using the plugin's skills.

For incidental Vercel mentions (a deploy URL, "it runs on Vercel"), just answer normally — no re-enable prompt needed.

# Import / dedup / merge scripts — check the catalog first

Before searching through `scripts/` for an import, dedup, or merge task, read
`scripts/README.md`. It is a decision guide ("I want to import/clean up X →
use script Y") covering: the shared import pipeline (`src/lib/imports/`) vs. the
one-off importers, the read-only `_audit_*` duplicate detectors, and the
merge-doctrine scripts. Pick the matching template from there instead of
re-deriving which script does what.

# Reading large data files

Files under `data/` can be multiple MB (e.g. `data/film/film-data.json`, `data/pen-america-*.json`). Do not read them in full. Use `jq`, `grep`, `wc`, or `Read` with `offset`/`limit` to pull only the slice you need. Reserve a full read for files you have confirmed are small.

## Data & Database

Always verify data changes with a read-only DB query before AND after applying them, and report exact row counts affected (e.g., "merged 14, kept 14, cleaned 3,399").

## Git Workflow

After any data enrichment/merge/cleanup, always commit AND push the result with a descriptive message summarizing counts and scope.

## Enrichment Pipeline

For cover/title enrichment, guard against namesake/leading-article mismatches and roll back batches that produce incorrect matches; verify a sample before bulk applying.

## Long-Running Jobs

Prefer interruption-resistant, checkpointed terminal commands for long batch jobs; avoid relying on background tasks/monitors that abort on session interruption.

## Data Quality

Double-check production data facts (publication years, country counts, framing) against authoritative sources before shipping; flag pre-existing errors found.
