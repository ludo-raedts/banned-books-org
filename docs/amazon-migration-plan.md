# Plan: migratie Bookshop.org → Amazon Associates

**Status (2026-11-26): op pauze.** Bookshop.org antwoordde dat Stripe een Amerikaanse bank en factuuradres eist, maar dat ze het tegoed handmatig kunnen overmaken per wire zodra het boven $50 komt (nodig: rekeningnummer, routing number, BIC/SWIFT, valuta, factuuradres). Daarmee is migratie niet nodig. Tegoed op dat moment: $8,32, ongeveer $3 per maand, dus de $50-drempel duurt lang; bankkosten voor een internationale wire komen er nog bij. Heropen dit plan als de wire-optie niet werkt, de kosten te hoog blijken of we meer bereik willen dan Bookshop biedt.

Plan, niets uitgevoerd. Aanleiding: Bookshop.org betaalt alleen uit aan affiliates met een Amerikaans adres en bankrekening. Dit plan geldt alleen als Bookshop.org negatief antwoordt op onze mail. Amazon-tag: `banned-books.org-20`.

## Wat er nu is

- **Kern:** `src/lib/bookshop.ts` bouwt de links (`/a/123844/{isbn13}`, met een storefront-fallback). Alle knoppen gebruiken die module en `BOOKSHOP_REL`. Dat zijn boekpagina's, reading club, christmas, banned-books-week en auteurspagina's.
- **Curated lijsten + widgets:** `src/lib/bookshop-lists.ts` en `src/components/bookshop-list-embed.tsx`. Ze staan op reason-, scope- en country-pagina's en op `/get-banned-books`. Amazon heeft hier geen equivalent voor.
- **"Waarom geen Amazon"-teksten:** op meer plekken dan alleen de essaypagina:
  - de pagina `/why-not-amazon` zelf, plus `.md`-twin, essays-feed, `essays-data`, `llms.txt` en `markdown-twins`
  - privacy ("We do not link to Amazon, on principle", regels 68, 124 en 218)
  - about (+ markdown), press, `homepage-faq`, `country-faq`
  - footers op boek- en auteurspagina's en `/get-banned-books`
  - de sitemap en `docs/PROJECT_CONTEXT.md`
- **Scripts en data:** `probe-bookshop-isbn`, `export-bookshop-lists`, `audit/remediate-bookshop-*` en de kolommen `bookshop_status` en `bookshop_isbn13`.

## Stappen

### Stap 0: voorwaarden (handmatig, geen code)

- Check in Associates Central of `banned-books.org-20` actief is. Amazon sluit accounts zonder 3 gekwalificeerde verkopen binnen 180 dagen.
- Check welke marketplace erbij hoort (amazon.com?) en de uitbetaling naar een NL-bankrekening. Niet geverifieerd.
- Zet OneLink aan voor internationale bezoekers (UK/DE/etc.). Anders verdien je alleen op amazon.com-klikken.
- Controleer het huidige commissiepercentage voor boeken. Waarschijnlijk veel lager dan Bookshop's 10%; het gaat om bereik, niet om marge.

### Stap 1: Amazon-linkmodule

- Nieuwe `src/lib/amazon.ts` met `AMAZON_TAG` en `getAmazonUrl()`.
  - ISBN's die met 978 beginnen: ISBN-13 omzetten naar ISBN-10, dan `https://www.amazon.com/dp/{isbn10}?tag=banned-books.org-20`.
  - 979 of ontbrekende ISBN's: `/s?k={isbn13 of titel}&tag=…`.
- Geen probe-stap nodig en geen nieuwe DB-kolom; wel een fallback naar zoeken.
- Behoud `rel="sponsored nofollow noopener noreferrer"`.
- Voeg de verplichte disclosure toe: "As an Amazon Associate I earn from qualifying purchases."

### Stap 2: knoppen omzetten

- Vervang op boekpagina, reading club (card + detail), christmas, banned-books-week en auteurspagina de Bookshop-knop door "Buy on Amazon".
- Behoud het analytics-event, maar hernoem naar een neutrale naam met een `retailer`-property, zodat Bookshop en Amazon vergelijkbaar blijven.
- Pas de PEN-kalender (ISBN 9780789349293) aan en update de adminlink in `admin-dashboard-client.tsx` naar Associates Central.

### Stap 3: lijsten en widgets vervangen

- Voorstel: vervang de Bookshop-widgets door een eigen "Top N uit onze catalogus"-blok op reason-, scope- en country-pagina's, met Amazon-links. Gebruikt bestaande data en is beter voor SEO dan een iframe.
- Alternatief: de lijsten gewoon weghalen.
- Op `/get-banned-books` de featured- en lijst-secties herschrijven.
- `bookshop-list-embed.tsx` kan weg, evenals het privacyblok over de widgets.

### Stap 4: "Waarom geen Amazon" weg

- `/why-not-amazon` met een 301 doorsturen naar `/about`, zodat backlinks blijven werken (alternatief: 410).
- Verwijderen uit essays-feed, `essays-data`, `llms.txt`, `markdown-twins` en de sitemap.
- Alle zinnen herschrijven in about, press, privacy, FAQ's en footers.
  - Privacy en about moeten Amazon als affiliate benoemen (wettelijk en contractueel vereist).
  - Houd de formulering eerlijk; wek niet de indruk dat het nooit een principe was.
- De andere essays noemen Amazon alleen als context ("is on Amazon…"); die hoeven niet te veranderen.

### Stap 5: opruimen en vastleggen

- Bookshop-scripts verwijderen of naar `scripts/archive/` verplaatsen; `scripts/README.md` bijwerken.
- Kolommen `bookshop_*` mogen blijven staan; droppen kan later via een migratie.
- Docs en geheugen bijwerken ("Affiliate sales layer", "Bookshop account issue").
- `scripts/audit-integrity.ts` moet exit 0 geven.

## Later, optioneel: meerdere winkels (OneLink)

Niet nodig voor de eerste versie. Start alleen met amazon.com en de tag `banned-books.org-20`; bezoekers uit andere landen kunnen nog steeds klikken en kopen, maar leveren dan geen commissie op.

**Hoe OneLink werkt**
- We linken altijd naar amazon.com met onze tag. Een JavaScript-snippet van Amazon bepaalt het land van de bezoeker en herschrijft de links in de browser naar de lokale winkel (amazon.co.uk, amazon.de, …), met onze tag voor die winkel.
- Instellen in Associates Central: Tools → OneLink. Daar koppel je de tags per winkel en kopieer je de snippet.

**Wat het kost**
- Per winkel(groep) een aparte aanmelding, tag, uitbetaling, drempel en belastingformulier. Voor zover bekend geldt één Europees account voor UK/DE/FR/IT/ES, dus waarschijnlijk 2–3 aanmeldingen (VS, Europa, eventueel Canada). Verifiëren in Associates Central. Of amazon.nl via OneLink kan, is onbekend.
- Het werkt het best met `/dp/{ASIN}`-links. Een ISBN-10 is meestal, maar niet altijd, in elke winkel hetzelfde product; zoeklinks vallen soms terug op een generiek resultaat.
- Privacy: de snippet laadt externe JavaScript van Amazon. Dat botst met "no advertising trackers" in de privacytekst en kan toestemming vereisen (GDPR). Meenemen in stap 4.
- Alternatief zonder Amazon-script: zelf het land bepalen via Cloudflare/Vercel geo-headers en per land de juiste link met de juiste tag bouwen. Privacyvriendelijker, maar de tags per winkel zijn nog steeds nodig.

**Verkeer per land (laatste 3 maanden, geschat uit analytics-screenshot, 2026-11-25)**

| Land | Aandeel | Bezoekers | Paginaweergaven |
|---|---|---|---|
| Verenigde Staten | 43% | 30K | 96K |
| Mexico | 7% | 5K | 6,9K |
| Verenigd Koninkrijk | 6% | 4,2K | 21K |
| India | 5% | 3,7K | 17K |
| Canada | 4% | 2,8K | 13K |
| Duitsland | 4% | 2,6K | 14K |
| Frankrijk | 3% | 2K | 10K |
| Nederland | 2% | 1,6K | 9K |
| Australië | 2% | 1,4K | 8,2K |
| Brazilië | 2% | 1,2K | 3,8K |
| Zweden | 2% | 1,1K | 5,3K |
| Noorwegen | 1% | 803 | 5,2K |
| Pakistan | 1% | 558 | 2,3K |
| Italië | 1% | 528 | 3,3K |
| België | 1% | 485 | 2,7K |

**Wat dit betekent**
- amazon.com dekt maar 43% van het verkeer. Meer dan de helft van de bezoekers is niet-Amerikaans, dus de eerdere aanname "vooral Amerikaans" klopt maar half.
- Eerste kandidaat voor een tweede stap: de Europese groep (UK 6% + DE 4% + FR 3% + IT 1% ≈ 14%), via één Europees account als dat klopt. Daarna Canada (4%) en eventueel Australië (2%).
- Mexico (7%) en India (5%) zijn groot, maar hebben aparte Amazon-winkels/programma's en waarschijnlijk lage koopkracht per bezoeker. Pas overwegen als de eerste stappen werken.
- Nederland, Zweden, Noorwegen en België zijn klein; of ze via een Associates-programma gedekt kunnen worden, is niet geverifieerd.

**Beslismoment**
- Start met alleen amazon.com. Kijk na enkele weken naar de klikken per land (het analytics-event krijgt een `retailer`-property, eventueel aan te vullen met land) en meld je alleen aan voor een extra winkel als het verkeer uit dat land het rechtvaardigt.

## Aandachtspunten

- **Bookshop-saldo:** $8,32 staat open en kan niet worden opgenomen. Wacht op hun antwoord voordat het account wordt losgelaten.
- **Social posts:** `docs/drafts/christmas-social/` bevat Bookshop-links; na de migratie de Amazon-links gebruiken.
- **Timing:** de christmas-pagina is net live. Beslis je vóór half december, doe dan eerst stap 1 en 2 en de rest later.
- **Dataset/API/llms.txt:** Amazon verbiedt affiliate-links in bulk-exports en data-feeds. De Zenodo-export en andere dumps krijgen geen Amazon-links.
- **Minimale versie:** stap 1–3 volstaan voor een werkende Amazon-variant. Stap 4 raakt ongeveer 12 bestanden en kan pas als de linkmodule staat.
