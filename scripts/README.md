# Scripts — catalogus & gids

> Doel: **"ik wil X (importeren, verrijken, opschonen, controleren) → welk script?"**
> beantwoorden zonder door alle ~100 scripts te zoeken.
>
> - Alle data-schrijvende scripts draaien standaard **dry-run**; schrijven gebeurt
>   met `--apply` (canoniek; helper: `scripts/lib/cli.ts` — `--write` werkt in de
>   gemigreerde oudere scripts nog als alias).
> - Aanroep: `pnpm tsx --env-file=.env.local scripts/<naam>.ts [...]`
>   (Python: `_parse_apm_pdf.py`; `.tsx`: zie het script zelf).
> - Lees altijd de header-comment van een script vóór je het draait.

## Naamgevingsconventies (snel herkennen wat een script doet)
- `_audit_*` / `audit-*` — **read-only**: detecteert/meet, schrijft niets naar de DB,
  produceert vaak een worklist (JSON/markdown/CSV).
- `_apply_*` / `apply-*` — past het verdict/worklist van de bijbehorende audit toe (**schrijft**).
- `_detect_*` / `_scope_*` / `_measure_*` / `_peek_*` / `_sample_*` — verkennend/meten, read-only.
- `_fix_*` / `_improve_*` / `cleanup-*` / `clean-*` — gerichte data-correctie.
- `import-*` / `add-*` — nieuwe data binnenhalen.
- `merge-*` — duplicaten samenvoegen.
- `enrich-*` — bestaande records met extra velden vullen.
- Leidende `_` = doorgaans **one-off / wegwerp** (specifieke batch of meting), niet herbruikbaar.
- `_tmp_*` = scratch/prototype — wordt **niet** in deze catalogus opgenomen (genegeerd door de freshness-check).

## Uitstroom: `scripts/archive/`
Afgeronde one-offs blijven niet in `scripts/` liggen: zodra het werk gedaan én
geverifieerd is, verhuist het script naar `scripts/archive/` (git bewaart de
historie; gearchiveerde `_`-scripts worden bij archivering alsnog gecommit als
audit-trail). De archiefmap valt buiten de freshness-check en buiten deze
catalogus — wat daar staat is referentiemateriaal, geen gereedschap. Kopieer
gerust een gearchiveerd script als sjabloon voor een nieuwe one-off, maar draai
ze niet opnieuw zonder de header te lezen (sommige waren destructief en
eenmalig, bv. `_apply_csam_block.ts`).

> **Catalogus actueel houden:** `scripts/audit-scripts-catalog.ts` flag't elk script dat
> hier niet genoemd wordt. Het draait automatisch als slotboodschap van `enrich-all.ts`, of los:
> `npx tsx scripts/audit-scripts-catalog.ts`. Voeg een nieuw script toe aan de juiste sectie hieronder.

## Families (sprong naar sectie)
1. [Import](#1-import) · 2. [Dedup-detectie](#2-dedup-detectie-vinden) · 3. [Merge](#3-merge-samenvoegen)
4. [Enrichment](#4-enrichment) · 5. [Audit & detectie](#5-audit--detectie-read-only)
6. [Cleanup & fixes](#6-cleanup--fixes) · 7. [Descriptions kwaliteit](#7-descriptions-kwaliteit-pijplijn)
8. [Review-queue](#8-review-queue) · 9. [Datasets & build](#9-datasets--build)
10. [SEO / GSC](#10-seo--gsc) · 11. [Overig / infra](#11-overig--infra)

---

## 1. Import

### Standaard werkwijze voor een nieuwe bron — LEES DIT EERST
Eén vaste route, zodat niet elke bron zijn eigen script + werkwijze krijgt.

**Stap 0 — Breng de bron naar een gestructureerd databestand.** Zet 'm om naar
`data/<bron>-<datum>.json` (of CSV). Eén rij per **boek × jurisdictie × ban-event**.
Normaliseer naar: `title`, `authors`, `country_code`, `year` (= **ban**-jaar, niet
pub-jaar), `scope_slug`, `action_type` (`banned`/`restricted`/`challenged`),
`reason_slug`, `source_url`, `source_name`. Heb je voor een **anderstalige editie**
de Engelse werktitel? Zet die in `title_english_meaningful` — dát is het
cross-language match-signaal (zie stap 2).

**Stap 1 — Kies de route (géén nieuw script tenzij nodig).**

| Je bron is… | Template |
|---|---|
| bans op boeken die **al** in de DB staan, geen nieuwe boeken | `add-ala-2025.ts` |
| government/national bans (JSON, batch-brede bron) | `import-africa-criminalization-bans.ts` |
| school/library **challenges** (per-entry scope/action/reasons/regio/instituut) | `import-nipissing-challenges.ts` |
| groot, consistent CSV-catalogus (per-district) | `import-pen.ts` |

De LLM-queue (`run-import-job.ts` / `import_jobs`) is **legacy/idle** — route nieuw
werk daar NIET doorheen ([[project_import_queue_decommission]]). De herbruikbare kern
is de gedeelde commit-lib **`commitParsedRow` / `commitNewBanForBook`**
(`src/lib/imports/review-commit.ts`); een nieuw script is een dunne lezer die je
databestand naar die functies voert — niet een eigen INSERT-implementatie.

**Stap 2 — Match-before-create (VERPLICHT, dedup-veiligheid).** `commitParsedRow`
INSERT *blind* een nieuw boek; de dedup is de verantwoordelijkheid van het
aanroepende script. Vóór elke create: zoek een bestaand boek (exacte slug →
pg_trgm-fuzzy → **Engelse-titel-slug** voor anderstalige edities — exact de tiers in
`verifier.ts` `matchBook`). Match → voeg de ban toe aan het bestaande boek
(`commitNewBanForBook`); geen match → create. Dit stopt de cross-language dupe-klasse
aan de bron.

**Stap 3 — Dry-run → tel → apply → tel.** Read-only telling vóór; dry-run; dan
`--apply` (via `isApply()` uit `scripts/lib/cli.ts`); dan read-only telling erna.
Rapporteer exacte rij-aantallen (CLAUDE.md-regel).

**Stap 4 — Verplichte dubbelen-sweep ná de import.** Draai
`_audit_cross_script_dupes.ts` (auteurs) + `_audit_spanish_edition_dupes.ts` (boeken)
en fold bevestigde hits via de merge-scripts (§2/§3). Staand vangnet voor wat door
stap 2 glipt — m.n. CSV-bronnen die geen Engelse titel meeleveren.

**Stap 5 — Commit + push** met de exacte counts in de message.

### Gedeelde commit-lib & LLM-queue — `src/lib/imports/`
- **`commitParsedRow` / `commitNewBanForBook`** (`review-commit.ts`) — de herbruikbare,
  transactionele INSERT-plek die directe scripts horen aan te roepen (stap 1). Auto-approve
  én handmatige review leveren dezelfde DB-vorm. **Doet zelf GEEN match-before-create** —
  dat hoort in de caller (stap 2).
- **LLM-queue** (`run-import-job.ts`): `pending → fetched → archived → extracted → verified
  → gated → committed`, met `gate.ts` (auto-approve-beslissing) en `verifier.ts` (match-stap,
  incl. de cross-language tier). **Idle/legacy** — alleen relevant als de queue ooit heropent.

### One-off import-scripts
Elk bestaat omdat de generieke importer iets níet kan (hardcoded `scope='government'`
+ `action_type='banned'` + één reason + één batch-brede bron).

| Script | Bron | Wanneer / waarom | Flag |
|---|---|---|---|
| `import-africa-criminalization-bans.ts` | `data/africa-criminalization-bans.json` | "Brave" variant: gebruikt gedeelde commit-lib, idempotent op (book_id, country, year, scope). **Template voor JSON-imports.** | `--apply` |
| `import-pen.ts` | `data/pen-2024-25.csv` | Per-district granulariteit; exact-slug + pg_trgm fuzzy match; OpenLibrary lookup voor nieuwe boeken. Sleutel = boek × staat × district × jaar | `--apply` (`--limit=N`) |
| `import-singapore-wiki.ts` | EN Wikipedia (JSON) | Eenvoudige government-bans met per-entry status/jaar/reason; één batch-brede Wikipedia-bron | `--apply` |
| `import-nipissing-challenges.ts` | Freedom to Read CA (JSON) | **Template voor school/library challenges:** per-entry scope, action_type, meerdere reasons, regio, instituut + per-entry bron | `--apply` (`--input=`) |
| `add-ala-2025.ts` | ALA-lijst (hardcoded slugs) | Voegt **alleen bans** toe aan bestaande boeken — geen boek-creatie. Template voor "bestaande boeken aanvullen" | `--apply` |
| `add-bulk-books.ts` | inline lijst | Bulk nieuwe boeken + OpenLibrary cover-fetch, direct via `adminClient()` | n.v.t. |
| `import-russia-bans.ts` | `data/russia-articles-batch1.json` + `data/russia-minjust-batch1.json` | RU: hand-curated onafhankelijke-pers cases + Минюст Federal List of Extremist Materials; alles `country='RU'`/`scope='government'`; dedup op (book_slug, year_started); minjust-rijen auto-`needs_review` | `--apply` (`--only=articles\|minjust`) |
| `import-berlin-verbannte.ts` | `data/berlin-verbannte-1938-*.json` (Berlin.de CC-BY, Nazi 1938-lijst) | DE `government`/`banned`/`historical`-bans, `warning_level=none` (censuur-slachtoffers, als Liste Otto). **Match-before-create via `matchExistingBook` (cross-language tier), niet de queue.** Houdt intra-batch slug-collisies (zelfde titel, andere auteur) + ambigue generieke bestaande-matches vast als needs_review. Idempotent/resumebaar | `--apply` (`--limit=N`) |

**Vuistregel:** JSON met standaard government-bans → `import-africa` als template ·
school/library challenges → `import-nipissing` · bans bij bestaande boeken → `add-ala-2025`.

---

## 2. Dedup-detectie (vinden)
Detectie en wijziging zijn gescheiden: `_audit_*` is read-only en levert een worklist
die een merge-script daarna inleest.

| Script | Doet |
|---|---|
| `_audit_paren_suffix_dupes.ts` | "Titel (suffix)"-dubbele boeken → `data/paren-suffix-dupes.json` (input voor `merge-paren-suffix-dupes.ts`) |
| `_audit_same_author_title_dupes.ts` | Same-author boek-dupes met genormaliseerd-identieke titel (`&`↔`and`, interpunctie, hoofdletters, diacritics, unicode-bewust) → `data/same-author-title-dupes.json` (exact, merge-ready voor `merge-paren-suffix-dupes.ts`) + `.md` met een NEAR-tier (subtitle/serie, review-only). Sluit placeholder-auteurs (Anonymous/Various/…) uit. Ving de "Pride: …& Community" vs "…and Community"-klasse die paren-suffix miste |
| `_audit_split_authors.ts` | Canonieke detector voor gesplitste auteurs → `data/hk-split-authors-review.md` |
| `_audit_honorific_author_dupes.ts` | Honorific-twin auteurs (Ustaz/Haji-prefix) → input voor `merge-honorific-author-dupes.ts` |
| `_audit_mojibake_authors.ts` | U+FFFD-corrupte auteursnamen (draai vóór nieuwe KDN-batch) |
| `_audit_cross_script_dupes.ts` | Cross-script auteur-twins: niet-Latijnse auteur die een bestaande Latijnse auteur dubbelt (name_english-match of identieke bio) → fold via `merge-cross-language-dupes.ts`. Draai ná elke vreemdtalige ban-import (FSEM/KDN/Iran). Under-count: name_english is schaars |
| `_audit_spanish_edition_dupes.ts` | **Latin-script** cross-language boek-dupes die `_audit_cross_script_dupes` mist: een vertaalde editie (Spaans/Frans-getiteld) van een werk dat al onder de Engelse titel staat. Gate = Spaanse titel + `original_language='en'` (de importer stempelt de taal van het Engelse *werk*) + zelfde-auteur Engelse rij → input voor de curated lijst in `merge-spanish-edition-dupes.ts`. Heuristiek over-telt (genuine `es/fr/it`-werken); handmatig filteren |
| `check-dupes.ts` | Ad-hoc: print info voor een **hardcoded** sluglijst om te beoordelen óf het dupes zijn. Schrijft niets |

> Detectoren **vinden**, merge-scripts **voeren uit**. Draai altijd eerst de audit.

> **Ingest-doctrine — vreemdtalige imports.** Een one-off importer matcht op
> titel-slug + pg_trgm en mint daardoor een **nieuwe** boekrij voor een vertaalde
> editie (de Spaanse titel matcht de Engelse canonical niet) — de bron van de
> cross-language dupe-klasse. De gedeelde LLM-pipeline (`src/lib/imports/verifier.ts`)
> vangt dit nu af via een cross-language tier op `title_english_meaningful`, maar
> CSV-one-offs (`import-pen.ts`) hebben dat signaal niet. **Verplicht na élke
> import met mogelijk vreemdtalige titels:** draai `_audit_cross_script_dupes.ts`
> (auteurs) én `_audit_spanish_edition_dupes.ts` (boeken), en fold de bevestigde
> hits via de bijbehorende merge-scripts. Dit is het staande vangnet, niet optioneel.

---

## 3. Merge (samenvoegen)
**Doctrine** (referentie: `merge-paren-suffix-dupes.ts`; zie memory "Merge order: DELETE
dupe before enrich on unique fields"): KEEP = canoniek, DROP = duplicaat. Per paar:
1. Verrijk KEEP's NULL-velden uit DROP (KEEP-set wint).
2. Migreer bans + reason/source-links (of `book_authors` + author-FK's bij auteur-merge).
3. DELETE DROP — CASCADE ruimt de rest op. Idempotent: DROP al weg = no-op.

### Boek-merges
| Script | Scope | Bijzonder | Flag |
|---|---|---|---|
| `merge-paren-suffix-dupes.ts` | **Generiek, data-gedreven** | Leest paren uit `data/paren-suffix-dupes.json` (`--file=` override). **Referentie-implementatie — start hier.** | `--apply` |

Afgeronde hardcoded boek-merges (orwell-1984, iran-duplicates) staan in `scripts/archive/` als sjabloon.

### Ban-merges (dezelfde boek, dubbele ban-rij)
Twee `bans`-rijen op één boek die hetzelfde event zijn, niet twee boeken. Doctrine: KEEP behoudt de canonieke institution-string; union van `ban_source_links` + `ban_reason_links` (on conflict do nothing), enrich KEEP's NULL-velden, DELETE DROP. KEEP's UNIQUE-key (`bans_unique_per_scope`) wordt nooit gemuteerd → geen conflict.
| Script | Scope | Bijzonder | Flag |
|---|---|---|---|
| `merge-institution-variant-dupes.ts` | **Generiek, data-gedreven** | Dedupt op genormaliseerde institution-**core** (`normalizeInstitution`: strip filler public/school(s)/district/isd) binnen jaar±1. KEEP = langste institution-string. Veiligheidsrail: clusters met jaar-spanning >1 worden **geflagd, niet gemerged**. **Start hier voor institution-spellingsvarianten.** | `--apply` |

Afgeronde hardcoded ban-merges (multiyear-pen: doorlopende PEN-ban over meerdere
jaarindexen; marlon-bundo-broward: sjabloon voor één-paar ban-merge) staan in `scripts/archive/`.

### Auteur-merges
| Script | Scope | Bijzonder | Flag |
|---|---|---|---|
| `merge-honorific-author-dupes.ts` | Hardcoded paren | Maleisisch import-artefact. Migreert `book_authors` + author-FK-tabellen | `--write` |
| `merge-cross-language-dupes.ts` | Hardcoded paren (auteur + evt. boek) | **Cross-script dupes** uit vreemdtalige ban-imports. Foreign DROP levert ALLEEN ban + URL-alias + taal-neutrale velden (datums/land/IDs); nooit name/title/`original_language`/description (= vertaling, niet het origineel). Boek mee-mergen alléén als het dezelfde *work* is. Input: `_audit_cross_script_dupes.ts` | `--apply` |

Afgeronde één-paar auteur-merge (`merge-vs-naipaul-authors.ts`: V. S. Naipaul-dubbel,
introduceerde óók `author_slug_aliases` + de alias-fallback op de author-pagina, sjabloon
voor "merge + dropped-slug-redirect") staat in `scripts/archive/`.

**Vuistregel:** generieke boek-dupes → vul `data/paren-suffix-dupes.json` + draai
`merge-paren-suffix-dupes.ts` · eenmalig bijzonder geval → kopieer het dichtstbijzijnde
hardcoded sjabloon uit `scripts/archive/` · auteur-dupes → `merge-honorific-author-dupes.ts`.

> ⚠️ `books.isbn13 UNIQUE` (e.a.): verwijder DROP vóór KEEP enrich't op een uniek veld.

---

## 4. Enrichment
Vullen van ontbrekende velden op bestaande records. **Veel `-gpt`/`-v2`-varianten — let op deprecaties.**

### Parallelle verrijking (zit in `enrich-all.ts`)
De orkestratie is **niet** een los script maar **Fase 1 van `enrich-all.ts`**:
het draait de drie disjuncte gratis-harvesters (`enrich-ol-harvest`,
`enrich-gb-harvest`, `enrich-native-titles`) **gelijktijdig** als losse
processen, daarna sequentieel de rest (covers-v2, gutenberg, archive,
descriptions, GPT), en sluit af met de confidence-auditor + before/after-rapport.
Procesisolatie = gratis graceful per-bron-skip: een quota-stop (gb 429 →
`GbQuotaError`) of crash in één bron breekt de andere twee niet af. Elke bron is
al skip-cached (only-when-NULL + `*_checked_at`) en checkpoint-baar (cursor) →
een onderbreking herverwerkt nooit een afgeronde rij. nohup-veilig:
`nohup npx tsx --env-file=.env.local scripts/enrich-all.ts --apply &`.
CourtListener doet **niet** mee: dat is een render-time live feed
(`src/lib/courtlistener.ts`), geen per-boek-kolom.

| Script | Doet |
|---|---|
| `enrich-all.ts` | **Master-pipeline.** Fase 1 = parallelle gratis-harvest (ol/gb/native-titles concurrent — verving de oude sequentiële `enrich-isbn` + covers-continuous first-pass), Fase 2 = sequentieel covers-v2 + gutenberg + archive + descriptions-v2 + GPT. Wrapt alles in een before/after coverage-snapshot + confidence-rollback. Flags: `--apply`, `--free-only`, `--no-gutenberg`, `--no-archive`, `--gpt-limit=N`, `--native-limit=N`, `--threshold=` |
| `enrich-coverage-snapshot.ts` | Read-only coverage-meting (isbn13 / cover / description / native-title-non-EN) via `count(head:true)` (1000-row-cap-veilig). `--snapshot=<path>` schrijft JSON. Exporteert `captureCoverage()` (gebruikt door enrich-all) |
| `enrich-coverage-report.ts` | Rendert het before/after-rapport (`data/enrichment-coverage-report-<date>.md`) uit twee snapshots + de run-manifest + `confidence.json` |
| `enrich.ts` | Oudere/seed-achtige enrichment (referentiedata + bestaande data); het `enrich.js`-compilaat is verwijderd |
| **Descriptions** | |
| `enrich-descriptions-v2.ts` | 2e-generatie CLI — **voorkeur voor nieuwe runs**. v1 (`enrich-descriptions.ts`) is verwijderd 2026-06-11; `/api/admin/enrich/run` draait in-process op v2 |
| `enrich-descriptions-continuous.ts` | Continu missende `description_book` vullen; tracking in `description_search_attempts` |
| `enrich-descriptions-gpt.ts` | GPT-fallback voor wat OL/Google Books niet vond |
| `enrich-ban-descriptions-gpt.ts` | GPT: concrete `description_ban` per boek |
| `enrich-censorship-context-gpt.ts` | GPT: `censorship_context` waar die ontbreekt |
| `enrich-descriptions-consensus.ts` | Recovery via **cross-model consensus** (GPT-4o-mini + Gemini-2.5-flash + judge) voor boeken die de v2-ladder niet kon gronden maar de modellen wél kennen; schrijft `description_source_type='ai_consensus'` (eigen tier, geen geciteerde bron). UNKNOWN/onenigheid → rij blijft onaangeroerd. Valideer eerst met `validate-consensus-descriptions.ts` |
| **Covers** | |
| `enrich-covers-continuous.ts` | Continu missende covers; tracking in `cover_search_attempts` |
| `enrich-covers-v2.ts` | Re-try van eerder gefaalde cover-searches |
| `enrich-russia-recognizable.ts` | → `scripts/archive/` (afgeronde FSEM-subset pass) |
| **Auteurs** | |
| `enrich-author-bios.ts` | Bios via Wikipedia (incl. `--photos-only`) |
| `enrich-author-ol.ts` | **Long-tail bio/birth-year/death-year via OpenLibrary Authors API** voor auteurs die Wikipedia miste. Exact-key: leidt de OL-author-id af uit de work-records van de eigen boeken (naam-search + gedeelde-titel-fallback). Vult ook `name_native` uit een niet-Latijns `alternate_name`. Foto's blijven bij v2; sticky via `ol_checked_at`. Draai ná enrich-author-bios.ts |
| `enrich-author-photos-v2.ts` | 2e-pass foto's voor auteurs zonder Wikipedia-hit |
| **Titels (meertalig)** | |
| `enrich-native-titles.ts` | **`title_native` + `title_native_script` voor anderstalige boeken die onder hun Engelse/vertaalde titel staan** (bv. "Doctor Zhivago" → "Доктор Живаго"). Bron Wikidata (CC-0): `wbsearchentities` (titel + zonder leidend lidwoord) → hard-gate op P31=written-work **én** P50-auteur-match (incl. aliassen/pseudoniemen); P364 wordt NIET als gate gebruikt (vaak leeg). Native titel uit `P1476@origlang` of label. Raakt `title`/`slug` nooit; niet-Latijnse transliteratie blijft NULL (review-gated, vlag in reviewbestand). Idempotent (`.is title_native null`-guard). Ranking op `distinct_countries`. Schrijft `data/native-title-enrichment-<date>.{json,md}`. `--limit` / `--offset` / `--lang=xx` / `--book-ids=` / `--apply` | apply |
| **Identifiers / overig** | |
| `enrich-isbn.ts` | Missende `isbn13` via OpenLibrary + Google Books |
| `enrich-gb-harvest.ts` | **Gebundelde Google-Books harvester**, **wezen-only** (geen isbn13 én geen work_id): één GB-call per boek vult isbn13 + cover_url + original_language via title-search (de enige route voor sleutelloze boeken). GB is ~1.000 queries/dag. Logt year/categories/pages/publisher naar `data/gb-harvest-proposals.jsonl` (niet geschreven). Resumebaar; draait via launchd |
| `enrich-ol-harvest.ts` | **Exact-key OL harvester** (gratis tegenhanger van gb-harvest, géén dagcap): voor *keybare* boeken (work_id óf isbn13) haalt het cover, `first_published_year` (uit work `first_publish_date` — de enige bron hiervoor) en sibling-ISBN direct uit het OL-record, zónder fuzzy title-search. Title-agreement guard weert vervuilde keys. Disjunct van gb-harvest → mag gelijktijdig draaien. Resumebaar via `data/ol-harvest-cursor.json` |
| `enrich-archive-org.ts` | archive.org identifiers via Advanced Search API |
| `enrich-gutenberg.ts` | Project Gutenberg IDs via Gutendex |
| `enrich-genres-gpt.ts` | GPT genre-enrichment (lege `genres`) |
| `enrich-genres-retry-gpt.ts` | Retry-pass voor wat gpt-4o-mini niet plaatste |
| `enrich-reasons.ts` | Classificeert ban-reasons die nu alleen 'other' zijn (GPT-4o-mini) |
| `enrich-pending-non-latin.ts` | Backfill non-Latin review-queue items (Model 3 title-velden) |
| `generate-discussion-questions.ts` | Reading-Club discussievragen, **alleen-lege-rijen** vulling (Claude Opus/gpt-4o). ⚠ Voedt de LLM enkel `{title, author}` → geen grounding, hallucinatie-risico (thema's/personen/gebeurtenissen). Gebruik voor *nieuwe* boeken liever `regenerate-discussion-questions-grounded.ts` |
| `regenerate-discussion-questions-grounded.ts` | **Voorkeur** voor reading-club-vragen. Twee modi: `--export` dumpt een gronding-worklist (description_book + auteur-bio + echte ban-records) naar `data/_rc_questions_grounding.json`; `--apply` schrijft hand-geauthorde Engelse vragen uit `data/rc-questions-authored.json` weg mét validatie (telcheck 5–15, Engels-heuristiek, dubbele-vraag-guard) en emit een before/after review (`data/rc-questions-review.md`). Vragen worden gegrond in eigen content geschreven, nooit door een onbewaakt zwakker model. Alle 110 bestaande sets hier 2026-06-15 mee herschreven. `--only=<source>` beperkt tot één track |
| `update-ban-descriptions.ts` | Voegt/updates ban-descriptions voor goed-gedocumenteerde bans |

> Voorkeur descriptions = `-v2` / `-continuous`. `-gpt` zijn fallbacks. Let op de DEPRECATED-marker.

---

## 5. Audit & detectie (read-only)
Schrijven **niets** naar de DB; produceren een rapport/worklist. (Dedup-audits staan in §2.)

| Script | Controleert |
|---|---|
| `audit-integrity.ts` | **Staande integriteits-toets** — consolideert de goedkope SQL/regex-detectoren tot één herhaalbare check. Invarianten (image-host, mojibake, boek-zonder-auteur, onmogelijke jaren) → drempel 0, **exit 1** bij overtreding (cron/CI-gate). Drift-metrics (non-person, gedeelde-cover/desc-contaminatie, slug-drift, wezen, cover/description-coverage, landendekking) → vergeleken met `data/integrity-baseline.json`. Vervangt `audit-db.ts` en `check-coverage.ts` (verwijderd 2026-06-11: beide braken op de Supabase 1000-row cap) en `_audit_site_health.ts`. Flags: `--json`, `--verbose`, `--update-baseline`. Dure audits (perceptual-hash, LLM) blijven los — zie footer van het script. |
| `score-data-quality.ts` | Data-quality classifier over de catalogus |
| `audit-enrichment-confidence.ts` | **Post-batch confidence + auto-rollback** voor een `enrich-all.ts`-run (laatste fase) (read-only; `--apply` reverteert, CSV-backup vooraf). Native-titels: scoort elke geschreven proposal uit de review-JSON op namesake/leidend-lidwoord-risico (−0.5 geen auteur-gate, −0.2 leidend lidwoord) en reverteert <`--threshold` (default 0.5) — reverteert alléén rijen waarvan `title_native` nog gelijk is aan de proposal (nooit een latere handmatige edit). ISBN/cover: structurele her-verificatie van de this-run writes (`--since=<ISO>`) op host-allowlist + dup-collision. ISBN/cover-semantiek zit al hard-gated vóór de write, dus de echte rollback-waarde zit bij native-titels |
| `audit-scripts-catalog.ts` | Freshness-check van déze catalogus: flag't scripts die niet in `README.md` staan (draait ook als slot van `enrich-all.ts`) |
| `check-no-desc.ts` | Snelle description-coverage check |
| **Jaren** | |
| `audit-publication-years.ts` | `first_published_year` vs OpenLibrary → review-artifact |
| `audit-impossible-years.ts` | Onmogelijke/verdachte publicatiejaren |
| `audit-author-years.ts` | Onmogelijke birth/death years |
| `verify-years-llm.ts` | LLM-cascade die `first_published_year` verifieert/backfillt voor rijen die OpenLibrary niet kon bevestigen (vervolg op `audit-publication-years.ts`); cache in `data/year-llm-verification.json(l)` (lokaal, niet gecommit) |
| `resolve-proposed-years.ts` | Vervolg op `verify-years-llm.ts`: lost de "unsure"-rijen (zonder OL work-id) op met de OpenLibrary API als derde signaal → `data/resolve-proposed-years.*` |
| **Auteurs** | |
| `audit-non-person-authors.ts` | Author-rijen die geen persoon zijn (uitgevers/comités/…) |
| `_audit_author_bio_contamination.ts` | Classificeert author-bios op contaminatie door `enrich-author-bios.ts` (verkeerd Wikipedia-artikel geaccepteerd: boek/film/band/andere persoon) → `data/author-bio-contamination-audit.md`; apply-zijde: `remediate-author-bios.ts` |
| **Covers** | |
| `audit-covers-for-placeholders.ts` | Google Books "image not available" placeholders |
| `_audit_google_covers.ts` | Degenererende horizontale Google-cover-strips |
| `audit-study-guide-covers.ts` | SparkNotes/CliffsNotes-covers (zie memory study-guide audit) |
| `audit-covers-vision.ts` | Vision-audit + auto-remediatie van title-search-gecontamineerde Google-covers (verkeerd boek / interieurpagina) → `data/cover-vision-audit.*`; recovery-zijde: `recover-nulled-covers.ts` |
| `_montage_google_covers.ts` | Visuele preview-montage van Google-covers → `public/cover-montage.html` (altijd checken vóór cover-fixes appliën) |
| `_audit_shared_enrichment.ts` | "Most-popular hit"-contaminatie: covers én descriptions die een titel-search op het verkeerde boek plakte → `data/shared-cover-audit.md`, `data/shared-description-audit.md`, `public/shared-cover-suspects.html` (bron-guard zit in `src/lib/enrich/title-match.ts`) |
| `_audit_ol_title_mismatch.ts` | Sibling van `_audit_shared_enrichment`: vangt het geval waar één boek's `openlibrary_work_id` naar een ánder werk wijst zónder dat een sibling de asset deelt (groepering mist het). Twee-tier (token-overlap + OL-auteur) onderscheidt CONFIRMED van LIKELY_TRANSLATION → `data/ol-title-mismatch-audit.md`. Lokaal-only |
| `_audit_ol_contamination.ts` | "Poisoned guard"-incident (2026-06-04): herpast de gecorrigeerde OL-guard op elke opgeslagen `openlibrary`-description en bucketet afwijzingen per binding (isbn / work_id / search) → `data/ol-contamination-audit.md`. Read-only. |
| `remediate-ol-contamination.ts` | Schoont de bevestigde "poisoned guard"-contaminatie op: nullt+flagt OL-descriptions die de gecorrigeerde guard afwijst **én** search-bound zijn of een blurb delen over inconsistente titels. Back-upt origineel naar CSV; `--apply` schrijft. (LLM-follow-up `_audit_llm_ol_contamination.ts` → archief: 0 besmet.) |
| **Slugs** | |
| `audit-slugs.ts` | Bestaande slugs vs huidige `slugify()` |
| `filter-nfd-subset.ts` | Filtert slug-audit naar de NFD-bug subset |
| **Descriptions / context** | |
| `_audit_ungrounded_descriptions.ts` | Ongegronde ai-drafted descriptions (read-only sizing) |
| `validate-consensus-descriptions.ts` | Read-only recall/false-positive-meting van de cross-model consensus-pijplijn (3 buckets: known/anonymous/target) — draai dit om een scope te vetten vóór `enrich-descriptions-consensus.ts --apply` |

Afgeronde audits/metingen (ban-vs-context-overlap + keep-narrative 2e-pass + steekproef-helpers,
ISBN-winrate-meting, CSAM-red-flags-telling, Nazi-warning-kandidaten) → `scripts/archive/`.

---

## 6. Cleanup & fixes
Gerichte data-correcties (**schrijven**). Veel zijn one-off (leidende `_` of `_fix_`).

| Script | Doet | Type |
|---|---|---|
| `cleanup-bans-action-type.ts` | Normaliseert niet-canonieke `bans.action_type` | generiek |
| `cleanup-non-person-authors.ts` | Ruimt non-persoon authors op (uit `audit-non-person-authors.ts`) | gericht |
| `apply-publication-year-fixes.ts` | Past high-conf jaar-correcties toe (uit `audit-publication-years.ts`) | apply |
| `cleanup-other-cotag.ts` | Strip redundante `'other'` ban-reason van bans die óók een specifieke reason dragen (repareert `enrich-reasons.ts`-artefact); bans met enkel `'other'` blijven | generiek |
| `cleanup-vague-pen-rollups.ts` | Verwijdert vage PEN-aggregaat roll-ups (institution+region NULL, enige bron = generieke `pen.org/book-bans/`) die gedekt zijn door concrete districtrijen zelfde boek/land jaar±1; keepers zonder dekking en rijen met extra bronnen blijven (geflagd); JSON-backup per run; idempotent — herdraai na elke aggregaat-achtige PEN-import | generiek |
| `cleanup-shared-enrichment.ts` | Apply-zijde van `_audit_shared_enrichment`: nullt cover/description op alle leden van een SUSPECT shared-group; de geguarde enrichers herstellen daarna de rechtmatige eigenaar | gericht |
| `recover-nulled-covers.ts` | Hervindt covers die `audit-covers-vision.ts` nullde: work-cover → edition-covers → ISBN-cover, met dezelfde safety-gates (nooit contaminatie herintroduceren) | gericht |
| `remediate-author-bios.ts` | Apply-zijde van `_audit_author_bio_contamination`: LLM-classificatie (gpt-4o-mini) nullt wrong_entity/wrong_person-bios; CSV-backup per run; deelt skip-cache met `enrich-author-bios.ts` zodat de enricher gerepareerde rijen niet opnieuw vervuilt | gericht |
| `normalize-russia-titles.ts` | RU FSEM Cyrillic-titels: zet `title_native_script='cyrillic'` + BGN/PCGN-transliteratie + `original_language`; raakt canonieke titel/slug niet aan; idempotent | generiek |
| `verify-pen-school-bans.ts` | Grondt PEN-school-bans tegen de upstream Index-bestanden (src#2131/#2068) en zet `bans.confidence='verified'` bij district-match via `titlesMatch()`; title+state-only matches → review, nooit auto | gericht |
| `_scope_fr_otto_bans.ts` / `_scope_fr_wikipedia_bans.ts` | Scope/verken FR ban-bronnen (read-only; Sprint-A Taak 5 FR is nog open) | scope |
| `mark-cover-override.ts` | Markeert cover als handmatige override (clear cover_url) | tool |

Afgeronde one-off fixes (cleanup-iran-titles, source-orphan-{canonical,cluster}-bans,
`_apply_google_cover_fixes`, `_apply_csam_block` ⚠️ destructief-eenmalig, `_apply_fr_nazi_warning_tiers`,
`_apply_ban_vs_context_cleanup`, `_apply_keep_narrative_groundedness`, `_fix_*`-batchcorrecties,
`_improve_north_korea`, `_update_fr_country_description`, `_strip_dark_mode`) → `scripts/archive/`.

---

## 7. Descriptions-kwaliteit (pijplijn)
Genummerde stages voor het opschonen/hergronden van bestaande descriptions.

| Stage | Script | Doet |
|---|---|---|
| audit | `score-descriptions.ts` | Scoort `description_ban`/`censorship_context` op concreetheid (0–3) → CSV |
| 1 | `wipe-ungrounded-filler-descriptions.ts` | Phase 1 QA: `description_book = NULL` voor `decision='WIPE'`-rijen (ai_drafted, geen ISBN/source, ≥2 filler-tells) uit `_audit_ungrounded_descriptions`; guard `description_source_type IS NULL`; CSV-backup → omkeerbaar. REGROUND-rijen blijven (Phase 2) |
| 2 | `rewrite-descriptions-grounded.ts` | Herschrijft zwakke boeken op basis van de audit-CSV |
| 2.5 | `flag-filler-rewrites.ts` | Flag't filler-phrasing → fake-audit CSV |
| 2.6 | `strip-filler-sentences.ts` | Strip filler-zinnen/clausules (behoudt named cases) |
| wrapper | `clean-descriptions.ts` | Één commando dat de remediation-stappen aaneenrijgt |
| 2 (no-ISBN) | `_reground_noisbn.ts` | Fase-2 reground van de no-ISBN REGROUND-rijen uit de ungrounded-audit die wél via title+author naar een OL/Wikipedia-bron resolven |

> Volgorde: `score-descriptions` → `clean-descriptions` (of los 2 → 2.5 → 2.6).

---

## 8. Review-queue
Verwerking van `import_review_queue` (legacy/idle — zie memory "Import queue is legacy/idle").

| Script | Doet |
|---|---|
| `remap-unmapped-queue.ts` | Re-run reason-mapping over rows met `unmapped_reason` (3 passes) |
| `llm-classify-unmapped-reasons.ts` | LLM 2e-pass voor rows die de regex-mapper niet aankon |

Afgeronde queue-one-offs (salvage-stale-queue-bans 2026-05-14, finish-deferred-review-queue
2026-06-06) → `scripts/archive/`.

---

## 9. Datasets & build

| Script | Produceert |
|---|---|
| `build-dataset.ts` | Betaalde download-dataset ZIP |
| `build-zenodo-dataset.ts` | Open citeerbare dataset voor Zenodo (CC-BY-4.0): 6 slug-keyed CSV's + `schema.json`/README/LICENSE. Dry-run; `--apply` → `private/zenodo/`. Exporteert `buildOpenTables()` (gedeeld met de diff). |
| `zenodo-descriptor-to-pdf.tsx` | `docs/zenodo/data-descriptor.md` → `data-descriptor.pdf` (marked + @react-pdf/renderer; Arial/Andale-Mono embedded) |
| `zenodo-deposit-diff.ts` | Vergelijkt de huidige open export met de laatst-gedeponeerde baseline (`docs/zenodo/deposited-manifest.json`) en adviseert of een nieuwe Zenodo-versie nodig is. Leest alléén de open core (commerciële verrijking telt niet mee). `--mark-deposited` her-ankert de baseline ná een deposit. Re-deposit is bewust, niet automatisch — zie `/admin/zenodo`. |
| `build-film-data.ts` | Events-layer voor de animated-world-map film-PoC |
| `build-berlin-verbannte-stage0.ts` | **Read-only Stap-0 seed-builder** voor `import-berlin-verbannte.ts`: haalt de Berlin.de CC-BY-dataset (4.764 rijen), partitioneert (book/blanket/authorless), normaliseert de boek-rijen → `data/berlin-verbannte-1938-<date>.json`, en (`--enrich-english`) vult `title_english_meaningful` via Wikidata (omgekeerde `enrich-native-titles`) als cross-language match-signaal. Raakt Supabase NOOIT aan |
| `build-wiki-enrichment-worklist.ts` | Worklist boeken voor Wikipedia ban-enrichment (Step A) |
| `stage-wiki-enrichment.ts` | Step B van de Wikipedia-enrichment-pijplijn |
| `apply-wiki-enrichment.ts` | Step C — past de wiki-enrichment toe |
| `seed.ts` | Seedt referentie/data (clear in reverse dependency order) |
| `seed-local-from-prod.ts` | Vult lokale Supabase met productiedata |
| `refresh-mv.ts` / `refresh-mv2.ts` | Refresht materialized views (o.a. `mv_ban_counts`) |

> Wikipedia-enrichment is een 3-stappen pijplijn: build-worklist (A) → stage (B) → apply (C).

---

## 10. SEO / GSC
Google Search Console + SEO. OAuth in `~/.gcp/`; data loopt 2–3 dagen achter (zie memory GSC).

| Script | Doet |
|---|---|
| `gsc-query.ts` | Snapshot-query |
| `gsc-diagnose.ts` | Dagelijkse traffic-breakdown (sitewide + gefilterd) |
| `gsc-striking-distance.ts` | "Striking distance" queries (net niet pagina 1) |
| `bing-diagnose.ts` | Bing Webmaster Tools traffic-breakdown (Bing/Yahoo/DDG/Ecosia, ~5-10% non-Google) |

---

## 11. Overig / infra

| Script | Doet |
|---|---|
| `fetch-news.ts` | RSS ophalen, embed + dedup, samenvatten (gpt-4.1-mini), opslaan |
| `suggest-editorial-classification-gpt.ts` | GPT editorial-classification suggester |
| `probe-bookshop-isbn.ts` | Test Bookshop.org affiliate deep-link per isbn13 |
| `_parse_apm_pdf.py` | Parse APM-PDF (Python) |

---

## Flag-conventie
- **`--apply` is de canonieke schrijf-flag.** Gebruik in nieuwe scripts
  `isApply()` / `hasFlag()` / `flagValue()` / `intFlag()` uit `scripts/lib/cli.ts`.
- De oudere `--write`-scripts (merge-paren-suffix, merge-honorific,
  apply-publication-year-fixes, remap-unmapped-queue, llm-classify-unmapped-reasons,
  score-data-quality) zijn gemigreerd naar `isApply()`; `--write` blijft daar als
  alias werken maar print een deprecation-waarschuwing.
- Alles data-schrijvend default **dry-run**. Bij twijfel: lees de header-comment.
