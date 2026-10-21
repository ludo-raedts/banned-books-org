#!/usr/bin/env bash
# Start een gratis (no-GPT) enrich-all run op de achtergrond — bedoeld voor 's nachts.
#
# Wat het draait: enrich-all.ts --apply --free-only --no-gutenberg --no-archive
#   Phase 1: OL/GB-harvest + native titles (covers/jaren/ISBN, ook voor nieuwe boeken)
#   Phase 2: beschrijvingen v2 (Wikipedia/OL/Google Books, letterlijke bron, geen LLM,
#            concurrency 5) over alle boeken zonder description_book (~9.400, uren werk)
#   Daarna: confidence-rollback + coverage-rapport in data/enrichment-coverage-report-<datum>.md
#
# Wacht eerst (op de achtergrond, max 72 uur) tot:
#   1. geen andere verrijkingsjob meer draait (enrich-all, data/*/enrich-new-*.sh) —
#      twee runs tegelijk = dubbele DB-load en strijd om het Google Books-quotum;
#   2. Google Books weer antwoordt (canary, elk uur). v2 slaat boeken zonder bron
#      blijvend op als 'flagged' en slaat die later over — een run tijdens een
#      GB-storing zou dus duizenden boeken onterecht afschrijven.
#
# Onderbreekbaar: opnieuw starten pakt op waar hij bleef.
# Tijdens de run niet pushen (enrich-load → build-fail 57014).
#
# Gebruik:
#   scripts/enrich-overnight.sh            # start op de achtergrond (wacht zo nodig eerst)
#   scripts/enrich-status.sh -f            # volgen zodra enrich-all loopt
#   tail -f data/enrich-all.log            # ook de wachtfase volgen
#   pkill -f enrich-overnight.sh; pkill -f scripts/enrich-all.ts   # stoppen
set -euo pipefail
cd "$(dirname "$0")/.."

LOG=data/enrich-all.log
OTHER_JOBS='scripts/enrich-all\.ts|enrich-new-[A-Z]\.sh'

if [ "${1:-}" != "--inner" ]; then
  if pgrep -f 'enrich-overnight\.sh --inner' >/dev/null || pgrep -f 'scripts/enrich-all\.ts' >/dev/null; then
    echo "enrich-overnight/enrich-all draait of wacht al — niet opnieuw gestart."
    exit 1
  fi
  nohup "$0" --inner > "$LOG" 2>&1 &
  echo "gestart op de achtergrond (pid $!) — log: $LOG"
  echo "wacht eerst op andere verrijkingsjobs en Google Books, daarna start enrich-all."
  exit 0
fi

ts() { date '+%d-%m %H:%M'; }

gb_ok() {
  local key n
  for key in GOOGLE_BOOKS_API_KEY GOOGLE_BOOKS_API_KEY2; do
    n=$(curl -s -m 20 "https://www.googleapis.com/books/v1/volumes?q=intitle:hatchet+inauthor:paulsen&maxResults=1&key=$(grep "^$key=" .env.local | cut -d= -f2-)" \
      | python3 -I -c "import json,sys
try: print(json.load(sys.stdin).get('totalItems') or 0)
except Exception: print(0)")
    [ "${n:-0}" -gt 0 ] && return 0
  done
  return 1
}

for i in $(seq 1 72); do
  if pgrep -f "$OTHER_JOBS" >/dev/null; then
    echo "$(ts) wacht: andere verrijkingsjob draait ($(pgrep -fl "$OTHER_JOBS" | head -1 | cut -c1-80))"
  elif ! gb_ok; then
    echo "$(ts) wacht: Google Books geeft geen resultaten (storing)"
  else
    echo "$(ts) vrij baan + Google Books gezond — enrich-all start"
    caffeinate -i -w $$ &
    exec npx tsx --env-file=.env.local scripts/enrich-all.ts \
      --apply --free-only --no-gutenberg --no-archive
  fi
  sleep 3600
done
echo "$(ts) na 72 uur nog steeds geblokkeerd — gestopt zonder run."
