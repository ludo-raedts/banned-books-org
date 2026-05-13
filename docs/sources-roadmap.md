# Sources roadmap — post-Sprint-A planning

> Stand: 2026-05-13. Eigenaar: Ludo Raedts.

## Doel van dit document

Dit document legt vast wélke bronnen we de komende maanden de database in willen brengen, in welke volgorde, en met welke ingest-strategie. Het is geen bibliografie — daarvoor zijn de drie research-bronnen in [`docs/research/`](research/) bedoeld:

- [`Bronnenlandschap voor verboden boeken in zeven rechtsgebieden.pdf`](research/Bronnenlandschap%20voor%20verboden%20boeken%20in%20zeven%20rechtsgebieden.pdf) — diepe verkenning van Rusland, China, Hongkong, Turkije, Marokko, Frankrijk en Spanje (Nederlandstalig).
- [`deep-research-report (11).md`](research/deep-research-report%20(11).md) — vrijwel identieke inhoud in markdown, makkelijker te citeren.
- [`compass_artifact_wf-…_text_markdown.md`](research/compass_artifact_wf-61e3ab9e-9975-4a05-8419-1602fe308b60_text_markdown.md) — bredere internationale verkenning (60+ jurisdicties) inclusief concrete titels per land en Wikipedia-startpunten.

De roadmap synthetiseert die drie en zet ze om in een werkbare planning. Bij twijfel is de research de bron, dit document de planning.

## Sprint A: Frankrijk eerst, bewust afwijkend van research-prioriteit

Het Bronnenlandschap-rapport noemt Rusland als hoogste-opbrengst startbron: één officiële federale lijst, direct doorzoekbaar, met honderden tot duizenden titels. Tóch is de keuze in Sprint A om met **Frankrijk** te beginnen. De motivering:

1. **Latin script.** Geen transliteratie-vraagstuk, geen non-Latin review-gate, geen risico op transliteratie-disagreement tussen de twee LLM-passes. Sprint 0.5 heeft de transliteratie-doctrine wel vastgelegd, maar de pipeline kan eerst rustig stabiliseren op één-talig Latin voor er een tweede script-conventie bijkomt.
2. **Eigen taalbeheersing.** Frans kan ik (Ludo) zelf controleren tegen de bron. Voor Russisch ben ik op de LLM-output aangewezen, en die wil ik pas vertrouwen als de pipeline op een talenvariant heeft bewezen dat ze betrouwbaar werkt.
3. **Drie validatie-boeken zijn al ingeladen.** *Suicide, mode d'emploi*, *Éden, Éden, Éden* en *La Question* zijn in Sprint 0.5 handmatig toegevoegd om de Model 3 rendering-doctrine te valideren. Een Frankrijk-batch sluit daar naadloos op aan: zelfde editor, zelfde scope, geen contextswitch.

Rusland verschuift daarmee niet naar achter — het wordt simpelweg de tweede ingest-cyclus, met de pipeline al gehard op Latin-volume.

## Strategisch doel

De database zo compleet mogelijk maken. Na Frankrijk willen we niet stoppen of lang pauzeren: zodra een bron klaar staat met geverifieerde bulk, wordt die ingeladen. Het doel is geen "perfecte editorial workflow" maar **doorzettend volume**: elke maand een nieuwe rechtsgebied erbij waar de bronkwaliteit het toestaat, met de review queue als kwaliteitsfilter in plaats van een wachtrij die altijd vol staat.

## Drie verdedigingslinies tegen de taalbarrière

Sprint A doet vier rechtsgebieden in Latin script (FR, ES, TR, DE/historisch). Daarna wordt taalbarrière een fundament-probleem: hoe vertrouw je een ban-titel in een script dat je niet leest? De aanpak rust op drie linies, die we als beleid voeren:

1. **Officiële overheidslijsten boven journalistiek waar mogelijk.** Wettelijke databanken (Legifrance, Rusland's federale lijst, BOE, Resmi Gazete) zijn zelf al gestructureerde brondata met een traceerbare juridische ankering. Wikipedia, NGO-rapporten en kwaliteitsmedia zijn aanvullingen voor metadata en context — niet primaire titelbronnen, behalve waar geen officiële lijst bestaat (Iran, Saudi-Arabië, post-2020 Hongkong).
2. **Two-LLM verificatie.** De pipeline draait elke extractie door Gemini 2.5 Pro én GPT-4o; bij disagreement op kritieke velden (titel, auteur, is_book) gaat de rij naar de review queue. Voor non-Latin scripts is de gate permanent dichtgezet (Sprint 0.5 doctrine): geen auto-import zolang de twee modellen het oneens zijn over de transliteratie. Dit vangt de meeste taalfouten zonder dat we ze met het oog hoeven te zien.
3. **Native-speaker reviewers op termijn.** Voor scripts waar two-LLM niet voldoende is — Arabisch, Han, mogelijk Devanagari — is uiteindelijk een editor met de taal nodig om de review queue af te werken. Hoe en wanneer is open. Mogelijke vormen: collega's met de taal als moedertaal, diaspora-communities zoals genoemd in de compass-research (The 88 Project voor Vietnam, RSF lokale correspondenten), of een betaalde freelance-pool. Dit is geen blocker voor de eerste vier Latin-talige rechtsgebieden.

## Status per rechtsgebied

De tabel geeft alleen de rechtsgebieden waar één van de drie research-documenten concreet materiaal voor aanlevert. "Ingeladen" is de huidige `bans`-telling per `country_code` op 2026-05-13 — een ondergrens, niet een doel. "In pipeline" markeert of er een bron-configuratie in `source-registry.ts` voor klaarstaat (op dit moment alleen `legifrance`, `france_archives`, `pen_america`, `manual` — geen daarvan is al productief gebruikt).

| Rechtsgebied | Onderzocht | In pipeline | Ingeladen | Bron in research/ |
|---|---|---|---|---|
| Frankrijk (FR) | ja | source-registry klaar | 20 | Bronnenlandschap PDF + compass (historisch) |
| Spanje (ES, modern + Franco) | ja | nee | 20 | Bronnenlandschap PDF + compass (Franco) |
| Spanje vroegmodern (Inquisition) | ja | nee | — (deels onder ES/VA) | Bronnenlandschap PDF (BNE-indexen) |
| Rusland (RU) | ja | nee | 30 | Bronnenlandschap PDF + compass (post-2012) |
| Sovjet-Unie (SU) | deels | nee | 25 | compass (Glavlit / Eastern Bloc) |
| China (CN) | ja | nee | 45 | Bronnenlandschap PDF + compass |
| Hongkong (HK) | ja | nee | 13 | Bronnenlandschap PDF + compass |
| Turkije (TR) | ja | nee | 12 | Bronnenlandschap PDF + compass |
| Marokko (MA) | ja | nee | 1 | Bronnenlandschap PDF |
| Nazi-Duitsland (DE, 1933–45) | ja | nee | 35 (alle DE) | compass (Wolfgang Herrmann / USHMM) |
| DDR (DD) | ja | nee | 4 | compass (HV Verlage) |
| Iran (IR) | ja | nee | 17 | compass (post-1979) |
| Egypte (EG) | ja | nee | 8 | compass + Arabische pers |
| Koeweit (KW) | ja | nee | 2 | compass (Gulf-state block) |
| India (IN) | ja | nee | 30 | compass (uitgebreid) |
| Pakistan (PK) | ja | nee | 9 | compass |
| Apartheid Zuid-Afrika (ZA) | ja | nee | 18 | compass (Publications Act 1974) |
| Vaticaan / Index Librorum (VA) | ja | nee | 35 | compass |

Voor de zeven Bronnenlandschap-jurisdicties ligt het bronwerk klaar; voor de elf compass-only entries is de research smaller (per-titel-lijsten ja, maar geen evaluatie van de officiële kanaal-kwaliteit). Dat verschil verklaart waarom de pipeline-volgorde primair de Bronnenlandschap-zeven volgt.

## Ingest-strategieën

Er zijn twee paden naast elkaar. Geen voorrang — welke past, bepaalt de bron.

**Pad 1: Pipeline.** Het volledige `src/lib/imports/`-traject uit Taak 3: fetcher → archiver → twee-pass LLM-extractie → verifier → gate → committer. Wordt gebruikt voor URL-gebaseerde bronnen waar de informatie in vrije tekst staat en LLM-extractie nodig is om gestructureerde rijen te produceren. Voorbeelden: Legifrance-besluiten, BOE-publicaties, FranceArchives finding aids, individuele Wikipedia-artikel-pagina's. Per URL één `import_jobs`-rij, retry-veilig per fase, audit-trail van beide modellen apart bewaard.

**Pad 2: Wikipedia-bulk-ingest.** De compass-research beveelt dit expliciet aan voor de cornerstone-pagina's (zie hieronder). Het gaat om Wikipedia-tabellen die al gestructureerd zijn met kolommen `Title / Author / Year / Notes`. Daar is geen LLM voor nodig — een parser die de wikitext leest en de rijen normaliseert is voldoende. Voordeel: snelheid, geen LLM-kosten, en geen taalbarrière voor de Engelstalige Wikipedia. Nadeel: kwaliteit varieert per pagina (`[citation needed]`-tags, semi-betrouwbare invoer) — een `unverified` flag op die rijen is essentieel om ze later te kunnen reviewen.

Beide paden zijn geldig en mogen parallel lopen. De pipeline wordt niet "verspild" op gestructureerde tabellen; de bulk-route wordt niet "te makkelijk" gevonden voor de eerste massa-import.

## Volgorde-voorstel post-Frankrijk

Onder voorbehoud van editorial bandwidth en native-speaker-beschikbaarheid voor de latere stappen, is de voorgestelde volgorde:

1. **Wikipedia-bulk-ingest van vier cornerstone-pagina's** uit de compass-aanbeveling: *List of books banned by governments*, *List of books banned in India*, *Index Librorum Prohibitorum*, *List of authors banned in Nazi Germany*. Levert ongeveer 1500 entries op dag één en heeft geen taalbarrière omdat de bron Engels is. Vergt het bouwen van een wiki-tabel-parser, niet meer.
2. **Rusland — federale lijst extremistische materialen (FSEM).** Hoogste volume per bron volgens het Bronnenlandschap-rapport. Vergt transliteratie (Cyrillic → BGN/PCGN per Sprint 0.5 doctrine) en zal de non-Latin review-queue workload meteen op gang brengen. Goede stress-test voor de twee-LLM gate.
3. **Spanje — BNE inquisitie-indexen plus franquistische expedientes via MetaPARES.** Latin script, bibliografisch sterke bronbasis, en het Franco-corpus heeft directe overlap met Latijns-Amerikaanse dictaturen die later aan de beurt komen (Pinochet's Chile, de Argentijnse Vuile Oorlog).
4. **Turkije — `muzır`-besluiten via Resmi Gazete plus Anayasa Mahkemesi-databank.** Latin script sinds 1928, juridisch concreet, en de officiële bronkanalen zijn relatief goed gestructureerd voor een niet-westerse jurisdictie.

Daarna verandert het beeld. Hongkong (gemengd Latin/Han, geen officiële masterlijst), Iran (geen publieke lijst, alle data via NGO's), China (industriële schaal maar bron-ondoorzichtig), en de Arabischtalige rechtsgebieden vragen alle drie native-speaker review. Welke van deze als eerste komt is afhankelijk van wie er beschikbaar is om de review-queue voor die taal af te werken. Dat is een keuze die op zijn vroegst tegen het einde van stap 4 hierboven gemaakt moet worden.

## Schema-evolutie (niet voor nu)

Niet relevant voor het direct uitvoeren van bovenstaande volgorde, wel om vast te leggen omdat alle drie de research-bronnen er onafhankelijk op uitkomen: het is op termijn nodig om naast `ban_sources.source_url` een aparte juridische ankerverwijzing per ban op te slaan — case-ID, court reference, statute citation, archief-locator. Het Bronnenlandschap-rapport noemt dit expliciet voor Frankrijk (Legifrance article-nummers), Rusland (114-FZ-verwijzingen) en Spanje (BOE-publicatie-IDs). De compass-research raadt in zijn schema-aanbeveling hetzelfde aan, in de vorm van *statute or order cited* als verplicht veld. De deep-research-rapportage formuleert het als een statuskolom plus "juridisch anker per titel".

Voorstel: dit pas verwerken wanneer de eerste echte non-Latin bron ingeladen wordt — daar is de juridische ankering het meest waardevol (transliteratie alleen is niet genoeg om de citatiekwaliteit te garanderen) en het is ook het moment waarop een schema-migratie sowieso minder bezwaarlijk is dan tijdens een Latin-batch-run.
