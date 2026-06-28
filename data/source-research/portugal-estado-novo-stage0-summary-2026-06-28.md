# Portugal Estado Novo (Brandão) — Stap 0 summary (2026-06-28)

> **DO NOT IMPORT YET.** Read-only Stap-0 seed produced by
> `scripts/build-portugal-estado-novo-stage0.ts` (no DB writes).

Source: José Brandão, "Livros Proibidos nos Anos da Ditadura de 1933 a 1974" — compilação da censura do Estado Novo (Comissão do Livro Negro sobre o Regime Fascista)
URL: https://bibliblogue.wordpress.com/wp-content/uploads/2012/04/200412livrosproibidos33_74.pdf
Verification anchor (per-title, NOT done here): PORBASE/BNP + Alvim (E-LIS).

## Counts
| Metric | Value |
|---|---|
| parsed rows | 900 |
| special-prohibition "(*)" | 94 |
| collective/anthology authors (Vários/Colectivo) | 61 |
| English work title resolved (Wikidata) | 33 (run with `--enrich-english`) |

## Year ambiguity (THE load-bearing data-quality risk)
The Brandão `DATA` column is "data da edição ou da proibição" — **edition OR
ban year, not disambiguated per row**. It is captured as `source_data_year`
only; `publication_year` is left `null` with `year_unverified: true`. Per
data-quality doctrine, no year may be asserted in production until it is
cross-checked per title against PORBASE/BNP (and/or Alvim's ISBD records).

## Cross-language match signal (Option A)
English work title resolved via Wikidata (cross-language match signal for
match-before-create / Stap 2): **33 / 900** filled. The
source carries Portuguese titles only, so without this a Portuguese-titled
duplicate of a book already in the catalogue under its English title would be
minted. A null English title = likely a net-new Portuguese-edition work (low
dedup risk); a filled one = a work that may already exist (e.g. Sartre
*À Porta Fechada* → "No Exit", Lawrence *O Amante de Lady Chatterley*).

## Normalized schema (per row)
```json
{
  "source_row_n": 1,
  "title": "1919",
  "title_pt_raw": "1919",
  "title_english_meaningful": null,
  "authors": [
    "John dos Passos"
  ],
  "author_raw": "Passos, John dos",
  "author_collective": false,
  "country_code": "PT",
  "scope_slug": "government",
  "action_type": "banned",
  "reason_slug": "political",
  "special_prohibition": false,
  "publisher": "Portugália",
  "publication_year": null,
  "year_unverified": true,
  "source_data_year": 1946,
  "source_name": "José Brandão, \"Livros Proibidos nos Anos da Ditadura de 1933 a 1974\" — compilação da censura do Estado Novo (Comissão do Livro Negro sobre o Regime Fascista)",
  "source_url": "https://bibliblogue.wordpress.com/wp-content/uploads/2012/04/200412livrosproibidos33_74.pdf",
  "wikidata_qid": null
}
```

## Sample rows
| # | PT title (normalized) | English (Wikidata) | author | (*) | DATA |
|---|---|---|---|---|---|
| 1 | 1919 | — | John dos Passos |  | 1946 |
| 2 | 08/15 - Hoje | — | H. Hellmut Kirst |  | 1965 |
| 3 | Abc de Castro Alves | The ABC of Castro Alves | Jorge Amado | ✱ | 1971 |
| 4 | ABC do Comunismo | — | N. Boukharine |  | 1974 |
| 5 | Acerca da Contradição | — | Mao Tsé-Tung |  | 1971 |
| 6 | Acerca dos Dias | — | Orlando César |  | 1972 |
| 7 | O Adolescente | — | Nita Clímaco |  | 1966 |
| 8 | Adolfo Hitler e o seu livro «Mein Kampf» | — | René Lichtenberg |  | 1949 |
| 9 | A Adúltera | — | Roy Harvey |  | 1967 |
| 10 | A África Austral | — | Arnaud Durban |  | 1970 |

## Next (not done here)
1. Run/finish `--enrich-english` (full sweep, resumable).
2. Per-title PORBASE/BNP year verification (mandatory before asserting any year).
3. Decide handling of the 61 collective/anthology rows (placeholder author).
4. THEN write a thin importer that feeds these rows through match-before-create
   → `commitParsedRow`/`commitNewBanForBook`, with the mandatory dupe sweep after.
