#!/usr/bin/env bash
# enrich-parallel.sh — nohup-safe supervisor that runs the three per-book
# enrichers CONCURRENTLY, measures before/after coverage, runs the confidence
# auditor, and writes a coverage report. Designed to survive terminal/session
# close: launch it detached and walk away.
#
#   nohup bash scripts/enrich-parallel.sh --apply > data/enrich-run/supervisor.log 2>&1 &
#
# The three sources are disjoint by construction (ol-harvest=keyable books,
# gb-harvest=orphans, native-titles=non-English) and EACH is independently:
#   • skip-cached + checkpointed — only-when-NULL writes + a resume cursor, so an
#     interruption never reprocesses a completed row. Re-running resumes.
#   • quota-graceful — gb-harvest stops cleanly on a 429 (GbQuotaError); because
#     each source is its OWN process, a quota stop or crash in one NEVER aborts
#     the others (process isolation = graceful per-source skip for free).
#
# Flags:
#   --apply            write to the DB (default: dry-run smoke test, sample sizes)
#   --commit           after the run, git add the run artifacts + push (requires --apply)
#   --threshold=0.5    confidence threshold for the rollback auditor
#   --native-limit=N   cap native-titles (default 99999 = full sweep)
#   --ol-limit=N       cap ol-harvest    (default 99999 = full sweep)
#   --gb-budget=N      GB query budget    (default 900; GB hard-caps ~1000/day)
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APPLY=""
APPLY_BOOL="false"
COMMIT=0
THRESHOLD="0.5"
NATIVE_LIMIT="99999"
OL_LIMIT="99999"
GB_BUDGET="900"
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY="--apply"; APPLY_BOOL="true" ;;
    --commit) COMMIT=1 ;;
    --threshold=*) THRESHOLD="${arg#*=}" ;;
    --native-limit=*) NATIVE_LIMIT="${arg#*=}" ;;
    --ol-limit=*) OL_LIMIT="${arg#*=}" ;;
    --gb-budget=*) GB_BUDGET="${arg#*=}" ;;
  esac
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_DIR="data/enrich-run/$STAMP"
mkdir -p "$RUN_DIR"
TSX="npx tsx --env-file=.env.local"

echo "== enrich-parallel $STAMP  (apply=${APPLY:-no}) =="

# 1. BEFORE snapshot
$TSX scripts/enrich-coverage-snapshot.ts --snapshot="$RUN_DIR/coverage-before.json"

# 2. Launch the three sources concurrently, each detached to its own log.
echo "-- launching sources --"
$TSX scripts/enrich-ol-harvest.ts $APPLY --limit="$OL_LIMIT" > "$RUN_DIR/ol-harvest.log" 2>&1 &
PID_OL=$!
$TSX scripts/enrich-gb-harvest.ts $APPLY --budget="$GB_BUDGET" > "$RUN_DIR/gb-harvest.log" 2>&1 &
PID_GB=$!
$TSX scripts/enrich-native-titles.ts $APPLY --limit="$NATIVE_LIMIT" > "$RUN_DIR/native-titles.log" 2>&1 &
PID_NATIVE=$!

# 3. Manifest (consumed by the report generator)
cat > "$RUN_DIR/manifest.json" <<JSON
{
  "startedAt": "$SINCE",
  "apply": $APPLY_BOOL,
  "sources": [
    {"name": "ol-harvest",     "pid": $PID_OL,     "log": "$RUN_DIR/ol-harvest.log"},
    {"name": "gb-harvest",     "pid": $PID_GB,     "log": "$RUN_DIR/gb-harvest.log"},
    {"name": "native-titles",  "pid": $PID_NATIVE, "log": "$RUN_DIR/native-titles.log"}
  ]
}
JSON

# 4. Wait for each independently; one source failing must not abort the run.
for entry in "ol:$PID_OL" "gb:$PID_GB" "native:$PID_NATIVE"; do
  name="${entry%%:*}"; pid="${entry#*:}"
  if wait "$pid"; then echo "   $name: done (exit 0)"; else echo "   $name: stopped (exit $?) — continuing"; fi
done

# 5. AFTER snapshot
$TSX scripts/enrich-coverage-snapshot.ts --snapshot="$RUN_DIR/coverage-after.json"

# 6. Confidence audit + auto-rollback (writes confidence.json for the report).
NATIVE_REVIEW="data/native-title-enrichment-$(date -u +%F).json"
$TSX scripts/audit-enrichment-confidence.ts \
  --since="$SINCE" --threshold="$THRESHOLD" \
  ${APPLY:+--native-review="$NATIVE_REVIEW"} \
  $APPLY 2>&1 | tee "$RUN_DIR/confidence.log"
# extract the trailing JSON line for the report
grep '^JSON ' "$RUN_DIR/confidence.log" | tail -1 | sed 's/^JSON //' > "$RUN_DIR/confidence.json" || true

# 7. Report
$TSX scripts/enrich-coverage-report.ts \
  --before="$RUN_DIR/coverage-before.json" \
  --after="$RUN_DIR/coverage-after.json" \
  --run-dir="$RUN_DIR" \
  --out="data/enrichment-coverage-report-$(date -u +%F).md"

# 8. Optional commit + push of the run artifacts (explicit staging only).
if [ "$COMMIT" = "1" ] && [ -n "$APPLY" ]; then
  echo "-- committing run artifacts --"
  git add "data/enrichment-coverage-report-$(date -u +%F).md" "$RUN_DIR" \
          data/ol-harvest-cursor.json data/native-title-enrichment-*.* 2>/dev/null
  git commit -m "enrich: parallel run $STAMP — coverage before/after + confidence rollback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" && git push
fi

echo "== done. report: data/enrichment-coverage-report-$(date -u +%F).md =="
