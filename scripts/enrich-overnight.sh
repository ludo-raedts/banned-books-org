#!/usr/bin/env bash
# Start een gratis (no-GPT) enrich-all run op de achtergrond — bedoeld voor 's nachts.
#
# Wat het draait: enrich-all.ts --apply --free-only --no-gutenberg --no-archive
#   Phase 1: OL/GB-harvest + native titles (covers/jaren/ISBN, ook voor nieuwe boeken)
#   Phase 2: beschrijvingen v2 (Wikipedia/OL/Google Books, letterlijke bron, geen LLM,
#            concurrency 5) over alle boeken zonder description_book (~9.400, uren werk)
#   Daarna: confidence-rollback + coverage-rapport in data/enrichment-coverage-report-<datum>.md
#
# Onderbreekbaar: rijen zonder bron worden 'flagged' en overgeslagen bij een herstart,
# dus opnieuw starten pakt op waar hij bleef.
#
# NIET starten terwijl een Vercel-deploy bouwt (enrich-load → build-fail 57014),
# en tijdens de run niet pushen.
#
# Gebruik:
#   scripts/enrich-overnight.sh            # start op de achtergrond
#   scripts/enrich-status.sh -f            # volgen
#   pkill -f scripts/enrich-all.ts         # stoppen
set -euo pipefail
cd "$(dirname "$0")/.."

if pgrep -f 'scripts/enrich-all\.ts' >/dev/null; then
  echo "enrich-all draait al (pid $(pgrep -f 'scripts/enrich-all\.ts' | head -1)) — niet opnieuw gestart."
  exit 1
fi

nohup npx tsx --env-file=.env.local scripts/enrich-all.ts \
  --apply --free-only --no-gutenberg --no-archive \
  > data/enrich-all.log 2>&1 &

echo "enrich-all gestart (pid $!) — log: data/enrich-all.log"
echo "volgen:  scripts/enrich-status.sh -f"
