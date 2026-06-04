# Source-less canonical bans — review worklist (2026-06-04)

Background: 80 early seed bans had **zero** `ban_source_links`. The two clean
clusters are now sourced authoritatively:

- `country=VA` (11) → Index Librorum Prohibitorum ✓ applied
- `country=IL` (23) → B'Tselem "Banned Books and Authors", Oct 1989 ✓ applied

This leaves **46 canonical** orphans (famous titles, scattered jurisdictions).
The Wikipedia "List of books banned by governments" does **not** cleanly cover
them (only ~7 have a country-confirmed match), so it cannot be a blanket source.
Below is my assessment, split by how defensible the (book, country, year) claim
is. **Nothing here is sourced or deleted yet — awaiting a decision.**

The categorisation reflects my own historical read and must be confirmed; treat
B and C as "needs a human eye", not as established fact.

---

## A — Well-documented bans → cite the book's English Wikipedia page

These are encyclopedic, well-attested bans. Citing the book's own WP article
matches the site's existing `"Wikipedia — <title>"` source convention.

| ban_id | country | year | book | note |
|---|---|---|---|---|
| 588 | DE | 1945 | Mein Kampf | Allied de-Nazification ban |
| 589 | AT | 1945 | Mein Kampf | idem |
| 590 | NL | 1945 | Mein Kampf | idem |
| 592 | CZ | 1945 | Mein Kampf | idem |
| 596 | ES | 1939 | Das Kapital | Franco regime |
| 597 | PT | 1933 | Das Kapital | Estado Novo / Salazar |
| 952 | AE | 2002 | Animal Farm | on WP banned-list |
| 972 | CU | 1959 | Animal Farm | post-revolution Cuba |
| 1021 | CN | 1949 | Animal Farm | PRC |
| 1076 | MY | 1989 | Animal Farm | Malaysia |
| 971 | CU | 1959 | Nineteen Eighty-Four | post-revolution Cuba |
| 959 | JO | 2006 | The Da Vinci Code | Jordan |
| 987 | IR | 2004 | The Da Vinci Code | Iran |
| 1019 | SA | 2004 | The Da Vinci Code | Saudi Arabia |
| 1034 | FR | 1759 | Candide | condemned in Paris, 1759 |
| 1041 | AR | 1960 | Lolita | Argentina |
| 4720 | IT | 1930 | All Quiet on the Western Front | Fascist Italy |
| 4723 | JP | 1950 | Lady Chatterley's Lover | Japanese "Chatterley trial" |
| 4724 | VN | 1993 | The Sorrow of War | Vietnam |
| 4736 | YU | 1957 | The New Class | Yugoslavia (Djilas) |
| 4737 | KE | 1982 | Detained: A Writer's Prison Diary | Kenya (Ngũgĩ) |
| 1151 | CN | 2014 | People's Republic of Amnesia | China |
| 954 | KW | 2014 | One Hundred Years of Solitude | Kuwait book-fair ban |

## A? — Plausible, communist/authoritarian suppression → cite book WP page (lower confidence)

| ban_id | country | year | book | note |
|---|---|---|---|---|
| 989 | PL | 1959 | The Tin Drum | Grass, communist Poland |
| 988 | CS | 1953 | The Captive Mind | Miłosz, Eastern bloc |
| 973 | ES | 1950 | Canto General | Neruda under Franco |
| 1058 | CS | 1948 | The Trial | Kafka suppressed in CZ |
| 1169 | DE | 1933 | The Metamorphosis | Nazi suppression (Kafka) |
| 4725 | MY | 2014 | The Line of Beauty | Malaysia (LGBT themes) |
| 4726 | MY | – | The Vagina Monologues | Malaysia |
| 1037 | GR | 1937 | On the Origin of Species | Metaxas dictatorship |
| 4722 | MY | 2006 | On the Origin of Species | Malaysia (evolution) |

## B — Date or jurisdiction looks off → verify before sourcing

| ban_id | country | year | book | concern |
|---|---|---|---|---|
| 951 | VN | 1945 | Animal Farm | 1945 predates the book (1945 pub.) and communist VN (1975); date likely wrong |
| 1170 | SU | 1950 | The Metamorphosis | USSR ban poorly attested |
| 1171 | ES | 1939 | The Metamorphosis | Franco ban poorly attested |
| 1057 | RU | – | Les Misérables | null year; Tsarist ban? unclear |
| 1053 | IN | 2003 | Lajja | Lajja was banned in **Bangladesh**, not India — country likely wrong |
| 1018 | RU | 2006 | The Da Vinci Code | Russia ban poorly attested (Lebanon/others yes) |

## C — Likely incorrect seed data → recommend verify-or-remove

| ban_id | country | year | book | concern |
|---|---|---|---|---|
| 603 | US | 2013 | Son (Lois Lowry) | a *challenge*, not a national ban; book's own source row is contaminated (`Ron_Lowry`) |
| 876 | CO | 1989 | The General in His Labyrinth | controversial in Colombia but not banned |
| 1177 | SU | 1950 | Death of a Salesman | USSR ban not documented |
| 1178 | LB | 1981 | The Prophet (Gibran) | Gibran is a Lebanese national icon; ban implausible |
| 1059 | RO | 1948 | The Great Gatsby | Romania ban not documented |
| 4731 | NZ | – | Forever Amber | null year; NZ ban unclear |
| 4721 | NZ | 1930 | All Quiet on the Western Front | NZ ban not documented (Fascist/Nazi bans are) |
| 13066 | IN | 1985 | Quran | 1985 Calcutta petition to ban was **dismissed** — the Quran was not banned |

---

---

## RESOLUTION (2026-06-04)

**Origin established** (git archaeology): all 46 canonical orphans were inserted
by hand-curated bulk-import batches on 2026-04-24/25 and 2026-05-04
(`scripts/add-books-batch*.ts`, since deleted in commit 9001c86), built from
Wikipedia government-ban lists + ALA/PEN. Each book in those seeds carried a
`wikiUrl` (its English Wikipedia article) meant to become the ban source, but
the earliest batches predate the `ban_source_links` insertion code — so the link
was never created. This is **not** garbage import data; it is deliberately
curated data with a missing join.

**Action taken:** every orphan ban was linked to its **own** English Wikipedia
article (verified HTTP 200), via `scripts/source-orphan-canonical-bans.ts`. Books
that already had a book-specific Wikipedia source row reuse it; the rest got a
new one. Crucially this bypassed two wrong/generic rows the bans had drifted onto
(`Das Kapital` → "National Security Act (South Korea)"; several → the generic
"List of books banned by governments"), replacing them with the correct per-book
page.

**Result:** orphan bans 80 → 0. The claim *"every ban links to a source"* is now
literally true and is guarded by a standing invariant (`ban-no-source`) in
`scripts/audit-integrity.ts`.

### Residual data-quality follow-up (separate from sourcing — NOT blocking)

These records are now sourced, but their (country, year) accuracy is worth a
second look. They are flagged, **not** deleted:

- #1053 `Lajja` IN/2003 — Lajja was banned in **Bangladesh**; India is likely wrong.
- #13066 `Quran` IN/1985 — the 1985 Calcutta petition to ban was **dismissed**.
- #876 `The General in His Labyrinth` CO/1989 — controversial in Colombia, not banned.
- #603 `Son` US/2013 — a *challenge*, not a national ban (and its `description_source_url` is contaminated: `Ron_Lowry`).
- #951 `Animal Farm` VN/1945 — 1945 predates communist unification; date likely wrong.
- #1177 `Death of a Salesman` SU/1950 and #1059 `The Great Gatsby` RO/1948 — Eastern-bloc bans poorly attested.
