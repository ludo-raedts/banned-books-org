# Cross-language same-work dupes — 2026-08-25

Read-only worklist from `scripts/_audit_cross_language_dupes.ts` (author-sibling
method). NOTHING here is merged automatically: confirmed pairs are added as a
numbered case to `scripts/merge-cross-language-dupes.ts` and applied there.

- **STRONG** (5): title/TEM-identical after normalisation, no year conflict — merge candidates.
- **WEAK** (29): partial title overlap or year conflict — review per pair.
- **WARNING** (0): same subject, different work (title cites another author's work) — NEVER merge; see the Mein-Kampf-critique doctrine in merge-cross-language-dupes.ts Case D.

## STRONG (auto-merge candidates — still verify each pair)

- **Faustino Perez** (author #7388) — title near-identical spelling (edit distance 1)
  - KEEP #10592 "Untill She Screams" [untill-she-screams] lang=en tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - DROP #16265 "Until she screams" [until-she-screams] lang=fr tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Franz Spielhagen** (author #10519) — title near-identical spelling (edit distance 1); year match (1938 vs 1936)
  - KEEP #21774 "Spione und Verschwörer in Spanien" [spione-und-verschworer-in-spanien] lang=∅ tem=∅ yr=1936 isbn=∅ desc=∅ bans=1
  - DROP #15210 "Spione und Verschwœrer in Spanien" [spione-und-verschwoerer-in-spanien] lang=fr tem=∅ yr=1938 isbn=∅ desc=∅ bans=1
- **Ismail Kadare** (author #161) — title_english_meaningful match; year match (1965 vs 1965)
  - KEEP #7427 "Përbindëshi (The Monster)" [perbindeshi-the-monster-1965] lang=∅ tem="The Monster" yr=1965 isbn=y desc=∅ bans=1
  - DROP #7374 "Përbindëshi" [perbindeshi] lang=sq tem="The Monster" yr=1965 isbn=y desc=∅ bans=1
- **Marcus van Heller** (author #4590) — title near-identical spelling (edit distance 2)
  - KEEP #16257 "The Loins of Amon" [the-loins-of-amon] lang=fr tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - DROP #11923 "The Lions of Amon" [the-lions-of-amon] lang=en tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Peter Nicolas** (author #10343) — title near-identical spelling (edit distance 2); year match (1934 vs 1934)
  - KEEP #15034 "Acht Werktaetige vor Militaergericht" [acht-werktaetige-vor-militaergericht] lang=fr tem=∅ yr=1934 isbn=∅ desc=∅ bans=1
  - DROP #21173 "Acht Werktätige vor Militärgericht" [acht-werktatige-vor-militargericht] lang=∅ tem=∅ yr=1934 isbn=∅ desc=∅ bans=1

## WEAK (review only)

- **Alfred Rosenberg** (author #4812) — shorter title contained in longer; year match (1930 vs 1930)
  - #16468 "The Myth of the Twentieth Century" [the-myth-of-the-twentieth-century] lang=∅ tem=∅ yr=1930 isbn=y desc=y bans=1
  - #6656 "The Myth of the Twentieth Century (1934) On the Dark Men of Our Times" [the-myth-of-the-twentieth-century-1934-on-the-dark-men-of-our-times] lang=en tem=∅ yr=1930 isbn=∅ desc=y bans=1
- **Charles Silverstein** (author #4498) — shorter title contained in longer
  - #6423 "The Joy of Gay Sex" [the-joy-of-gay-sex] lang=en tem=∅ yr=1977 isbn=y desc=y bans=1
  - #6430 "The New Joy of Gay Sex" [the-new-joy-of-gay-sex] lang=de tem=∅ yr=∅ isbn=y desc=y bans=1
- **Elena Malisova** (author #4299) — token jaccard 0.67
  - #6243 "Summer in a Pioneer Tie" [summer-in-a-pioneer-tie] lang=ru tem=∅ yr=2021 isbn=∅ desc=y bans=1
  - #13449 "Summer in a Pioneer Scarf" [summer-in-a-pioneer-scarf] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Ezra de Richarnaud** (author #7412) — shorter title contained in longer
  - #10647 "The Small Rooms of Paris" [the-small-rooms-of-paris] lang=en tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #16264 "Small Rooms of Paris" [small-rooms-of-paris] lang=fr tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **F. Engels** (author #9991) — shorter title contained in longer; both original_language NULL (language unconfirmed)
  - #22631 "Cartas Sobre o Materialismo Histórico" [cartas-sobre-o-materialismo-historico] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #23299 "Sobre o Materialismo Histórico" [sobre-o-materialismo-historico] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Gabriel Jackson** (author #17498) — token jaccard 0.75; ⚠ differs only in volume/series tokens — likely SIBLING VOLUMES, not a dupe; both original_language NULL (language unconfirmed)
  - #23235 "República Espanhola e a Guerra Civil 1º" [republica-espanhola-e-a-guerra-civil-1] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #23236 "República Espanhola e a Guerra Civil 2º" [republica-espanhola-e-a-guerra-civil-2] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Gao Hua** (author #4304) — shorter title contained in longer
  - #6248 "How the Red Sun Rose" [how-the-red-sun-rose] lang=zh tem=∅ yr=2000 isbn=y desc=y bans=1
  - #6679 "How the Red Sun Rose: The Origins and Development of the Yan'an Rectification Movement, 1930-1945" [how-the-red-sun-rose-the-origins-and-development-of-the-yanan-rectification-movement-1930-1945] lang=en tem=∅ yr=∅ isbn=∅ desc=y bans=1
- **Georges Gurvitch** (author #16910) — token jaccard 0.60; ⚠ differs only in volume/series tokens — likely SIBLING VOLUMES, not a dupe; both original_language NULL (language unconfirmed)
  - #23196 "Proudhon e Marx I" [proudhon-e-marx-i] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #23197 "Proudhon e Marx II" [proudhon-e-marx-ii] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Grace Metalious** (author #436) — shorter title contained in longer
  - #606 "Peyton Place" [peyton-place] lang=en tem=∅ yr=1956 isbn=y desc=y bans=2
  - #23229 "Regresso a Peyton Place" [regresso-a-peyton-place] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Gustav Mayer** (author #7340) — shorter title contained in longer; both original_language NULL (language unconfirmed)
  - #22457 "Friedrich Engels" [friedrich-engels] lang=∅ tem=∅ yr=1934 isbn=y desc=y bans=1
  - #16510 "Friedrich Engels: A Biography" [friedrich-engels-a-biography] lang=∅ tem=∅ yr=∅ isbn=y desc=y bans=1
- **J. Felicidade Alves** (author #16881) — shorter title contained in longer; both original_language NULL (language unconfirmed)
  - #23148 "Pessoas Livres" [pessoas-livres] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #23316 "Também nós Queremos ser Pessoas Livres" [tambem-nos-queremos-ser-pessoas-livres] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Jean Lacouture** (author #17184) — shorter title contained in longer; both original_language NULL (language unconfirmed)
  - #22932 "Ho Chi Minh" [ho-chi-minh] lang=∅ tem=∅ yr=∅ isbn=∅ desc=y bans=1
  - #22933 "Ho Chi Minh/Habib Burguiba" [ho-chi-minh-habib-burguiba] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **John Milton** (author #4851) — shorter title contained in longer; year match (1667 vs 1667)
  - #6687 "Paradise Lost" [paradise-lost] lang=∅ tem=∅ yr=1667 isbn=y desc=y bans=3
  - #9410 "Paradise Lost and Paradise Regained" [paradise-lost-and-paradise-regained] lang=en tem=∅ yr=1667 isbn=y desc=y bans=1
- **Karl Dantz** (author #14766) — shorter title contained in longer; year match (1927 vs 1925)
  - #20532 "Geschichten aus »Peter Stoll«" [geschichten-aus-peter-stoll] lang=de tem=∅ yr=1927 isbn=∅ desc=∅ bans=1
  - #21522 "Peter Stoll" [peter-stoll] lang=∅ tem=∅ yr=1925 isbn=∅ desc=∅ bans=1
- **Karl Marx** (author #60) — shorter title contained in longer
  - #16502 "Theories of Surplus Value" [theories-of-surplus-value] lang=∅ tem=∅ yr=∅ isbn=y desc=y bans=1
  - #10581 "History of Theories of Surplus Value" [history-of-theories-of-surplus-value] lang=zh tem=∅ yr=∅ isbn=∅ desc=y bans=1
- **Karl Marx** (author #9373) — shorter title contained in longer; year match (1848 vs 1848)
  - #14036 "Manifiesto comunista" [manifiesto-comunista] lang=∅ tem=∅ yr=1848 isbn=y desc=y bans=1
  - #14037 "Manifiesto del partido comunista" [manifiesto-del-partido-comunista] lang=es tem=∅ yr=1848 isbn=y desc=y bans=1
- **Kusarnov, G.** (author #9332) — shorter title contained in longer
  - #13962 "El materialismo dialéctico y el concepto" [el-materialismo-dialectico-y-el-concepto] lang=es tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #13963 "Materialismo dialéctico" [materialismo-dialectico] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **L. Sttau Monteiro** (author #17083) — shorter title contained in longer
  - #22833 "A Estátua" [a-estatua] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #23137 "Peças Em Um Acto (Guerra Santa e a Estátua)" [pecas-em-um-acto-guerra-santa-e-a-estatua] lang=pt tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **L. Sttau Monteiro** (author #17083) — shorter title contained in longer
  - #22901 "A Guerra Santa" [a-guerra-santa] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #23137 "Peças Em Um Acto (Guerra Santa e a Estátua)" [pecas-em-um-acto-guerra-santa-e-a-estatua] lang=pt tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Marco Ferrarese** (author #8598) — shorter title contained in longer; year match (2013 vs 2013)
  - #13157 "Nazi Goreng: Young Malay, Fanatic, Skinheads" [nazi-goreng-young-malay-fanatic-skinheads] lang=en tem=∅ yr=2013 isbn=∅ desc=∅ bans=1
  - #13223 "Nazi Goreng" [nazi-goreng] lang=ms tem=∅ yr=2013 isbn=∅ desc=∅ bans=1
- **Marcus van Heller** (author #4590) — shorter title contained in longer
  - #16280 "The House of Borgia" [the-house-of-borgia] lang=fr tem=∅ yr=∅ isbn=y desc=y bans=1
  - #10635 "The House of Borgia Volumes l and ll" [the-house-of-borgia-volumes-l-and-ll] lang=en tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Perón, Juan Domingo** (author #9440) — shorter title contained in longer
  - #14117 "Habla Perón" [habla-peron] lang=∅ tem=∅ yr=1948 isbn=∅ desc=∅ bans=1
  - #14114 "El General Perón habla sobre la administración púlbica" [el-general-peron-habla-sobre-la-administracion-pulbica] lang=es tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Pham Doan Trang** (author #620) — token jaccard 0.67
  - #6373 "Politics of the police state" [politics-of-the-police-state] lang=en tem=∅ yr=∅ isbn=y desc=y bans=1
  - #1074 "Politics of a Police State" [politics-of-a-police-state] lang=vi tem=∅ yr=2021 isbn=y desc=y bans=1
- **Platanov, Konstantin** (author #9454) — token jaccard 0.60; ⚠ differs only in volume/series tokens — likely SIBLING VOLUMES, not a dupe; both original_language NULL (language unconfirmed)
  - #14144 "Psicología recreativa. Volumen II" [psicologia-recreativa-volumen-ii] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
  - #14145 "Psicología recreativa Volumen I" [psicologia-recreativa-volumen-i] lang=∅ tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Robert Desmond** (author #7715) — shorter title contained in longer
  - #16287 "Seeds of the Rainbow" [seeds-of-the-rainbow] lang=fr tem=∅ yr=∅ isbn=y desc=y bans=1
  - #11346 "Seeds of the Rainbow - Part 1 and 2" [seeds-of-the-rainbow-part-1-and-2] lang=en tem=∅ yr=∅ isbn=∅ desc=∅ bans=1
- **Robert Desmond** (author #7715) — shorter title contained in longer
  - #16287 "Seeds of the Rainbow" [seeds-of-the-rainbow] lang=fr tem=∅ yr=∅ isbn=y desc=y bans=1
  - #11376 "Seeds of the Rainbow I and Ii" [seeds-of-the-rainbow-i-and-ii] lang=en tem=∅ yr=∅ isbn=y desc=y bans=1
- **Sui Ishida** (author #1286) — shorter title contained in longer
  - #7232 "Tokyo Ghoul" [tokyo-ghoul] lang=en tem=∅ yr=2011 isbn=y desc=y bans=6
  - #13472 "Tokyo Ghoul: re" [tokyo-ghoul-re] lang=∅ tem=∅ yr=∅ isbn=y desc=y bans=1
- **Sui Ishida** (author #1286) — shorter title contained in longer
  - #7232 "Tokyo Ghoul" [tokyo-ghoul] lang=en tem=∅ yr=2011 isbn=y desc=y bans=6
  - #13473 "Tokyo Ghoul: zakki" [tokyo-ghoul-zakki] lang=∅ tem=∅ yr=∅ isbn=y desc=y bans=1
- **Vatsyayana** (author #11898) — title_english_meaningful near-match (jaccard ≥0.6)
  - #16620 "The Kama Sutra" [the-kama-sutra] lang=sa tem=∅ yr=∅ isbn=y desc=y bans=1
  - #22983 "O Kama Sutra" [o-kama-sutra] lang=∅ tem="Kama Sutra" yr=∅ isbn=y desc=∅ bans=1

## WARNING (same subject, DIFFERENT work — never merge)

_none_
