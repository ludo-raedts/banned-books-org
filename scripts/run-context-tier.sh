#!/bin/bash
# Checkpointed, resumable runner: sourced censorship histories for a worklist slice (dry-run, no DB writes).
# Usage: scripts/run-context-tier.sh <ids-file> <out-tag> [chunk=40]
cd "$(dirname "$0")/.." || exit 1
IDS="$1"; TAG="$2"; CHUNK="${3:-40}"
for i in $(seq 1 40); do
  OUT=$(pnpm tsx --env-file=.env.local scripts/verify-censorship-context.ts --ids-file="$IDS" --with-ban-text --from-sources --concurrency=5 --limit="$CHUNK" --firecrawl --firecrawl-max=100 --out="$TAG" 2>&1 | tail -5)
  echo "$OUT" | grep -E "Outcomes|Cost"
  echo "$OUT" | grep -q "Outcomes: {}" && { echo "done: nothing left"; break; }
done
