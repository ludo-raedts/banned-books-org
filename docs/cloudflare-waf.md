# Cloudflare WAF & bot-defense — operationele documentatie

> Wat er in de Cloudflare custom-WAF staat, waarom, en hoe je het meet en
> terugdraait. Aanleiding: het CN/HK-botnet-incident van juli 2026 (zie §3).
> Zusterdocument van [gsc-ops.md](gsc-ops.md).
>
> Beheer: **uitsluitend via de API** (token in `.env.local`:
> `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID`). Bot Fight Mode staat
> bewust UIT (challengde legitieme search/AI-bots, zie memory
> cloudflare-botfight-seo-diagnosis).
>
> Laatst bijgewerkt: 2026-07-07.

## 1. Actuele regelset (phase `http_request_firewall_custom`)

Ruleset-id: `9c3ac2cfe19d42f18322daaedac7ef49`. Regels in evaluatievolgorde:

| # | Action | Expression (kern) | Waarom |
|---|--------|-------------------|--------|
| 1 | `block` | `http.user_agent eq ""` | Lege UA = nooit een echte browser. Vervangt Bot Fight Mode. |
| 2 | `block` | UA contains TikTokSpider / Bytespider / Amazonbot / CCBot / GPTBot / ClaudeBot / Google-Extended / meta-externalagent / Applebot-Extended | Handhaaft robots.txt `ai-train=no` tegen crawlers die zich er niet aan houden. **Search-AI (OAI-SearchBot, ChatGPT-User, PerplexityBot e.d.) staat hier bewust NIET in** — AI-verwijsverkeer is gewenst. |
| 3 | `managed_challenge` | `ip.geoip.country eq "SG" and not cf.client.bot` | Tencent-Cloud datacenter-swarm die /books crawlde en de DB overbelastte (2026-06-16). |
| 4 | `block` | `ip.geoip.country in {"CN" "HK"} and not cf.client.bot` | Residential scraper-botnet, juli 2026 — zie §3. Rule-id `f09e5357d8c64efdbaa3db5ac66ae0d3`. |

`not cf.client.bot` in regel 3+4 = **geverifieerde crawlers zijn altijd
uitgezonderd** (Googlebot, Bingbot, Baiduspider, Sogou, DuckDuckBot, search-AI
bots). Daardoor hebben deze geo-regels geen SEO-effect; Googlebot crawlt
bovendien nooit vanaf CN/SG-IP's.

## 2. Doctrine

- **AI-verkeer is welkom** (search-AI én referrals); alleen expliciete
  training-crawlers die robots.txt negeren worden geblokkeerd (regel 2).
- **Geo-regels altijd met `not cf.client.bot`**, anders breek je indexering.
- **Rate-limits zijn zinloos tegen residential botnets** (duizenden IP's ×
  1-2 requests); een top-IP-lijst laat zo'n botnet per definitie niet zien.
- Escalatieladder voor een nieuwe swarm: `managed_challenge` → interactive
  `challenge` (Turnstile) → `block`. Professionele farms met echte
  Chrome-instanties + solver-diensten halen de eerste twee (empirisch
  bewezen, zie §3); reken er dus niet op dat een challenge het einde is.
- Elke wijziging direct meten via GraphQL (§4) — niet op Vercel Analytics
  wachten.

## 3. Incident: CN/HK residential scraper-botnet (juli 2026)

**Symptoom.** Vercel Analytics toonde PRC 855 + HK 191 "visitors"/7d (64% van
al het verkeer), HK exact 1,00 pv/bezoeker. Aanvankelijk aangezien voor een
Chinese-lezers-UX-probleem (hoge bounce op Chinese literatuur).

**Diagnose (2026-07-07).** Geen mensen maar een botnet:

- Landing pages = honderden ultra-obscure long-tail author/book-pagina's met
  elk exact 1-2 bezoeken, nul concentratie op Chinese content
  (`/countries/cn`: 2 bezoeken). Referrers vrijwel volledig leeg.
- CF GraphQL: 5-8k req/dag uit CN sinds 2026-07-01 met **vlakke UA-rotatie
  over Chrome 142-150, ~50/50 macOS/Windows, 98% desktop** — synthetisch.
  Echt Chinees verkeer is overwegend mobiel.
- Het botnet draait echte Chrome-instanties en voert JS uit — dáárom telde
  Vercel Analytics (client-side snippet) het als bezoekers. De eigen
  server-side tracker (`pageviews`-tabel, zie §5) liet al die tijd het echte
  beeld zien: ~3 CN-bezoekers/week.

**Escalatie (alle drie de treden doorlopen op 2026-07-07):**

| Tijd (Z) | Actie | Resultaat |
|---|---|---|
| 05:53 | `managed_challenge` op CN+HK | Farm loste de non-interactive check op: 352 content-200's vs 42×403 in het eerste uur. |
| 06:55 | Interactive `challenge` (Turnstile-scherm) | Farm loste ook Turnstile op: 352×200 vs 24×403 per 30 min om 08:30Z. |
| 08:32 | **`block`** | Effectief — een block valt niet op te lossen. |

**Afweging bij het block.** Echt CN/HK-publiek was ~3 bezoekers/week; wie in
China over verboden boeken leest zit realistisch achter een VPN (exit-land ≠
CN) en valt buiten de regel. Baiduspider blijft uitgezonderd, dus een
eventuele Baidu-indexering loopt door. **Heroverwegen** zodra echt Chinees
verkeer waardevol wordt (bv. als Chinese titels via zoekmachines verkeer
gaan trekken — zie het zh-findability-spoor).

**Nevenschade van het onderzoek (blijvend nuttig):** title_native-dekking
CN-boeken 31/58 → 43/58 (hand-grounded, `scripts/apply-manual-native-titles.ts`),
authors.name_native 0/50 → 42/50, Chinese titels op `/countries/cn`-kaarten en
in `<title>`/meta-description. Baidu Webmaster-registratie onderzocht en
afgewezen (SMS-wall, non-ICP-indexatie ~0, query-censuur op deze niche).

## 4. Meten & terugdraaien

Alle voorbeelden lezen `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` uit
`.env.local`. Free-plan-limieten: GraphQL max **1 dag** per query; velden
`clientAsn`, `clientASNDescription`, `botManagementDecision` en
`firewallEventsAdaptive*` zijn **niet** beschikbaar.

Regels bekijken:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/9c3ac2cfe19d42f18322daaedac7ef49" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result.rules[] | {id, action, description}'
```

Effect meten (statuscodes per land, ≤24h-venster) — let op: een
challenge-flow genereert zelf ook 200's op `/cdn-cgi/challenge-platform/*`,
filter die eruit voordat je "de challenge werkt niet" concludeert:

```graphql
query ($zone: String!, $since: Time!, $until: Time!) {
  viewer { zones(filter: {zoneTag: $zone}) {
    httpRequestsAdaptiveGroups(
      filter: {datetime_geq: $since, datetime_lt: $until, clientCountryName_in: ["CN","HK"]}
      limit: 100, orderBy: [count_DESC]
    ) { count dimensions { clientCountryName edgeResponseStatus datetimeHour clientRequestPath } }
  } }
}
```

Terugdraaien of de-escaleren (action: `block` → `managed_challenge`, of regel
weg met DELETE):

```bash
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/9c3ac2cfe19d42f18322daaedac7ef49/rules/f09e5357d8c64efdbaa3db5ac66ae0d3" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"action":"managed_challenge","expression":"(ip.geoip.country in {\"CN\" \"HK\"} and not cf.client.bot)","description":"...","enabled":true}'
```

## 5. Welke analytics-bron vertelt de waarheid?

| Bron | Telt | Botgevoeligheid |
|---|---|---|
| **Eigen `pageviews`-tabel** (admin → Stats "Traffic") | Client-beacon `/api/pageview`, alleen book/author-detailpagina's, vuurt ná React-hydration | **Meest betrouwbaar voor échte bezoekers**: eist `Accept-Language` + browser-headers (`looksLikeBrowser`) + UA-blocklist — dit botnet haalde geen van drie. |
| Vercel Analytics | Elke JS-executie van het snippet, alle pagina's | Telt elke bot die JS uitvoert als bezoeker; het botnet stond er 7 dagen in als "64% van het verkeer". |
| Cloudflare (GraphQL / admin-kaart "Cloudflare — 24h") | Alle edge-requests | Alles inclusief bots en assets; goed voor volume/attack-forensiek, niet voor publieksmeting. |

Vuistregel: **publieksvragen beantwoord je met de eigen tracker; bot- en
volumevragen met CF GraphQL; Vercel Analytics alleen met deze kanttekening
lezen.**
