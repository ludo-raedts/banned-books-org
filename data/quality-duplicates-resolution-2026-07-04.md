# Quality-duplicates CSV — analyse & resolutie (2026-07-04)

Input: `quality_duplicates_2026-07-04.csv` — 50 titelgroepen waar meerdere
book-rijen dezelfde titel delen (case-insensitief gegroepeerd; de kolommen
slug/author tonen één representant per groep).

## Uitkomst

- **46 groepen = legitieme titel-naamgenoten** — verschillende werken van
  verschillende auteurs die toevallig dezelfde (vaak generieke) titel dragen.
  Vooral Berlijn-1938 (`Die Prostitution`, `Eros`, `Ferdinand Lassalle`, …),
  Portugal Estado Novo (`Lenine` ×3, `A Guerra Civil de Espanha`) en
  moderne US-titels (`Forever` Blume/Stiefvater, `Breathless` ×3,
  `Requiem` Akhmatova/Oliver, `Howl` Ginsberg/Hutchinson). Allemaal correct
  met slug-suffixen onderscheiden → geen actie.
- **4 groepen bevatten echte fouten** (ban aan verkeerd gelijknamig boek
  gehangen, of dubbele boek-rij) → gefixt via
  `scripts/_fix_title_collision_bans_2026_07_04.ts` (--apply gedraaid).

## De 4 fixes (bron-geverifieerd)

| # | Titel | Probleem | Fix |
|---|---|---|---|
| 1 | Lucky | Book #18834 "Alice **Seabold**" was een dupe van #205 lucky-as (Alice Sebold). De spelfout staat letterlijk zo in PEN 2021-22 (Virginia Beach-rij: "Seabold, Alice"). | Ban #35891 (Virginia Beach) → #205 (nu 84 bans); book #18834 + auteur #346 verwijderd; alias `alice-seabold`→auteur #206 (`lucky`→#205 bestond al). |
| 2 | Shame | Rushdie's Pakistan-1983-ban (#29284, desc noemt Rushdie expliciet) stond op #10643 "Shame" van Rudolph Conway Ph. D. — dat is een KDN-1969 pulptitel (gazette bil 356, Brandon House). | Nieuw book #23405 `shame-salman-rushdie` (1983, en); ban verplaatst. #10643 houdt alleen de MY-ban. |
| 3 | The Fugitive | PEN 2022-23 Frisco-ban (#32235) stond op #10742 van Pablo Neruda — dat is de KDN-1956 rij (gazette bil 459). PEN-CSV (git e8e17dd): "The Fugitive, Grisham, John, Theodore Boone". Serie-broertjes (The Accused, The Activist, …) bestonden al als aparte books. | Nieuw book #23406 `the-fugitive-grisham` (2015, en); ban verplaatst. #10742 houdt alleen de MY-ban. |
| 4 | Lenin | APM Córdoba AR-1976-ban (#27916) stond op #10720, de Chineestalige KDN-rij (Ngai Ming Chi). APM-bron p. 25: "Walter, Gerard — Lenin" (Gérard Walters biografie, 1950). Auteur #9581 bestond al als wees uit de APM-import. | Nieuw book #23407 `lenin-walter` (1950, fr); ban verplaatst. #10720 houdt alleen de MY-ban. |

Rijtelling: 4 bans verplaatst · 3 books + 1 auteursrelatie aangemaakt ·
1 book + 1 auteur verwijderd · 2 slug-aliases (1 nieuw, 1 bestond al).

## Verificatie

- Vóór én na met read-only queries gecontroleerd (ban → book_id, donor-rijen
  houden precies hun eigen KDN/bron-ban, geen wees-auteurs).
- `audit-integrity.ts`: alle invariants groen; slug-drift 852→855 = de drie
  nieuwe bewust-gesuffixte slugs.

## Restpunten (niet gefixt, wel gezien)

- `Hitler` #13676 auteur "Amaler, Jean" en `Karl Marx` #13952 "Korsh, Karl"
  (= Karl Korsch) — gazette-spellingen uit de bronlijsten, geen dupes;
  kandidaten voor een latere auteursnaam-normalisatiepas.
- `Girls Like Us` #1237 (Gail Giles): isbn13 9781558291225 + yr 2024 ogen
  verdacht (Giles' boek is 2014) — apart na te lopen, geen dupe-kwestie.
- Nieuwe books #23405/#23406/#23407 hebben nog geen cover/beschrijving; de
  reguliere enrichment-pijplijn (enrich-all) pakt ze vanzelf op.
