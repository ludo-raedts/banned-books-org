# Sprint A — volgende sessie

## Status na 2026-05-13

Sprint A is voor het grootste deel rond. Afgerond:

- **Taak 1** (`toSlug` NFD-fix), commits `b52cbfb..25f0e7b`.
- **Taak 1.5** (bulk NFD slug-fix), commits `a15474d..3dfecb7`.
- **Taak 2A** (schema additions: enums, Model 3 kolommen, `import_review_queue`), commits `75471ae..be055d6`.
- **Taak 2B** (data backfill: `ban_sources`, `title_native` voor en + fr), commits `9a52282..eb711cc`.
- **Taak 3** (pipeline plumbing in `src/lib/imports/`), commits `9843075..74e8c66`. Eindtest geslaagd met de Wikipedia-pagina over *Suicide, mode d'emploi* als manual-source. `import_jobs`-tabel en twee fuzzy-match RPCs (`find_book_candidates_by_title`, `find_author_candidates_by_name`) zijn in productie.
- **IndexNow delta-feature** — tracking-tabel + endpoint + admin-UI knop.

[`docs/PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) en [`docs/sources-roadmap.md`](../sources-roadmap.md) zijn up-to-date tot deze stand.

## Volgende sessie — twee opties

### A. Taak 4 — Language admin-filter + backfill

Scope:
- 334 NULL `title_native` rijen verwerken (non-en/non-fr books waar Taak 2B niet bij kwam).
- 67 fout-geklasseerde `original_language` corrigeren (21 NFD-Spaanstalige als `en`, 46 fr-classified met Engelse titel).
- Admin-UI om dit soort bulk-correcties los van een script te kunnen doen.

Eigenschappen: bekende scope, geen externe blockers, alle data zit al in productie. Levert geen nieuwe content; ontgrendelt wel de Model 3 rendering-doctrine voor de 334 al-aanwezige non-en/non-fr rijen (zonder `title_native` valt de h1-keuze terug op niets goeds).

### B. Taak 5 — Eerste echte source: Frankrijk

Scope:
- Legifrance fetch-strategie ontwerpen. Tijdens de Taak 3 eindtest bleek Legifrance Cloudflare-geblokt voor de huidige fetcher (403 op een test-URL). Drie kandidaten: realistische browser-headers, headless browser (Playwright), of een outbound proxy. Bron-specifieke override in `source-registry.ts` plus een tweede `fetcher`-implementatie als de huidige `fetch()` niet door Cloudflare komt.
- Wayback/archive.today fallback chain valideren tegen een echte Legifrance-URL (code zit in `src/lib/imports/archiver.ts`, niet getest tegen Cloudflare-realiteit).
- FranceArchives redirect-chain-detectie operationeel maken (`fetcher.ts` heeft `redirect_count`, gate gebruikt `redirect_chain_excessive` >5; nog niet gevalideerd tegen de beruchte 32-step chains die finding #3 documenteert).
- Joubert-bibliografie als tweede Franse bron toevoegen aan de source-registry zodra Legifrance werkt.

Eigenschappen: levert echte nieuwe content (Franse 1949-wet-besluiten zijn een serieuze corpus), maar drie technische blockers staan tussen de sessie en het eerste ingeladen boek. Bij Cloudflare-fail kan dat de hele sessie kosten zonder dat er één boek bij komt.

### Mijn voorstel

**Taak 5, met een time-boxed de-risking spike als eerste stap.** De gebruiker noemt het strategisch doel volume-doorzetting; Taak 4 voldoet daar niet aan (334 al-aanwezige rijen verschuiven is geen volume). Maar Taak 5 cold-starten is onverstandig gezien de drie blockers. Concreet:

1. Eerste 30 minuten: proberen één Legifrance-URL door de fetcher te krijgen — eerst met realistische User-Agent + Accept-headers, daarna eventueel Playwright. Als dat zonder pijn lukt, doorgaan met Taak 5. Als het op een 403-muur stuit die in 30 minuten niet weg is, pivot naar de Wayback-route: voer Legifrance-URLs in via `web.archive.org`-snapshots en sla het directe fetch-probleem over voor deze sessie.
2. Als óók de Wayback-route geen werkende corpus oplevert (Legifrance-pagina's niet of nauwelijks gearchiveerd), pivot naar Taak 4 in dezelfde sessie. Dat is een veilig opvangscenario met een gegarandeerde uitkomst.

Met andere woorden: Taak 5 met een vangnet, in plaats van Taak 4 als veilige keuze.

## Open follow-ups (niet kritisch)

Drie kleine punten die niet de volgende sessie hoeven, maar wel gedocumenteerd staan:

- **Stale `error`-veld op `import_jobs` na een succesvolle re-run.** De orchestrator update het `error`-veld alleen bij een mislukte fase, niet bij een geslaagde resume. Een job die eerst faalt en daarna doorloopt, blijft de oude foutmelding tonen ondanks `status='queued'` of `'committed'`. Cosmetisch. Fix is een eenregels-clear in `runPhase` bij succes.
- **`scripts/build-dataset.ts` controleren op de nieuwe Sprint A kolommen.** `title_native`, `title_native_script`, `title_transliterated`, `title_english_meaningful`, `original_language`, `verification_status` zijn allemaal in Sprint A toegevoegd; vraag is of de CSV/JSON/SQLite-export deze meeneemt. Niet getest. Relevant zodra de betaalde dataset opnieuw gebouwd wordt.
- **`/admin/scripts` pagina uitbreiden met een pipeline-sectie** zodra de pipeline meer dan één keer in de praktijk gebruikt is. Nu zou het overkomen als een spec-pagina; pas zinvol als er echte runs op staan om naar te wijzen.

## Research-documenten voor inhoudelijk werk

Drie bronnen in [`docs/research/`](../research/), in volgorde van diepte vs breedte:

- [`Bronnenlandschap voor verboden boeken in zeven rechtsgebieden.pdf`](../research/Bronnenlandschap%20voor%20verboden%20boeken%20in%20zeven%20rechtsgebieden.pdf) — diepe analyse van zeven rechtsgebieden (Rusland, China, Hongkong, Turkije, Marokko, Frankrijk, Spanje) met per land de aanbevolen primaire bronkanalen, juridische ankering, en betrouwbaarheidsoordeel. Voor Taak 5 is de Frankrijk-sectie hier de juiste startpagina.
- [`deep-research-report (11).md`](../research/deep-research-report%20(11).md) — Nederlandstalige tegenhanger met dezelfde zeven rechtsgebieden plus strategische aanbevelingen en de bronvolgorde voor maximale opbrengst per uur. Iets toegankelijker dan de PDF.
- [`compass_artifact_wf-…_text_markdown.md`](../research/compass_artifact_wf-61e3ab9e-9975-4a05-8419-1602fe308b60_text_markdown.md) — bredere internationale verkenning (60+ landen) met concrete titels, Wikipedia-startpunten en schema-aanbevelingen (statute or order cited, customs/import flags, author-prosecuted-tags). Voor de volgordevolgorde post-Frankrijk in [`docs/sources-roadmap.md`](../sources-roadmap.md) is dit de leidende bron.
