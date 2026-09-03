# enrich-reasons DRY-RUN — class untagged

Run: 2026-09-03T14:39:59.272Z · model gpt-4o-mini · 6 bans classified
Nothing was written to the database.

Mode: **--grounded-only** — only reasons the ban event's own description states
are written. Slugs under "inferred" follow from the book's themes and are
deliberately NOT written.

- rows the description states a reason for (would be written): **3**
- rows whose description states no reason (left untagged): **3**
- rows without a per-event description (book-level inference only): **0**

## Proposed reasons per slug

| slug | rows |
| --- | --- |
| religious | 3 |

## Per row

| ban | book | title | event | STATED (written) | inferred (dropped) | has per-event description |
| --- | --- | --- | --- | --- | --- | --- |
| 13072 | 6 | The Satanic Verses | SD · 1988 | religious | political | yes |
| 13073 | 6 | The Satanic Verses | ZA · 1988 | — | political, violence, religious (unevidenced) | yes |
| 13075 | 6 | The Satanic Verses | SO · 1988 | religious | political | yes |
| 13076 | 6 | The Satanic Verses | BN · 1989 | religious | political | yes |
| 13077 | 6 | The Satanic Verses | SG · 1989 | — | political, violence, religious (unevidenced) | yes |
| 13078 | 6 | The Satanic Verses | VE · 1989 | — | political, violence, religious (unevidenced) | yes |

## Rows with a per-event description (the strongest signal)

- **ban 13072** "The Satanic Verses" → `religious` _(dropped: political)_
  > Banned November 1988 for blasphemy against Islam.
- **ban 13073** "The Satanic Verses" → `nothing stated` _(dropped: political, violence, religious (unevidenced))_
  > Banned November 1988 under apartheid-era publications law; the ban was formally lifted in January 2002.
- **ban 13075** "The Satanic Verses" → `religious` _(dropped: political)_
  > Banned 24 November 1988 for blasphemy against Islam.
- **ban 13076** "The Satanic Verses" → `religious` _(dropped: political)_
  > Banned in 1989 for blasphemy against Islam.
- **ban 13077** "The Satanic Verses" → `nothing stated` _(dropped: political, violence, religious (unevidenced))_
  > Banned March 1989 under the Undesirable Publications Act.
- **ban 13078** "The Satanic Verses" → `nothing stated` _(dropped: political, violence, religious (unevidenced))_
  > Banned in June 1989 — described by contemporary accounts as the last nation to impose a restriction during the initial wave of bans.
