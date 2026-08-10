# Bookshop redirect-target audit — 2026-07-03

Read-only. HEAD `/a/123844/{bookshop_isbn13 ?? isbn13}` → 308 Location product-slug, vergeleken met onze titel via titlesMatch (strict) / head-variant (loose). Aanleiding: desc-websearch-pilot 2026-07-03 vond deep links naar compleet andere werken.

Gecheckt: **150** van 5194 bookshop_status='valid' links (checkpoint: `data/bookshop-redirect-audit-checkpoint.jsonl`).

| bucket | n | betekenis |
|---|---|---|
| match | 140 | titel + auteur in slug — OK |
| match, auteur niet in slug | 5 | zelfde titel, andere naam — mogelijk bewerking/companion, steekproef |
| head-only match | 0 | alleen titel-kop matcht (subtitel ontbreekt op Bookshop) — meestal OK |
| **mismatch, auteur niet in slug** | **1** | **waarschijnlijk compleet ander werk (Buscaglia-klasse)** |
| mismatch, auteur wél in slug | 4 | waarschijnlijk vertaalde editie of ander werk van dezelfde auteur |
| gone (404) | 0 | status-drift sinds laatste probe-sweep |
| no_slug | 0 | redirect zonder parseerbare product-slug |
| unverifiable | 0 | geen Latijnse titel-tokens om te vergelijken |
| error | 0 | transient; volgende run opnieuw geprobeerd |

## Mismatch (5) — reviewen, daarna remediëren

Fix-pad na review: `npx tsx --env-file=.env.local scripts/remediate-bookshop-editions.ts --audit=data/bookshop-redirect-audit-2026-07-03.json --book-ids=<bevestigde ids> --apply` — herleidt een correcte Engelse papieren editie via het OL-werk, of demoteert naar de storefront-fallback (xref NULL + `bookshop_status='not_found'`). Niets applyen zonder deze review.

De kolom "geverifieerd ≥02-07" markeert rijen waarvan bookshop_checked_at ná 2026-07-02T12:00:00Z ligt: die zijn in de affiliate-sessie al page-verified of bewust gedemoveerd — lagere prioriteit. Ongeverifieerde rijen staan bovenaan.

### Auteur NIET in slug (1) — waarschijnlijk ander werk, hoogste prioriteit

| id | book | auteur | link-ISBN | redirect-slug | geverifieerd ≥02-07 | voorstel |
|---|---|---|---|---|---|---|
| 104 | [To Live](https://banned-books.org/books/to-live-yu-hua) | Yu Hua | 9780449901816 (xref) | [living-loving-and-learning-leo-f-buscaglia](https://bookshop.org/p/books/living-loving-and-learning-leo-f-buscaglia/9780449901816?ean=9780449901816) | — | remediate: OL-editie herleiden, anders xref NULLen + not_found |

### Auteur wél in slug (4) — vertaalde editie / ander werk zelfde auteur

| id | book | auteur | link-ISBN | redirect-slug | geverifieerd ≥02-07 | voorstel |
|---|---|---|---|---|---|---|
| 12 | [Brave New World](https://banned-books.org/books/brave-new-world) | Aldous Huxley | 9786074536782 (xref) | [un-mundo-feliz-aldous-huxley](https://bookshop.org/p/books/un-mundo-feliz-aldous-huxley/9786074536782?ean=9786074536782) | — | remediate: OL-editie herleiden, anders xref NULLen + not_found |
| 33 | [Harry Potter and the Philosopher's Stone](https://banned-books.org/books/harry-potter-philosophers-stone) | J.K. Rowling | 9781781103685 (xref) | [harry-potter-e-a-pedra-filosofal-j-k-rowling](https://bookshop.org/p/books/harry-potter-e-a-pedra-filosofal-j-k-rowling/9781781103685?ean=9781781103685) | — | remediate: OL-editie herleiden, anders xref NULLen + not_found |
| 57 | [The Master and Margarita](https://banned-books.org/books/the-master-and-margarita) | Mikhail Bulgakov | 9781482625196 (xref) | [el-maestro-y-margarita-mijail-bulgakov](https://bookshop.org/p/books/el-maestro-y-margarita-mijail-bulgakov/9781482625196?ean=9781482625196) | — | remediate: OL-editie herleiden, anders xref NULLen + not_found |
| 92 | [The Stranger](https://banned-books.org/books/the-stranger) | Albert Camus | 9782070360024 (xref) | [etranger-albert-camus](https://bookshop.org/p/books/etranger-albert-camus/9782070360024?ean=9782070360024) | — | remediate: OL-editie herleiden, anders xref NULLen + not_found |

## Head-only match (0) — subtitel wijkt af, steekproef volstaat

| id | book | auteur in slug? | link-ISBN | redirect-slug |
|---|---|---|---|---|

## Match (145)

140 met auteur-bevestiging in de slug — niet gelist (volledige lijst in het checkpoint-JSONL).

### Match zonder auteur in slug (5) — bewerkingen/companions?

Zelfde titel maar géén auteurstoken in de slug — vangt o.a. toneelbewerkingen (The Grapes of Wrath → Frank Galati) en study guides.

| id | book | auteur | link-ISBN | redirect-slug |
|---|---|---|---|---|
| 52 | [Ulysses](https://banned-books.org/books/ulysses) | James Joyce | 9781515398790 (xref) | [ulysses-color-illustrated-formatted-for-e-readers](https://bookshop.org/p/books/ulysses-color-illustrated-formatted-for-e-readers/9781515398790?ean=9781515398790) |
| 128 | [The Things They Carried](https://banned-books.org/books/the-things-they-carried) | Tim O'Brien | 9781604138733 | [the-things-they-carried-sterling-professor-of-humanities-harold-bloom](https://bookshop.org/p/books/the-things-they-carried-sterling-professor-of-humanities-harold-bloom/9781604138733?ean=9781604138733) |
| 159 | [The Iron Heel](https://banned-books.org/books/the-iron-heel) | Jack London | 9781984034533 (xref) | [the-iron-heel](https://bookshop.org/p/books/the-iron-heel/9781984034533?ean=9781984034533) |
| 164 | [Shanghai Baby](https://banned-books.org/books/shanghai-baby) | Wei Hui | 9798623493958 | [shanghai-baby-the-adventures-of-an-american-girl-from-the-far-east-to-](https://bookshop.org/p/books/shanghai-baby-the-adventures-of-an-american-girl-from-the-far-east-to-the-midwest/9798623493958?ean=9798623493958) |
| 165 | [Mao: The Unknown Story](https://banned-books.org/books/mao-the-unknown-story) | Jung Chang | 9780679746324 (xref) | [mao-the-unknown-story-jon-halliday](https://bookshop.org/p/books/mao-the-unknown-story-jon-halliday/9780679746324?ean=9780679746324) |
