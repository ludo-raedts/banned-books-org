# Backlink- & citatie-inventaris — banned-books.org (2026-10-23)

Vervolg op `backlink-audit-2026-06-22.md`. Vraag: linken er meer sites naar ons
en/of gebruiken ze ons als bron? **Antwoord: ja, duidelijk meer, en vooral
"als bron" — in redactionele stukken, LibGuides/LMS-opdrachten, forums, een
Soviet-geschiedenissite en citatie-generators.** Common Crawl heeft de site
nog steeds niet (0 captures in CC-MAIN-2026-26/33/38).

## Bronnen deze ronde

| Bron | Methode | Vangst |
|------|---------|--------|
| Eigen `pageviews.referrer_host` (90 d, 21 jul–23 okt, 77.367 pv) | psql | ~95 referrer-hosts — **rijkste bron, vervangt Vercel-UI** |
| Wikimedia `exturlusage` (23 wiki's) | API | en 4, pt 1, he 1, Wikidata 1 |
| Firecrawl search `"banned-books.org"` (6 varianten) + curl-verificatie van 71 kandidaten | CLI | 24 pagina's met echte link/citatie naar óns |
| GitHub code search | `gh api` | 11 hits (awesome-lists + mirrors, dataportals-registry, daily-website-launches) |
| Hacker News (Algolia) | API | 0 |
| Bluesky public search API | — | 403 vanaf hier; go.bsky.app-referrers tonen het wél |
| GSC Links / Bing Backlinks | UI-only | **niet gecheckt** (login nodig) |

Valse positieven: **`banned-books.org.uk`** (UK-bibliotheekcampagne 2011,
nog live) wordt door Wikipedia *Book censorship*, bn.wikipedia, marefa.org,
Dansk PEN, Goodreads-topics, StoryGraph en ~8 oude blogs gelinkt — dat zijn
wij NIET. WebSearch-tool, DuckDuckGo-html en Bing-curl zijn onbruikbaar voor
exacte domein-zoekopdrachten; Firecrawl search werkt wel.

## A. Redactionele links & citaties (nieuw sinds juni, geverifieerd in HTML)

| Pagina | Wat | Link |
|--------|-----|------|
| pawins.org/news/bookbans (Pennsylvanians for Welcoming & Inclusive Schools) | Artikel gebouwd op ons persbericht (46 Nobel, 27 Pulitzer, 15.887 titels, 119 landen) | dofollow → / en /countries |
| theeducatorsroom.com "Before We Debate What Students Read…" | "banned by two Tennessee school districts" → /books/the-odyssey | dofollow |
| ncclinked.com (North Central College, 2026-10-02) | "according to banned-books.org" (J is for Justice) | dofollow |
| widenerblueroute.org (Widener Univ. literair tijdschrift) | bron-link naast oif.ala.org → /reading-club/young-readers/… | dofollow |
| xn--e1aaonfjem.com/books ("Секретно", Soviet-geschiedenis) | voetnoot [5] "Books banned in Soviet Union" → /countries/su | dofollow |
| rug.nl studentenblog Nederlands (RUG) | "Ga eens grasduinen op banned-books.org" | dofollow |
| tbrbooksofallon.com (2026-10-04) | "Banned-books.org points out the irony…" → /books/the-giver | dofollow |
| williamtucker.substack.com/p/concrete-rose (+ wtucker.edublogs.org) | neemt onze ban-kaart over, link /countries/us + /books/concrete-rose | dofollow |
| philgarber.medium.com | "Banned-Books.org reported that the US has the world's highest number…" | tekst-citaat, geen link |
| flipbook.so "The Censored Page Ep. 6" | APA-referentie "Banned Books. (n.d.). Fahrenheit 451. https://www.banned-books.org/books/fahrenheit-451" | tekst-citaat |
| publicdatasets.dev/social-sciences | awesome-public-datasets-mirror → /dataset | dofollow |
| en.wikipedia: List of books banned by governments, Banned Books Week, The Anarchist Cookbook, Pet (novel) | referentie/EL | nofollow (431 pv/90 d, 85 van 95 dagen; Anarchist Cookbook = 250 pv) |
| pt.wikipedia Lista de livros proibidos pelos governos; he.wikipedia טוני האגן | referentie | nofollow |
| GitHub: datenoio/dataportals-registry, WebsiteLaunches/daily-website-launches (2026-04-25), 3 awesome-list-mirrors | listings | nofollow |

## B. Community / UGC (geen equity, wel bewijs van "als bron gebruikt")

- **resetera.com** — 2 threads (okt 2026): gebruiker kalindana: *"I've been using this site as a key source because they cite everything"* (voor een Banned Books-display). 78 pv in 2 dagen.
- **forum.scope.org.uk** — October 2026 Book Club: Banned Books → /search (nofollow ugc), 21 pv.
- **forum.hebban.nl** (NL) — "staat bijna het hele oeuvre van Stephen King" (ugc).
- **goodreads.com** user-status → /books/like-a-love-story (ugc); 9 pv.
- **LinkedIn**: ISBNdb deelde het persbericht ("Book Bans: A Data Issue Across 119 Countries"); Karen Jackson (Warwick University Library) tagt Banned-Books.org bij hun Banned Books Week-display; Matthias Vanderaspoilden (HUMO) tagt ons bij een Kortrijk-event (HOWEST / Bibliotheek Kortrijk / Avansa).
- **Crunchbase** heeft een organisatieprofiel `banned-books-org` (link → banned-books.org).
- **forum.zwame.pt** (PT, 15 pv/1 dag, Handmaid's Tale), **dorinlazar.ro** (RO-blog, Goma/Cărtărescu/Müller, 18 pv), **wfmu.org** (Where the Wild Things Are), **bookcrossing.com** (41 pv, auteurspagina's), **bookstr.com**, **thenest.owlcrate.com** — referrers gezien, bronpagina niet gevonden via search.

## C. Onderwijs & citatie-tools (de sterkste "wordt als bron gebruikt"-laag)

Referrers 90 d, allemaal nieuw t.o.v. juni behalve Dallas College:

- **Documenten/LMS**: teams.public.onecdn.static.microsoft 232 pv (links gedeeld in MS Teams); *.officeapps.live.com ≈ 95 pv (links in Word/Excel/PowerPoint/OneNote-documenten = opdrachten/lesmateriaal); lernplattform.bycs.de 31 (BayernCloud Schule); digipad.app 21 (FR school-padlet); padlet 7; u46.instructure.com (School District U-46, IL), rutgers/sjsu.instructure.com, scad.blackboard.com, dallascollege.brightspace.com 11, online.bismarckstate.edu, learn.snhu.edu, mylearning.suny.edu, educat.nmu.edu, index-education.net (Pronote FR), ourspace.awp.nhs.uk.
- **Citatie-generators**: my.noodletools.com 9, citationmachine.net, citethisforme.com (+ mybib in juni) — studenten citeren de site formeel.
- **AI-assistenten**: chatgpt.com 281 (60 van 95 dagen), copilot.microsoft.com 63, perplexity.ai 12, claude.ai 5, poe 1 → ≈ 360 pv.

## D. Eigen kanalen (geen externe backlinks, wel verkeer)

go.bsky.app 388 + bsky.app 42 (dagelijkse bot; "What on Earth Is a Pangolin?" 62 pv), facebook-varianten ≈ 330, instagram ≈ 112, reddit ≈ 118, t.co 41, github 33, medium 13, zenodo 12, raedts.net, bookshop.org-lijst "The Most Banned Books in the World" (zelf samengesteld), blueskyfeeds.com (aggregator van onze posts), einpresswire/natlawreview (eigen persbericht).

## Verschil met juni 2026

| | juni | oktober |
|--|------|---------|
| Wikipedia-pagina's met link | 2 | 7 (en 4, pt, he, Wikidata) |
| Redactionele dofollow-pagina's | ~3 (uchicago, natlawreview, medium) | ≥ 11 |
| LMS/onderwijs-hosts | 3 | ≥ 16 |
| Citatie-tools | 1 | 4 |
| Forums die ons als bron noemen | 0 | 4 (resetera ×2, scope, hebban) |
| AI-referrals (90 d) | ~55 | ≈ 360 |

## Vervolgkansen (niet uitgevoerd)

1. **Dansk PEN** gebruikt in zijn #ForbudteBøger-2026 bronnenlijsten (okt 2026) het verouderde `banned-books.org.uk` als bron — pitch ons als vervangende bron.
2. **GSC Links + Bing Backlinks** handmatig nalopen (UI-only) voor de slapende links die geen verkeer geven.
3. Kort bedankje/verbinding met pawins.org, theeducatorsroom.com, Warwick University Library, Секретно — redactionele linkers die al bevestigd zijn.
