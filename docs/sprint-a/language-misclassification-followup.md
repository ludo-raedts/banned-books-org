# Language misclassification follow-up (Sprint A taak 2 / Migratie B spillover)

Migratie B (`supabase/migrations/<timestamp>_model3_backfill_and_verification_status.sql`)
backfills the Model 3 columns on `books` based on `original_language`. Rows
with `original_language = 'en'` get `title_native = title` and
`title_native_script = 'latin'`. The assumption: an English-tagged title is
also an English-language string in Latin script.

That assumption is wrong for the 21 rows below. Each one is tagged
`original_language = 'en'` but the `title` string is unambiguously Spanish
(or in two cases Japanese/German, recorded with Latin transliterations and
diacritics). Migratie B will write `title_native = title` and
`title_native_script = 'latin'` to all 21, which is technically defensible
(the strings *are* Latin script) but semantically wrong: the *native*
language is not English, so `title_native` should eventually hold the
properly-attributed Spanish/Japanese/German title and `original_language`
should be corrected.

The fix is editorial, not a schema change. It is scheduled as part of
**Sprint A taak 4** (admin tooling), specifically: a filter on the admin
books page surfacing rows where `title` contains non-ASCII Latin diacritics
but `original_language = 'en'`. From there a curator can reclassify
language, set the proper `title_native`, and optionally add an English
translation in `title_english_meaningful`.

## The 21 rows (snapshot, 2026-05-12, local seed of production)

| id   | title                                                          | original_language | slug                                                          |
| ---- | -------------------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| 1579 | Solo quedó nuestra historia                                    | en                | solo-quedo-nuestra-historia                                   |
| 4301 | Paul Cézanne                                                   | en                | paul-cezanne                                                  |
| 4442 | Velázquez                                                      | en                | velazquez                                                     |
| 4965 | Frío cae blanco                                                | en                | frio-cae-blanco                                               |
| 4997 | La luna dentro de mí                                           | en                | la-luna-dentro-de-mi                                          |
| 4998 | La teoría de lo perfecto                                       | en                | la-teoria-de-lo-perfecto                                      |
| 5310 | Téo's Tutu                                                     | en                | teos-tutu                                                     |
| 5338 | ¿Quién es Carmen Sandiego?                                     | en                | quien-es-carmen-sandiego                                      |
| 5441 | Arte para niños con 6 grandes artistas                         | en                | arte-para-ninos-con-6-grandes-artistas                        |
| 5487 | Christmas in México                                            | en                | christmas-in-mexico                                           |
| 5498 | Crepúsculo: un amor peligroso                                  | en                | crepusculo-un-amor-peligroso                                  |
| 5529 | El diario completamente verídico de un Indio a tiempo parcial  | en                | el-diario-completamente-veridico-de-un-indio-a-tiempo-parcial |
| 5531 | El épico fracaso de Arturo Zamora                              | en                | el-epico-fracaso-de-arturo-zamora                             |
| 5539 | El último héroe del Olimpo                                     | en                | el-ultimo-heroe-del-olimpo                                    |
| 5721 | La maldición del Titán                                         | en                | la-maldicion-del-titan                                        |
| 5727 | La travesía de Santiago                                        | en                | la-travesia-de-santiago                                       |
| 5741 | Lotería                                                        | en                | loteria                                                       |
| 5757 | Mär: Märchen Awakens Romance (Series, Title Not Specified)     | en                | mar-marchen-awakens-romance-series-title-not-specified        |
| 5771 | MeruPuri: Märchen Prince (Series, Title Not Specified)         | en                | merupuri-marchen-prince-series-title-not-specified            |
| 5845 | Pokémon: Sun & Moon (Series, Title Not Specified)              | en                | pokemon-sun-moon-series-title-not-specified                   |
| 5930 | Te daría el sol                                                | en                | te-daria-el-sol                                               |

## Likely correct classifications

- Rows 1579, 4965, 4997, 4998, 5338, 5441, 5487, 5498, 5529, 5531, 5539,
  5721, 5727, 5741, 5930 — Spanish (`es`).
- Row 4301 (`Paul Cézanne`), 4442 (`Velázquez`) — proper nouns; the book
  itself may well be English about Spanish/French painters. Confirm with
  the underlying source before reclassifying.
- Row 5310 (`Téo's Tutu`) — English title with French diacritic on a proper
  noun. Probably correct as `en`.
- Rows 5757, 5771 (`Mär…`, `MeruPuri: Märchen Prince`) — Japanese manga
  romanised; the German "Märchen" is part of the romanisation. Likely
  `ja`.
- Row 5845 (`Pokémon: Sun & Moon`) — English title with French diacritic
  on a proper noun. Probably correct as `en`.

The detailed editorial decisions belong with whoever runs Sprint A taak 4
admin tooling; this list is the input.

## Why we are not blocking Migratie B on this

Migratie B writes `title_native_script = 'latin'` for all `en` rows. For
the rows above the value is **technically correct** (the strings are Latin
script). The wrong piece is `original_language`, not the script. Once
`original_language` is corrected to `es`/`ja`/etc. for a row, Migratie B's
backfill no longer applies (the WHERE clauses target `'en'` and `'fr'`).
The curator can then set `title_native` to the proper native-language
string at editorial time.

In short: this backfill does not make the data *worse* than it already is.
The editorial fix happens later, in Sprint A taak 4.

## French books: the same problem in reverse (46 rows beyond the Sprint 0.5 trio)

Migratie B touches **49** rows with `original_language = 'fr'`, not just
the 3 books that were originally hand-classified during the Sprint 0.5
extraction validation. Somewhere along the way a curator (or earlier
import pass) set `original_language = 'fr'` on 46 additional books. A
quick sample (from the seeded local DB):

| id  | title                  |
| --- | ---------------------- |
|  59 | Madame Bovary          |
|  68 | Candide                |
|  73 | Les Fleurs du Mal      |
|  89 | Nana                   |
|  90 | The Second Sex         |
|  91 | Being and Nothingness  |
|  92 | The Stranger           |
| 125 | Persepolis             |
| 169 | Capital and Ideology   |
| 179 | Droll Stories          |

Half of these (`Madame Bovary`, `Candide`, `Les Fleurs du Mal`, `Nana`)
have French-language `title` strings and are correctly classified — for
those, Migratie B's `title_native = title` is right.

The other half (`The Second Sex`, `Being and Nothingness`, `The Stranger`,
`Persepolis`, `Capital and Ideology`, `Droll Stories`) have the
**English-edition title** in `title`. Migratie B will write the English
title into `title_native` for a French-classified book. That is the same
mismatch as the 21 Spanish books above, just in the opposite direction:
language tag is correct, title string is in the wrong language.

The right editorial state for these is: keep `original_language = 'fr'`,
but replace `title_native` with the French original (`Le Deuxième Sexe`,
`L'Étranger`, `Persépolis`, `Capital et Idéologie`, `Les Contes
drolatiques`) and move the English edition title into
`title_english_meaningful`. Again — Sprint A taak 4 admin tooling, not a
Migratie B blocker.

## Other languages already in production (38 langs, all unaffected by Migratie B)

Survey 3 (seeded local DB, 2026-05-12) shows the full distribution of
`original_language` on `books`. Migratie B only touches `en` (4099 rows)
and `fr` (49 rows). The remaining 334 rows across 38 other languages —
plus 2 rows with `original_language IS NULL` — will keep `title_native`
and `title_native_script` at `NULL` until they are processed through the
extraction pipeline (or fixed by the Taak 4 admin filter).

| lang   | books | lang | books | lang | books | lang | books |
| ------ | ----- | ---- | ----- | ---- | ----- | ---- | ----- |
| zh     | 43    | ms   | 7     | hu   | 5     | af   | 2     |
| es     | 43    | pl   | 7     | he   | 4     | bg   | 2     |
| de     | 35    | el   | 7     | ro   | 3     | nl   | 2     |
| ru     | 28    | id   | 7     | sh   | 3     | sq   | 2     |
| ar     | 24    | la   | 7     | sr   | 1     | sw   | 2     |
| pt     | 17    | ja   | 5     | bn   | 1     | ur   | 2     |
| it     | 14    |      |       | ta   | 1     |      |       |
| fa     | 12    |      |       | da   | 1     |      |       |
| tr     | 11    |      |       | uk   | 1     |      |       |
| vi     | 11    |      |       | ml   | 1     |      |       |
| cs     | 10    |      |       | hi   | 1     |      |       |
| ko     | 8     |      |       | gu   | 1     |      |       |
|        |       |      |       | am   | 1     |      |       |
|        |       |      |       | (null) | 2   |      |       |

This is more scope than the original Taak 4 plan accounted for — the admin
filter needs to surface not just the 21 Spanish NFD rows, but every row
where `title_native IS NULL` AND `original_language` is set. That is **336
rows** today (334 + 2 NULL-language). Not a blocker for Migratie B; flagged
so the Taak 4 estimate can absorb it.

