# Berlin match-before-create DRY-RUN — 2026-06-17 (READ-ONLY, no writes)

Seed: `data/berlin-verbannte-1938-2026-06-17.json` · tested 3606 of 3606 rows · matcher: `matchExistingBook` (verifier.ts).

| Outcome | Rows |
|---|---|
| **matched existing** | **58** (exact 56, fuzzy 2) |
| would-create new | 3548 |
| of matches: likely via English-title tier | 0 |

## Matches via the English-title (cross-language) tier — SPOT-CHECK THESE
These are where dedup depends on the Wikidata English title. A wrong English
title (e.g. the ~6 known false positives) causes a WRONG merge here.

| src# | German title | English title | → matched book (id) | status | conf |
|---|---|---|---|---|---|

## All other matches (German slug / fuzzy)

| src# | German title | → matched book (id) | status | conf |
|---|---|---|---|---|
| 187 | Voici Adolf Hitler | Voici Adolf Hitler (#15232) | exact | 1 |
| 235 | Rayons et ombres d'Allemagne | Rayons et ombres d’Allemagne (#14753) | exact | 1 |
| 315 | Hitler en Espagne | Hitler en Espagne (#15202) | exact | 1 |
| 322 | Chantage á la guerre | Chantage à la guerre (#15227) | exact | 1 |
| 461 | Süd-Ost-Europa | Süd-Ost-Europa (#14805) | exact | 1 |
| 513 | Stalin | Stalin (#10548) | exact | 1 |
| 700 | Wir im fernen Vaterland geboren ... | Wir im fernen Vaterland geboren (#15009) | exact | 1 |
| 780 | Notre défense nationale intégrale | Notre défense nationale intégrale (#15304) | exact | 1 |
| 839 | Ahasver | Ahasver (#10270) | fuzzy | 1 |
| 972 | Civitavecchia, ein Friedhof der Lebenden | Civitavecchia, ein Friedhof der Lebenden (#15133) | exact | 1 |
| 1119 | Blut und Ehre | Blut und Ehre (#15172) | exact | 1 |
| 1304 | Securité d'abord | Sécurité d’abord (#15098) | exact | 1 |
| 1321 | Al Capone | Al Capone (#4089) | exact | 1 |
| 1354 | Zuidersee | Zuidersee (#14903) | exact | 1 |
| 1403 | Au nom de la loi | Au nom de la loi (#15076) | exact | 1 |
| 1671 | Les Dictateurs | Les dictateurs (#14414) | exact | 1 |
| 1675 | Le Danger allemand | Le danger allemand (#14590) | exact | 1 |
| 1721 | Das grosse Los im Spiegel der Statistik und Zahlen-Analyse | Das grosse Los im Spiegel der Statistik und Zahlen-Analyse (#14680) | exact | 1 |
| 1726 | Die Judenfrage der Gegenwart | Die Judenfrage der Gegenwart (#14870) | exact | 1 |
| 1958 | Le fléau de l'Europe | Le fléau de l’Europe (#14940) | exact | 1 |
| 2010 | Hanussen | Hanussen (#14727) | exact | 1 |
| 2151 | La Crise morale du temps présent et l'éducation humaine | La crise morale du temps présent et l’éducation humaine (#14950) | exact | 1 |
| 2227 | Police politique hitlérienne | Police politique hitlérienne (#14795) | exact | 1 |
| 2313 | Opium | Opium (#7451) | exact | 1 |
| 2364 | Là-bas dans les geôles | Là-bas dans les geôles. (#14982) | exact | 1 |
| 2423 | Griff über die Grenze | Griff über die Grenze (#14541) | exact | 1 |
| 2427 | Spanien | Spanien (#14514) | exact | 1 |
| 2807 | Hitlers motorisierte Stossarmee | Hitlers motorisierte Stossarmee (#15020) | exact | 1 |
| 2843 | Idoles allemandes | Idoles allemandes (#14809) | exact | 1 |
| 2962 | Alte und neue Prophezeiungen über den Weltkrieg der Zukunft | Alte und neue Prophezeiungen über den Weltkrieg der Zukunft (#14679) | exact | 1 |
| 3053 | Hitler | Hitler (#13676) | exact | 1 |
| 3151 | Einstein | Einstein (#14626) | exact | 1 |
| 3302 | Auf zum Kampf gegen die Kriegs-Hetzer! | Auf zum Kampf gegen die Kriegs-Hetzer ! (#14463) | exact | 1 |
| 3420 | Lenin | Lenin (#10720) | exact | 1 |
| 3440 | Der Zusammenstoss zweier Welten in Spanien | Der Zusammenstoss zweier Welten in Spanien (#14491) | exact | 1 |
| 3452 | Die Glocken von Basel | Die Glocken von Basel (#14404) | exact | 1 |
| 3459 | Assassins! Une documentation sur l'avènement de Hitler | Assassins ! Une documentation sur l’avènement de Hitler. (#14687) | exact | 1 |
| 3476 | Halte-la! | Halte-là (#14565) | exact | 1 |
| 3514 | All quiet in Germany | All quiet in Germany (#14484) | exact | 1 |
| 3610 | Sous la vague hitlérienne | Sous la vague hitlérienne (#14430) | exact | 1 |
| 3676 | L'Allemagne de Hitler | L’Allemagne d’Hitler. (#15054) | fuzzy | 0.869565 |
| 3704 | Englands Schatten über Europa | Englands schatten über Europa (#14542) | exact | 1 |
| 3974 | Die gute Ehe | Die gute Ehe (#15199) | exact | 1 |
| 4215 | L'évangile de la force | L’Évangile de la force (#14787) | exact | 1 |
| 4497 | Français, voici la guerre! | Français, voici la guerre. (#14860) | exact | 1 |
| 4555 | L'Allemagne fera-t-elle sombrer l'Europe? | L’Allemagne fera-t-elle sombrer l’Europe ? (#15254) | exact | 1 |
| 4700 | Les Allemands dans nos maisons | Les Allemands dans nos maisons. (#15091) | exact | 1 |
| 4825 | Die geistige Situation der Deutschen | Die geistige Situation der Deutschen (#14960) | exact | 1 |
| 4877 | Karl Marx | Karl Marx (#13952) | exact | 1 |
| 4967 | Le triomphe du germanisme | Le triomphe du germanisme (#14502) | exact | 1 |
| 5009 | Le vrai combat d'Hitler | Le vrai « Combat » d’Hitler (#14668) | exact | 1 |
| 5068 | En l'an III de la croix gammée | En l’an III de la croix gammée. (#14554) | exact | 1 |
| 5082 | L'opéra politique | L’Opéra politique (#15070) | exact | 1 |
| 5152 | Le temps du mépris | Le temps du mépris (#14970) | exact | 1 |
| 5246 | Hitler gegen Christus | Hitler gegen Christus (#15005) | exact | 1 |
| 5445 | La vie de famille | La vie de famille (#15131) | exact | 1 |
| 5468 | Auf der Flucht erschossen | Auf der Flucht erschossen (#14690) | exact | 1 |
| 5485 | Ein Staat stirbt. Österreich 1934—38 | Ein Staat stirbt, Österreich 1934-38 (#15293) | exact | 1 |

> READ-ONLY measurement. No rows written. Decide blanket/authorless handling
> and clean the false-positive English titles before any real import.
