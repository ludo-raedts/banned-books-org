# Import-review · dedup-pipeline + merge-UI

Werkdocument voor de workstream "wat doen we met queue-rijen die er duplicaat
uitzien?" Capture's het ontwerp, wat er gebouwd is, en wat er nog open staat.

> Stand: 2026-05-14. Dedup-pipeline-fix en read-only "Existing Book" panel live.
> Per-veld pickers + merge-endpoint nog te bouwen.

---

## Probleem

De Wikipedia-bulk-importer plaatste rijen in `import_review_queue` met
`agreement_details.dedup_check.kind = 'possible_duplicate'` (similarity tussen
0.5 en 0.85) zodra de fuzzy-match een kandidaat-boek vond zonder boven de
auto-skip-grens van 0.85 te komen. In de audit (zie
[`scripts/_check_dedup_signals.ts`](../scripts/_check_dedup_signals.ts)) was de
stand:

- 102 pending rijen met `possible_duplicate` (24% van pending)
- Sim-scores gelijkmatig verdeeld 0.50–0.85
- **Stuk-voor-stuk echte duplicaten** in de top-20 hoogste matches
- 8 boeken kregen 2+ hits; één boek (#6) zelfs 10× — popular banned book,
  10 verschillende landen-secties van Wikipedia

Twee problemen tegelijk:

1. **Veel matches scoorden sub-0.85** alleen omdat de Wikipedia-titel een
   `(YYYY)` jaar-suffix had die de canonieke titel niet heeft. `"Lady
   Chatterley's Lover (1928)"` vs `"Lady Chatterley's Lover"` haalt ~0.82
   trigram-similarity, terwijl het objectief hetzelfde boek is.
2. **Auto-skip bij sim > 0.85 was semantisch fout** voor het meeste verkeer.
   Een Wikipedia-rij over "Lady Chatterley's Lover" uit de Australië-sectie is
   géén re-import van een bestaande rij — het is een **nieuwe ban in Australië**
   die op het bestaande boek moet komen.

---

## Ontwerp in drie fasen

### Fase 1 — Pipeline-fix (commit [`907b9f1`](https://github.com/ludo-raedts/banned-books-org/commit/907b9f1))

Door een parallel-agent gemaakt; bevatte ook source_context-fallback. Voor
dedup specifiek:

- **Title-normalisatie** in
  [`src/lib/wikipedia/dedup.ts`](../src/lib/wikipedia/dedup.ts) — `(YYYY)` en
  `(series)`/`(novel)`/`(book)`/`(novella)` suffixes worden gestript vóór
  zowel de slug-collision-lookup als de fuzzy RPC. Andere parentheticals
  (echte titel-onderdelen zoals `"1984 (Nineteen Eighty-Four)"`) blijven
  staan.
- **Nieuwe `auto_add_ban` decision-mode** in
  [`src/lib/wikipedia/importer.ts`](../src/lib/wikipedia/importer.ts):
  baseline-quality gates identiek aan `auto_approve`, maar dedup vond een
  bestaand boek. Pipeline maakt een **nieuwe ban op het bestaande boek** in
  plaats van te skippen. `dedup.kind === 'duplicate'` betekent dus niet meer
  "skip" maar "add ban to existing".
- **Idempotente `commitNewBanForBook`** in
  [`src/lib/imports/review-commit.ts`](../src/lib/imports/review-commit.ts):
  SELECT-first-then-INSERT op
  `(book_id, country_code, year_started, scope_id)`. Re-runs zijn no-ops.

### Fase 2 — Migraties + backlog-replay (commit [`dbfbbbd`](https://github.com/ludo-raedts/banned-books-org/commit/dbfbbbd))

- **`merge_decisions jsonb`** kolom op `import_review_queue`
  (`supabase/migrations/20260514145016_review_queue_merge_decisions.sql`).
  Audit-trail voor toekomstige per-veld winnaars + ban-acties.
- **`bans_unique_per_scope` UNIQUE-constraint** op
  `(book_id, country_code, year_started, scope_id)`
  (`supabase/migrations/20260514151511_bans_dedupe_and_unique.sql`). Migratie
  ruimt eerst transactioneel duplicaten op met "keep-oldest-merge-sources":
  laagste id wint, source/reason-links van losers gaan via
  `ON CONFLICT DO UPDATE` naar de winnaar, lege scalairs op de winnaar
  worden vanuit de oudste loser ingevuld. Post-check aborteert bij
  resterende duplicaten vóór de constraint geplaatst wordt. Productie-run
  loste 10 duplicate-paren op zonder errors.
- **`scripts/replay-dedup-on-queue.ts`** —
  herverwerkt elke pending `possible_duplicate`-rij door de nieuwe
  genormaliseerde dedup. Dry-run default; `--apply` commit. Productie-run
  resultaten:

| Categorie | Aantal |
|---|---|
| Auto-add-ban (alle gates passen, nieuwe ban op bestaand boek) | **35** |
| Stay in review, dedup-evidence updated naar `'duplicate'` | 34 |
| Stay in review, blijven `'possible_duplicate'` (echte twijfel) | 37 |
| Errors / skipped | 0 |

- **Audit-scripts**: `_check_ban_dupes.ts`, `_check_dedup_signals.ts`,
  `_check_dedup_impact.ts`, `_inspect_queue_row.ts` — read-only diagnostics
  voor toekomstige verificatie.

### Fase 3 — Read-only "Existing Book" panel (commit [`0c3bb00`](https://github.com/ludo-raedts/banned-books-org/commit/0c3bb00))

UI op `/admin/import-review/[id]` toont nu boven de twee-koloms parsed-vs-form
layout een volle-breedte panel met de volledige kandidaat-boek-shape:

- **Cover** (140×210 thumbnail) + links naar `/books/{slug}` + admin-edit
- **Alle titel-varianten**: canonical, native, transliterated, English
  meaning; auteurs, jaar, taal, ISBN-13, genres; inklapbare beschrijving en
  slug-aliases
- **Tabel met bestaande bans op het boek**: per ban de country, year, action,
  scope, status badge, source-links
- **Header**: kind-label + sim-score + ban-coverage-samenvatting ("N bans
  in CC1, CC2") + badge "Titles match after normalization" als de
  client-side mirror van `normalizeTitleForDedup` exact-match levert

Server-loader in
[`src/app/admin/import-review/[id]/page.tsx`](../src/app/admin/import-review/%5Bid%5D/page.tsx)
draait drie queries parallel zodra `dedup_check.book_id` gevuld is: book-row
met joins, bans met scope + sources, en `book_slug_aliases`.

Read-only — geen pickers, geen mutaties, geen merge-endpoint. Een editor kan
met de bestaande Approve/Defer/Reject-knoppen nu wél een geïnformeerde keuze
maken zonder zelf de DB te hoeven openen.

---

## Wat er nu mogelijk is

- Editors zien op de detail-pagina onmiddellijk of een queue-rij echt een
  dupe is of een nieuwe ban voor een ander land/jaar/scope. Verwacht effect:
  de overgebleven 71 ambiguë rijen (37 ambigu + 34 quality-blocked) zijn
  veel sneller te triagen, zelfs zonder formele merge-flow.
- Nieuwe Wikipedia-import-runs creëren automatisch nieuwe bans op
  bestaande boeken voor dedup-matches, geen handmatige actie meer nodig
  bij sterke matches.
- De pipeline is robuust tegen herhaalde runs van dezelfde Wikipedia-pagina
  (alle inserts idempotent).

## Wat nog niet kan

- **Per-veld picker** voor de gevallen waar de editor wíl mergen (oude
  beschrijving vervangen, nieuwe titel-variant toevoegen). Nu nog handmatig
  in Studio of via de Admin Books edit-flow.
- **"Voeg nieuwe ban toe" knop** vanuit de UI als de gates niet automatisch
  passen (year=null, reason=unmapped). Nu nog handmatig.
- **"Not a duplicate" override** voor de gevallen waar dedup een false
  positive geeft (zeldzaam — top-20 was 100% raak — maar niet onmogelijk in
  de 0.50–0.55 staart).
- **Audit-kolom `merge_decisions`** is leeg; wordt pas gevuld zodra de
  merge-endpoint bestaat.

---

## Open follow-ups

- **Enrich race-guards** (covers, descriptions, isbn, author-photos) waren
  lokaal toegevoegd in deze sessie maar niet gecommit omdat de bestanden
  ook andere uncommitted wijzigingen hadden (title-ladder integratie). Te
  bundelen wanneer dat parallel-werk landt.
- **Auto-add-ban behoeft DATABASE_URL** in env — werkt via `pg.Client` i.p.v.
  supabase-js. Was bij eerste run-attempts onduidelijk; eerste DATABASE_URL
  regel in `.env.local` was leeg, tweede de echte; het `loadEnvLocal`-shim
  in scripts pakt de niet-lege waarde.
- **Drie kolommen op mobile** is nog niet getest; admin is desktop-first,
  maar als dit voor reading-on-the-go wenselijk wordt, moet de
  `md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1.2fr)]`-grid een
  responsive-tabs-variant krijgen.

---

## Bestanden in deze workstream

Code:
- [`src/lib/wikipedia/dedup.ts`](../src/lib/wikipedia/dedup.ts) — title-normalisatie + dual-slug lookup
- [`src/lib/wikipedia/importer.ts`](../src/lib/wikipedia/importer.ts) — `decide()` + `commitAutoAddBan`
- [`src/lib/wikipedia/types.ts`](../src/lib/wikipedia/types.ts) — `auto_add_ban` variant
- [`src/lib/imports/review-commit.ts`](../src/lib/imports/review-commit.ts) — `commitNewBanForBook`
- [`src/app/admin/import-review/[id]/page.tsx`](../src/app/admin/import-review/%5Bid%5D/page.tsx) — rich data fetch
- [`src/app/admin/import-review/[id]/detail-client.tsx`](../src/app/admin/import-review/%5Bid%5D/detail-client.tsx) — `ExistingBookPanel`

Migraties:
- `supabase/migrations/20260514145016_review_queue_merge_decisions.sql`
- `supabase/migrations/20260514151511_bans_dedupe_and_unique.sql`

Tooling (eenmalige + diagnostische):
- [`scripts/replay-dedup-on-queue.ts`](../scripts/replay-dedup-on-queue.ts) — herverwerkt backlog
- [`scripts/_check_dedup_signals.ts`](../scripts/_check_dedup_signals.ts) — queue-distributie
- [`scripts/_check_dedup_impact.ts`](../scripts/_check_dedup_impact.ts) — simuleert pipeline-impact
- [`scripts/_check_ban_dupes.ts`](../scripts/_check_ban_dupes.ts) — telt scope-tuple-duplicaten in `bans`
- [`scripts/_inspect_queue_row.ts`](../scripts/_inspect_queue_row.ts) — jsonb-shape inspector
