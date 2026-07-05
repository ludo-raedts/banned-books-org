#!/usr/bin/env bash
# Status van een lopende (of laatste) enrich-all run.
#
# Gebruik:
#   scripts/enrich-status.sh          # één snapshot
#   scripts/enrich-status.sh -f       # ververst elke 60s (Ctrl-C om te stoppen)
#   scripts/enrich-status.sh -f 30    # ververst elke 30s
#
# Leest alleen logs/procestabel — raakt de run of de DB nooit aan.
set -uo pipefail
cd "$(dirname "$0")/.."

show() {
  echo ""
  echo "════════ enrich-all status — $(date '+%H:%M:%S') ════════"

  local main_pid
  main_pid=$(pgrep -f 'scripts/enrich-all\.ts' | head -1 || true)
  if [ -n "${main_pid:-}" ]; then
    echo "● enrich-all draait (pid ${main_pid})"
  else
    echo "○ enrich-all draait NIET — dit is de laatste run"
  fi

  local run_dir
  run_dir=$(ls -dt data/enrich-run/*/ 2>/dev/null | head -1 || true)
  if [ -z "${run_dir:-}" ]; then
    echo "geen run-directory gevonden onder data/enrich-run/"
    return
  fi

  if [ -f "${run_dir}coverage-before.json" ]; then
    local start now elapsed
    start=$(stat -f %m "${run_dir}coverage-before.json")
    now=$(date +%s)
    elapsed=$(( now - start ))
    printf "run: %s  (gestart %dh%02dm geleden)\n" "$run_dir" $(( elapsed / 3600 )) $(( (elapsed % 3600) / 60 ))
  else
    echo "run: $run_dir"
  fi

  echo ""
  echo "── Phase 1 harvesters (eigen logs) ──"
  local log name marker last
  for log in "${run_dir}"*.log; do
    [ -e "$log" ] || continue
    name=$(basename "$log" .log)
    if pgrep -f "enrich-${name}\.ts" >/dev/null 2>&1; then
      marker="●"
    else
      marker="✓"
    fi
    last=$(tail -c 4096 "$log" | grep -v '^[[:space:]═─]*$' | tail -1 | cut -c1-110)
    printf "  %s %-14s %s\n" "$marker" "$name" "${last:-"(log leeg)"}"
  done

  echo ""
  echo "── laatste 8 regels data/enrich-all.log (Phase 2 + samenvatting) ──"
  if [ -f data/enrich-all.log ]; then
    tail -8 data/enrich-all.log | sed 's/^/  /'
  else
    echo "  (data/enrich-all.log bestaat niet)"
  fi
}

if [ "${1:-}" = "-f" ]; then
  interval="${2:-60}"
  while true; do
    show
    sleep "$interval"
  done
else
  show
fi
