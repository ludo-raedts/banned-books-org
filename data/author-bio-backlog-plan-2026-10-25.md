# Plan: de 520 auteurs met ≥3 verboden boeken en geen bio (2026-10-25)

Uit de site-audit van 25 oktober (§3). Stand: 13.343 auteurs, 3.790 met bio (28%).
Van de auteurs zonder bio hebben er **520** drie of meer verboden titels — samen 2.253
boeken. Hun pagina's zijn sinds vandaag alleen voor Google `noindex`; Bing en de rest
indexeren ze gewoon, dus elke bio die erbij komt is direct zichtbaar in 56% van het
verkeer én maakt de pagina voor Google indexeerbaar.

Ruwe lijst (id, slug, naam, foto, wikidata, boeken, views 90d, landen):
`scratchpad/authors-no-bio-522.txt` van deze sessie; opnieuw te genereren met de query
onderaan.

## Wat de lijst zegt

| Segment | Aantal | Kenmerk |
|---|---:|---|
| Met verkeer (≥5 views/90d) | 16 | hua-situ 46, jose-vilhena 39, wei-wei 20, zhiying-li 15, lenine 12, shannon-watters 11, samira-ahmed 8, nora-sakavic 7, sam-moussavi 6, alex-sanchez 6, ibram-x-kendi 6, lisa-greenwald 6, yun-chen 5, lyla-lee 5, joelle-charbonneau 5, elena-armas 5 |
| Met Wikidata-id maar geen bio | 2 | alex-sanchez Q3610720, ibram-x-kendi Q31213305 → bio-pipeline heeft ze gemist |
| Met foto maar geen bio | ~60 | foto-pipeline vond ze wél; bio-bron ontbrak (vaak Chinese/Portugese namen) |
| HK/MY/CN-import (Chinese namen, Latijns getranslitereerd) | ~35 | hua-situ, zhiying-li, wei-wei, yun-chen, dan-wang, shuzhuang-chen … — Wikipedia-NL/EN kent ze niet; zh.wikipedia/Baidu Baike wél |
| PT-Estado-Novo-import | ~25 | jose-vilhena, tomas-da-fonseca … — pt.wikipedia dekt de meesten |
| FR Liste Otto / DE 1938 | ~40 | siegfried-lichtenstaedter, victor-noack … — de.wikipedia dekt een deel |
| US PEN-auteurs (YA/kinderboeken) | ~300 | shannon-watters, sam-moussavi, lyla-lee, andres-miedoso … — geen Wikipedia-artikel; wél uitgeverspagina's en eigen sites |
| Pseudo-auteurs | enkele | "Jehovah's Witnesses (Watch Tower Society)" → registreren in `organization-authors.ts` (Organization-node, geen bio nodig) |
| Split-auteur | 1 | `lenine` (15 boeken, FR/PT) naast `lenin` (34, met bio) en `vladimir-lenin` (6) → mergen + alias-rijen |

Opvallend: `original_language` is bij 516 van de 520 leeg. De naam-ladder voor niet-Latijnse
bio-bronnen (`project_author_multilingualism`) kan daardoor niet kiezen welke Wikipedia
te raadplegen.

## Aanpak in vier stappen (geen sprint, gewoon volgorde)

1. **Zekere winst, één dag.**
   - Merge `lenine` → `lenin` (alias-rij + ban-overdracht; `scripts/merge-*`-doctrine).
   - `jehovahs-witnesses-watch-tower-society` → `ORGANIZATION_AUTHOR_SLUGS`.
   - Herdraai `enrich-author-bios.ts` gericht (`--ids-file`) op de 2 Wikidata-dragers en de
     ~60 foto-dragers: daar is de identiteit al vastgesteld, alleen de bio-stap faalde.
   Verwachting: ~40–60 bio's.

2. **Taal vastzetten, dan Wikipedia per taal.**
   - Zet `original_language` per auteur af van de ban-landen (HK/CN/MY-Chinees → zh,
     PT → pt, FR → fr, DE → de, AR → es) via een kleine backfill met review-bestand.
   - Laat `enrich-author-bios.ts` daarna per taal zoeken (zh/pt/fr/de.wikipedia, Wikidata
     sitelinks) en vertaal gevonden bio's naar het Engels met bronvermelding
     (`bio_source_type='wikipedia_<lang>'`). Dit is de bestaande pijplijn met een
     taalparameter, geen nieuwe code van betekenis.
   Verwachting: ~80–120 bio's (HK/PT/FR/DE-segmenten).

3. **US-PEN-auteurs zonder Wikipedia (~300).**
   - Hier bestaat geen encyclopedische bron; wel uitgeverspagina's (Scholastic, Penguin,
     Macmillan), eigen auteurssites en Bookshop-auteurspagina's. Gebruik de
     websearch-pijplijn (`enrich-descriptions-websearch.ts`-patroon: Gemini-grounded
     zoeken → extract → gpt-4o-mini judge+groom) met een **bio-prompt**: 2–3 zinnen,
     alleen feiten die op de bronpagina staan, altijd `bio_source_url`.
   - Review-gate zoals bij de foto's: eerst 30 stuks dry-run, montage/steekproef lezen,
     dan pas de rest (lessen uit `feedback_llm_verdict_sample_before_apply`).
   Verwachting: ~150–200 bio's.

4. **Rest = handwerk of laten.**
   - Wat overblijft (~100) zijn obscure pamflettisten en pseudoniemen. Die pagina's blijven
     `noindex` voor Google; voor Bing zijn ze nu al vindbaar. Niet forceren.

## Meten

- `audit-integrity.ts` (bio-coverage komt als drift-metric mee).
- Herhaal de query hieronder; doel na stap 1–3: 520 → <200.
- Google: `gsc-index-check.ts` neemt 12 willekeurige auteurs mee; na 8 weken zien we of
  bio-dragende pagina's wel geïndexeerd raken.

## Query

```sql
with x as (
  select a.id, a.slug, a.display_name, a.original_language,
         a.photo_url is not null photo, a.wikidata_id,
         count(distinct ba.book_id) books,
         (select count(*) from pageviews p
           where p.entity_type='author' and p.entity_id=a.id
             and p.viewed_at > now() - interval '90 days') pv90,
         (select string_agg(distinct b.country_code, ',')
            from book_authors ba2 join bans b on b.book_id = ba2.book_id
           where ba2.author_id = a.id) countries
  from authors a join book_authors ba on ba.author_id = a.id
  where (a.bio is null or trim(a.bio) = '') and coalesce(a.is_placeholder, false) = false
  group by a.id having count(distinct ba.book_id) >= 3)
select * from x order by pv90 desc, books desc;
```
