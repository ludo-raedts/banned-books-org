# Nazi / Holocaust-denial warning-tier candidates

Gegenereerd 2026-05-30T18:21:18Z. Scanned 13675 books with warning_level='none'. 26 candidate(s) flagged.

**Workflow**: review elke kandidaat in `/admin/books` → filter "Unclassified" → zoek op title / id → handmatig de juiste tier zetten in admin. Of: gebruik dezelfde pattern als `_apply_fr_nazi_warning_tiers.ts` voor een batch-update.

De detector kijkt naar drie soorten signalen:
1. Auteur op de curated lijst (Nazi-figuren, Holocaust-deniers, collaborators)
2. Titel-keywords (Mein Kampf, Aryan, "Protocols of...", "Holocaust + denial-frame")
3. Beschrijvings-keywords ("Holocaust denial", "Nazi ideologue", "Volksverhetzung", "Gayssot Act")

Score per candidate is een ruwe optelsom van signal-weights. Hogere score = sterker geval.

## Voorgestelde tier: extended (9)

| score | id | title | author | signals |
|---:|---:|---|---|---|
| 10 | 16468 | [The Myth of the Twentieth Century](/books/the-myth-of-the-twentieth-century) | Alfred Rosenberg | author:Alfred Rosenberg (NSDAP chief theorist); title:Rosenberg foundational |
| 5 | 14401 | [Hitler « Mein Kampf » par lui-même](/books/hitler-mein-kampf-par-lui-meme) | Chr Appuhn | title:Mein Kampf title |
| 5 | 14493 | [Adolf Hitler, ses aspirations, sa politique, sa propagande et les « Protocoles des sages de de Sion](/books/adolf-hitler-ses-aspirations-sa-politique-sa-propagande-et-les-protocoles-des-sages-de-de-sion) | R. Blank | title:antisemitic forgery |
| 5 | 14825 | [Adolf Hitlers Mein Kampf](/books/adolf-hitlers-mein-kampf) | Manuel Humbert | title:Mein Kampf title |
| 5 | 15016 | [Face à Hitler et à Mein Kampf](/books/face-a-hitler-et-a-mein-kampf) | Roger Morvilliers | title:Mein Kampf title |
| 5 | 16464 | [The SS Man and the Question of Blood](/books/the-ss-man-and-the-question-of-blood) | Heinrich Himmler | author:Heinrich Himmler (Reichsführer-SS) |
| 5 | 16465 | [Diaries of 1945](/books/diaries-of-1945) | Joseph Goebbels | author:Joseph Goebbels (Reich propaganda minister) |
| 5 | 16466 | [Michael: A German Destiny in Diary Form](/books/michael-a-german-destiny-in-diary-form) | Joseph Goebbels | author:Joseph Goebbels (Reich propaganda minister) |
| 5 | 16467 | [Memoirs](/books/memoirs) | Alfred Rosenberg | author:Alfred Rosenberg (NSDAP chief theorist) |

## Voorgestelde tier: context (17)

| score | id | title | author | signals |
|---:|---:|---|---|---|
| 3 | 16470 | [The International Jew](/books/the-international-jew) | Henry Ford | author:Henry Ford ("The International Jew" specifically) |
| 3 | 16474 | [The Myth of the Holocaust: The Truth About the Fate of the Jews in World War II](/books/the-myth-of-the-holocaust-the-truth-about-the-fate-of-the-jews-in-world-war-ii) | Jürgen Graf | author:Jürgen Graf (Holocaust denier) |
| 2 | 583 | [Oliver Twist](/books/oliver-twist) | Charles Dickens | desc: antisemitic content |
| 2 | 812 | [Lord Horror](/books/lord-horror) | David Britton | desc: antisemitic content |
| 2 | 1182 | [The Berlin Boxing Club](/books/the-berlin-boxing-club) | Robert Sharenow | desc: antisemitic content |
| 2 | 1336 | [The Fixer](/books/the-fixer) | Bernard Malamud | desc: antisemitic content |
| 2 | 3871 | [Origins of the Holocaust](/books/origins-of-the-holocaust) | David Downing | desc: antisemitic content |
| 2 | 4025 | [Towards Genocide](/books/towards-genocide) | David Downing | desc: antisemitic content |
| 2 | 6263 | [Jud Süß](/books/jew-suss-feuchtwanger) | Lion Feuchtwanger | desc: antisemitic content |
| 2 | 8275 | [The Seamstress: A Memoir of Survival](/books/the-seamstress-a-memoir-of-survival) | Sara Tuvel Bernstein | desc: antisemitic content |
| 2 | 8355 | [In the Neighborhood of True](/books/in-the-neighborhood-of-true) | Susan Kaplan Carlton | desc: antisemitic content |
| 2 | 14209 | [Serie La SS en acción: Por qué nos mienten los judíos; Los judíos; La SS europea;](/books/serie-la-ss-en-accion-por-que-nos-mienten-los-judios-los-judios-la-ss-europea) | _(anon)_ | desc: antisemitic content |
| 2 | 15129 | [Apocalypse de notre temps](/books/apocalypse-de-notre-temps) | Henri Rollin | desc: antisemitic content |
| 2 | 16473 | [Dezionization](/books/dezionization) | Valery Yemelyanov | desc: antisemitic content |
| 2 | 16476 | [Das Judenthum in der Musik](/books/das-judenthum-in-der-musik) | Richard Wagner | desc: antisemitic content |
| 2 | 16483 | [La France juive](/books/la-france-juive) | Édouard Drumont | desc: antisemitic content |
| 2 | 16487 | [Jews in history](/books/jews-in-history) | Alexey Shmakov | desc: antisemitic content |
