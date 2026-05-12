# Sprint: news filtering — scoping

> Onderzoek, geen code. Doel: beslissen tussen drie richtingen — A. betere
> triage-UI, B. reject-mechanisme met reden, C. pre-filter classifier.
> Snapshot: 2026-05-12. Bron-DB: production. Geen wijzigingen aangebracht.

## TL;DR — twee aannames uit de brief blijken niet te kloppen

1. **De brief stelt "er is geen expliciete reject-actie".** In de code zit
   wel degelijk een Reject-knop (`src/app/admin/news/news-admin-client.tsx`
   r. 109-115) en een `reject_all` bulk-actie. De status-check op
   `news_items` staat `'rejected'` toe naast `'draft'` en `'published'`
   (baseline migration r. 445). **Wat ontbreekt is niet de actie maar de
   reden** — er wordt nergens vastgelegd waarom een item is afgewezen.

2. **De brief vraagt naar de "draft-voorraad". Die is nul.** De huidige
   DB-staat is 48 published, 56 rejected, **0 drafts**. Er is geen achterstand;
   er ligt wel een impliciet gelabeld reject-corpus van 56 items uit de
   afgelopen 18 dagen. Dat is precies het materiaal waarmee de drie scopes
   beoordeeld moeten worden — en het is bruikbaarder dan de brief
   veronderstelt.

De rest van dit document gaat over wat dat betekent voor A/B/C.

---

## 1. Huidige flow

Bestanden: [src/lib/fetch-news.ts](../../src/lib/fetch-news.ts),
[src/config/news.ts](../../src/config/news.ts),
[src/app/admin/news/page.tsx](../../src/app/admin/news/page.tsx),
[src/app/admin/news/news-admin-client.tsx](../../src/app/admin/news/news-admin-client.tsx),
[src/app/api/admin/news/route.ts](../../src/app/api/admin/news/route.ts),
[src/app/api/cron/fetch-news/route.ts](../../src/app/api/cron/fetch-news/route.ts).

### Pipeline van RSS → publicatie

1. Vercel cron treft `/api/cron/fetch-news` dagelijks om 08:00 UTC.
2. `runFetchNews()` haalt 11 feeds op (zie `FEEDS` in `fetch-news.ts`).
3. Per item, in volgorde:
   - **Datumfilter** — alleen items < 7 dagen oud.
   - **URL-dedup** — als `source_url` al bestaat in `news_items` (welke
     status dan ook), skip.
   - **Keyword-filter** — alleen voor broad-scope feeds met `keywordFilter`
     ingesteld (HRW, Meduza, Article 19, IranWire, China Digital Times,
     PEN International). Regex: `/book|author|censor|ban|publish|library|literature/i`.
   - **Embedding** — `text-embedding-3-small` op `title + description[0:800]`.
   - **Cosine-dedup** — vergelijk met alle embeddings van items uit de
     laatste `dedup_window_days` (default 14). Drempel: `dedup_threshold`
     (default 0.85). Bij overschrijding: skip als duplicate.
   - **OpenAI summarise** — `gpt-4.1-mini`, 40–70 woorden,
     `NOT_RELEVANT`-sentinel als topic-filter.
   - **Insert** met `status = config.autoPublish ? 'published' : 'draft'`.

### Velden gevuld op insert vs. op publish

Bij insert (`fetch-news.ts` r. 263-279) worden gevuld: `title`,
`source_name`, `source_url`, `published_at`, `summary`, `status`,
`embedding`, `auto_published`, `source_language`, `original_title`,
`original_summary`. Plus DB-defaults: `fetched_at`, `created_at`. Als
`auto_publish=true` óók `published_week`.

Bij handmatige publish (`api/admin/news/route.ts` r. 30-37): `status →
'published'`, `published_week → current Monday`, en optioneel een
bewerkte `summary`. Verder niets — er wordt geen `published_by`,
`published_at` (editor-zijde, niet RSS-pubdate) of audit-log
bijgehouden. Drafts bevatten al alles wat publish nodig heeft.

### Wat gebeurt er met oude drafts

Niks automatisch. Geen TTL, geen aging, geen "auto-skip na X dagen".
Een draft blijft draft tot iemand klikt. Twee bijwerkingen die wel
materieel zijn:

- **Dedup vergeet drafts > 14 dagen oud.** De cutoff in `fetch-news.ts`
  r. 184-189 is `published_at >= now() - dedupWindowDays`. Een draft die
  3 weken blijft hangen draagt niet meer bij aan dedup voor het volgende
  item van dezelfde gebeurtenis — daarmee verdwijnt het dedup-signaal
  vóórdat het item officieel is afgewezen.
- **`source_url` blijft wel uniek voor altijd.** De URL-dedup-set leest
  *alle* rijen, ongeacht status of leeftijd. Dat is ook hoe `unpublish`
  zacht-delete: status flipt naar `rejected`, URL blijft in de
  dedup-tabel (zie comment in `api/admin/news/route.ts` r. 46-50).

### Bevinding

De flow is conceptueel goed: cheap filters first (URL → keyword →
embedding-dedup → LLM-summary). Maar er zijn twee leemtes:

- **Geen reject-reden.** `rejected` is een eindstatus zonder context.
  Dat blokkeert leren — zowel handmatig (welke feeds leveren wat?) als
  machinaal (er is geen label voor classifier-training, alleen een
  binaire ja/nee).
- **Geen post-publish observability.** Er is geen view die laat zien
  welke feeds welk percentage opleveren; dat moest hier ad-hoc met SQL.

### Open vragen

- Wil je dat oude drafts (mocht die situatie ontstaan) automatisch
  vervallen, of blijft "geen draft-voorraad" een doelstelling die met
  triage-discipline behaald wordt?
- Is `published_week` (huidige maandag) als enige tijdmarker bij publish
  voldoende, of wil je ook `decided_at` apart bijhouden? Zie sectie 5.

---

## 2. De werkelijke draft-voorraad

**Headline**: er is op dit moment geen voorraad. Alle items zijn
beslist.

### Counts per status (alles)

| status     | n  |
|------------|----|
| published  | 48 |
| rejected   | 56 |
| draft      |  0 |

Lifetime: 2026-04-23 (oudste) → 2026-05-11 (nieuwste). 104 items in
~18 dagen, dus ~5.8 items/dag gemiddeld.

### Per maand (sinds project-start)

| maand    | published | drafts | rejected | totaal | approve-% |
|----------|-----------|--------|----------|--------|-----------|
| 2026-04  | 5         | 0      | 1        | 6      | 83.3 %    |
| 2026-05  | 43        | 0      | 55       | 98     | 43.9 %    |

April was cold-start (6 items). Mei is steady-state: bijna 50/50
publish/reject. De daling van approve-% gaat hand in hand met het
uitbreiden naar broad-scope feeds (HRW, Meduza, Article 19) — die
verlagen het inkomende signaal-ruis-niveau substantieel.

### Per source (top 14, all-time)

| source                       | pub | draft | rej | totaal | approve-% |
|------------------------------|-----|-------|-----|--------|-----------|
| HRW                          | 1   | 0     | 15  | 16     |  6.3 %    |
| Google News — banned books   | 13  | 0     | 1   | 14     | 92.9 %    |
| Meduza                       | 0   | 0     | 11  | 11     |  0.0 %    |
| PEN America                  | 7   | 0     | 3   | 10     | 70.0 %    |
| Index on Censorship          | 4   | 0     | 4   | 8      | 50.0 %    |
| PEN International            | 1   | 0     | 5   | 6      | 16.7 %    |
| IranWire                     | 1   | 0     | 2   | 3      | 33.3 %    |
| The Australian               | 2   | 0     | 0   | 2      |  100 %    |
| Yahoo                        | 1   | 0     | 1   | 2      | 50.0 %    |
| Parade                       | 1   | 0     | 1   | 2      | 50.0 %    |
| Article 19                   | 0   | 0     | 2   | 2      |  0.0 %    |
| The Guardian                 | 2   | 0     | 0   | 2      |  100 %    |
| Common Dreams                | 0   | 0     | 1   | 1      |  0.0 %    |
| Boing Boing                  | 1   | 0     | 0   | 1      |  100 %    |

### Auto vs. handmatig

`auto_published = true` count: **0**. Alle 48 published zijn handmatig
door jou gedaan. `news_config.auto_publish` is consistent uit geweest.

### Bevinding

- De brief-aanname "items blijven eeuwig draft" is theoretisch correct
  maar empirisch onwaar — jij triage'rt actief.
- Vier feeds zijn de afgewogen ruisleveranciers: HRW (94% rej), Meduza
  (100% rej), Article 19 (100% rej), PEN International (83% rej). Samen
  35 van de 56 rejects = 63%.
- Twee feeds zijn signaal-zwaar: Google News-aggregator (93% pub), PEN
  America (70% pub).
- Het approve-percentage daalt naarmate je broad-scope feeds toevoegt,
  niet doordat je strenger wordt.

### Open vragen

- Wil je het approve-percentage zien per feed in admin/news, zodat je
  beslissingen over feed-set kunt maken zonder SQL?
- Is "feed pruning" (Meduza / Article 19 weghalen, of strenger
  keywordFilter zetten) een alternatief dat naast B/C bekeken moet
  worden?

---

## 3. Steekproef van het reject-corpus

**Pivot t.o.v. de brief.** Met 0 drafts is een sample van drafts niet
mogelijk. Wat wél nuttig is en wat de brief eigenlijk wil weten — *wat
slaan we over en waarom* — beantwoordt een sample van de **rejected**
set. Hieronder 30 willekeurig getrokken rejected items, ongesorteerd op
oordeel.

(Selectie via `ORDER BY random() LIMIT 30` op `status='rejected'`. Reproduceerbaarheid: niet stabiel — query opnieuw draaien geeft een nieuwe trekking.)

---

**#42 Common Dreams · 5d**
'An Embrace of Anti-Intellectualism': Public School Bans on Nonfiction Books Doubled as Trump Returned to Power.
_Doubled bans op nonfiction, PEN-rapport syndicatie._

**#28 Yass Tribune · 6d**
Books banned as publisher cuts ties with guilty author.
_Craig-Silvey-zaak Australië, regionale syndicatie._

**#54 Meduza · 4d**
Report: Russia revokes all foreign press credentials for Victory Day parade.
_Persvrijheid, niet over boeken._

**#24 Merimbula News Weekly · 6d**
Books banned as publisher cuts ties with guilty author.
_Identieke titel als #28 — andere regionale krant._

**#29 ABC Australia · 6d**
Ban on Craig Silvey's books hardened in public schools after guilty plea.
_Zelfde zaak als #24/#28, andere framing._

**#92 HRW · 1d**
Tunisia: End Abusive Prosecution of Refugee Aid Workers.
_Mensenrechten, geen censuur van literatuur._

**#55 Meduza · 5d**
Moscow's Victory Day parade to proceed without military hardware; 'Immortal Regiment' march canceled.
_Geopolitiek, niet over boeken._

**#65 Article 19 · 6d**
MENA region: Persistent threats to journalism and media freedom.
_Persvrijheid, geen boeken._

**#62 IranWire · 4d**
Baha'i Woman Flora Samadani Arrested by Intelligence Agents in Yazd.
_Religieuze vervolging, geen boekencensuur._

**#90 Meduza · 1d**
Kaspersky Lab co-founder says FSB unit overseeing internet blocking has 'no idea' how networks work.
_Internet-censuur, geen boeken._

**#85 SJO Daily · 1d**
New PEN America Report Finds Nonfiction School Books Banned at Double the Previous Rate.
_PEN-rapport syndicatie (vgl. #42)._

**#80 PEN International · 5d**
Belarus: Freedom for Andrzej Poczobut must lead to more releases.
_Schrijver vrijgelaten — wel boekgerelateerd; jouw editorial call._

**#41 Parade · 4d**
1961 Pulitzer Prize Winner Ranked Number One 'Best Banned or Censored' Book.
_Listicle/clickbait — op-topic, niet gepubliceerd._

**#102 HRW · 0d**
DR Congo: Increasing Repression of Critical Expression.
_Mensenrechten breed, geen boeken._

**#101 Meduza · 1d**
Report: Russia's FSO bans officials from wearing watches at meetings with Putin.
_Het woord "ban" zit erin, maar het gaat over horloges._

**#56 Meduza · 6d**
Moscow court bans entertainment website 'YaPlakal' over alleged racist jokes.
_Website-ban, niet boek — wel een grijze zone._

**#104 HRW · 0d**
Tunisia Suspends Rights Groups That Shaped Its Democracy.
_NGO-onderdrukking, geen boeken._

**#27 EducationHQ · 6d**
Books banned from WA schools after popular author admits to serious crimes.
_Zelfde Craig-Silvey-zaak (#24/#28/#29) — vierde syndicatie._

**#61 IranWire · 5d**
Iran Wants Opposition Flags Banned at the 2026 World Cup in the US.
_Vlaggen-ban, geen boeken._

**#39 Houston Chronicle · 4d**
More schools banned nonfiction books in 2024-25 school year, new report finds.
_PEN-rapport syndicatie (vgl. #42, #85)._

**#57 Meduza · 6d**
Hungary returns gold and cash seized from Ukrainian state bank Oschadbank.
_Geopolitiek, geen relatie tot boeken._

**#87 Yahoo · 5d**
More schools banned nonfiction books in 2024-25 school year, new report finds.
_Identieke titel als #39 — andere syndicator._

**#70 HRW · 6d**
US Seeks to Lift Sanctions on Eritrea.
_Sancties, geen boeken._

**#71 HRW · 7d**
US: Courts Consider Access to Mifepristone via Telehealth.
_Abortion access, geen boeken._

**#74 HRW · 7d**
Missed Opportunity on Tanzania Election Violence.
_Verkiezingsgeweld, geen boeken._

**#7 Index on Censorship · 10d**
From Belarus to Gaza we continue to bear witness to the unprecedented attacks on journalists globally.
_Persvrijheid op WPFD — niet specifiek over boeken._

**#45 Index on Censorship · 4d**
Imprisoned and critically ill Iranian Nobel prizewinner warned three years ago that prisons were set up to kill.
_Schrijver-mensenrechten — grensgeval._

**#58 Meduza · 6d**
Russian man sets himself on fire at war memorial on anniversary of Ukraine invasion, authorities suppress news of it.
_Onderdrukking nieuws — niet over boeken._

**#68 HRW · 5d**
EU: Protect Integrity of Anti-Deforestation Law.
_Milieuregelgeving — keyword "publish" geraakt waarschijnlijk._

**#53 Meduza · 4d**
GitHub access deteriorates in Russia as internet regulator denies blocking.
_Internet-censuur, geen boeken._

### Patronen die uit het oogpunt van schaal opvallen

- **De PEN-America-nonfiction-doubled-rapportage is 8× binnengekomen**
  (USA Today, The Hill, Houston Chronicle, Common Dreams,
  www.causes.com, Publishing Perspectives, SJO Daily, Yahoo).
  Allemaal afgewezen. De huidige `dedup_threshold = 0.85` cosine
  vangt deze paraphrased headlines duidelijk niet.
- **De Craig-Silvey-zaak is 3-4× binnengekomen** van regionale
  Australische bladen (Yass Tribune, Merimbula News Weekly,
  Australian Broadcasting, EducationHQ). Idem niet gededupliceerd.
- **HRW, Meduza, Article 19, IranWire** leveren samen 30/56 rejects
  (54%). De `keywordFilter` regex laat te veel door — "publish" in
  "EU anti-deforestation law", "ban" in "watches at meetings", etc.

### Open vragen

- Zijn de grensgevallen (#56 YaPlakal-website, #80 Poczobut-vrijlating,
  #45 Mohammadi-gezondheid) bewust geweigerd, of waren ze borderline?
  Voor classifier-training is dit verschil cruciaal.
- Zou je voor borderline-items een aparte status willen ("hold for
  review") of is de huidige binaire publish/reject voldoende?

---

## 4. Wat zou een pre-filter classifier moeten presteren

### Kostenmodel

Stel dat een pre-filter `K%` van items overslaat vóór de LLM-call. Bij
de huidige ~5.8 items/dag is dat operationeel niet relevant — de OpenAI
kosten zijn een paar dollarcent per dag. **De waarde van een classifier
zit hier niet in geld besparen maar in mentale ruis besparen** (geen
HRW/Meduza-rejects meer in het admin-scherm).

### Recall vs missed-good rekensom

Notatie: `p` = approve-rate, `r` = classifier-recall op de "publish"-klasse
(fractie échte publishables die de classifier láát passeren). Items per
dag die je mist:

```
missed_good_per_day = items_per_day × p × (1 − r)
```

Met huidige cijfers (5.8 items/dag, p ≈ 0.45):

| recall r | gemist per dag | gemist per maand |
|----------|----------------|------------------|
| 0.99     | 0.026          | 0.8              |
| 0.95     | 0.13           | 3.9              |
| 0.90     | 0.26           | 7.8              |
| 0.80     | 0.52           | 15.7             |

Praktisch: voor recall ≥ 0.95 mis je < 4 publishables per maand. Voor
0.90 mis je ~8 per maand op ~80 nieuwe publishables — 10% van wat je
anders zou gepubliceerd hebben. Dat is de prijs.

### Minimum-precisie voor "safe to auto-skip"

De andere kant: van de items die de classifier ALS reject markeert,
welk percentage zou je in werkelijkheid hebben gepubliceerd? Dat is
`1 − precision_on_reject`. Met huidige p ≈ 0.45:

- Precision_on_reject ≥ 0.98 → < 2% false-rejects → veilig.
- Precision_on_reject ≥ 0.95 → 5% false-rejects → operationeel
  acceptabel als je een review-tab houdt voor borderline cases.
- Precision_on_reject < 0.90 → te risicovol om volledig automatisch te
  draaien; bruikbaar als "suggested skip" UI.

### Hoeveel labels heb je nodig

Standaard heuristieken voor tekstclassificatie:

- **kNN over embeddings (cosine)**: ~50-100 voorbeelden per klasse om
  betekenisvol te zijn; ~200+ om stabiel te zijn. Werkt goed met de
  bestaande `text-embedding-3-small` embeddings (1536-d), die er al
  zitten.
- **Logistische regressie over embeddings**: 200-500 per klasse voor
  stabiele coëfficiënten; verbetert lang door tot ~1000+.
- **Fine-tuned model / GPT-as-classifier**: 50-200 voorbeelden zijn al
  bruikbaar als few-shot prompt; geen "training" in de klassieke zin.

### Huidige stand

```
positief (published): 48
negatief (rejected) : 56
```

Klassenbalans is gezond (~46/54). Voor een kNN-classifier zit je **net op
de ondergrens** van 50/klasse. Voor LR zit je nog ver onder. Praktisch:

- **Vandaag**: GPT-as-classifier met few-shot kan al, met 8-12 echte
  voorbeelden per klasse in de prompt.
- **Over 1 maand** (~150 extra items): kNN wordt betrouwbaar.
- **Over 3 maanden** (~500 extra items): LR over embeddings wordt
  stabiel.

### Aanbeveling

Niet op classifier wachten tot je 500 labels hebt — wel
labeling-infrastructuur (sectie 5/6 onder B) eerst opzetten zodat elke
volgende maand bruikbare data oplevert.

### Open vragen

- Is "miss 8 publishables per maand" acceptabel? Of moet recall ≥ 0.97?
- Wil je dat de classifier *categorieën* voorspelt (out-of-scope vs
  duplicate vs editorial decline) of alleen binaire skip/keep?
  Categorieën vergen aanzienlijk meer labels per klasse.

---

## 5. Schema-minimum vs optimum

Huidige situatie: `news_items` heeft `status text` met check-constraint
`{'draft','published','rejected'}` (baseline migration r. 445). Geen
reden, geen audit-velden, geen embedding-index buiten de feature-kolom
zelf.

### Optie a — MINIMUM: alleen labelen, geen classifier

Eén kolom toegevoegd aan `news_items`:

```sql
ALTER TABLE news_items
  ADD COLUMN rejection_reason text;
```

Of, als je vrije tekst wilt vermijden, een enum-achtige check:

```sql
ALTER TABLE news_items
  ADD COLUMN rejection_reason text
  CHECK (rejection_reason IS NULL OR rejection_reason IN
    ('out-of-scope', 'duplicate', 'editorial-decline', 'low-quality', 'other'));
```

**Voor**:
- Eén kolom, één migration, geen UI-herstructurering.
- Bestaande 56 rejects krijgen `NULL` — duidelijk onderscheid tussen
  pre-label en post-label tijdperken.
- Klaar voor handmatige analyse (`GROUP BY rejection_reason`) zonder
  meer infrastructuur.

**Tegen**:
- Geen `decided_at`, dus je weet niet wanneer een beslissing viel
  (alleen via `published_week` bij approval, niets bij reject).
- Geen `decided_by` — voor jou alleen als solo-beheerder geen probleem,
  maar als ooit een tweede editor komt, niet retrofittable zonder pijn.
- Vrijetekst kan rommelig worden; enum-check is rigide voor late
  bijschaving.

**Migratie-naam (Supabase CLI conventie, zie PROJECT_CONTEXT §13)**:
`supabase/migrations/YYYYMMDDHHMMSS_news_items_rejection_reason.sql`
(timestamp van moment-van-genereren via `supabase migration new`).

### Optie b — STRUCTUREEL: voorbereiden op pre-filter classifier

```sql
ALTER TABLE news_items
  ADD COLUMN decision text
    CHECK (decision IS NULL OR decision IN ('publish','reject','hold')),
  ADD COLUMN rejection_reason text
    CHECK (rejection_reason IS NULL OR rejection_reason IN
      ('out-of-scope', 'duplicate', 'editorial-decline', 'low-quality', 'other')),
  ADD COLUMN decided_at  timestamptz,
  ADD COLUMN decided_by  text;

-- pgvector kNN-index voor latere classifier
CREATE INDEX news_items_embedding_ivfflat
  ON news_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Voor**:
- `decision` is een nieuwe dimensie naast `status`: een item kan
  bijvoorbeeld `decision='hold'` hebben zonder status te flippen.
  Geeft ruimte voor "borderline" categorie zonder de
  status-check-constraint te raken.
- `decided_at` ondersteunt latere "approve-time-to-decision" analyse.
- `decided_by` is forward-compat als je ooit een tweede beheerder
  invoegt (consistent met de bestaande `editorial_publish_log.admin_user`
  conventie genoemd in PROJECT_CONTEXT §13).
- ivfflat-index maakt kNN over `embedding` realtime mogelijk (huidige
  cosine-dedup is een full scan; dat schaalt nu prima maar niet bij
  10k+ items).

**Tegen**:
- Vier kolommen tegelijk = meer regressie-risico op de admin-API
  (`api/admin/news/route.ts` patch-handler moet alle vier zetten).
- `status` en `decision` deels overlappend kan verwarrend zijn — moet
  in code helder gedocumenteerd of `status` wordt afgeleid van
  `decision`.
- ivfflat-index op een tabel van 104 rijen is overkill maar
  kost ook niets; alleen relevant boven ~1000 rijen voor performance.

**Migratie-naam**:
`supabase/migrations/YYYYMMDDHHMMSS_news_items_decision_schema.sql` +
afzonderlijk
`supabase/migrations/YYYYMMDDHHMMSS_news_items_embedding_index.sql`
(splitsen omdat het index-toevoegsel los is van het schema-deel).

### Afweging

Optie a is een kleine investering die niet "verkeerd" kan zijn — je
verzamelt labels en kunt later optie b boven optie a stapelen zonder
data te verliezen. Optie b is een grotere commitment maar verlaagt
toekomstige migratie-kosten.

### Open vragen

- Wil je `rejection_reason` als enum (strict, hervormbaar via nieuwe
  migration) of als text (flexibel, riskeer rommel)?
- Is `decision='hold'` nuttig of voer je gewoon "later beslissen" in
  als gewoon-niet-klikken (current behaviour)?

---

## 6. UI-impact

Bestand: [src/app/admin/news/news-admin-client.tsx](../../src/app/admin/news/news-admin-client.tsx).

### Minimum (past bij schema-optie a)

Wat verandert:
- Dropdown of segmented control naast de bestaande Reject-knop met
  vaste reasons (out-of-scope / duplicate / editorial-decline /
  low-quality / other).
- Bij klik op Reject → PATCH naar `/api/admin/news` met
  `{ id, action: 'reject', reason: '<value>' }`.
- API-route schrijft `rejection_reason` mee.
- `reject_all` bulk-actie kan optioneel een default reason krijgen of
  uitgeschakeld worden ten gunste van per-item.
- Geen impact op fetch-news (cron-pad) of op het publieke `/news` (de
  RLS-policy reageert op `status`, niet op de nieuwe kolom).

Bouwtijd: **0.5-1 dag** inclusief migration + e2e check.

### Structureel (past bij schema-optie b)

Wat verandert, bovenop het minimum:
- Filter-tabs of zoekbalk op `decision` (pending / decided / hold).
- "Similar past rejections" preview naast nieuwe drafts — gebruikt de
  ivfflat-index om de 3 dichtstbijzijnde eerdere rejects te tonen met
  hun `rejection_reason`. Helpt menselijke triage én is meteen een
  voorvertoning van wat een kNN-classifier zou doen.
- Per-feed approve-percentage statbalk bovenaan (komt mooi naast de
  bestaande config-card).
- `decided_at` registreren voor latere analyse van triage-latency.

Bouwtijd: **2-3 dagen** inclusief migration, embedding-index opbouw,
similar-rejections fetcher, UI-componenten en tests.

### Open vragen

- Wil je voor de minimum-versie ook de bestaande 56 rejects retro-labelen
  via een aparte admin-screen, of accepteer je dat die `NULL` blijven
  (= "pre-label era")? Zie sectie 7.
- Past de huidige Tailwind-stijl van de news-admin-card bij een
  multi-select dropdown of moet er een nieuwe component (Popover /
  RadixUI) ingebracht worden?

---

## 7. Backfill-strategie voor de 56 bestaande rejects

### Optie a — Niets doen

56 rejects blijven `rejection_reason = NULL`. Alleen items vanaf nu krijgen labels.

- **Voor**: geen werk; geen risico op verkeerd retro-labelen.
- **Tegen**: classifier-training start een maand later (50/klasse is al
  marginaal; weggooien van 56 items duwt je verder weg van die
  ondergrens).

### Optie b — Eenmalige triage-sessie

Jij loopt de 56 rejects door in een minimal UI (lijst met titel,
summary, source, dropdown met de 5 redenen).

- **Voor**: classifier-training begint direct met ~50/klasse + reason-
  breakdown. Levert ook meteen inzicht in welke feeds welk soort ruis
  geven.
- **Tegen**: 56 items × ~30 sec elk ≈ 30 min werk. Plus mentale
  inconsistency: je labelt met de wijsheid-na-afloop, niet met de
  wijsheid-op-het-moment-van-rejecten.
- **Risico**: minimaal. Voor 80% van de items is de reden visueel
  duidelijk (HRW/Meduza = out-of-scope; PEN-doubled = duplicate;
  Craig-Silvey = duplicate). De grijze gevallen zijn ~10/56.

### Optie c — Auto-label op leeftijd

> 14 dagen oud en nooit gepubliceerd → `rejection_reason = 'skipped'`
(geen echte reden).

- **Voor**: geen handwerk.
- **Tegen**: in de huidige data is dit aantal **0** (de oudste rejected
  is < 18 dagen; alle 56 zijn binnen 14 dagen actief bekeken). Voor de
  toekomst is dit vooral een mechanisme om de gevreesde
  drafts-blijven-eeuwig-staan situatie op te ruimen — maar die situatie
  bestaat empirisch nog niet.
- **Risico**: vervuilt classifier-training met een synthetisch label
  dat geen editorial signaal draagt. Vooral gevaarlijk als
  draft-voorraad ooit ontstaat door bv. een vakantie.

### Aanbeveling

Optie **b** is veruit het verstandigst. 30 minuten eenmalig werk
genereert je eerste bruikbare reason-distributie. Optie c kan altijd
later als veiligheidsklep worden toegevoegd, maar nu niet nodig.

### Open vragen

- Heb je 30 minuten over om de 56 retro te labelen, of past dat beter
  in een vervolgsessie nadat de minimum-UI uit sectie 6 staat?
- Wil je dat de retro-labeled items een aparte vlag krijgen
  (`retro_labeled boolean`) zodat ze later eventueel uit
  classifier-training kunnen worden uitgesloten?

---

## 8. Risico's

### Drift in criteria

Naarmate je meer ervaring krijgt met welke items waardevol zijn,
verschuiven de impliciete criteria. Een kNN-classifier op oudere data
gaat dan systematisch verkeerd voorspellen op nieuwe data.
**Mitigatie**: `decided_at` mee opslaan (sectie 5 optie b) en periodiek
classifier hertrainen op een rolling window (bv. laatste 6 maanden).

### Eén beslisser

Jij bent de enige editor. Er is geen tweede paar ogen om je oordeel te
valideren, en geen mechanisme om "ik zou dit nu anders beslissen" terug
te annoteren. **Mitigatie**: voor borderline items een `decision='hold'`
optie (sectie 5b) en periodiek (per kwartaal?) je oude beslissingen
herzien.

### Auto-publish later aanzetten

Stel je flipt `news_config.auto_publish` ooit op true. Dan wordt
`status='published'` een mix van twee dingen: jouw expliciete editorial
keuze én items die de filters passeerden. Voor classifier-training
betekent dit dat "published" geen schoon positief label meer is.
**Mitigatie**: het bestaande `auto_published boolean` veld op
`news_items` is al de discriminator. Bij classifier-training filter je
op `auto_published = false` (alleen handmatig publicaties tellen als
echt positief). Documenteer dit expliciet.

### Reden-vocabulaire verandert

Als je over een half jaar besluit dat "duplicate" niet één klasse maar
twee is (exact-duplicate vs paraphrase-duplicate), dan moet je oude
labels herzien. **Mitigatie**: start met een grof vocabulaire (5
redenen, zie sectie 5) en accepteer dat hervorming via een nieuwe
migration normaal is — niet over-engineer'n met een hiërarchische
reasons-tabel zoals de bestaande `reasons` voor bans.

### Pre-filter raakt zwarte gaten

Als de classifier systematisch een bepaald onderwerp afwijst (bv.
"alles uit Iran is irrelevant"), gaan terechte items uit dat onderwerp
nooit meer langs jou. **Mitigatie**: behoud een review-tab waar
auto-rejected items voor X dagen zichtbaar blijven; spot-check
periodiek; geen feed/onderwerp permanent uitsluiten zonder rationale.

---

## Drie scopes — samenvatting

> Geen aanbeveling. Wel: per scope bouwtijd, vereiste labeled data, en
> wanneer de scope het meest geschikt is.

### A. Betere triage-UI (bulk-acties, snellere doorloop)

- **Bouwtijd**: 0.5-1 dag.
- **Labels nodig**: geen.
- **Wat krijg je**: bulk-publish, keyboard shortcuts, geconsolideerde
  preview, source-filter chips. Minder klikken per item.
- **Meest geschikt wanneer**: triage zelf de bottleneck is. Vandaag is
  dat niet aanwijsbaar — er staan 0 drafts open. Wint vooral als de
  feed-set wordt uitgebreid en de dagelijkse instroom > 20 items/dag
  gaat groeien.
- **Levert geen leerdata op**: hierna sta je nog op nul wat betreft
  reden-data voor C.

### B. Reject-mechanisme met reden

- **Bouwtijd**: 1 dag (schema-optie a + minimum-UI) tot 2-3 dagen
  (schema-optie b + structurele UI inclusief similar-rejections).
- **Labels nodig**: bouw de mechaniek; daarná accumuleer je labels.
  56 retro-labels via optie 7b is een halve dag werk.
- **Wat krijg je**: per-item reason; query-able rejection-redenen;
  zicht op feed-kwaliteit; **fundament voor C**.
- **Meest geschikt wanneer**: je nog niet zeker weet of een classifier
  meerwaarde heeft, en je eerst data wilt verzamelen voordat je
  beslist. Ook wanneer je editorial inzicht wilt los van automatisering
  (welke feeds aanhouden, welke schrappen).

### C. Pre-filter classifier (sla irrelevant items helemaal over)

- **Bouwtijd**: 2-4 dagen voor kNN over embeddings (kant-en-klare
  ivfflat-index + similarity query + threshold-tuning) tot 1-2 weken
  voor LR/fine-tune met evaluatieharnas, false-positive analyse en
  fallback-tab voor auto-skipped items.
- **Labels nodig**: nu **48 pos / 56 neg** = net op de kNN-ondergrens.
  Voor stabiel resultaat: ~150 per klasse (≈ 1 maand instroom) voor
  kNN; ~500 per klasse (≈ 3 maanden) voor logistische regressie. Een
  GPT-as-classifier met few-shot werkt vandaag al, maar voegt
  LLM-kosten in de hot-path toe.
- **Wat krijg je**: items die als "skip" bestempeld worden komen niet
  in admin (of komen in een aparte review-tab). Daadwerkelijke OpenAI-
  besparing is verwaarloosbaar; mentale last is de winst.
- **Meest geschikt wanneer**: B een paar maanden gedraaid heeft en je
  een statistisch verdedigbare reden-verdeling hebt. Of: nu meteen met
  GPT-few-shot als interim, op voorwaarde dat je accepteert dat het
  trainings-en-monitoringproces minder rigoureus is dan bij een
  expliciete classifier.

