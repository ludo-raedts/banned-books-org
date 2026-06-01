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

# Reading large data files

Files under `data/` can be multiple MB (e.g. `data/film/film-data.json`, `data/pen-america-*.json`). Do not read them in full. Use `jq`, `grep`, `wc`, or `Read` with `offset`/`limit` to pull only the slice you need. Reserve a full read for files you have confirmed are small.
