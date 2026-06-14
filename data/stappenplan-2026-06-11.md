# Stappenplan — kwaliteit, SEO & scripts (2026-06-11)

Gebaseerd op: verse DB-coverage-meting (exacte counts), data-quality-report 2026-06-10,
site-audit 2026-05-31 (+ verificatie wat al gefixt is), GSC t/m 2026-06-05 (frontier-dagen genegeerd).

Volgorde = leverage. Gratis bronnen eerst, betaalde API's alleen op gescopete worklists.

## A. Datakwaliteit & verrijking (gratis eerst)

- [x] **A1. Maak de gestrande re-ground run af** — ✅ 2026-06-11. Alle 512 no-ISBN
      REGROUND-rijen verwerkt (runs 1–3). ~109 dragen nu een gegronde beschrijving
      (~89 via de reground-ladder + 20 via het consensus-spoor); ~403 bevestigd
      "geen bron via title-search" → beslispunt A1c. Timestamp-resume was kapot
      (score-data-quality herstempelde de catalogus) → `--ids-file` toegevoegd +
      log-gebaseerde reconstructie. Run-3 kosten: $0,0007.
- [x] **A1b. Fase 2: re-ground de ISBN-rijen** — ✅ 2026-06-11. Selectie isbn13 NOT NULL
      + source_type NULL = 4.317 kandidaten (ongegronde-tekst + lege-beschrijving ISBN-rijen,
      bewust samen). Volledig afgewerkt over meerdere runs op één dag; laatste run liep tot
      echte completion (geen quota-stop). Resultaat: **boeken zonder description_book
      5.868 → 4.511** (−1.357 nieuwe beschrijvingen) plus ~1.950 ongegronde AI-teksten
      vervangen door bronvaste tekst. Restpool = **1.009 ISBN-rijen** bevestigd zonder
      vindbare bron (de vloer; niet opnieuw draaien — re-grindt alleen missers). LLM-kosten
      verwaarloosbaar (~$0,03/run). Twee infra-fixes onderweg: GB-key-rotatie
      (GOOGLE_BOOKS_API_KEY → KEY2, 2 GCP-projecten = 2.000/dag) + harde 30s fetch-timeout
      op alle bron-fetchers (voorkwam de 2u-hang). Geen nieuwe audit nodig: 0 van de 1.890
      imports sinds 06-04 droeg de ongegronde signatuur.
- [ ] **A1c. Beslispunt NO-SOURCE-restant** (na A1+A1b): ~1.4xx no-ISBN-rijen houden
      ongegronde tekst (bevestigd onvindbaar via title-search, of nooit REGROUND-eligible).
      Kiezen: laten staan vs. wipen conform fase 1-doctrine. Eerst omvang exact meten.
- [ ] **A2. Volle OL-harvest pass** — `enrich-ol-harvest.ts` (gratis, geen dagcap, exact-key).
      Doelvelden: cover (6.854 missend), `first_published_year` (5.501), sibling-ISBN (6.196).
      Daarna coverage opnieuw meten en het verschil noteren.
- [ ] **A3. GB-harvest (launchd, ~1.000/dag) laten lopen** voor de wezen — geen actie,
      wel wekelijks `data/gb-harvest-proposals.jsonl` even checken op bruikbare year/categories.
- [ ] **A4. Placeholder-auteurs herclassificeren** — grootste flag-driver (1.504 boeken;
      "Anonymous" draagt 1.630 boeken, veelal FSEM-tracts). Split "echt anoniem werk" van
      "auteur onbekend bij ons"; echte anoniem niet langer als kwaliteits-flag laten tellen.
      Pure DB/heuristiek-fix, geen API-kosten.
- [ ] **A5. Cover-side shared-enrichment cleanup** — laatste open contaminatie-dossier.
      Worklist bestaat al (`_audit_shared_enrichment.ts`); apply via `cleanup-shared-enrichment.ts`,
      de geguarde enrichers herstellen daarna de rechtmatige covers.
- [ ] **A6. Ban-verificatie opschalen** — 152 van 34.810 bans `verified` is mager voor een
      bronnen-site. Het `verify-pen-school-bans.ts`-patroon (lokaal matchen tegen upstream-bestanden)
      is gratis; richt eerst op bans van de top-100/canonieke boeken (zichtbaarst, JSON-LD-waarde).

## B. SEO (datagestuurd, eerst meten)

- [ ] **B1. SEO-hercheck draaien** (stond gepland voor 06-08): `gsc-striking-distance.ts` vs
      baseline `data/gsc/striking-distance-2026-05-22.json`, apex-impressie-decay, en vooral:
      herstellen /books/ en /authors/ in positie na de core-update-demotie (7→29/34)?
- [ ] **B2. GSC-demand-worklist voor verrijking** — laat B1 bepalen wélke boekpagina's eerst
      description/context krijgen: pagina's met impressies maar dunne content. Dit is de
      core-update-herstellever (thin content werd afgewaardeerd).
- [ ] **B3. `censorship_context` NIET bulk-vullen** (13.580 missend). Alleen gpt-4o-mini op de
      B2-worklist, batches van ~200, gevalideerd via het bestaande consensus/validatie-patroon.
      Risico is niet kosten (~centen) maar kwaliteit: ongegronde AI-context is precies wat de
      core update afstrafte.

## C. Scripts-wildgroei (139 bestanden, 35 one-offs)

- [ ] **C1. `scripts/archive/` aanmaken** en afgeronde one-offs verplaatsen (de `_`-scripts
      waarvan het werk klaar is: `_apply_csam_block`, `_fix_south_korea_bans`, `_strip_dark_mode`,
      `_improve_north_korea`, queue-salvage one-offs, …). Catalogus krijgt een sectie "Archief";
      `audit-scripts-catalog.ts` moet de map negeren. Git-history bewaart alles.
- [ ] **C2. Deprecated/kapot opruimen** — verwijder `enrich-descriptions.ts` (DEPRECATED),
      beslis `enrich.ts`/`enrich.js` (max één houden), verwijder `check-coverage.ts` en
      `audit-db.ts` (beide kapot door 1000-row cap) en neem hun coverage-counts op als
      drift-metrics in `audit-integrity.ts` (head-counts met filter, exact).
- [ ] **C3. Schrijf-flag uniformeren naar `--apply`** via een kleine gedeelde CLI-helper in
      `scripts/lib/` (accepteert `--write` als alias tijdens de overgang). Nieuwe scripts
      verplicht via de helper.
- [ ] **C4. Audit-restjes code** — `src/lib/supabase.js` (hand-synced duplicaat van `.ts`)
      verwijderen; `middleware` → `proxy` rename (Next 16 deprecatie, check eerst
      `node_modules/next/dist/docs/`).
- [ ] **C5. Resterende UI-auditpunten verifiëren** — A6 (twee design-systems), A7 (combobox-ARIA),
      A8 (`book-browser` ≈ duplicaat `search-client`), A10 (`prefers-reduced-motion`).
      Eerst checken wat al stilletjes gefixt is, dan pas bouwen.

## Status-snapshot (referentie)

| Metric | Waarde (2026-06-11) |
|---|---|
| Boeken | 15.890 (32% confident · 53% default · 15% flagged) |
| Zonder description | 5.868 (37%) — was 92% op 31 mei |
| Zonder cover | 6.854 (43%) |
| Zonder isbn13 / jaar | 6.196 / 5.501 |
| Zonder censorship_context | 13.580 (85%) |
| Auteurs zonder bio / foto | 6.263 (66%) / 4.229 (44%) |
| Bans | 34.810 — slechts 152 verified |
| GSC (betrouwbare dagen 06-03..06-05) | 22–32 clicks/dag, organische CTR ~0,16% |
