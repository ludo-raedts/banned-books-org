# Scripts — catalogus & gids

> Doel: **"ik wil X (importeren, verrijken, opschonen, controleren) → welk script?"**
> beantwoorden zonder door alle ~100 scripts te zoeken.
>
> - Alle data-schrijvende scripts draaien standaard **dry-run**; pas wordt geschreven
>   met `--apply` óf `--write` (conventie verschilt per script — zie de flag-kolom).
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

### Gedeelde pipeline (voorkeur) — `src/lib/imports/`
De motor voor "nette" imports. `run-import-job.ts` orkestreert:
`pending → fetched → archived → extracted → verified → gated → committed`.
- `gate.ts` — pure auto-approve beslissing (Latin-script, geen author-collision, geen high-stakes bron, …).
- `committer.ts` / `review-commit.ts` — één transactionele INSERT-plek; auto-approve én handmatige review leveren dezelfde DB-vorm.

**Gebruik dit (of `commitParsedRow` / `commitNewBanForBook`) als je ban standaard van vorm is.**

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

**Vuistregel:** JSON met standaard government-bans → `import-africa` als template ·
school/library challenges → `import-nipissing` · bans bij bestaande boeken → `add-ala-2025`.

---

## 2. Dedup-detectie (vinden)
Detectie en wijziging zijn gescheiden: `_audit_*` is read-only en levert een worklist
die een merge-script daarna inleest.

| Script | Doet |
|---|---|
| `_audit_paren_suffix_dupes.ts` | "Titel (suffix)"-dubbele boeken → `data/paren-suffix-dupes.json` (input voor `merge-paren-suffix-dupes.ts`) |
| `_audit_split_authors.ts` | Canonieke detector voor gesplitste auteurs → `data/hk-split-authors-review.md` |
| `_audit_honorific_author_dupes.ts` | Honorific-twin auteurs (Ustaz/Haji-prefix) → input voor `merge-honorific-author-dupes.ts` |
| `_audit_mojibake_authors.ts` | U+FFFD-corrupte auteursnamen (draai vóór nieuwe KDN-batch) |
| `check-dupes.ts` | Ad-hoc: print info voor een **hardcoded** sluglijst om te beoordelen óf het dupes zijn. Schrijft niets |

> Detectoren **vinden**, merge-scripts **voeren uit**. Draai altijd eerst de audit.

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
| `merge-paren-suffix-dupes.ts` | **Generiek, data-gedreven** | Leest paren uit `data/paren-suffix-dupes.json` (`--file=` override). **Referentie-implementatie — start hier.** | `--write` |
| `merge-orwell-1984-dupes.ts` | Eén geval (hardcoded) | Dedupt op (country, scope) i.p.v. volledige key (zelfde SU-ban, afwijkend jaar); incl. slug-aliasing | `--write` |
| `merge-iran-duplicates.ts` | 4 hardcoded paren | Simpelst: herhangt ban, verwijdert book_authors + boek. Geen enrichment/aliassen | `--apply` |

### Auteur-merges
| Script | Scope | Bijzonder | Flag |
|---|---|---|---|
| `merge-honorific-author-dupes.ts` | Hardcoded paren | Maleisisch import-artefact. Migreert `book_authors` + author-FK-tabellen | `--write` |

**Vuistregel:** generieke boek-dupes → vul `data/paren-suffix-dupes.json` + draai
`merge-paren-suffix-dupes.ts` · eenmalig bijzonder geval → kopieer dichtstbijzijnde hardcoded
script · auteur-dupes → `merge-honorific-author-dupes.ts`.

> ⚠️ `books.isbn13 UNIQUE` (e.a.): verwijder DROP vóór KEEP enrich't op een uniek veld.

---

## 4. Enrichment
Vullen van ontbrekende velden op bestaande records. **Veel `-gpt`/`-v2`-varianten — let op deprecaties.**

| Script | Vult |
|---|---|
| `enrich-all.ts` | Master-pipeline: alle open velden over de hele catalogus |
| `enrich.ts` / `enrich.js` | Oudere/seed-achtige enrichment (referentiedata + bestaande data) |
| **Descriptions** | |
| `enrich-descriptions-v2.ts` | 2e-generatie CLI — **voorkeur voor nieuwe runs** |
| `enrich-descriptions.ts` | ⚠️ **DEPRECATED** — gebruik v2 |
| `enrich-descriptions-continuous.ts` | Continu missende `description_book` vullen; tracking in `description_search_attempts` |
| `enrich-descriptions-gpt.ts` | GPT-fallback voor wat OL/Google Books niet vond |
| `enrich-ban-descriptions-gpt.ts` | GPT: concrete `description_ban` per boek |
| `enrich-censorship-context-gpt.ts` | GPT: `censorship_context` waar die ontbreekt |
| **Covers** | |
| `enrich-covers-continuous.ts` | Continu missende covers; tracking in `cover_search_attempts` |
| `enrich-covers-v2.ts` | Re-try van eerder gefaalde cover-searches |
| **Auteurs** | |
| `enrich-author-bios.ts` | Bios via Wikipedia (incl. `--photos-only`) |
| `enrich-author-photos-v2.ts` | 2e-pass foto's voor auteurs zonder Wikipedia-hit |
| **Identifiers / overig** | |
| `enrich-isbn.ts` | Missende `isbn13` via OpenLibrary + Google Books |
| `enrich-archive-org.ts` | archive.org identifiers via Advanced Search API |
| `enrich-gutenberg.ts` | Project Gutenberg IDs via Gutendex |
| `enrich-genres-gpt.ts` | GPT genre-enrichment (lege `genres`) |
| `enrich-genres-retry-gpt.ts` | Retry-pass voor wat gpt-4o-mini niet plaatste |
| `enrich-reasons.ts` | Classificeert ban-reasons die nu alleen 'other' zijn (GPT-4o-mini) |
| `enrich-pending-non-latin.ts` | Backfill non-Latin review-queue items (Model 3 title-velden) |
| `generate-discussion-questions.ts` | Reading-Club discussievragen (Claude Opus) |
| `update-ban-descriptions.ts` | Voegt/updates ban-descriptions voor goed-gedocumenteerde bans |

> Voorkeur descriptions = `-v2` / `-continuous`. `-gpt` zijn fallbacks. Let op de DEPRECATED-marker.

---

## 5. Audit & detectie (read-only)
Schrijven **niets** naar de DB; produceren een rapport/worklist. (Dedup-audits staan in §2.)

| Script | Controleert |
|---|---|
| `audit-db.ts` | Algemene DB-health (boeken zonder cover/description, …) |
| `_audit_site_health.ts` | Data-integriteit voor de site-audit (alleen SELECTs) |
| `score-data-quality.ts` | Data-quality classifier over de catalogus |
| `audit-scripts-catalog.ts` | Freshness-check van déze catalogus: flag't scripts die niet in `README.md` staan (draait ook als slot van `enrich-all.ts`) |
| `check-coverage.ts` / `check-no-desc.ts` | Snelle coverage-checks |
| **Jaren** | |
| `audit-publication-years.ts` | `first_published_year` vs OpenLibrary → review-artifact |
| `audit-impossible-years.ts` | Onmogelijke/verdachte publicatiejaren |
| `audit-author-years.ts` | Onmogelijke birth/death years |
| `verify-years-llm.ts` | LLM-cascade die `first_published_year` verifieert/backfillt voor rijen die OpenLibrary niet kon bevestigen (vervolg op `audit-publication-years.ts`) |
| **Auteurs** | |
| `audit-non-person-authors.ts` | Author-rijen die geen persoon zijn (uitgevers/comités/…) |
| **Covers** | |
| `audit-covers-for-placeholders.ts` | Google Books "image not available" placeholders |
| `_audit_google_covers.ts` | Degenererende horizontale Google-cover-strips |
| `audit-study-guide-covers.ts` | SparkNotes/CliffsNotes-covers (zie memory study-guide audit) |
| **Slugs** | |
| `audit-slugs.ts` | Bestaande slugs vs huidige `slugify()` |
| `filter-nfd-subset.ts` | Filtert slug-audit naar de NFD-bug subset |
| **Descriptions / context** | |
| `_audit_ungrounded_descriptions.ts` | Ongegronde ai-drafted descriptions (read-only sizing) |
| `_audit_ban_vs_context_overlap.ts` | Overlap `description_ban` ↔ `censorship_context` |
| `_audit_keep_narrative_groundedness.ts` | 2e-pass op de ban-vs-context audit |
| `_sample_keep_narrative.ts` / `_peek_censorship_context.ts` | Steekproef/inspectie-helpers |
| `_measure_isbn_description_winrate.ts` | Meting (geen writes) |
| **CSAM / editorial flags** | |
| `_audit_csam_red_flags.ts` | Telt CSAM-red-flag treffers |
| `_detect_nazi_warning_candidates.ts` | Kandidaten voor `context`/`extended` warning_level |

---

## 6. Cleanup & fixes
Gerichte data-correcties (**schrijven**). Veel zijn one-off (leidende `_` of `_fix_`).

| Script | Doet | Type |
|---|---|---|
| `cleanup-bans-action-type.ts` | Normaliseert niet-canonieke `bans.action_type` | generiek |
| `cleanup-iran-titles.ts` | Iran-records met transliteratie als primaire titel → doctrine | gericht |
| `cleanup-non-person-authors.ts` | Ruimt non-persoon authors op (uit `audit-non-person-authors.ts`) | gericht |
| `apply-publication-year-fixes.ts` | Past high-conf jaar-correcties toe (uit `audit-publication-years.ts`) | apply |
| `_apply_google_cover_fixes.ts` | zoom=3→1 fix; onherstelbare covers nullen | one-off |
| `_apply_csam_block.ts` | ⚠️ DESTRUCTIEF one-time: blokkeert 2 CSAM-adjacent works | one-off |
| `_apply_fr_nazi_warning_tiers.ts` | warning_level/rationale op 6 Nazi/Holocaust-denial boeken | one-off |
| `_apply_ban_vs_context_cleanup.ts` | Past verdict van `_audit_ban_vs_context_overlap.ts` toe | apply |
| `_apply_keep_narrative_groundedness.ts` | Past verdict van bijbehorende audit toe | apply |
| `_fix_blanket_author_names.ts` | Corrigeert Liste-Otto "Toutes ses œuvres" auteursnamen | one-off |
| `_fix_south_korea_bans.ts` | Data-quality fix KR historische bans | one-off |
| `_improve_north_korea.ts` | Verbetert KP-coverage | one-off |
| `_scope_fr_otto_bans.ts` / `_scope_fr_wikipedia_bans.ts` | Scope/verken FR ban-bronnen (read-only) | scope |
| `_update_fr_country_description.ts` | Herschrijft `countries.description` voor Frankrijk | one-off |
| `_strip_dark_mode.ts` | Strip dode `dark:` Tailwind-tokens uit de codebase | one-off |
| `mark-cover-override.ts` | Markeert cover als handmatige override (clear cover_url) | tool |

---

## 7. Descriptions-kwaliteit (pijplijn)
Genummerde stages voor het opschonen/hergronden van bestaande descriptions.

| Stage | Script | Doet |
|---|---|---|
| audit | `score-descriptions.ts` | Scoort `description_ban`/`censorship_context` op concreetheid (0–3) → CSV |
| 2 | `rewrite-descriptions-grounded.ts` | Herschrijft zwakke boeken op basis van de audit-CSV |
| 2.5 | `flag-filler-rewrites.ts` | Flag't filler-phrasing → fake-audit CSV |
| 2.6 | `strip-filler-sentences.ts` | Strip filler-zinnen/clausules (behoudt named cases) |
| wrapper | `clean-descriptions.ts` | Één commando dat de remediation-stappen aaneenrijgt |
| — | `rewrite-descriptions-grounded.ts` | (zie stage 2) |

> Volgorde: `score-descriptions` → `clean-descriptions` (of los 2 → 2.5 → 2.6).

---

## 8. Review-queue
Verwerking van `import_review_queue` (legacy/idle — zie memory "Import queue is legacy/idle").

| Script | Doet |
|---|---|
| `remap-unmapped-queue.ts` | Re-run reason-mapping over rows met `unmapped_reason` (3 passes) |
| `llm-classify-unmapped-reasons.ts` | LLM 2e-pass voor rows die de regex-mapper niet aankon |
| `salvage-stale-queue-bans.ts` | One-off salvage van 37 stale rows (2026-05-14 batch) |

---

## 9. Datasets & build

| Script | Produceert |
|---|---|
| `build-dataset.ts` | Betaalde download-dataset ZIP |
| `build-zenodo-dataset.ts` | Open citeerbare dataset voor Zenodo (CC-BY-4.0) — zie memory Zenodo |
| `zenodo-descriptor-to-pdf.tsx` | `docs/zenodo/data-descriptor.md` → PDF |
| `zenodo-deposit-diff.ts` | Bepaalt of de open core genoeg veranderd is voor een nieuwe Zenodo-versie (re-deposit is bewust, niet automatisch) |
| `build-film-data.ts` | Events-layer voor de animated-world-map film-PoC |
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

---

## 11. Overig / infra

| Script | Doet |
|---|---|
| `fetch-news.ts` | RSS ophalen, embed + dedup, samenvatten (gpt-4.1-mini), opslaan |
| `suggest-editorial-classification-gpt.ts` | GPT editorial-classification suggester |
| `probe-bookshop-isbn.ts` | Test Bookshop.org affiliate deep-link per isbn13 |
| `_parse_apm_pdf.py` | Parse APM-PDF (Python) |

---

## Flag-conventie (let op: inconsistent)
- `--apply` → import-scripts + `merge-iran-duplicates.ts` + meeste `apply-*`/cleanup-scripts.
- `--write` → `merge-paren-suffix`, `merge-orwell`, `merge-honorific`.
- Alles data-schrijvend default **dry-run**. Bij twijfel: lees de header-comment.
