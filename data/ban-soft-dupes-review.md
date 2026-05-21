# Ban soft-duplicate review

Generated: 2026-05-19 · 4 groups (year-span ≤ 10) across 4 books.

## Why this exists

The `bans_unique_per_scope` UNIQUE constraint (migration `20260514151511_bans_dedupe_and_unique.sql`) blocks duplicates on `(book_id, country_code, year_started, scope_id)`. It cannot see "same event reported with a different year." Example: `Lolita` had a French ban entered as 1956 (sexual) from one source and 1955 (obscenity) from a second Wikipedia import — both visible side-by-side on the public book page.

Fill in the `Decision` column for each group with one of:

- `MERGE` — same real-world event; keep lowest id, migrate reasons / sources / description.
- `KEEP-BOTH` — genuinely distinct events (separate ban orders, separate jurisdictions, re-banning after a lift).
- `MERGE-NEWEST` — same event, but the *higher-id* row carries the better year/reason; keep the higher id.

Once filled in, run the follow-up migration (TBD) to apply the decisions.

## Span 0 years — same year, same country (1)

### Emile, ou De l'éducation — Jean-Jacques Rousseau · Vatican City (Holy See) (VA)

- Span: **0 years**
- Page: <https://www.banned-books.org/books/emile-ou-de-l-education>
- Decision: `TBD`

| Ban ID | Year | Scope | Reasons | Source(s) | Description |
|---|---|---|---|---|---|
| 4744 | 1762–1966 | Church | religious | — | Placed on the Index in 1762 for natural religion hostile to Catholic doctrine; simultaneously burned by the Parlement of Paris. On the Index |
| 5925 | 1762 | Government / national | religious | Wikipedia: List of authors and works on the Index Librorum Prohibitorum |  |

## Span 1–2 years — very likely same event (1)

### Forever Amber — Kathleen Winsor · Australia (AU)

- Span: **1 year**
- Page: <https://www.banned-books.org/books/forever-amber>
- Decision: `TBD`

| Ban ID | Year | Scope | Reasons | Source(s) | Description |
|---|---|---|---|---|---|
| 4730 | 1945 | Customs / border | obscenity, sexual | Wikipedia: Forever Amber | Banned in 1945 for "sex obsession"; the novel's frank treatment of its protagonist's sexual relationships was deemed obscene. |
| 5861 | 1944 | Government / national | obscenity | Wikipedia: List of books banned by governments | Banned by Australia in 1945 as "a collection of bawdiness, amounting to sex obsession." |

## Span 3–5 years — likely same event, double-check (2)

### It — Stephen King · United States (US)

- Span: **3 years**
- Page: <https://www.banned-books.org/books/it>
- Decision: `TBD`

| Ban ID | Year | Scope | Reasons | Source(s) | Description |
|---|---|---|---|---|---|
| 275 | 1987 | School | sexual, violence | PEN America |  |
| 608 | 1990 | Public library | sexual, violence, language | American Library Association — Frequently Challenged Books |  |

### Prisoner of the State — Zhao Ziyang · Hong Kong (HK)

- Span: **3 years**
- Page: <https://www.banned-books.org/books/prisoner-of-the-state>
- Decision: `TBD`

| Ban ID | Year | Scope | Reasons | Source(s) | Description |
|---|---|---|---|---|---|
| 1152 | 2020 | Public library | political | Hong Kong Free Press — Libraries remove books | Removed from Hong Kong Public Libraries for review after the enactment of the National Security Law (June 2020). Withdrawal was deemed neces |
| 5934 | 2023 | Government / national | political | Wikipedia: Book censorship in Hong Kong | ✓ |
