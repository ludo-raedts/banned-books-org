# Admin-portal audit — 2026-08-07

Methode: volledige code-analyse van `src/app/admin/` (38 bestanden, ~9.800 regels) en alle 25
routes onder `src/app/api/admin/`, plus een live walkthrough van elke sectie op localhost
(desktop 1520px én mobiel 375px). Rij-aantallen op basis van `docs/zenodo/data-descriptor.md`
en `data/integrity-baseline.json` (~20.300 books, ~12.800 authors, ~35.900 bans).

**Kernoordeel.** De portal is functioneel rijk en doet wat hij moet doen, maar hij is organisch
gegroeid: 13 secties die elk hun eigen conventies hebben (8 definities van dezelfde card-class,
6 input-varianten, 4 feedback-patronen, 4 lijststijlen), en — belangrijker — een load-profiel dat
haaks staat op het "load zo laag mogelijk"-doel: het dashboard vuurt bij elke load ~158
PostgREST-round-trips af, de Books/Authors-lijsten halen de complete catalogus (5–20 MB) naar de
browser, en vrijwel niets is gecachet. Eén admin-sessie (dashboard + books + authors + stats)
kost ruwweg **25 MB Supabase-egress en ~200 queries**. Dat is per pageload, niet continu (er is
nergens polling — dat is goed), maar het is de grootste egress-post van het project buiten de
publieke boekpagina's.

---

## 1. Systeemload (grootste hefboom)

### 1.1 Data-quality-card: ~158 queries per dashboard-load — prioriteit #1
`src/app/api/admin/data-quality/route.ts` draait automatisch bij élke `/admin`-pageload
(`data-quality-card.tsx:207,217`, fetch-on-mount): 14 exact-counts + volledige paginaties van
`ban_reason_links` (64 req), `ban_sources` (~37), `book_authors` (~22) en alle boektitels (~21)
om anti-joins en duplicaat-detectie **in JS** te doen. ≈ 3 MB egress en 12–18 s wall time, terwijl
de cijfers alleen bij imports veranderen (paar keer per week).
- **Fix:** één SQL-view/RPC met de counts + anti-joins (`NOT EXISTS`) + duplicate-count → 1 query.
  Wrap in `unstable_cache` (1 u) of laat meerijden op `mv_refresh_log`. De bestaande
  "Refresh"-knop op de card wordt dan de cache-bust.
- De `?detail=`-kliks zijn nog erger: `no_ban_reason`/`no_author`/`duplicates` trekken de héle
  bans- of books-tabel met 3-laags joins binnen (10–15 MB per klik); de `limit` wordt pas ná het
  ophalen toegepast. Zelfde fix: anti-join-views, dan werkt `.range()` echt.

### 1.2 Books/Authors-lijsten: volledige catalogus naar de browser
- `admin/books/page.tsx:28-32`: while-loop, 21 sequentiële requests, ~20.300 boeken mét
  author-join → 5–8 MB per pageload, force-dynamic. Client filtert/pagineert daarna alles in JS.
- `admin/authors/page.tsx:24-26`: idem (13 req), en selecteert **`bio` (longtext) voor 12.800
  auteurs terwijl de UI er alleen `!!bio` van maakt** → 10–20 MB per pageload voor een vinkje.
- **Fix:** server-side search + paginering. De infrastructuur bestaat al:
  `/api/admin/books/search` (ilike + trigram-index + limit 20) wordt al door Reading Club
  gebruikt. Lijstpagina = eerste 50 + count, zoeken via de bestaande search-route, filter-chips
  als `count`-queries. `bio` vervangen door een boolean-expressie in de select.

### 1.3 Book of the day (`/admin/bluesky`): ~35 queries + externe API, ongecachet
`pickForDates(14)` pagineert intern de hele books-tabel (~20 req via `eligibleBookIds()`), doet
daarna 14× een aparte `hydrate(id)` met 3-diepe join, plus `getRecentPosts()` — een **synchrone
Bluesky-API-call in de render**. Alles force-dynamic.
- **Fix:** picks zijn al "frozen" in de DB — de hele upcoming-lijst kan uit de opgeslagen picks +
  één batched hydrate-query komen. `getRecentPosts` in `unstable_cache` (5–15 min) of lazy achter
  een knop. `eligibleBookIds` alleen draaien wanneer er echt een dag ge-(re)rold moet worden.

### 1.4 Reading Club: ~31 queries, met stille truncatie
5× `getThemeBooks()` à 4 sequentiële queries, waarvan `ban_reason_links` **zonder limit → stil
gekapt op PostgREST's 1000-rij-cap** (`reading-club-data.ts:405-409`) — de `.slice(0,1000)` erna
suggereert bescherming die er niet is. Thema-suggesties zijn dus gebaseerd op een willekeurige
deelverzameling.
- **Fix:** de reason→books-selectie als één SQL-view; en sowieso: published picks staan al in de
  DB, de zware auto-pull hoeft alleen bij "Generate suggestions".

### 1.5 Stats: zwaarste losse statement + stil falen
`v_weekly_totals` = full scan over 90 dagen `pageviews` met 2× `count(DISTINCT visitor_hash)`,
ongecachet (`stats/page.tsx:88-91`) — de meest waarschijnlijke `statement_timeout` (8 s)-kandidaat.
De hele pagina zit in één `try/catch` die **stil naar leeg valt**: bij een timeout zie je een lege
stats-pagina zonder foutmelding. Alleen `getDailyTraffic` en de Cloudflare-snapshot zijn gecachet
(300 s) — het goede patroon bestaat al, pas het toe op de overige 12 queries.

### 1.6 Correctheids-bugs met load-oorsprong (stille 1000-rij-caps)
| Plek | Gevolg |
|---|---|
| `src/lib/site-urls.ts:36` — `bans.select('country_code')` zonder paginatie | country-URLs missen landen bij IndexNow-bulk (zelfde klasse fout als de gedocumenteerde 16→119-bug) |
| `src/lib/fetch-news.ts:197` — `news_items.select('source_url')` zonder paginatie | URL-dedup faalt stil zodra er >1000 news_items zijn |
| `reading-club-data.ts:405` — `ban_reason_links` zonder limit | thema-suggesties op een deelverzameling (zie 1.4) |

### 1.7 `maxDuration`-inconsistenties en runner-robuustheid
- Routes zonder `maxDuration` die hem nodig hebben: `fetch-news` (cron-tweeling heeft 300),
  `refresh-views` (cron heeft 60), `data-quality`, `cover-candidates` (worst-case ~60 s door 2×
  sequentiële Google-Books-calls met 30 s default timeout), `banned-books-week`/`reading-club`
  suggest (15–25 MB corpus).
- `generate-discussion-questions` `action:'generate'`: default `limit = Infinity` met sequentiële
  LLM-calls à ~5 s → gegarandeerde timeout bij >60 rijen, half werk, verloren tokens. Zet default
  op ~40.
- Enrich-runner in-process: prescan haalt de volle kandidatenset op vóór `limit`-slicing
  (`covers.ts:296-320` → 10.463 rijen ook bij limit 50); geen streaming/voortgang — browser wacht
  tot 300 s op één JSON-response, geen abort; geen resume-cursor.
- `withDbRetry` bestaat (`src/lib/db-retry.ts`) maar wordt **nergens in de admin** gebruikt —
  precies waar de zwaarste queries zitten.

### 1.8 Middleware dekt `/api/admin` niet
`middleware.ts` matcht alleen `/admin/:path*`; elke route compenseert correct met `requireAdmin()`
(alle 23 geverifieerd — auth is consistent en degelijk: HMAC-cookie, timing-safe, throttled login).
Maar: scanners op `/api/admin/*` kosten nu telkens een volledige function-invocation, en
`middleware.ts:33` (`/api/admin/login` passthrough) is dode code. `/api/admin/:path*` aan de
matcher toevoegen → 401 op de edge.

---

## 2. Functionele bevindingen (bugs, dood, stale)

### Echte bugs
1. **BBW picks tonen altijd "· 1 countries"** — `banned-books-week-admin-client.tsx:86` bouwt
   `countries` als N lege strings; regel 347 telt `new Set(...)` → altijd 1. (1984 en The Satanic
   Verses stonden er live met "1 countries".) Geef gewoon `countryCount` door.
2. **News: succes-melding bij mislukte call** — `news-admin-client.tsx:65-77` en `:334-344` checken
   `res.ok` niet; bij een 500 verdwijnt het item alsnog uit de lijst alsof publish/reject lukte.
3. **"Reject all" heeft geen confirm** (`:249`) terwijl single "Unpublish" die wél heeft —
   bulk-destructief met één klik.
4. **ThemePanel** rendert `picks.slice(0, 12)` maar `publish()` schrijft álle picks weg
   (`reading-club-admin-client.tsx:969` vs `:947`) — onzichtbare boeken gaan mee live.
5. **Content-blocks**: `PAGE_LABELS` mist `reading-club-young-readers` → sectie toont de rauwe
   slug als kop (live gezien).
6. **Unsaved-changes-bescherming ontbreekt precies waar de meeste state staat**: reading-club
   (4 tabs + themes), BBW-picks en news-edits hebben géén dirty-tracking; wegnavigeren = stil
   verlies. Book/author/content-block-edit hebben het wél (en zelfs daar dekt
   `use-unsaved-changes.ts` alleen `beforeunload`, geen client-side navigatie).
7. **Dood in productie maar wel klikbaar**: "Rebuild now" (dataset) → 400 op Vercel
   (`build-dataset/route.ts:14-18`) terwijl de confirm zegt "takes ~5 seconds"; idem
   `add-image-host` (alleen local-dev). Verberg of label ze als local-only.

### Stale / dood
- `enrich-runner.tsx:272`: disabled-hint zegt "only ISBN today" terwijl 4 stappen in-process kunnen.
- `books-list-client.tsx`: filter `extended_no_essay` onbereikbaar (niet in de pill-array).
- Reading Club CC: `<details>`-label noemt "bookshop URL" die per migratie verwijderd is.
- `reading-club/route.ts`: acties `save/delete_currently_challenged_entry` zijn backward-compat
  zonder UI-caller.
- `scripts/page.tsx:10`: ongebruikte `ImageIcon`-import; `data-quality-card.tsx:102`: ongebruikte
  `metric`-prop.
- Zenodo record-URL + DOI hardcoded op 2 plekken (`zenodo/page.tsx:8,11` én
  `admin-dashboard-client.tsx:438,446`) — moet synchroon blijven.
- `/api/admin/revalidate` heeft geen enkele UI-caller (bewust curl-only? dan documenteren).

### Functionele observaties
- **News is de enige plek met `window.location.reload()`** — de comment legt uit waarom
  (`useState(initial)` re-seedt niet bij `router.refresh()`), maar reading-club en BBW gebruiken
  wél `router.refresh()` met hetzelfde state-patroon → daar wordt de UI dus stil níet ververst
  na server-mutaties.
- Dedup-threshold-input op News accepteert `0,7` (locale-komma) in een tekstveld — riskant bij
  parsen; maak er een `type=number` met step van.
- Scripts- en Zenodo-pagina's zijn 100% statische documentatie (1.573 + 218 regels JSX, 0 queries)
  met gemengd NL/EN copy. Prima dat het bestaat, maar het is geen "admin", het zijn runbooks.
- Stats en Sitemap hebben als `<h1>` letterlijk "Admin" en missen de back-link die elke andere
  pagina heeft.

---

## 3. UI-inconsistenties (het patroon: 13 secties, 13 dialecten)

| Wat | Varianten |
|---|---|
| Card-class | 8 definities (5× `gap-3`, 3× `gap-4`) + 2× voluit uitgeschreven; deels als prop, deels lokaal |
| Input-class | 6 varianten (border-gray-200 vs 300, rounded vs rounded-lg, 3 paddings) |
| Feedback | `ui.toast` (4 bestanden) · inline `msg`/`error`-spans (~9 plekken, eigen kleurlogica) · `ui.confirm` (5) · **native `alert()`** (`upcoming-manager.tsx:26` — expliciet wat `admin-ui.tsx` zegt te vervangen) |
| Save/dirty | 3 niveaus: volledig (books/authors/content-blocks) · half (config-cards) · niets (reading-club, BBW-picks, news) |
| Refresh na mutatie | `router.refresh()` · `window.location.reload()` · lokale state-filter · niets |
| Lijsten | `<table>` met zebra · `<table>` zonder · `<ol>` bordered cards · `<ul divide-y>` · `<dl grid>` |
| Page-header | h1+backlink in server page · in client component · eyebrow zonder backlink ("Admin") · alleen h1 |
| Fetch-hygiëne | 20/29 calls met `credentials:'include'`, 9 zonder; foutextractie `data.error ?? HTTP n` ~14× gedupliceerd; geen gedeelde helper |

Verbatim-duplicaten die één component moeten worden: `ToggleSwitch` (news ↔ BBW, 27 regels),
`move()` (4×), `addBook()` (4×), `<Code>` (scripts ↔ zenodo), `formatBytes()` (2×), `flagEmoji()`
(2×), `StatusPill` (2×, verschillende maten), Prev/Next-paginering (books ↔ authors, 20 regels),
`NewsRow` ↔ `PublishedRow` (~95% gelijk, ~200 regels), relative-time-formatter (2×, andere buckets).

---

## 4. Mobiel

| Ernst | Bevinding | Plek |
|---|---|---|
| **Hoog** | 12-item nav ≈ 1.020px breed in `overflow-x-auto` met **verborgen scrollbar** — op 375px zijn 9 items onzichtbaar zonder enige affordance (live bevestigd: je ziet "Overview · Books · Aut…") | `admin-shell.tsx:51-72` |
| Middel | Referrer-rijen (favicon + `w-[140px]` label + bar + counts) ≈ 308px in een 293px container → rechterkolom afgekapt (live gemeten) | `traffic-card.tsx:255-283` |
| Middel | `flex-1` zonder `min-w-0` naast `w-full` textareas → flexbox-blowout-risico | `reading-club:532`, `BBW:342` |
| Middel | `grid-cols-2` zonder `sm:`-prefix (birth/death year) — 2 kolommen op 320px | `author-edit-client.tsx:92` |
| Middel | Sitemap `dl grid-cols-[auto_auto_1fr]` met font-mono paden — note-kolom wordt ~60px | `sitemap-client.tsx:142` |
| Laag | Nav-pills `py-1` in een `h-12` header — onder de 44px touch-richtlijn | `admin-shell.tsx:46,62` |
| Laag | Content-block-preview zonder `overflow-x-auto` — lange codeblokken kunnen overflowen | `content-block-edit-client.tsx:125` |
| Goed | `hidden sm:table-cell`-degradatie op books/authors-lijsten; `overflow-x-auto` op code/tabellen; news-cards; login | — |

Plus: op élke admin-pagina staat de **publieke site-header bóven de admin-balk** (dubbele chrome,
~96px verticaal op mobiel vóór de content begint). De admin zit in de root-layout genest; een
eigen minimale layout zou dat oplossen en meteen duidelijk maken "je bent in de admin".

---

## 5. Ontwerpvoorstel (los van de huidige setup)

### 5.1 Informatie-architectuur: van 13 tabs naar 4 groepen
De huidige nav somt 12 secties op als gelijkwaardige pills. Functioneel zijn het 4 clusters:

```
Dashboard   (huidige Overview + Stats samengevoegd: gezondheid, traffic, trending, inbox, sales)
Catalogus   Books · Authors                          (zoeken-eerst, server-side)
Publiceren  News · Book of the day · Reading Club · BBW · Content blocks   (redactie-flows)
Systeem     Scripts · Sitemap/IndexNow · Zenodo · MV-refresh               (runbooks & ops)
```

- **Desktop:** 4 groepslabels in de balk; secundaire nav (tabs of sidebar) binnen de groep.
- **Mobiel:** hamburger/sheet-menu met de 4 groepen uitgeklapt — lost het verborgen-scrollbar-
  probleem structureel op i.p.v. met een fade-gradient te pleisteren.
- **Stats apart houden heeft geen reden meer** zodra de zware queries gecachet zijn; Trending +
  Traffic + Cloudflare passen logisch op het dashboard. (DataQuality en Trending staan nu op
  twee verschillende pagina's zonder technische reden.)
- Scripts/Zenodo blijven waardevol als runbooks maar horen visueel in een "Systeem"-groep, niet
  als gelijkwaardige tab naast Books.

### 5.2 Dashboard: rustig bij binnenkomst, zwaar alleen on-demand
- Boven: 4–6 kleine stat-tegels (books/bans/countries, drafts, DB-size, sales) — allemaal
  goedkope counts die er al zijn.
- Data-health: **één cached samenvattingsregel** (score + top-3 kritieke metrics) uit de nieuwe
  SQL-view; het volledige panel + detail-tabellen pas na klik ("Details").
- Inbox, MV-refresh, essay-prompt: prima zoals ze zijn (licht).
- Quick actions inkorten: 13 externe links is een bookmarks-bar; groepeer of verplaats naar een
  uitklapbare lijst.

### 5.3 Catalogus: zoeken-eerst
Vervang beide fetch-alles-lijsten door hetzelfde model als de publieke zoek:
zoekveld (debounced, bestaande search-route) + server-paginated tabel (50/pagina) + filter-chips
als count-queries. Verwachte winst: van ~13 MB/pageload naar <100 kB, en de eerste render wordt
merkbaar sneller. De edit-formulieren zelf zijn goed (beste save-patroon van de portal) — alleen
uniformeren (zie 5.5) en een "View live →"-link naar de publieke pagina toevoegen (mist nu).

### 5.4 Publiceren: één redactie-grammatica
News, BOTD, Reading Club en BBW zijn allemaal "een lijst curated items met publish-knop", maar
delen nu niets. Eén gedeelde set: `PickList` (reorder + remove + blurb), `PublishBar`
(Save draft / Publish / dirty-indicator / laatste-publicatie-tijd), `ConfirmAction` voor alles
destructiefs of live-gaands. Daarmee verdwijnen de 4 `move()`-kopieën, de 4 `addBook()`-kopieën
en de 3 dirty-tracking-niveaus in één klap, en krijgen reading-club/BBW eindelijk
unsaved-changes-bescherming.

### 5.5 Gedeelde admin-kit (~10 primitives, 1 bestand of map)
`Card`, `Input/Select/Textarea`, `Button` (primary/danger/ghost), `ToggleSwitch`, `StatusPill`,
`PageHeader` (h1 + backlink), `DataTable` (met mobiele kolom-degradatie), `Code`, `PickList`,
`PublishBar` — plus één `adminFetch()`-helper (credentials, res.ok-check, error-extractie,
optionele toast). Dat elimineert vrijwel alle inconsistenties uit §3 en maakt elke volgende
sectie goedkoper om te bouwen. `admin-ui.tsx` (toast + confirm) is al een goede kern — afmaken
(Escape-handler + focus-trap) en overal verplicht maken (de native `alert()` eruit).

### 5.6 Eigen admin-chrome
Admin-layout zonder de publieke site-header: één balk, meer ruimte, duidelijker context,
en geen dubbele sticky headers op mobiel.

---

## 6. Aanbevolen volgorde (klein, concreet)

**Load (grootste effect, weinig UI-werk):**
1. Data-quality → SQL-view/RPC + cache; detail-queries als anti-join-views met echte limits.
2. `bio` uit de authors-select; books/authors server-side pagineren + bestaande search-route.
3. Stats-queries in `unstable_cache` (patroon staat er al); `withDbRetry` + zichtbare fout i.p.v.
   stille lege pagina.
4. Bluesky-page: picks uit DB + batched hydrate; `getRecentPosts` cachen/lazy.
5. De drie stille 1000-rij-caps fixen (site-urls, fetch-news, reading-club-data).
6. `maxDuration` gelijktrekken met cron-tweelingen; `generate-discussion-questions` default-limit.
7. `/api/admin/:path*` in de middleware-matcher.

**Bugs (klein en direct):**
8. BBW "1 countries"-fix; `res.ok`-checks in news; confirm op "Reject all"; ThemePanel
   slice/publish-mismatch; `PAGE_LABELS`-key; prod-dode knoppen verbergen.

**UI/mobiel (kan incrementeel):**
9. Admin-kit + `adminFetch()`; daarna sectie voor sectie migreren (begin bij news: grootste
   duplicaat, en reading-club/BBW: grootste risico op dataverlies).
10. Nav-hergroepering (4 groepen) + mobiel sheet-menu + eigen admin-chrome.
11. Mobiele fixes uit §4 (min-w-0, traffic-card, author-grid, touch-targets).

**Opruimen:**
12. Dode code/stale copy uit §2; dubbele helpers samenvoegen; Zenodo-URLs naar één constante.
