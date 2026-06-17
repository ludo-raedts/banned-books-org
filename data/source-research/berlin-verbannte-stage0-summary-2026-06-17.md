# Berlin verbannte Bücher — Stap 0 summary (2026-06-17)

> **DO NOT IMPORT YET.** Read-only Stap-0 seed produced by
> `scripts/build-berlin-verbannte-stage0.ts` (no DB writes).

Source: Liste der verbannten Bücher (Berlin.de / BerlinOnline GmbH, CC-BY) — Liste des schädlichen und unerwünschten Schrifttums, Stand 31.12.1938
URL: https://www.berlin.de/verbannte-buecher/suche/ · License: CC-BY (Berlin Open Data / BerlinOnline GmbH)

## Partition
| Bucket | Rows | Disposition |
|---|---|---|
| total | 4764 | — |
| **book** (clean book-level) | **3606** | import seed → `data/berlin-verbannte-1938-2026-06-17.json` |
| blanket ("Sämtliche…") | 607 | EXCLUDE → model as author-level |
| authorless (anon/aggregate) | 551 | HOLD for manual review |

Book rows with a publication year: 3585 / 3606.

## Cross-language match signal (Option A)
English work title resolved via Wikidata (cross-language match signal for
Stap 2): **29 / 3606** filled (run with `--enrich-english` to populate).
A null English title = likely a net-new German work (low dedup risk); a filled
one = a work that may already be in the catalogue under its English title.

## Normalized schema (per row)
```json
{
  "source_row_id": 1,
  "list_page": 166,
  "title": "Frauenleiden",
  "title_english_meaningful": null,
  "authors": [
    "Ignaz Zadek"
  ],
  "country_code": "DE",
  "year": 1938,
  "scope_slug": "government",
  "action_type": "banned",
  "reason_slug": "political",
  "warning_level": "none",
  "publisher": "Vorwärts",
  "publication_place": "Berlin",
  "publication_year": 1917,
  "source_name": "Liste der verbannten Bücher (Berlin.de / BerlinOnline GmbH, CC-BY) — Liste des schädlichen und unerwünschten Schrifttums, Stand 31.12.1938",
  "source_url": "https://www.berlin.de/verbannte-buecher/suche/",
  "ocr_line": "Zadek, Ignaz: Frauenleiden. Berlin: Vorwärts 1917.",
  "wikidata_qid": null
}
```

## Sample book rows
| # | German title | English (Wikidata) | author | pub.year |
|---|---|---|---|---|
| 1 | Frauenleiden | — | Ignaz Zadek | 1917 |
| 2 | Larissa | — | Hubert Ernst Gilbert | 1930 |
| 4 | Kulturgeschichte der Neuzeit | — | Egon Riedinender | 1927 |
| 5 | Gericht über Hugenberg | — | Wahrmund | 1932 |
| 6 | Priester der Liebe | — | Chajim Bloch | 1930 |
| 7 | Das Buch der NSDAP | — | Walter Maria Espe | 1934 |
| 11 | Quartier an der Mosel | — | Karl Friedrich Borée | 1936 |
| 13 | Drei Tage | — | Victoria Wolf | 1937 |

## Ban-year note
`year = 1938` for every row = the date of the list edition the dataset
encodes ("Stand vom 31. Dezember 1938"). Many of these books were suppressed
earlier (e.g. the 1933 burnings); 1938 is the verifiable list-appearance year,
not a claim about the first prohibition date.

## Next (not done here)
1. Run/finish `--enrich-english` (full sweep, resumable).
2. Review the 551 authorless rows + decide blanket modeling.
3. THEN write a thin importer that feeds these rows through match-before-create
   → `commitParsedRow`/`commitNewBanForBook`, with the mandatory dupe sweep after.
