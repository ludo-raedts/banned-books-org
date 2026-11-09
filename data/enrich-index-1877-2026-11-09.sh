#!/usr/bin/env bash
# Light enrichment for the 2026-11-09 Index Librorum Prohibitorum 1877 import
# (4,565 VA books, 2,732 authors without a bio). Wikipedia/Wikidata only.
# Run from the repo root, VPN off, not during a deploy. Resumable; re-running is safe.
#
# Deliberately left out:
#   - Google Books harvest: fuzzy title search on 17th-c. Latin titles returns modern
#     namesake editions (wrong covers/years), and these books have no ISBN.
#   - OL harvest: exact-key only, and none of these books has a work_id/ISBN → no-op.
#   - genres-gpt / websearch covers+descriptions: paid (OpenAI spend cap).
# Author bios: era guard now falls back to the ban (decree) year, so a 20th-c.
# namesake is rejected; dry-run 150 → 19 matched, all the right historical person.
set -euo pipefail
cd "$(dirname "$0")/.."
A=data/index-1877-2026-11-09-author-ids.json
run() { echo; echo "▶ $*"; npx tsx --env-file=.env.local "$@"; }

run scripts/enrich-author-bios.ts --ids-file=$A --limit=3000 --apply
run scripts/enrich-author-bios.ts --ids-file=$A --limit=3000 --photos-only --apply
