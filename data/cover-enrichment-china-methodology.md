# Cover-enrichment voor Chineestalige boeken — methodology

Geschreven 2026-05-28 na de cover-gap-audit (4585 boeken zonder cover, waarvan 1921 Chineestalig).

## De doelgroep

| Bron-lijst | Boeken | Talen | Aard |
|---|---:|---|---|
| Malaysia KDN (Senarai Larangan) | 2812 | zh 1451 / ms 710 / ta 78 / null 573 | Mix van oude communistische, religieuze en politieke titels; vaak 1950s-90s PRC-druk, geen ISBN, geen jaar |
| Wikipedia: Book censorship in Hong Kong | 470 | zh ~470 | Modern (post-2020 NSL), HK/Taiwanese publishers, vaak te vinden op Bookzone / Joint Publishing / Books.com.tw |

De HK-set en de Maleisische zh-set zijn allebei Chineestalig maar verschillen sterk in vindbaarheid: HK-titels zijn modern en zitten op meerdere commerciële Chinese sites, KDN-titels zijn deels obscuur PRC-materiaal dat alleen in centrale catalogi staat.

## Wat we al hebben

- `GOOGLE_AI_API_KEY` in env, `@google/genai` als dependency, Gemini 2.5-flash al in gebruik voor de import-verifier
- `src/lib/enrich/mirror-image.ts` — download + magic-byte-check + upload naar Supabase storage bucket (`author-photos` nu). Het patroon is herbruikbaar voor een nieuwe `book-covers` bucket
- `isAllowedImageUrl` allowlist — buitenlandse hosts (douban.com, books.com.tw, hkpl.gov.hk) zitten er NIET in en gaan er ook NIET in. Alles wat we via een Chinese site vinden MOETEN we mirroren

## Drie kandidaten, in volgorde van mijn voorkeur

### 1. Gemini 2.5 + Google Search grounding (mijn voorkeur)

```
prompt = "Find the official book cover image URL for this banned book.
Title: {title} (also: {title_native})
Author: {author}
Year: {year}
Context: This book is on a Chinese-language banned-books list (Hong Kong NSL / Malaysia KDN).
Return JSON: { image_url, source_page_url, confidence: low|med|high, reasoning }.
If you cannot find a clear, attributable book cover image, return confidence='low' and a null image_url."
```

Pipeline per boek:
1. Gemini-call met `googleSearch` tool (één call, ~1-3s)
2. Verifier-pass: fetch het opgegeven `source_page_url`, controleer dat `image_url` ook werkelijk op die pagina staat (anti-hallucinatie)
3. Download `image_url` via `mirrorImageToStorage` (nieuwe `book-covers` bucket) — magic-byte check + size-bounds zit er al in
4. pHash-check tegen een kleine library van bekende Chinese-site-placeholders (Douban grey square, books.com.tw "geen cover" plaatje)
5. Write `cover_url` = Supabase storage public URL, `cover_status = 'valid'`, `cover_source = 'gemini-grounded'`

Voordelen:
- Geen scraping, geen captcha, geen proxy nodig
- Gemini disambigueert titels (essentieel — "Red Flag" matcht 50 boeken)
- Gemini-grounding mag van Google's ToS en geeft attribution-URL terug
- Eén pipeline werkt voor HK én KDN

Nadelen / risico's:
- **Hallucinatie**: LLM kan een plausibel-klinkende URL geven die niet bestaat of niet bij dit boek hoort. Verifier-pass (stap 2) vangt dit grotendeels op, maar niet 100%
- **Cost**: gemini-2.5-flash met grounding ~$0.002/call → 1921 × $0.002 = ~**$4** voor één pass. Met retries en verifier-call ~$10 totaal. Verwaarloosbaar
- **Geo-coverage**: Google Search indexeert Chinese sites slechter dan Baidu/Bing-CN. Verwacht 30-60% hit-rate op KDN (oudere PRC-titels), 60-80% op HK (moderne titels)
- **Copyright**: book covers zijn auteursrechtelijk beschermd; ons gebruik is editorial/critical commentary (sterke fair-use claim, NL/EU citaatrecht). Lager risico, niet nul

### 2. Hybrid: Gemini routeert naar gekozen bron + scraping fallback

Zelfde pipeline als optie 1, maar als Gemini niets vindt of low-confidence retourneert: direct scraping van een handvol Chinese sites in volgorde:
1. Douban Books (`search.douban.com/book/subject_search?search_text=...`) — hoogste dekking
2. Books.com.tw (Taiwan, modern) — voor HK-titels
3. CNKI / NLC catalog — voor oude PRC-titels

Scraping vereist:
- Roterende residential-proxy (Vercel-IP's worden door Douban geweigerd). Bv. Bright Data, Decodo (~$50-100/mo trial)
- Cookie + user-agent rotation
- Captcha-fallback (Douban triggert die snel) — manual review queue voor failures

Voordelen: significant hogere dekking voor de moeilijkere KDN-bucket.
Nadelen: 5× zoveel werk, juridisch grijzer (Douban ToS verbiedt scraping expliciet), kost een proxy-abonnement, broze pipeline.

### 3. Pure scraping zonder LLM

Te broos, geen disambiguation, lage waarde. Niet aanbevolen.

## Mijn voorstel — concrete eerste stap

Begin met **optie 1, pilot op 50 boeken**:
- 25 HK-titels (gemakkelijker, valideert dat de pipeline überhaupt werkt)
- 25 KDN-zh-titels (representatief voor het moeilijke deel)

Bouw:
- `src/lib/enrich/gemini-cover-search.ts` — wraps Gemini + grounding tool, returns `{ url, sourcePage, confidence }`
- `src/lib/enrich/verify-cover-on-page.ts` — fetch source page, scan voor img-tag met de claimed URL of een redirect daarvan
- Nieuwe Supabase bucket `book-covers` (publiek read, file_size_limit 5MB) — migration nodig
- Aanpassing `mirror-image.ts` om bucket param te accepteren, of een tweede `book-covers`-specific wrapper
- `scripts/enrich-covers-gemini-pilot.ts` — leest 50 specifieke book_ids, draait pipeline, schrijft naar `data/cover-gemini-pilot-results.md` voor mijn eyeball-review voor we apply doen

Beslismoment na de pilot: hit-rate, false-positive rate, en mijn visuele oordeel of de gevonden covers daadwerkelijk bij het boek horen. Als pilot goed gaat, breid uit. Als niet, dan weten we waarom en kunnen we gericht opties 2 of een ander idee proberen.

## Open vragen voor user

1. Akkoord dat we covers MIRROR naar Supabase (vs. linken naar bron)? Mirror = duurzaamheid + uniforme allowlist; downside = ~5KB-50KB per cover storage × 2000 boeken = ~50MB extra in Supabase, en wij worden de "host"
2. Akkoord dat we covers gebruiken onder editorial/citaatrecht zonder per-cover toestemming? (Standaard praktijk voor banned-book lijsten incl. PEN America en Wikipedia)
3. Wel of geen ChatGPT als 2e opinion-validatie? Kan helpen bij twijfelgevallen maar verdubbelt cost
