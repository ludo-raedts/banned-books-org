# Site-audit banned-books.org — 2026-10-25

Vervolg op `site-audit-2026-05-31.md` en de audit van 2026-08-08. Bronnen deze ronde:
Google Search Console (API: 28d/120d query+pages, URL Inspection op 108 URL's), Bing Webmaster
Tools (178 dagen), Cloudflare GraphQL (30 dagen zone + 7 dagen per cache/path/land/status),
eigen `pageviews`-tabel (96 dagen), Postgres read-only, `audit-integrity.ts`, Lighthouse 12
lokaal (mobile, 3 pagina's; PageSpeed-API gaf quota 0), live headers/sitemaps/HTML van ~45 URL's,
codebase-review (Next 16.2.4). Alle ruwe output staat in de scratchpad van deze sessie.

## 1. Diagnose in één alinea

Google is weg: van 108 geïnspecteerde URL's is er **1 geïndexeerd** (een hub-pagina). `/books/1984`,
`/books/lolita`, `/books/animal-farm`, alle 11 reason-hubs, alle gecheckte landen, alle essays en
`/dataset` staan op "Crawled – currently not indexed"; `/top-100-banned-books`, alle year-hubs,
alle reading-club-pagina's en `/countries/hk` zijn "URL is unknown to Google". Laatste Googlebot-
crawl op de kernboeken dateert van juli. GSC 28d: 138 impressies, 2 klikken, homepage op positie 20
voor de eigen merknaam. Dat is geen ranking-suppressie meer (augustus: 987 geïndexeerd), het is een
site-brede uitsluiting. Tegelijk is de site gezond en groeiend in het Bing-ecosysteem: Bing+DDG+
Yahoo+Ecosia = **56% van alle pageviews**, Bing-kliks ~165/dag (piek 701 op 6 okt, BBW), 42.464 pv
in 30 dagen (+104% t.o.v. de 30 dagen ervoor). Techniek is grotendeels op orde (Lighthouse perf
89–96, SEO 92, integrity-audit exit 0). De hefbomen liggen in: (a) de catalogus voor Google
concentreren, (b) content waar Bing al beloont uitbouwen, (c) een handvol concrete technische
lekken.

## 2. Zoekmachines en verkeer

### Google (GSC, sc-domain)

| Metriek | Waarde |
|---|---|
| Impressies 28d (25 sep–23 okt) | 138 |
| Klikken 28d | 2 |
| Dagen met 0 impressies in oktober | 6 |
| Striking-distance queries (pos 5–20, ≥20 impr, 90d) | 0 |
| URL Inspection 108 URL's: geïndexeerd | 1 (1%) |
| "Crawled – currently not indexed" | 48 (incl. top-100 boeken, reasons, landen, essays) |
| "URL is unknown to Google" | 59 (incl. /top-100-banned-books, year-hubs, reading-club) |
| Apex-URL's die nog impressies krijgen | `banned-books.org/books/to-kill-a-mockingbird` 51 impr pos 2.9 (0 klik) |

Lezing: het augustus-oordeel ("authority-bound, geen per-page-kwaliteit") blijft staan, maar de
toestand is verslechterd van "slecht gerankt" naar "niet in de index". Google's site-brede
kwaliteitsclassifier beoordeelt de *verhouding* dun/rijk over het hele domein; per-pagina-dunheid
voorspelde rejectie niet (bewezen in augustus), maar de site-ratio is een ander mechanisme en de
enige knop die wij zelf kunnen draaien. Zie §4.1.

### Bing-ecosysteem (Bing WMT, 178 dagen)

| Metriek | Waarde |
|---|---|
| Kliks/dag laatste 7d | 165 (vorige 7d 214, BBW-normalisatie −23%) |
| Piek | 6 okt: 701 kliks / 7.461 impr |
| Trend | mei 0 → jun ~15/dag → aug ~60 → sep ~130 → okt ~200 |
| Topquery | "banned books" 6.911 impr, pos 6.4, CTR 5,4% |
| Beste CTR-pagina's | /countries/gb 16,5% (3.031 impr), /books/the-perks… 18,6%, "banned books in canada" 47% CTR pos 1.8, "banned books uk" 48% pos 1.2 |
| Zwakke snippets | /history 1.200 impr 4,1% CTR; /search 912 impr 2,1%; /countries 2.585 impr 5,3% |
| Year-hub | /banned-books/2026: 1.773 impr, 8,5% CTR — met **1** interne inkomende link |

### Eigen pageviews (96 dagen, alleen /books en /authors getrackt)

| Bucket | 30d | % | 90d | % |
|---|---:|---:|---:|---:|
| direct/null | 16.060 | 37,8 | 29.816 | 38,9 |
| bing | 10.837 | 25,5 | 17.780 | 23,2 |
| duckduckgo | 10.111 | 23,8 | 18.671 | 24,4 |
| yahoo + ecosia | 2.905 | 6,8 | 5.666 | 7,4 |
| social (vnl. Bluesky-bot 398) | 686 | 1,6 | 1.015 | 1,3 |
| google | 671 | 1,6 | 1.105 | 1,4 |
| edu/LMS + wikipedia | 356 | 0,8 | 771 | 1,0 |
| AI (chatgpt 70, copilot 18) | 89 | 0,2 | 348 | 0,5 |

Concentratie: top-100 boekpagina's = 49% van boek-pv, top-1.000 = 83%. **69% van de boeken en 82%
van de auteurs kreeg in 90 dagen nul views.** Boeken met 1 ban (85% van de catalogus) trekken 28%
van de views. DE (3.644 boeken) en MY (3.065) zijn 32% van de catalogus en leveren 1.378 + 2.321 pv.

### Cloudflare (30 dagen)

- Requests/dag: 50–90k normaal; botgolf 28 sep–9 okt tot 454k/dag (threats tot 13.886/dag, 53.827×403 in 7 dagen). Unieke bezoekers stabiel 7–10k/dag.
- HTML-cache aan de edge: 7 dagen = 97k miss, 47k none, 30k hit, 22k dynamic, 18k expired → ~14% van HTML uit CF-cache; de rest gaat naar Vercel (daar meestal ISR-HIT).
- `/_next/image` webp: 69k hit vs 44k miss in 7 dagen.
- Topverkeer-HTML 7d: `/` 5.862, `/search` 2.002, `/books/carrie-stephen-king` 1.268, `/authors/colleen-hoover` 1.254, `/countries/ca` 918.

## 3. Content en data

### Catalogus (Postgres, 25 okt)

| Veld | n | % van 20.934 boeken |
|---|---:|---:|
| description_book | 9.868 | 47,1 |
| cover_url | 10.553 | 50,4 |
| isbn13 | 10.590 | 50,6 |
| first_published_year | 13.920 | 66,5 |
| title_native | 4.769 | 22,8 |
| ≥5 bans zonder beschrijving / zonder cover | 6 / 20 | — |

Gaten per import (geen beschrijving): DE 96%, MY 88%, FR 87%, PT 92%, AR 85%, HK 85%, RU 91%; US 10%.
Auteurs: 13.343, bio 3.790 (28%), foto 4.730 (35%); **522 auteurs met ≥3 boeken zonder bio**
(kop: hua-situ 27, zhiying-li 23, wei-wei 22, jose-vilhena 29, tomas-da-fonseca 14; plus `lenine`
15 boeken zonder bio naast `lenin` 34 en `vladimir-lenin` 6 = driedeling, merge-kandidaat).
Bans: 37.763, 78,6% zonder beschrijving (PEN/DE), 0 zonder bron, 10 zonder reason.
Landen: alle 119 hebben een intro (mediaan 663 tekens). Essays: 9, laatste 16 juli 2026 — **3
maanden geen nieuw redactioneel werk**; `/essays` zelf is ~700 woorden zonder H2's.

Integrity: exit 0, 7 invariants OK. Drift: shared-description 23 (baseline 17: its-perfectly-normal-
paar, persepolis 1/2, drive-your-man-wild-paar), slug≠slugify 916 (892). Residu PEN-jaarstempel: 331
boeken met pub-year 2024/25 = eerste ban-jaar. Dubbele titel+auteur: 1 groep (Chetusan ×3, ids
11322/11324/11325). `untitled-12` (id 16966) krijgt 14 pv zonder titel.

### Concrete content-gaten met verkeer (30d)

- Boeken zonder beschrijving: Quran 61 pv (4 bans), 1619-project-born-on-the-water 31, 7-generations 31 (ook geen cover), fellowship-of-the-ring 13.
- Auteurs zonder bio: hua-situ 25 pv, jose-vilhena 22, wei-wei 12, zhiying-li 8, homer 7, samira-ahmed 6, nikole-hannah-jones 5, ibram-x-kendi 4. ashaari-muhammad 80 pv zonder foto.
- Top-25 boeken en top-15 auteurs zijn verder compleet (desc+cover, bio+foto).

## 4. Advies, geprioriteerd

### 4.1 Google: concentreren, niet wachten (grootste hefboom, grootste onzekerheid)

1. **Indexeerbare kern definiëren en de rest `noindex,follow`.** Voorstel voor de drempel: boek is
   indexeerbaar als (≥2 bans) OF (beschrijving én cover) OF (≥1 pageview in 90d); auteurs blijven
   op de bestaande bio-regel. Grove schatting: ~6–7k boeken blijven indexeerbaar, ~14k gaan noindex
   (vooral DE/MY/FR/PT/AR/HK/RU-import zonder blurb en zonder verkeer). Zelfde regel toepassen op
   `sitemap-books.xml` (nu 20.892 URL's, allemaal priority 0.9/monthly). Dit is een pilot met
   meetpunt: `gsc-index-check.ts` nu (1/108) en na 8 en 16 weken. Risico: nihil voor Bing (die
   indexeert via IndexNow en volgt `follow`), en de pagina's blijven bestaan voor bezoekers en AI.
2. **Landenlijsten als roll-up voor de dunne imports.** Voor DE/MY/PT/FR/HK: de landenhub en de
   auteurspagina's dragen de inhoud (lijst, jaar, bron, context-callout); de losse boekpagina
   zonder blurb wordt noindex (punt 1). Geen pagina's verwijderen.
3. **Autoriteit blijven bouwen op de manier die aantoonbaar werkt**: het persbericht met cijfers
   leverde pawins.org, ncclinked, theeducatorsroom en ISBNdb-LinkedIn op (backlink-audit 23 okt).
   Eén data-gedreven release per maand (bv. "Banned in 2026: eerste cijfers", "DoDEA", "prison
   bans") is de goedkoopste autoriteitsbron; FAIRsharing/Zenodo-DOI-spoor doorzetten.
4. Kleine Google-hygiëne die nu geen schade doet maar wel moet: `/search` en `/llms.txt` uit
   `sitemap-static.xml`; `lastmod` toevoegen aan static/countries/reasons-sitemaps (nu 1/164 en
   0/130); hoofdletter-paden (`/BOOKS/1984` → 200) naar 308 zoals landen al doen; http-apex in 1
   hop (nu 2× 308) via één Cloudflare-redirectregel; root-layout `alternates.canonical: '/'`
   verwijderen zodat 404/error niet naar `/` canonicaliseren.

### 4.2 Bing/DDG: optimaliseren waar het verkeer al is

5. **Titels inkorten tot ≤60 tekens** op boek (nu 75), land (78) en reason (84): Bing en Google
   knippen ze af; de ladder in de code kan de "| Banned Books"-suffix op hubs laten vallen.
6. **Snippets van de drie grote hubs herschrijven**: `/countries` (2.585 impr, 5,3%), `/history`
   (1.200, 4,1%), `/search` (912, 2,1%, indexeerbaar). `/countries/gb` (16,5%) en de CA-query (47%)
   bewijzen dat landenpagina's op Bing winnen: GB, CA, AU, US-hub uitbouwen naar 1.500+ woorden
   met wetgeving, tijdlijn en sleutelzaken.
7. **Year-hubs ontwezen**: `/banned-books/2026` scoort op Bing met 1 interne link. Koppel
   `year_started` in de ban-rijen op boekpagina's aan `/banned-books/{jaar}` en zet een "per jaar"-
   strook op land- en reason-hubs. Zelfde voor `/book-of-the-day/[date]` (0 inkomende links buiten
   `/share`) en de footer-only hubs (award-winning, rising, film, podcasts).
8. **og:image ontbreekt** op `/countries/*` en essays (wel `summary_large_image` gedeclareerd);
   essay-meta-description is 300 tekens; auteurspagina's gebruiken de kleine `summary`-card.
   Boek-OG-image: 358 KB PNG, ongecached, 2 s TTFB per share-preview → cachen en verkleinen.

### 4.3 Content

9. **Essay-cadans herstellen**: 1 stuk per 2–3 weken, gestuurd door Bing-vraagintentie ("why was
   jane eyre banned" 3 varianten, "is captain underpants banned", "mein kampf banned"). Format dat
   al werkt: data + 1 verhaal. `/essays` zelf verrijken (H2-secties per thema, 700 → 1.500 woorden).
10. **522 auteurs ≥3 boeken zonder bio**: kop van de lijst (Chinese/Portugese imports) via de
    bestaande gegrounde bio-pipeline; `lenine`/`lenin`/`vladimir-lenin` mergen met alias-rij.
11. **Puntfixes met verkeer**: Quran, 1619-project-born-on-the-water, 7-generations,
    fellowship-of-the-ring (beschrijving); ashaari-muhammad (foto); `untitled-12` id 16966 (titel);
    Chetusan ×3 (dubbel); 6 nieuwe shared-description-paren uit de drift.
12. **331 PEN-jaarstempels** (pub-year = eerste ban-jaar 2024/25) via de bestaande
    verify-years-llm-watchlist afwerken; dit raakt "bans before publication" en de FAQ-tekst.

### 4.4 Techniek

13. **Hydration-fout op home en boekpagina** (React #418, tekst-mismatch) in de console: vinden
    (vermoedelijk datum/teller die server≠client rendert) en fixen; het kost Lighthouse BP (79) en
    kan bij zoekmachines renderverschillen geven.
14. **Meetgat dichten**: `pageviews` trackt alleen /books en /authors (CHECK-constraint). Landen,
    reasons, essays, search en home toevoegen (entity_type uitbreiden); zonder dit is de hub-vs-
    content-vraag niet te beantwoorden en blijft de Vercel-UI de enige, bot-vervuilde bron.
15. **Koude ISR long tail**: 7/25 sitemap-steekproef MISS met 1,5–4,5 s TTFB, 404-pagina 2,5 s.
    Goedkoop: alle 119 landen prerenderen (nu `generateStaticParams []`), 404 statisch. Groter:
    Cloudflare cache-rule voor HTML met korte TTL + bestaande targeted busts (nu ~14% CF-HTML-hit).
16. **`/banned-books-week` is force-dynamic + cookies()** voor een admin-preview die niet eens
    werkt (vergelijkt cookie met raw `ADMIN_SECRET` i.p.v. HMAC-token; zelfde fout in
    `api/indexnow/route.ts:15`). Publieke pagina naar ISR, preview via `/admin`.
17. **Reason-hub meta-description** telt uit de eerste 2.000 `ban_reason_links`
    (`reasons/[slug]/page.tsx:84-98`) terwijl de pagina de volledige sweep gebruikt → foute
    aantallen in de snippet voor lgbtq/sexual/political.
18. **Auteurspagina** haalt bans twee keer op, ongebonden `.in(book_id)` stilletjes op 1.000 rijen
    gekapt (`authors/[slug]/page.tsx:162-165`) → foute tellingen voor PEN-zware auteurs.
19. **API-hardening**: `/api/books` `limit`/`offset` onbegrensd (`api/books/route.ts:24-25`) →
    clampen (≤96 / ≤5.000) en zod op de publieke routes; `/api/pageview` en `/api/suggest` zonder
    rate-limit buiten Cloudflare.
20. **Onderhoud**: `middleware.ts` → `proxy` (deprecated in Next 16; codemod bestaat); Next
    16.2.4 → 16.4.3, React 19.3.1; Biome 2 errors (`import-magnusson-delta.ts:212`) + 228 warnings
    (115× useButtonType, 80% in admin); werk-e-mailadres als User-Agent in 10 getrackte scripts
    (publieke repo) → één `CONTACT_EMAIL` uit env; HSTS zonder `preload`; geen CSP (bekend).
21. **Structured data**: BreadcrumbList ontbreekt op land/reason/scope/context/year; Book→author
    Person zonder `@id` (`#person`) zodat entiteiten niet gekoppeld zijn; essays `dateModified` =
    `datePublished`; `/books/1984` draagt een Franse Grasset-ISBN (978-2-246…) met `inLanguage: en`
    → steekproef hoe vaak de canonieke ISBN een buitenlandse editie is.
22. Bewuste keuzes die blijven: `Disallow: /_next/image/` (blokkeert Google Images, bespaart
    egress), Content-Signal in robots.txt (Lighthouse noemt het "unknown directive", onschadelijk),
    thin-author-noindex, Dataset-markup op `/dataset` ondanks 0 Google-impressies.

## 5. Wat goed is

Caching-discipline (React `cache()`, `unstable_cache` achter elke dynamische route, ISR 7d op
boeken/auteurs, prefetch uit); deterministische titel/description-ladders; rijke en valide JSON-LD
op boek/auteur (Book/Person met `@id`, `sameAs`, FAQ ≤5); markdown-twins via Accept-negotiatie;
security-baseline (HMAC-sessies, edge-401, cron-secret, headers); robots/llms/feed/indexnow allemaal
kloppend; 0 img zonder alt, 1 H1 per pagina, canonicals correct, non-www → www in 1 hop;
Lighthouse mobile: home 95/91/96/92, boek 89/89/79/92, US-hub 96/92/79/92 (perf/a11y/bp/seo),
CLS 0 overal; 341/341 tests groen, tsc 0 fouten.

## 6. Volgorde die ik zou aanhouden

Week 1: 13, 16, 17, 18, 19 (bugs, één PR); 4 + 8 (sitemap/OG-hygiëne); 11 (puntfixes).
Week 2–3: 1 + 2 (indexeerbare kern + sitemap-filter, met nulmeting via `gsc-index-check.ts`); 5–7
(titels, hub-snippets, year-hub-links); 14 (meetgat).
Doorlopend: 9 (essays), 3 (maandelijkse data-release), 10 (bio-backlog), 12 (jaarstempels).
Herijken: 8 en 16 weken na stap 1, met dezelfde 108-URL-check en de Bing-dagreeks.

## 7. Status na de uitvoering (zelfde dag, 25 okt avond)

Uitgevoerd en gepusht (commits af38ee9 → 1c34cf9 + Next-upgrade):

| # | Punt | Status |
|---|---|---|
| 13 | Hydration-fout | **Opgelost.** Oorzaak = Cloudflare e-mail-obfuscatie die `contact@…`/`info@…` herschreef (home-FAQ, /press) → in code `<EmailLink>` met `<!--email_off-->`, en Ludo heeft Scrape Shield → Email Address Obfuscation uitgezet (25 okt ~19:45 Z). Hercheck in schone headless Chrome (Lighthouse): home en /books/1984 zonder React #418. Het challenge-platform-script was niet de oorzaak en is inmiddels ook niet meer aanwezig in de HTML. Enige rest: CF Web-Analytics-beacon `static.cloudflareinsights.com` resolvet niet in de Lighthouse-sandbox (geen echt probleem). |
| 16 | `/banned-books-week` force-dynamic | ISR 3600 (+archive 86400); kapotte preview weg; `/api/indexnow` verifieert HMAC-token |
| 17 | Reason-meta telling | één `cache()`-sweep voor metadata én pagina |
| 18 | Auteurs dubbelfetch / 1.000-cap | één `getBooksForAuthor` (nested embed, chunked) |
| 19 | API-clamp | `/api/books` limit ≤96, offset ≤25k |
| 8 | OG/snippets | og:image op landen + essays; essay-description ≤155; auteurs `summary_large_image`; boek-OG-card ISR 7d |
| 4 | Sitemap/canonical-hygiëne | `/search` + `/llms.txt` uit sitemap-static; root-canonical weg; mixed-case slugs 308 (pad-segment `/BOOKS/` is alleen op Vercel een 200 — Next zelf 404't; laten) |
| 1+2 | Indexeerbare kern | **Google-only** `<meta name="googlebot" content="noindex,follow">` buiten de kern (≥2 bans óf blurb+cover): 9.089 kern / 11.803 Google-noindex. Auteurs-noindex ook Google-only gemaakt. `sitemap.xml` = kern (9.084 boeken + 3.802 auteurs); nieuw `sitemap-full.xml` (20.892 + 13.336) alleen bij Bing ingediend (API, status Pending). Nulmeting: 1/108. |
| 5 | Titels | boek-ladder cap 70→55 (vóór suffix), land/reason-hub-titels ingekort |
| 6 | Hub-snippets | `/countries`, `/history`, `/search` herschreven (vraag-eerst); /history Article met Person-byline |
| 7 | Year-hubs | jaar-links in ban-clusters op boekpagina's; `<YearStrip>` op land- en reason-hubs (echte tellingen uit de volledige sweep) |
| 14 | Meetgat | migratie `20261025180000_pageviews_hub_entity_types.sql` + API + tracker op /, landen, reasons, essays, year-hubs, search, news. **Migratie nog niet toegepast** (deploy-classifier): `supabase db push` draaien; tot dan worden hub-inserts stil geweigerd. |
| 20 | Onderhoud | `middleware.ts` → `proxy.ts`; Biome 0 errors; e-mailadres uit 12 script-UA's; Next 16.4.3 / React 19.3.1 (zie build-log in commit) |
| 21 | Structured data | BreadcrumbList op land/reason/scope/context/year; Book→author `@id` (#person/#organization) |
| 11 | Puntfixes | 7 besmette beschrijvingen genuld; Fellowship/7 Generations/1619 Born on the Water (OL, ISBN geverifieerd), Quran + Untitled 12 (handgeschreven, bron Wikipedia); 7-Generations-cover; Ashaari Muhammad Wikidata-id (geen vrije foto). `untitled-12` is een echte titel (Kaur Kender), Chetusan ×3 zijn drie taalversies — geen fouten. Integrity exit 0, shared-desc-drift 23→19. |
| 10 | 520 auteurs zonder bio | plan in `data/author-bio-backlog-plan-2026-10-25.md` |
| 12 | PEN-jaarstempels | ids-file klaar: `data/pen-stamped-residue-2026-10-25.json` (331). Draaien: `pnpm tsx --env-file=.env.local scripts/verify-years-llm.ts --ids-file=data/pen-stamped-residue-2026-10-25.json --dry-run` → review → `--apply` |
| 15 | Koude ISR long tail | bewust niet: landen prerenderen bij build brak eerder de build onder enrichment-load (d29ffe1); CF HTML-cache-rule blijft een optie |
| 3, 9 | Data-release, essays | bij Ludo |

Afgerond door Ludo op 25 okt: `supabase db push` (14, hub-pageviews lopen), e-mail-obfuscatie uit (13), WAF-regel 5 AI-agent-uitzondering toegepast (`scripts/cf-waf-exempt-ai-agents.ts`, zie docs/cloudflare-waf.md §6). Nog open: year-verify run (12).

## 8. Content-ronde 26 okt (Bing-data → content)

- Volledige Bing-export (2.101 query-rijen, 1.545 pagina-rijen) geaggregeerd; vraag-intentie
  ("why was X banned", "is X banned") zit op positie 2–4 met 4–6% CTR achter generieke snippets.
- 14 topboeken: `description_ban` handgeschreven met ALA-Top-10-jaren + redenen en PEN-tellingen
  per schooljaar (`human_curated`). Boek-meta opent nu met "Why was X banned? <eerste zin>".
- Snippets herschreven: `/countries/us` (USA/America), landen (lidwoord-bewust), auteurs (meest
  verboden titel in de staart), jaar-hubs (echte aantallen), `/challenged-books`, `/scope/school`,
  `/news`, `/reasons`. Landen-FAQ: "since 2020"-vraag. Home linkt naar `/banned-books/2026`.
- Jaren: PEN-residu (331) door `verify-years-llm` + `resolve-proposed-years --ids-file` (nieuw);
  OL-titelmatch blijkt onbetrouwbaar (The Stand-In → 1670), daarom handmatig 13 zekere jaren gezet
  (Afterglow 2023, The Deep Dark 2024, Racial Justice 2022, Body Book for Boys 2010, The Elements
  2007, Annotated Art 1995, Sculpture 1994, Leonardo da Vinci 1994, Zara Hossain Is Here 2021,
  When Villains Rise 2020, Manga Shakespeare: The Tempest 2007, Nevertheless We Persisted 2018,
  The World that Belongs to Us 2020). 5 PEN-titeltypo's gecorrigeerd; auteur "Sabina Kahan"
  → "Sabina Khan" samengevoegd (alias-rij). Integrity exit 0; slug-drift-baseline 892 → 921
  geaccepteerd (slugs blijven bij titelcorrecties).
- Nog voor Ludo: Jane Eyre-rij 5850 verwijderen (SQL in chat); lege auteursrij 1052 (sabina-kahan)
  verwijderen; de 263 "no OL year"-rijen blijven op de watchlist.
