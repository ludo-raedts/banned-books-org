---
name: ship
description: Finish sequence for this repo — run the integrity audit, commit, and push. Use when the user says /ship, "ship it", or asks to wrap up and push completed work.
---

# Ship

Run the finish sequence for the current task:

1. **Audit.** Run `npx tsx scripts/audit-integrity.ts` and confirm it exits 0. If it exits non-zero, STOP — report the failing invariants/drift and do not commit.
2. **Stage.** Stage only the files relevant to the task at hand (no blanket `git add -A`; leave unrelated working files like `data/` scratch output and `.claude/settings.json` alone unless they are part of the task). Never suppress git add errors with `2>/dev/null` — one dead pathspec aborts the entire add. Verify the staged set with `git status --short` before committing.
3. **Commit.** Write a concise commit message summarizing what and why; for data work include exact counts and scope (e.g., "merged 14, cleaned 3,399").
4. **Push.** Push to origin main.
5. **Report.** Report the pushed commit hash and summarize what shipped. Pushing triggers the Vercel deploy — do not start heavy enrichment runs while it builds (enrich-all ↔ deploy collision).
