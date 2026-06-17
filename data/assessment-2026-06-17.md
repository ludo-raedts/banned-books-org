# Datakwaliteit-assessment — 2026-06-17 (Spoor B, read-only)

Verse meting van waar de kwaliteit nú staat. Alles read-only; geen data
gewijzigd. Volgt de B-stappen uit `data/briefing-2026-06-17.md`.

## B-1 — Integriteits-toets (`audit-integrity.ts`)

**Alle 6 invarianten houden (0 fouten).** Geen kapotte data: geen niet-allowlisted
image-hosts, geen U+FFFD, geen auteurloze boeken, geen bronloze bans, geen
onmogelijke jaren.

4 drift-WARNs vs (stale) baseline — alle verklaarbaar, géén regressie:

| metric | nu | baseline | duiding |
|---|---:|---:|---|
| book without description | 6739 | 1677 | description-wipe (2.283 gewist → eerlijke fallback) + stale baseline; matcht coverage-snapshot |
| book without cover | 6838 | 5890 | stale baseline; matcht snapshot (~6.853) |
| slug ≠ slugify | 784 | 354 | bewuste disambiguatie-slugs + alias-rijen (`forever-judy-blume`, `harry-potter-philosophers-stone`), geen bug |
| ban vóór publicatie | 784 | 748 | +36, klein; los na te kijken |

**Opruim-puntje (→ Spoor A-1):** `audit-integrity.ts` noemt in zijn "periodic deep
audits"-blok drie dupe-detectoren die niet (meer) bestaan: `_audit_split_authors.ts`,
`_audit_paren_suffix_dupes.ts`, `_audit_honorific_author_dupes.ts`. Alleen
`merge-*`-varianten + `_audit_cross_script_dupes.ts` bestaan. Stale referentie.

## B-2 — Dubbelen-sweep

| detector | uitkomst |
|---|---|
| `_audit_cross_script_dupes.ts` | 0 — geen detecteerbare cross-script auteur-twins |
| `merge-spanish-edition-dupes.ts` (dry) | alle curated pairs al toegepast (no-op) |
| `merge-paren-suffix-dupes.ts` (dry) | 145/145 al toegepast |
| `merge-honorific-author-dupes.ts` (dry) | 2/2 al toegepast |

De bekende/curated dupe-patronen zijn dus **volledig gemerged**. De open vraag was
*nieuwe* Spanish-edition dupes die de cross-script-detector mist. Daarvoor nieuwe
read-only detector geschreven: **`scripts/_audit_spanish_edition_dupes.ts`**.

Sleutel-precisiefilter: een echte Spanish-EDITION-rij draagt `original_language='en'`
(de importer stempelt de taal van het onderliggende Engelse *werk*), terwijl een
genuine foreign WORK `es`/`fr`/`it` draagt. Dat filter dropt het Liste-Otto Franse
batch + Spaanse/Italiaanse literaire catalogi die de losse titel-regex anders
binnenlaat (97 ruwe clusters → 19 na filter).

**8 bevestigde nieuwe Spanish-edition dupes** (DROP → KEEP):
- #8391 La Casa en Mango Street → #43 The House on Mango Street (Cisneros)
- #8605 El Sol Y Sus Flores → #246 The Sun and Her Flowers (Rupi Kaur)
- #7949 La carta de Ivy Aberdeen al mundo/… → #433 Ivy Aberdeen's Letter to the World (Blake)
- #2731 El Libro de la Familia/The Family Book → #407 The Family Book (Todd Parr)
- #18723 Esta bien ser diferente/… → #9645 It's Okay To Be Different (Todd Parr)
- #4997 La luna dentro de mí → #443 The Moon Within (Salazar)
- #5533 El Gusano de Tequila → #6014 The Tequila Worm (Canales)
- #18305 ↔ #18307 (zelfde bilingual boek "The Colors of Us", 2× ingevoerd; Karen Katz)

**5 te verifiëren vóór merge** (titel-vertaling bevestigen): #8231 (J. Andrews),
#18965 (Woodson — EN-canon "The Day You Begin" mogelijk afwezig in DB), #5525
(Shusterman "El abismo"), #4954 (Herman "El gris"), #17691 (Bell "La tormenta").

**6 bevestigd GEEN dupe** (heuristiek-vals): #5441 (auteur 455 = gecontamineerde
author-link, apart probleem), #6551 (Dumas Frans), #9928 (Engelse titel, regex-fout),
#5336 (distinct werk "¡Sí! somos Latinos"), #13989 (Lenin verzamelwerk), #17568
(canonieke Engelse titel "Niño Wrestles the World"), #18958 (Sotomayor ≠ Clemente).

→ Residu is klein: een **curated uitbreiding van `merge-spanish-edition-dupes.ts`**,
geen nieuwe pipeline. De diepere preventie hoort thuis in Spoor A-3 (match-before-create:
`original_language='en'` + Spaanse titel + bestaande zelfde-auteur Engelse rij = match,
niet create).

## B-3 — Score-data-quality (`score-data-quality.ts`, dry-run)

| bucket | nu (15864) | baseline 06-15 (15888) |
|---|---:|---:|
| confident | 5158 (32.5%) | 5151 (32.4%) |
| default | 8379 | 8410 |
| flagged | **2327** | **2327** |

Auteurs: confident 1486 / default 8026 / flagged 20.

**Stabiel, geen regressie.** −24 boeken = de cross-language merges van 06-16/17.
Opvallend: de description-wipe liet `flagged` níet groeien — gewiste ongegronde
descriptions werden eerlijke fallback i.p.v. de "AI-drafted without description"-flag.

## B-4 — SEO-hercheck (GSC)

**Striking-distance** (90d, ≥50 impr): 8 kandidaten, flat vs baseline 05-22 (ook 8).
Deenie domineert nog (12.539 impr, pos 7.3, CTR 0.1% — bekend CTR-probleem).

**Daily impressions (`gsc-diagnose`, alle queries):** een **scherpe, aanhoudende
collaps rond 6-7 juni 2026**:

```
... 05-30..06-05:  ~700–1900 impr/dag, 13–45 clicks/dag
06-06: 219   06-07: 54   06-08: 17   06-09: 23   06-10: 51
06-11: 38    06-12: 9    06-13: 21   06-14: 18   06-15: 18
```
Clicks: vorige 7d 14,1/dag → laatste 7d 0,4/dag (**−97%**). De daling start 8-9 dagen
vóór de 2-3-daagse GSC-frontier → **reëel, geen meet-artefact**.

**Technische oorzaak uitgesloten** (prod-checks als Googlebot):
- robots.txt: `User-agent: * / Content-Signal: search=yes / Allow: /` — search-crawling
  toegestaan; alleen AI-trainingsbots geblokkeerd (bewust).
- Boekpagina: 200 OK, `<meta robots="index, follow">`, geen noindex, geen X-Robots-Tag,
  geen Cloudflare-challenge voor Googlebot. Pagina's blijven indexeerbaar.

→ De collaps is **algoritmisch** (ranking-suppressie), geen crawl/index-blok.
**Nuance t.o.v. het geheugen-frame "mei core-update":** impressies waren gezond
(~800–1900/dag) tot en met 5 juni en stortten pas op 6-7 juni in. Dat wijst op een
Google-update/refresh rond 6 juni, niet (alleen) het mei-event. Lever blijft
content-kwaliteit + autoriteit, gerealiseerd bij de volgende refresh.

## B-5 — Vervolgacties (voorstel)

1. **Spanish-edition merge** — curated uitbreiding van `merge-spanish-edition-dupes.ts`
   met de 8 bevestigde pairs; de 5 onzekere eerst per-titel verifiëren. Klein, laag risico.
2. **Match-before-create (Spoor A-3)** — de `original_language='en'` + Spaanse-titel-regel
   als matcher in de gedeelde importer; dit is de échte preventie van deze dupe-klasse.
3. **A-1 opruimen** — stale detector-referenties in `audit-integrity.ts` corrigeren.
4. **SEO** — geen quick fix; monitoren tot volgende core-update-refresh. Verifiëren of
   de 6-juni-collaps samenvalt met een bekende Google-update (extern).
