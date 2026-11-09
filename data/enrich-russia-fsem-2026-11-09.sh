#!/usr/bin/env bash
# Scoped enrichment for the 2026-11-09 FSEM full-list import (51 books, 29 new authors).
# Run from the repo root, VPN off, after the Google Books quota reset (~09:00 CEST),
# not during a deploy. Each step is resumable; re-running is safe.
# Expect a low yield: most FSEM books are obscure Russian tracts without ISBN/OL/GB records.
# Deliberately left out: websearch covers/descriptions (OpenAI spend cap).
set -euo pipefail
cd "$(dirname "$0")/.."
B=data/russia-fsem-2026-11-09-book-ids.json
A=data/russia-fsem-2026-11-09-author-ids.json
run() { echo; echo "▶ $*"; npx tsx --env-file=.env.local "$@"; }

# authors
run scripts/enrich-author-bios.ts --ids-file=$A --limit=1000 --apply
run scripts/enrich-author-bios.ts --ids-file=$A --limit=1000 --photos-only --apply

# books (id-scoped)
run scripts/enrich-gb-harvest.ts --ids-file=$B --apply
run scripts/enrich-ol-harvest.ts --ids-file=$B --apply
run scripts/enrich-genres-gpt.ts --ids-file=$B --apply
