# Mojibake authors — review

Generated 2026-05-28T08:01:57Z. 0 flagged author(s); 0 linked book(s) total.

Detection scans `authors.display_name` for three independent signals:

1. `REPLACEMENT_CHAR` — U+FFFD (`�`), the canonical "decode failed" marker.
2. `MOJIBAKE_PATTERN` — UTF-8 misread as Latin-1/CP1252 (`Ã©`, `â€™`, `Â£`, …).
3. `CONTROL_RUN` — a run of 3+ characters that are neither letters/marks nor common punctuation.

### Counts by reason

- `REPLACEMENT_CHAR`: 0
- `MOJIBAKE_PATTERN`: 0
- `CONTROL_RUN`: 0

## KDN-Maleisië window (created 2026-05-26 – 2026-05-28) — 0 hit(s)

_None in this window._

## Other hits — 0

_None outside the KDN window._
