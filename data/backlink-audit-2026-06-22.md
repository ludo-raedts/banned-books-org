# Backlink- & referral-inventaris — banned-books.org (2026-06-22)

Samengestelde discovery over vier bronnen. **Kernles: geen enkele bron is
compleet en ze overlappen nauwelijks.** Crawl-rapporten (GSC, Bing) en
real-traffic-referrers (Vercel) vinden grotendeels verschillende domeinen.

## Bron-dekking

| Bron | Type | Toegang | Vangst |
|------|------|---------|--------|
| Google Search Console | Crawl-backlinks | UI (geen links-API) | 14 links / 6 domeinen |
| Bing Webmaster | Crawl-backlinks | UI "Backlinks" (klassieke API leeg) | 12 pagina's / 4 domeinen |
| Vercel Web Analytics | Echte klik-referrers | UI Referrers | ~50 referrer-hosts (rijkste) |
| Cloudflare Web Analytics | Echte klik-referrers | Beacon (auto-injected) | Werkt (2.16k/Jun1-22) maar te grof |
| Cloudflare GraphQL | (referer) | API-token | n.v.t. — dimensie betaald-gated |
| Common Crawl | Crawl-index | CDX | 0 captures — site nog niet gecrawld |

Vercel = JS-beacon → alleen echte mensen (bots eruit), dus complementair aan de
crawl-bronnen, geen vervanging. Toont link-aanwezigheid op klikmoment, niet
dofollow/nofollow of slapende links.

**Cloudflare WA werkt wél** (beacon auto-geïnjecteerd aan de edge voor echte
browsers; onzichtbaar voor curl omdat CF bot-requests overslaat), maar de
Referers-lijst is **top-5 + 75% "direct"** en toont alleen zoekmachines — de
backlink-long-tail wordt weg-geaggregeerd. Vercel's granulaire lijst blijft de
betere referrer-bron. CF voegt voor backlink-discovery niets toe.

## Echte content-backlinks (de waardevolle vondsten)

Bron-kolom: G=GSC, B=Bing, V=Vercel (getal = Vercel-bezoekers/30d).

| Domein | Bronnen | Aard / betekenis |
|--------|---------|------------------|
| en.wikipedia.org | G, V(64) | **Grootste niet-search-bron.** Wikidata/Wikipedia-campagne landt |
| github.com | V(17) | **Dataset-deel-project** (campagne, bv. apd-core / Data Is Plural). GitHub = nofollow → geen SEO-equity, wel 17 echte referrals + discovery |
| einpresswire.com | V(5) | **Persbericht via EIN Presswire** — bron van Bing's PR-cluster |
| schoolbox.lauriston.vic.edu.au | V(3) | AU-school LMS — docent linkt (Tier-3 advocacy) |
| dallascollege.brightspace.com | V(2) | College-LMS/LibGuide |
| fairsharing.org | V(2) | **Dataset-campagneplaatsing — live + verkeer** |
| natlawreview.com | V(2) | National Law Review — redactionele bron |
| answers.lib.uchicago.edu | V(1) | **UChicago bibliotheek — LibGuide-play werkt** |
| zenodo.org | V(1) | Dataset-DOI-landing |
| medium.com | G, V(1) | Blogpost |
| mybib.com | V(1) | Citatie-generator — site wordt geciteerd |
| 2ip.io | G | Tech/IP-tool listing — verifiëren |
| raedts.net | G, V(1) | **Eigen domein** (self-placed) |

### PR-syndicatiecluster (van het zelf-verzonden EIN Presswire-bericht)
einpresswire.com (V5), prwireindia.com (B6), weeklyvoice.com (B3),
cbherald.com (B2), alamoana.net (B1), cw39.com (V1, Houston TV),
natlawreview.com (V2, National Law Review).
Eén zelf-verzonden persbericht, breed gesyndiceerd. Lage SEO-waarde, maar
bewust — geen spam. Natlawreview/cw39 zijn overnames, geen eigen redactie.

## Social / community (meestal nofollow, wel discovery)
linkedin.com (V8 + G2), reddit.com (G8, V3 + out./old.reddit), m.facebook.com (3),
facebook.com (1), youtube.com (1).

## AI-assistenten (gewenst per discoverability-strategie)
chatgpt.com (50), copilot.microsoft.com (4), notebooklm.google.com (1),
chatopens.net (1).

## Zoekmachines (organisch, geen backlinks — context)
google.com (707), duckduckgo.com (225), bing.com (169), yahoo (div. landen),
ecosia.org (31), yandex (27 + ru/tr), qwant.com (8), search.brave.com (2),
oceanhero.today (1).

## Tooling/transactioneel (geen echte backlinks)
vercel.com, mail.google.com, checkout.stripe.com, statics.teams.cdn.office.net,
canva.com, get-qr.com, *.mcas.ms, manager.cloud.ipdgroup.com.

## Conclusies

1. **Vercel-referrers is de rijkste discovery-bron** hier — het toont de edu/
   bibliotheek- en campagneplaatsingen die de crawl-rapporten (GSC/Bing) nog
   niet hebben geïndexeerd.
2. **Campagne landt aantoonbaar**: Wikipedia (64!), fairsharing.org, zenodo.org
   drijven echt verkeer. Tier-3 advocacy werkt (UChicago, Dallas College,
   Lauriston-school).
3. **Zelf-verzonden EIN-persbericht verklaart de hele PR-cluster** — Bing's
   4 domeinen + cw39.com (Houston) + natlawreview.com. Bewuste distributie,
   geen scraper-overname; geen onafhankelijke redactionele dekking.
4. **Common Crawl heeft de site nog niet** → autoriteit nog laag, maar de
   inkomende links beginnen te komen.

## Open verificaties
- github.com-bron(nen) identificeren.
- Per content-backlink: anchor + dofollow/nofollow (Wikipedia/fairsharing/
  natlawreview/UChicago vooral).
- 2ip.io-listing beoordelen (kwaliteit vs. ruis).
