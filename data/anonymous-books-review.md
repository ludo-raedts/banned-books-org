# Anonymous / placeholder author audit

_Gegenereerd 2026-05-28 door `scripts/_audit_anonymous_books.ts`._

Totaal boeken gekoppeld aan een placeholder-author: **1334**.

## Per placeholder-author

| Placeholder | Author id | Boeken |
|---|---:|---:|
| `Anonymous` | 33 | 1308 |
| `No Further Information Available` | 1820 | 20 |
| `Various Authors` | 455 | 2 |
| `Unknown` | 4391 | 2 |
| `Unknown` | 421 | 1 |
| `No Further Information` | 4235 | 1 |

## Per categorie

| Categorie | Aantal | Toelichting |
|---|---:|---|
| `CANDIDATE_REAL_PERSON` | 0 | description noemt een specifieke persoon — hoogste prioriteit voor correctie |
| `EDITED_COMPILED` | 0 | editor/compiler/vertaler bekend — vervang Anonymous door deze persoon (met rol) |
| `ORG_CREDIT` | 0 | organisatie/redactie genoemd — vervang door non-person author entry |
| `TITLE_HAS_AUTHOR` | 6 | auteur staat in de titel zelf — overlap met metadata-in-titles audit |
| `TRULY_ANONYMOUS` | 0 | description bevestigt anonimiteit — Anonymous is correct, geen actie |
| `NO_DESC` | 1306 | geen description om uit te halen — bron-check vereist |
| `NO_SIGNAL` | 22 | description aanwezig maar geen patroon — handmatige inspectie nodig |

## TITLE_HAS_AUTHOR (6)

> auteur staat in de titel zelf — overlap met metadata-in-titles audit

### book 10443 · `documents-for-study-by-peoples-p-c-c` · "Documents for Study BY People's P.C.C."

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: title: "Documents for Study BY People's P.C.C." → captured "People's P.C.C"

### book 11614 · `harta-timbalan-menteri-purported-to-have-been-written-by-kumpulan-anti-rasuah-negara-karan` · "Harta Timbalan Menteri (purported to Have Been Written BY Kumpulan Anti Rasuah Negara (karan)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: title: "Harta Timbalan Menteri (purported to Have Been Written BY Kumpulan Anti Rasuah Negara (karan)" → captured "Kumpulan Anti Rasuah Negara"

### book 11623 · `an-artcle-entitled-on-the-occasion-of-30th-anniversary-of-foundation-of-workers-party-of-korea-report-delivered-by-general-secretary-lim-ii-sung-as-commenoration-of-30th-founding-anniversary-of-w` · "An Artcle Entitled "on the Occasion of 30Th Anniversary of Foundation of Worker's Party of Korea Report Delivered BY General Secretary Lim Ii Sung as Commenoration of 30Th Founding Anniversary of W"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: title: "An Artcle Entitled "on the Occasion of 30Th Anniversary of Foundation of Worker's Party of Korea Report Delivered BY General Secretary Lim Ii Sung as Commenoration of 30Th Founding Anniversary of W" → captured "General Secretary Lim Ii"

### book 11625 · `ten-poems-and-lyrics-by-mao-tse-tung` · "Ten Poems and Lyrics By Mao Tse-tung"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: title: "Ten Poems and Lyrics By Mao Tse-tung" → captured "Mao Tse-tung"

### book 13433 · `there-they-are-and-here-we-are-belarusian-poetry-and-poems-of-solidarity-edited-and-compiled-by-v-korkunov-afterword-by-u-verina-moscow-nedovolny-2021-3-11-2025` · "There They Are, and Here We Are: Belarusian Poetry and Poems of Solidarity, Edited and compiled by V. Korkunov. Afterword by U. Verina (Moscow: Nedovolny, 2021) 3.11.2025"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: title: "There They Are, and Here We Are: Belarusian Poetry and Poems of Solidarity, Edited and compiled by V. Korkunov. Afterword by U. Verina (Moscow: Nedovolny, 2021) 3.11.2025" → captured "V. Korkunov. Afterword by"

### book 13437 · `diaries-of-an-nkvd-officer-a-documentary-exposure-of-stalinism-comp-ed-and-comment-by-a-zelenkova` · "Diaries of an NKVD Officer: A Documentary Exposure of Stalinism, comp., ed., and comment. by A. Zelenkova"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: title: "Diaries of an NKVD Officer: A Documentary Exposure of Stalinism, comp., ed., and comment. by A. Zelenkova" → captured "A. Zelenkova"

## NO_DESC (1306)

> geen description om uit te halen — bron-check vereist

### book 2902 · `ap-psychology-prep-plus-2020-2021` · "AP Psychology Prep Plus, 2020-2021"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 3140 · `lgbtq-history-book` · "LGBTQ+ History Book"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 3570 · `daulaires-book-of-greek-myths` · "D'Aulaires Book of Greek Myths"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 3870 · `online-pornography-title-only-no-further-information` · "Online Pornography"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7563 · `abortion` · "Abortion"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7565 · `child-sexual-abuse-in-the-catholic-church` · "Child Sexual Abuse in the Catholic Church"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7566 · `children-of-violence-in-america` · "Children of Violence in America"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7567 · `crimes-of-gender-violence-against-women` · "Crimes of Gender: Violence Against Women"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7569 · `family-violence` · "Family Violence"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7571 · `gun-control` · "Gun Control"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7572 · `guns-and-violence` · "Guns and Violence"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7577 · `reproductive-technologies` · "Reproductive Technologies"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7578 · `sexual-harassment` · "Sexual Harassment"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7579 · `suicide` · "Suicide"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7580 · `teen-pregnancy` · "Teen pregnancy"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7581 · `the-abortion-controversy` · "The Abortion Controversy"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7585 · `the-haiti-earthquake` · "The Haiti Earthquake"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7587 · `violence-against-women` · "Violence Against Women"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7588 · `violence-in-the-media` · "Violence in the Media"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 7589 · `weapons-of-mass-destruction` · "Weapons of Mass Destruction"

- placeholder: `No Further Information Available` (id=1820); year=2025; lang=en
- evidence: (no/empty description)

### book 3352 · `annies-baby-the-diary-of-anonymous-a-pregnant-teenager` · "Annie's Baby: The Diary of Anonymous, a Pregnant Teenager"

- placeholder: `Anonymous` (id=33); year=2024; lang=en
- evidence: (no/empty description)

### book 9676 · `a-different-season` · "A Different Season"

- placeholder: `Anonymous` (id=33); year=2022; lang=en
- evidence: (no/empty description)

### book 9678 · `feminism` · "Feminism"

- placeholder: `Anonymous` (id=33); year=2020; lang=en
- evidence: (no/empty description)

### book 9633 · `the-holy-bible` · "The Holy Bible"

- placeholder: `Anonymous` (id=33); year=2017; lang=en
- evidence: (no/empty description)

### book 7766 · `lucy-in-the-sky` · "Lucy in the Sky"

- placeholder: `Anonymous` (id=33); year=2012; lang=en
- evidence: (no/empty description)

### book 9677 · `being-you` · "Being You"

- placeholder: `Anonymous` (id=33); year=2012; lang=en
- evidence: (no/empty description)

### book 7659 · `european-art` · "European Art"

- placeholder: `No Further Information` (id=4235); year=2004; lang=en
- evidence: (no/empty description)

### book 8235 · `the-bible-book` · "The Bible Book"

- placeholder: `Anonymous` (id=33); year=1974; lang=en
- evidence: (no/empty description)

### book 7767 · `the-book-of-david` · "The Book of David"

- placeholder: `Anonymous` (id=33); year=1868; lang=en
- evidence: (no/empty description)

### book 7327 · `quran` · "Quran"

- placeholder: `Unknown` (id=4391); year=609; lang=ar
- evidence: (no/empty description)

### book 3599 · `collection-of-classic-fairy-tales` · "Collection of Classic Fairy Tales"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 6323 · `what-has-religion-done-for-mankind` · "What has Religion done for Mankind"

- placeholder: `Unknown` (id=4391); year=?; lang=?
- evidence: (no/empty description)

### book 7393 · `smokehouse-monthly` · "Smokehouse Monthly"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 7394 · `ace-g-men` · "Ace G Men"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 7497 · `gaie-france` · "Gaie France"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7498 · `gay-defi` · "Gay Defi"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7499 · `conspiracy` · "Conspiracy"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7500 · `le-nouveau-lettres-de-femmes` · "Le Nouveau Lettres de femmes"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7502 · `lesbian-licks` · "Lesbian Licks"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7503 · `tabou-special` · "Tabou Spécial"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7504 · `connex-mag` · "Connex Mag"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7505 · `debande-dessinee` · "Débande dessinée"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7506 · `couples` · "Couples"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7507 · `mes-voisines-hors-serie` · "Mes voisines hors série"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7508 · `pur-hentai` · "Pur Hentaï"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7509 · `lechangiste` · "l'Echangiste"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7510 · `black-extreme` · "Black Extrême"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7511 · `brut` · "Brut"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7512 · `charme-noir` · "Charme noir"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7513 · `love-show` · "Love show"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7514 · `newcummers` · "Newcummers"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7515 · `club-exhib` · "Club Exhib"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7516 · `club-est` · "Club Est"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7517 · `club-nord-et-belgique` · "Club Nord et Belgique"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7518 · `club-ouest-et-centre` · "Club Ouest et Centre"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7519 · `indecent` · "Indécent"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7520 · `marc-dorcel-magazine` · "Marc Dorcel Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7521 · `honcho-et-all-man` · "Honcho et All Man"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7522 · `rdv-mecs` · "RDV mecs"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7523 · `union` · "Union"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7531 · `annales-de-philosophie-chretienne` · "Annales de philosophie chrétienne"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (no/empty description)

### book 7534 · `the-complete-psilocybin-mushroom-cultivators-bible` · "The Complete Psilocybin Mushroom Cultivator's Bible"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 7535 · `health-and-efficiency` · "Health and Efficiency"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 7663 · `penthouse` · "Penthouse"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 7664 · `horney-housewife` · "Horney Housewife"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10290 · `green-ray` · "Green Ray"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10292 · `beating-up-gongs-drums-and-sing` · "Beating Up Gongs & Drums, and Sing"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10295 · `malayan-monitor` · "Malayan Monitor"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10298 · `a-compilation-of-materials-on-the-vietnam-issue` · "A Compilation of Materials on the Vietnam Issue"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10299 · `big-parade-in-red-square` · "Big Parade in Red Square"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10301 · `a-collection-of-songs-no-1-series` · "A Collection of Songs(No.1 Series)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10303 · `heroes-of-the-thai-thoo-river` · "Heroes of the Thai Thoo River"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10304 · `johnson-go-home` · "Johnson Go Home"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10305 · `biography-of-worlds-greatest-soviet-writer` · "Biography of World's Greatest Soviet Writer"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10307 · `unite-together-and-give-johnson-a-frontal-assault` · "Unite Together and Give Johnson a Frontal Assault"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10310 · `the-people-of-south-vietnam-must-win-the-american-troops-must-lose` · "The People of South Vietnam Must Win the American Troops Must Lose"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10313 · `how-marx-studied` · "How Marx Studied"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10314 · `letter-to-the-public-a-strong-protest-to-the-alliance-government-against-the-shooting-of-comrade-ong-chong-of-our-party-to-death` · "Letter to the Public a Strong Protest to the Alliance Government Against the Shooting of Comrade Ong Chong of Our Party to Death"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10317 · `aid-vietnam-resist-america` · "Aid Vietnam Resist America"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10320 · `national-hero-nguyen-van-troi` · "National Hero Nguyen Van Troi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10323 · `rang-undang-undang-bahasa-kebangsaan-menuju-ke-arah-penggunaan-berbilang-bahasa-ke-mana-arah-tujuan-bahasa-melayu` · "Rang Undang-undang Bahasa Kebangsaan Menuju ke Arah Penggunaan Berbilang Bahasa ke Mana Arah Tujuan Bahasa Melayu"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10326 · `ketetapan-rang-undang-undang-bahasa-kebangsaan-1967` · "Ketetapan Rang Undang-undang Bahasa Kebangsaan 1967"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10329 · `suprise-attack-news` · "Suprise Attack News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10331 · `call-of-the-people` · "Call of the People"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10333 · `strange-loves-of-beautiful-ladies` · "Strange Loves of Beautiful Ladies"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10334 · `capitalism` · "Capitalism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- co-credited (non-placeholder): _Lau Chee Ming_
- evidence: (no/empty description)

### book 10335 · `tai-chung-po` · "Tai Chung Po"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10336 · `lustful-dreams` · "Lustful Dreams"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- co-credited (non-placeholder): _Hsia Fei_
- evidence: (no/empty description)

### book 10337 · `wong-chung-nams-expedition` · "Wong Chung Nam's Expedition"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10339 · `charge` · "Charge"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10341 · `introducing-communist-leaders-in-various-countries` · "Introducing Communist Leaders in Various Countries"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10342 · `reverting-to-its-origin` · "Reverting to Its Origin"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10344 · `little-mister` · "Little Mister"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10349 · `lewd-scenes-in-a-hotel` · "Lewd Scenes in a Hotel"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10351 · `the-worlds-leaders-of-people` · "The World's Leaders of People"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10352 · `talks-on-international-problems` · "Talks on International Problems"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10353 · `flag` · "Flag"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10354 · `child-of-the-brigade` · "Child of the Brigade"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10356 · `kai-meng-youth` · "Kai Meng Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10360 · `workmens-paradise` · "Workmen's Paradise"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10361 · `quotations-from-chairman-mao-tse-tung` · "Quotations from Chairman Mao Tse-tung"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10365 · `the-new-evening-post` · "The New Evening Post"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10366 · `chuan-min-fao-peoples-newspaper` · "Chuan Min Fao (people's Newspaper)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10369 · `every-red-flower-is-facing-the-sun` · "Every Red Flower Is Facing the Sun"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10370 · `chun-chau-fortnightly` · "Chun Chau Fortnightly"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10373 · `chenderamata-perayaan-bersama-hari-buroh-kesatuan-kesatuan-sekerja-1967` · "Chenderamata perayaan bersama hari buroh kesatuan-kesatuan sekerja 1967"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10376 · `march-8-international-womens-day-souvenir-1967` · "March 8 International Women's Day Souvenir 1967"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10380 · `chen-hsien-pao` · "Chen Hsien Pao"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10381 · `collection-of-family-letters-of-lenin` · "Collection of Family Letter's of Lenin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10382 · `teachers-of-peiping` · "Teachers of Peiping"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10383 · `tong-po-kong-special-edition` · "Tong Po Kong Special Edition"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10385 · `liberation-songs` · "Liberation Songs"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- co-credited (non-placeholder): _Tsao Pe Han_
- evidence: (no/empty description)

### book 10391 · `course-of-russian` · "Course of Russian"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10394 · `passion-of-fire-unknown-vol-1` · "Passion of Fire Unknown (Vol.1)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10398 · `the-bewitching-woman-and-the-infatuated-man` · "The Bewitching Woman and the Infatuated Man"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10402 · `passion-of-fire-vol-ii` · "Passion of Fire (vol.ii)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10403 · `defend-world-peace` · "Defend World Peace"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10406 · `the-adventure-tsang-hai-ke-of-a-prince` · "The Adventure Tsang Hai-ke of a Prince"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10407 · `developed-maiden-land` · "Developed Maiden Land"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10408 · `picture-books-yang-kuei-hsiang` · "Picture Books yang Kuei Hsiang"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10410 · `the-globe-troting-of-a-libertine` · "The Globe Troting of a Libertine"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10413 · `tighten-sino-russian-frendship` · "Tighten Sino-russian Frendship"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10414 · `a-girl-mason` · "A Girl Mason"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10416 · `picture-books-3-getting-into-a-sedan-chair` · "Picture Books 3 Getting into a Sedan Chair"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10421 · `tilling-the-wilds` · "Tilling the Wilds"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10424 · `picture-books-new-liberated-areas` · "Picture Books New Liberated Areas"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10426 · `my-romance` · "MY Romance"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10428 · `picture-books-heroic-father` · "Picture Books Heroic Father"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10430 · `cherita-terpileh-mengenai-pahlawan-pahlawan-revolusi` · "Cherita Terpileh Mengenai Pahlawan-pahlawan Revolusi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10434 · `gema-kemarahan-revolusi` · "Gema Kemarahan Revolusi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10436 · `picture-books-the-marriage-of-yang-hsiao-lin` · "Picture Books the Marriage of yang Hsiao Lin"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10437 · `new-china-the-south-seas-chinese` · "New China & the South Seas Chinese"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10438 · `selected-stories-of-revolutionary-heroes` · "Selected Stories of Revolutionary Heroes"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10439 · `discourses-on-soviet-literature` · "Discourses on Soviet Literature"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10440 · `picture-books-the-last-drop-of-blood` · "Picture Books the Last Drop of Blood"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10442 · `the-agry-roar-of-the-revolution` · "The Agry Roar of the Revolution"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10444 · `october-revolution-and-china` · "October Revolution and China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10446 · `berita-buroh` · "Berita Buroh"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10448 · `picture-books-an-account-of-the-redress-of-grievances-of-a-blind-monthly-paid-worker` · "Picture Books an Account of the Redress of Grievances of a Blind Monthly Paid Worker"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10449 · `times` · "Times"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10450 · `suara` · "Suara"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10452 · `red-east` · "Red East"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10454 · `belia-baru` · "Belia Baru"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10455 · `emancipation-series` · "Emancipation Series"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10456 · `picture-books-blood-and-tear-feud` · "Picture Books Blood and Tear Feud"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10458 · `pangkalan-dan-perananja-militer-asing` · "Pangkalan dan Perananja Militer Asing"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 10460 · `picture-books-chao-i-man` · "Picture Books Chao I Man"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10462 · `bahan-bahan-hsueh-hsih` · "Bahan-bahan Hsueh Hsih"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10463 · `establishment-and-strengthening-of-youth-during-anti-blockade-campaign` · "Establishment and Strengthening of Youth During Anti-blockade Campaign"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10466 · `selected-military-writings-of-mao-tse-tung-tulisan-tulisan-askar-terpilih-mao-tse-tung` · "Selected Military Writings of Mao Tse-tung(tulisan-tulisan Askar Terpilih Mao Tse-tung"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10468 · `picture-books-white-haired-woman` · "Picture Books White Haired Woman"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10469 · `trade-unions-in-soviet-union` · "Trade Unions in Soviet Union"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10472 · `picture-books-the-happiness-of-resurgence` · "Picture Books the Happiness of Resurgence"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10474 · `spring-and-love` · "Spring and Love"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10476 · `picture-books-liu-chi-tan-peoples-hero` · "Picture Books Liu Chi Tan People's Hero"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10481 · `mengeritik-dan-menyangkal-jalan-yang-salah-bagi-revisionism-keluaran-khas-bertarikh-oktober-1967` · "Mengeritik dan Menyangkal Jalan yang Salah Bagi Revisionism Keluaran Khas Bertarikh Oktober 1967"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10484 · `oppose-old-ideas-in-the-party` · "Oppose Old Ideas in the Party"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10485 · `bendera-keluaran-no-2` · "Bendera,keluaran No.2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10487 · `picture-books-ballards-of-the-year-of-resurgence` · "Picture Books Ballards of the Year of Resurgence"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10488 · `true-news` · "True News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10489 · `suara-pembebasan` · "Suara Pembebasan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10490 · `fook-kwei` · "Fook Kwei"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10491 · `picture-books-the-gallant-hero` · "Picture Books the Gallant Hero"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10493 · `tambahan-khas-merayakan-ulang-tahun-ketujuh-sarawak-united-peoples-party-bahagian-miri-bagi-see-hua-daily-news-bertarikh-10hb-november-1967` · "Tambahan Khas Merayakan Ulang Tahun Ketujuh Sarawak United Peoples Party,bahagian Miri Bagi See Hua Daily News Bertarikh 10Hb November 1967"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10494 · `forward-progressive-road` · "Forward Progressive Road"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10496 · `tuanty-five-thousand-long-march` · "Tuanty-five Thousand Long March"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10498 · `glory-to-the-peoples-republic-of-china` · "Glory to the Peoples' Republic of China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10501 · `freedom-news` · "Freedom News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10502 · `selections-of-literary-report` · "Selections of Literary Report"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10507 · `bachaan-bahasa-china-darjah-tinggi-buku-pertama` · "Bachaan Bahasa China , Darjah Tinggi, Buku Pertama"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10508 · `front-line-correspondence` · "Front Line Correspondence"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10509 · `handbook-on-sino-soviet-friendship` · "Handbook on Sino Soviet Friendship"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10510 · `problems-of-unified-fighting-line` · "Problems of Unified Fighting Line"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10515 · `surat-kepada-ahli-ahli-parti-oleh-jawatan-kuasa-perhubungan-parti-buroh-pahang` · "Surat Kepada Ahli-ahli Parti Oleh Jawatan-kuasa Perhubungan Parti Buroh, Pahang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10516 · `gallant-army-of-liberation` · "Gallant Army of Liberation"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10518 · `progressive-youth` · "Progressive Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10519 · `kita-mesti-menang-penjajahan-british-di-hong-kong-akan-ditewaskan` · "Kita Mesti Menang!penjajahan British di Hong Kong Akan Ditewaskan"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10521 · `introducing-soviet-russia` · "Introducing Soviet Russia"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10529 · `rather-die-than-submit` · "Rather Die Than Submit"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10534 · `cahaya-menyinar-rongga-hati` · "Cahaya Menyinar Rongga Hati"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10536 · `women-and-children-hygiene` · "Women and Children Hygiene"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10538 · `bachaan-rakyat-untok-darjah-tinggi-buku-pertama` · "Bachaan Rakyat Untok Darjah Tinggi, Buku Pertama"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10539 · `grand-ceremony-of-founding-of-the-country` · "Grand Ceremony of Founding of the Country"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10543 · `great-edison` · "Great Edison"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10545 · `ariyamai` · "Ariyamai"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 10547 · `guide-to-trades-industrialists-of-new-china` · "Guide to Trades & Industrialists of New China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10553 · `kumpulan-karangan-karangan-mengenai-revolusi` · "Kumpulan Karangan-karangan Mengenai Revolusi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10554 · `heroines-of-soviet-russia` · "Heroines of Soviet Russia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10556 · `self-pride-of-the-russians` · "Self Pride of the Russians"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10557 · `perniagaan-harian-hong-kong` · "Perniagaan Harian Hong Kong"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10559 · `october` · "October"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10560 · `soviet-weekly` · "Soviet Weekly"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10561 · `kesatuan-tukang-tukang-mas-dan-perak-singapura-terbitan-khas-merayakan-hari-buroh-antarabangsa-tahun-1968` · "Kesatuan Tukang-tukang Mas dan Perak Singapura-terbitan Khas Merayakan Hari Buroh Antarabangsa Tahun 1968"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10562 · `history-of-china-brief-course` · "History of China-brief Course"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10563 · `labour-in-socialist-countries` · "Labour in Socialist Countries"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10565 · `a-history-of-europe-vol-1-from-the-earliest-time-to-1713` · "A History of Europe Vol.1 from the Earliest Time to 1713"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10568 · `deshabhimani` · "Deshabhimani"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 10569 · `akhbar-pembebasan` · "Akhbar Pembebasan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10571 · `interexchange-of-remittances-in-central-china` · "Interexchange of Remittances in Central China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10575 · `study-study-and-study` · "Study,study and Study"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10578 · `soviet-women` · "Soviet Women"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10582 · `how-to-exercise-criticism-and-self-criticism` · "How to Exercise Criticism and Self Criticism"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10583 · `the-working-youth-of-the-rumanian-peoples-republic` · "The Working Youth of the Rumanian Peoples Republic"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10586 · `observation` · "Observation"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10587 · `jen-wern` · "Jen Wern"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10588 · `confessions-of-an-english-maid` · "Confessions of an English Maid"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- co-credited (non-placeholder): _Geoffrey Lowndes_
- evidence: (no/empty description)

### book 10590 · `china-children` · "China Children"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10593 · `hopeh-literary-arts` · "Hopeh Literary Arts"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10595 · `the-mathrubhumi-illustrated-wekly` · "The Mathrubhumi Illustrated Wekly"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 10598 · `china-young-children` · "China Young Children"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10599 · `vengalachilai` · "Vengalachilai"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 10602 · `the-experience-and-mission-of-the-chinese-labour-movement` · "The Experience and Mission of the Chinese Labour Movement"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10603 · `malay-nadukalil` · "Malay Nadukalil"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 10605 · `how-man-became-great` · "How Man Became Great..."

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10606 · `translations` · "Translations"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10607 · `china-reconstructs` · "China Reconstructs"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10611 · `suara-malaya-merdeka` · "Suara Malaya Merdeka"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10615 · `sin-pao` · "Sin Pao"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10621 · `world-knowledge` · "World Knowledge"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10623 · `tell-me-why-no-22-25th-january-1969` · "Tell Me Why,No.22,25Th January 1969"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10624 · `how-to-study-capitalism` · "How to Study Capitalism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10626 · `sexual-experience` · "Sexual Experience"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10627 · `edisi-khas-memperingati-hari-ulangtahun-kedua-pemogokan-di-ladang-nenas-chuan-seng` · "Edisi Khas Memperingati Hari Ulangtahun Kedua Pemogokan di Ladang Nenas Chuan Seng"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10628 · `humanity-news` · "Humanity News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10629 · `talking-and-singing` · "Talking and Singing"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10631 · `companion-no-151` · "Companion No.151"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10638 · `sexual-position` · "Sexual Position"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10640 · `hupeh-literary-art` · "Hupeh Literary Art"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10641 · `selected-popular-songs` · "Selected Popular Songs"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10642 · `study-of-sex-of-the-human-male-and-female` · "Study of Sex of the Human Male and Female"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10644 · `hwa-hills-stained-with-blood` · "Hwa Hills Stained with Blood"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10646 · `world-student-news-all-past-present-and-future-issues` · "World Student News (all Past,present and Future Issues)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10650 · `talks-on-ideology` · "Talks on Ideology"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10653 · `women-of-new-china` · "Women of New China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10654 · `a-short-history-of-social-development` · "A Short History of Social Development"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10657 · `new-china` · "New China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10659 · `inauguration-on-establishment-of-peoples-democratic-republic` · "Inauguration on Establishment of People's Democratic Republic"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10665 · `vedangalin-vandavalam` · "Vedangalin Vandavalam"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 10667 · `industrial-commercial-paths-of-new-china` · "Industrial & Commercial Paths of New China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10677 · `untitled-chinese-publication-kdn-l-n-186-1951` · "Untitled Chinese publication (KDN L.N. 186 / 1951)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- co-credited (non-placeholder): _Lei Zi Jian; Looi Chee Kian; Chen Jian; Yang Shan Yong_
- evidence: (no/empty description)

### book 10678 · `internals-of-china` · "Internals of China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10679 · `translated-series-of-popular-knowledge` · "Translated Series of Popular Knowledge"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10680 · `cheng-fong-pau` · "Cheng Fong Pau"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10682 · `peasants-voice` · "Peasants Voice"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10686 · `red-flag` · "Red Flag"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10688 · `liliput-series-of-times-encyclopedia` · "Liliput Series of Times Encyclopedia"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10689 · `facts-review` · "Facts Review"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10691 · `seruan-raayat` · "Seruan Raayat"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10692 · `kiangnan-marching-music` · "Kiangnan Marching Music"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10693 · `chinese-peoples-literature` · "Chinese People's Literature"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10696 · `suara-raayat` · "Suara Raayat"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10699 · `khuai-huoh-pau` · "Khuai Huoh Pau"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10700 · `truth` · "Truth"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10701 · `ladies-of-new-china-no-8` · "Ladies of New China, No. 8"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10702 · `modern-women` · "Modern Women"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10704 · `night-travellers-weekly` · "Night Travellers Weekly"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10705 · `warta-kebanungan-raayat` · "Warta Kebanungan Raayat"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10706 · `learn-lenins-method-of-working` · "Learn Lenin's Method of Working"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10707 · `eastern-china-pictorial` · "Eastern China Pictorial"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10708 · `fun-look` · "Fun Look"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10710 · `warta-raayat` · "Warta Raayat"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10711 · `learners-weekly` · "Learner's Weekly.."

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10716 · `lending-of-the-red-lamp` · "Lending of the Red Lamp"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10719 · `communist` · "Communist"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10722 · `feng-pao` · "Feng Pao"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10723 · `daily-worker` · "Daily Worker"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10724 · `lenin-news` · "Lenin News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10725 · `literature-for-the-masses` · "Literature for the Masses"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10728 · `liberator` · "Liberator"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10730 · `new-china-monthly` · "New China Monthly"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10731 · `loyal-press` · "Loyal Press"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10732 · `liberation-news` · "Liberation News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10734 · `action-news-service` · "Action News Service"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10735 · `liberation-of-greater-shanghai` · "Liberation of Greater Shanghai"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10736 · `little-friends` · "Little Friends"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10738 · `kejadian-yang-sebenarnya-mengenai-kekachauan2-di-malaya-1` · "Kejadian yang Sebenarnya Mengenai Kekachauan2 Di-malaya 1"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10739 · `angles` · "Angles"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10740 · `liberation-soldiers` · "Liberation Soldiers"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10741 · `new-contruction` · "New Contruction"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10743 · `british-union-quarterly-the` · "British Union Quarterly, The"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10745 · `chinese-youth` · "Chinese Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- co-credited (non-placeholder): _Liao Hu Chin_
- evidence: (no/empty description)

### book 10748 · `communist-international-the` · "Communist International, The"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10749 · `life-of-karl-marx` · "Life of Karl Marx"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10750 · `for-everlasting-peace-for-peoples-democracy` · "For Everlasting Peace for People's Democracy"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10751 · `spring-hidden-in-tigers-lair` · "Spring Hidden in Tiger's Lair"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10752 · `challenge` · "Challenge"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10753 · `life-of-stalin` · "Life of Stalin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10754 · `study` · "Study"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10758 · `literary-art` · "Literary Art"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10759 · `the-prohibitive-flesh-the-romance-of-kong-sui-yang-vol-2` · "The Prohibitive Flesh the Romance of Kong Sui-yang Vol. 2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10761 · `die-welt` · "Die Welt"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10763 · `the-general-masses` · "The General Masses"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10765 · `eye-the` · "Eye, The"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10766 · `life-on-soviet-farms` · "Life on Soviet Farms"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10767 · `north-east-pictorial` · "North-east Pictorial"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10770 · `forward-bloc` · "Forward Bloc"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10771 · `lightening-news` · "Lightening News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10772 · `charhar-education` · "Charhar Education"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10774 · `berita-china` · "Berita China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10775 · `free-press` · "Free Press"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10778 · `headline` · "Headline"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10779 · `literary-news` · "Literary News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10783 · `humanite` · "Humanite"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10784 · `literary-post` · "Literary Post"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10785 · `useful-friend` · "Useful Friend"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10789 · `knowledge-on-soviet-russia-monthly` · "Knowledge on Soviet Russia Monthly"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10790 · `old-edition-of-jade-mats-volume-i-ii-iii-and-continuation` · "Old Edition of Jade Mats - Volume I, Ii, Iii and Continuation"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10796 · `inside-the-empire` · "Inside the Empire"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10799 · `modern-west-chambers-dream-volume-i-and-ii` · "Modern West Chamber's Dream - Volume I and Ii"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10800 · `kypriaka-nea` · "Kypriaka Nea"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10801 · `logical-proof-of-materialism-and-historical-materialism` · "Logical Proof of Materialism and Historical Materialism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10802 · `modern-youth` · "Modern Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10805 · `labour-monthly` · "Labour Monthly"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10806 · `madame-curie` · "Madame Curie"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10807 · `education-in-the-north-east` · "Education in the North East"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10809 · `malacca-news-sheet` · "Malacca News Sheet"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10810 · `toward-new-life` · "Toward New Life"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10813 · `moscow-news` · "Moscow News..."

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10818 · `netaji` · "Netaji"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10820 · `secret-volume-yer-por-chee` · "Secret Volume. Yer Por Chee"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10821 · `china-news` · "China News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10822 · `new-propeller-the` · "New Propeller, The..."

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10823 · `march-under-flag-of-mao-tse-tung` · "March Under Flag of Mao Tse Tung"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10824 · `china-youth` · "China Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10825 · `the-human-bogey-of-hong-kong` · "The Human Bogey of Hong Kong"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10827 · `peoples-post` · "People's Post...."

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10829 · `north-russia-weekly` · "North Russia Weekly"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10830 · `pan-chin-lien-a-dissolute-woman` · "P'an Chin-lien. a Dissolute Woman"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10831 · `pore-val` · "Pore Val"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10833 · `popular-poems-song` · "Popular Poems & Song"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10836 · `marx-engels-lenin-stalin-on-ways-of-thought` · "Marx, Engels, Lenin & Stalin on Ways of Thought"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10837 · `siapa-tah-tuhan-dan-juru-selamat-manusia-itu` · "Siapa Tah Tuhan dan Juru Selamat Manusia Itu"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10838 · `a-dissolute-woman-commits-adultery` · "A Dissolute Woman Commits Adultery"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10842 · `flavour` · "Flavour"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10844 · `russia-to-day` · "Russia To-day"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10845 · `materialism-empirio-criticism` · "Materialism & Empirio Criticism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10846 · `selected-liberation-songs-1949` · "Selected Liberation Songs 1949"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10847 · `a-red-card-every-night-volumes-i-and-ii` · "A Red Card Every Night - Volumes I and Ii"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10849 · `russia-to-day-newsletter` · "Russia To-day Newsletter"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10850 · `materialistic-conception-of-love` · "Materialistic Conception of Love"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10852 · `the-wild-mandarin-ducks-volume-i-and-ii` · "The Wild Mandarin-ducks-volume I and Ii"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10854 · `student-voice` · "Student Voice"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10855 · `materials-for-study-of-anti-american-white-paper` · "Materials for Study of Anti-american White Paper"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10856 · `basic-social-science-readers` · "Basic Social Science Readers"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10857 · `a-certain-maid-servant-of-katong` · "A Certain Maid Servant of Katong"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10859 · `vema` · "Vema"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10860 · `merge-of-personal-interest-and-public-interest-in-age-of-socialism` · "Merge of Personal Interest and Public Interest in Age of Socialism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10861 · `popular-soviet-russian-political-science-series` · "Popular Soviet Russian Political Science Series"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10862 · `the-secret-history-of-mo-chak-thin` · "The Secret History of Mo Chak-thin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10864 · `week-the` · "Week, The"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10866 · `siaran-partai-berkenaan-revolusi-nasional-rakyat-kalimantan-utara` · "Siaran Partai Berkenaan Revolusi Nasional Rakyat Kalimantan Utara"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 10869 · `sarbiyan` · "Sarbiyan"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10870 · `knowledge-no-97-volume-9-dated-12th-november-1962` · "Knowledge No.97 Volume 9 Dated 12Th November 1962"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10872 · `world-news-and-views` · "World News and Views"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10880 · `union-paper` · "Union Paper"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10881 · `finding-out-part-number-11` · "Finding Out (part Number 11)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10882 · `most-distinguished-medal` · "Most Distinguished Medal"

- placeholder: `Various Authors` (id=455); year=?; lang=zh
- evidence: (no/empty description)

### book 10887 · `mr-short` · "MR. Short"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10888 · `union-weekly` · "Union Weekly"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10892 · `mrs-cheung-lam` · "MRS. Cheung Lam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10894 · `teachers-journal-no-3-dated-15-5-1960` · "Teachers' Journal No.3 Dated 15.5.1960"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10898 · `teachers-journal-no-4-dated-15-7-1960` · "Teachers' Journal No.4 Dated 15.7.1960"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10901 · `upset-press` · "Upset Press"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10902 · `teachers-journal-vol-ii-no-1-dated-15-2-1961` · "Teachers' Journal Vol.ii No.1 Dated 15.2.1961"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10903 · `awake` · "Awake"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- co-credited (non-placeholder): _Ohsawa Arimasa_
- evidence: (no/empty description)

### book 10904 · `meng-cheung-ying-rise-up` · "Meng Cheung Ying, Rise Up"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10906 · `teachers-journal-vol-ii-no-3-dated-15-6-1961` · "Teachers' Journal Vol.ii No.3 Dated 15.6.1961"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10909 · `teachers-journal-vol-iii-no-2-12th-issue-dated-15-8-1962` · "Teachers' Journal Vol.iii No.2, 12Th Issue Dated 15.8.1962"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10911 · `new-china-stands-on-side-of-peace-bloc-in-international-theatre` · "New China Stands on Side of Peace Bloc in International Theatre"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10913 · `teachers-journal-vol-iii-no-3-13th-issue-dated-15-10-1962` · "Teachers' Journal Vol.iii No.3, 13Th Issue Dated 15.10.1962"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10916 · `vanguard-news` · "Vanguard News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10917 · `review-of-indonesia` · "Review of Indonesia"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10918 · `economics-and-politics-in-the-era-of-the-dictatorshipof-the-proleteriat` · "Economics and Politics in the Era of the Dictatorshipof the Proleteriat"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10919 · `new-democracy-theory` · "New Democracy Theory"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10921 · `teachers-journal-vol-iii-no-4-14th-issue-dated-15-12-1962` · "Teachers' Journal Vol.iii No.4, 14Th Issue Dated 15.12.1962"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10922 · `for-a-lasting-peace-for-a-peoples-democracy` · "For a Lasting Peace, for a People's Democracy"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10923 · `new-democratic-marching-music` · "New Democratic Marching Music"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10924 · `victory-news` · "Victory News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10925 · `teachers-journal-vol-iv-no-1-15th-issue-dated-15-3-1963` · "Teachers' Journal Vol.iv No.1, 15Th Issue Dated 15.3.1963"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10929 · `teachers-journal-vol-iv-no-2-16th-issue-dated-15-5-1963` · "Teachers' Journal Vol.iv No.2, 16Th Issue Dated 15.5.1963"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10932 · `voice-of-the-people-kuan-shing-po` · "Voice of the People Kuan Shing Po"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10933 · `chendera-mata-hari-wanita-sedunia-8hb-march-1964` · "Chendera Mata Hari Wanita Sedunia 8Hb March 1964"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10935 · `history-of-the-communist-party-of-the-soviet-union` · "History of the Communist Party of the Soviet Union"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10936 · `new-shops-in-soviet-union` · "New Shops in Soviet Union"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10938 · `indu-nesan` · "Indu Nesan"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10940 · `new-times` · "New Times"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- co-credited (non-placeholder): _Various_
- evidence: (no/empty description)

### book 10941 · `voice-of-the-revolution` · "Voice of the Revolution"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10946 · `nathikam-atheism` · "Nathikam (atheism)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10948 · `nine-coats` · "Nine Coats"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10950 · `global-digest` · "Global Digest"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10954 · `eastern-horizon` · "Eastern Horizon"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10957 · `singing-in-praise-of-china` · "Singing in Praise of China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10959 · `mao-tze-tung-on-peoples-democratic-dictatorship` · "Mao Tze Tung on People's Democratic Dictatorship"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10961 · `week-end-news` · "Week End News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10966 · `week-end-newspaper` · "Week End Newspaper"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 10967 · `peking-review` · "Peking Review"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 10970 · `novel` · "Novel"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10972 · `the-student-of-the-peninsula-have-grown-up` · "The Student of the Peninsula Have Grown Up"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10975 · `novel-monthly` · "Novel Monthly"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10981 · `issuing-forth` · "Issuing Forth"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10985 · `the-students-all-over-the-world-are-of-one-mind` · "The Students All Over the World Are of One Mind"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10992 · `wong-kwai-and-li-heung-heung` · "Wong Kwai and Li Heung Heung"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- co-credited (non-placeholder): _Li Kwai_
- evidence: (no/empty description)

### book 10993 · `materialise-the-general-route` · "Materialise the General Route"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 10998 · `on-marx` · "On Marx"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11000 · `tetangga-jang-gagah-berani` · "Tetangga Jang Gagah Berani"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 11005 · `soviet-literature` · "Soviet Literature"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11007 · `workers-and-farmers-news` · "Workers and Farmers News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11011 · `sociology-elementary-reader` · "Sociology Elementary Reader"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11012 · `revolutionary-songs-for-all` · "Revolutionary Songs for All"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11014 · `on-property-under-socialism` · "On Property Under Socialism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11015 · `workers-news` · "Workers News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11016 · `berita-pemuda` · "Berita Pemuda"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11018 · `on-relation-between-cities-villages` · "On Relation Between Cities & Villages"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11020 · `chenderamata-puja-umor-10-partai-rakyat-malaysia` · "Chenderamata Puja Umor 10 Partai Rakyat Malaysia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11023 · `yang-ko-paddy-transplanting-song` · "Yang Ko Paddy Transplanting Song"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11027 · `son-of-the-blacksmith-and-his-assistants` · "Son of the Blacksmith and His Assistants"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11028 · `the-short-history-of-the-malayan-races-movement` · "The Short History of the Malayan Races Movement"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11034 · `song-of-liberation-of-youth` · "Song of Liberation of Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11037 · `young-edison` · "Young Edison"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11038 · `chenderamata-perayaan-ulang-tahun-3-partai-buroh-malaya-chawangan-perbandaran-bersama-merayakan-8hb-3-hari-wanita-1965` · "Chenderamata Perayaan Ulang Tahun 3 Partai Buroh Malaya Chawangan Perbandaran Bersama Merayakan 8Hb 3 Hari Wanita 1965"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11040 · `on-transition-from-socialism-to-communism` · "On Transition from Socialism to Communism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11042 · `watch-tower` · "Watch Tower"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11044 · `young-vanguard` · "Young Vanguard"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11060 · `lover-lover` · "Lover,lover"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11063 · `sexual-flame` · "Sexual Flame"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11064 · `news-kzvestiya` · "News Kzvestiya"

- placeholder: `Anonymous` (id=33); year=?; lang=ru
- evidence: (no/empty description)

### book 11066 · `soviet-finance-and-currency` · "Soviet Finance and Currency"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11068 · `new-times-novoye-vremya` · "New Times Novoye Vremya"

- placeholder: `Anonymous` (id=33); year=?; lang=ru
- evidence: (no/empty description)

### book 11071 · `mens-affairs` · "Men's Affairs"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11072 · `truth-pravda` · "Truth Pravda"

- placeholder: `Anonymous` (id=33); year=?; lang=ru
- evidence: (no/empty description)

### book 11073 · `peoples-awakening-news` · "People's Awakening News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11074 · `soviet-labour-hero` · "Soviet Labour Hero"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11075 · `springtime-in-bangkok` · "Springtime in Bangkok"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11077 · `peoples-china` · "People's China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11078 · `soviet-pictorial` · "Soviet Pictorial"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11080 · `peoples-democratic-dictatorship` · "People's Democratic Dictatorship"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11084 · `peoples-news-johore` · "People's News (johore)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11087 · `c-p-s-u-problems-of-party-ideological-work-1948` · "C.P.S.U. Problems of Party Ideological Work, 1948"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11088 · `peoples-news-n-perak` · "People's News (n. Perak)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11089 · `soviet-sportwomen` · "Soviet Sportwomen"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11090 · `dravida-nadu` · "Dravida Nadu"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11092 · `soviet-transportation` · "Soviet Transportation"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11094 · `erimalai` · "Erimalai"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11095 · `peoples-song-music` · "People's Song & Music"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11097 · `men-and-women` · "Men and Women"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- co-credited (non-placeholder): _Li Yang_
- evidence: (no/empty description)

### book 11099 · `peoples-war` · "People's War"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11100 · `action` · "Action"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11107 · `below-the-wind` · "Below the Wind"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11108 · `the-vices-of-chang-ching-sen` · "The Vices of Chang Ching Sen"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11109 · `janashakti` · "Janashakti"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11112 · `dissolute-women-of-wealthy-families` · "Dissolute Women of Wealthy Families"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11113 · `kalki` · "Kalki"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11114 · `pictorial-life-history-of-stalin` · "Pictorial Life History of Stalin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11117 · `kumudam` · "Kumudam"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11118 · `pictorial-life-of-to-hang-chi` · "Pictorial Life of to Hang Chi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11122 · `political-commonsense-of-workers` · "Political Commonsense of Workers"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11125 · `may-day-manisfesto-in-english-of-the-communist-party-of-india` · "May Day Manisfesto in English of the Communist Party of India"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11126 · `political-economy` · "Political Economy"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11133 · `nava-jug` · "Nava Jug"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11134 · `portrait-of-stalin` · "Portrait of Stalin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11136 · `the-cave-of-hundred-flowers-vying-with-one-another-in-loveliness` · "The Cave of Hundred Flowers Vying with One Another in Loveliness"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11140 · `secret-in-beauty-parlours-alias-hundred-flowers-vying-with-one-another-in-love-loveliness` · "Secret in Beauty Parlours Alias Hundred Flowers Vying with One Another in Love Loveliness"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11143 · `stalin-and-revolution-of-china` · "Stalin and Revolution of China"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11145 · `on-the-british-communist-partys-policy` · "On the British Communist Party's Policy"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11148 · `primary-education-in-soviet-russia` · "Primary Education in Soviet Russia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11151 · `one-year-of-peoples-struggles` · "One Year of People's Struggles"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11154 · `spring-in-tokyo` · "Spring in Tokyo"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11158 · `ramantic-secrets-in-tokyo` · "Ramantic Secrets in Tokyo"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11159 · `peoples-age` · "People's Age"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11163 · `phulwari` · "Phulwari"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11167 · `political-thesis-of-the-communist-party-of-india-1948` · "Political Thesis of the Communist Party of India, 1948"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11171 · `por-murasu` · "Por Murasu"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11173 · `affairs-of-a-young-girl` · "Affairs of a Young Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11178 · `puthu-valvu` · "Puthu Valvu"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11179 · `red-light-press` · "Red Light Press"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11180 · `songs-of-liberated-zones` · "Songs of Liberated Zones"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11181 · `romance-in-rubber-estate` · "Romance in Rubber Estate"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11182 · `revolutionary-movement-in-the-colonies-semi-colonies` · "Revolutionary Movement in the Colonies & Semi Colonies"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11183 · `red-star-news` · "Red Star News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11185 · `indian-art-of-love` · "Indian Art of Love"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11186 · `savera` · "Savera"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11187 · `reference-materials-for-cultural-education` · "Reference Materials for Cultural Education"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11188 · `storyof-how-woman-rises-up` · "Storyof How Woman Rises Up"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11189 · `secret-loves-of-chiangping-vol-i-vol-ii` · "Secret Loves of Chiangping (vol.i & Vol.ii)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11194 · `shakti` · "Shakti"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11195 · `revenge` · "Revenge"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11197 · `su-nu-ching` · "Su Nu Ching"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11201 · `the-romance-contenders` · "The Romance Contenders"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11202 · `tamil-mani` · "Tamil Mani"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11203 · `spring-of-south-island` · "Spring of South Island"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11204 · `the-romance-contenders-2nd-edition` · "The Romance Contenders (2Nd Edition)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11205 · `teeppori` · "Teeppori"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11206 · `science-for-the-masses` · "Science for the Masses"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11209 · `towards-the-democratic-front-to-win-real-independence-peoples-democracy-1948` · "Towards the Democratic Front to Win Real Independence & People's Democracy, 1948"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11211 · `story-of-sheung-ngos-escape-to-moon` · "Story of Sheung Ngo's Escape to Moon"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11212 · `sex-love-between-me-and-uncle` · "Sex Love Between Me and Uncle"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11213 · `viduthalai` · "Viduthalai"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11216 · `besieged` · "Besieged"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11217 · `viduthalai-murasu` · "Viduthalai Murasu"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11219 · `stray-dog-cannot-eat-up-the-sun` · "Stray Dog Cannot Eat Up the Sun"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11225 · `who-rules-pakistan` · "Who Rules Pakistan"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11227 · `student-news-singapore` · "Student News (singapore)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11238 · `study-diary` · "Study Diary"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11240 · `aesthetic-conception-of-marxism` · "Aesthetic Conception of Marxism"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11241 · `seven-blossoms` · "Seven Blossoms"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11242 · `students-news` · "Student's News"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11243 · `pertemuan-wakil2-partai2-komunis-dan-partai2-buruh` · "Pertemuan Wakil2 Partai2 Komunis dan Partai2 Buruh"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 11247 · `push-the-great-wheel-to-go-forward` · "Push the Great Wheel to Go Forward"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11251 · `the-song-of-malaya` · "The Song of Malaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11253 · `study-of-utilisation-new-philosophy` · "Study of Utilisation New Philosophy"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11254 · `go-forward-brethren-of-malaya` · "Go Forward! Brethren of Malaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11257 · `sing-for-unity` · "Sing for Unity"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11259 · `tai-poh-province-administration` · "Tai Poh Province Administration"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11261 · `atlas-bof-the-world` · "Atlas Bof the World"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11264 · `pernjataan-seruan-pertemuan-wakil2-partai2-komunis-dan-partai2-buruh` · "Pernjataan & Seruan: Pertemuan Wakil-Wakil Partai-Partai Komunis dan Partai-Partai Buruh"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 11265 · `badges` · "Badges"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11267 · `study-the-sino-russian-pact` · "Study the Sino-russian Pact"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11268 · `berita-ringkas` · "Berita Ringkas"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11272 · `hsueh-hsih-materials-volume-two` · "Hsueh Hsih Materials,volume Two"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11275 · `text-book-on-russian-lectures` · "Text Book on Russian Lectures"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11276 · `compatriots-come-and-do-righteousness` · "Compatriots,come and Do Righteousness"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11280 · `firmly-support-the-righteous-struggle-of-the-west-coast-fishermen-in-their-no-fishing-one-day-strike` · "Firmly Support the Righteous Struggle of the West Coast Fishermen in Their 'No Fishing' One Day Strike"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11281 · `battle-news` · "Battle News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11284 · `an-emergency-call-of-a-good-citizen` · "An Emergency Call of a Good Citizen"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11285 · `battlefront` · "Battlefront"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11286 · `modern-history-of-china-1st-edition` · "Modern History of China (1St Edition)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11287 · `to-intensify-training` · "To Intensify Training"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11288 · `chendera-mata-5-1-hari-buroh-sa-dunia-1966` · "Chendera Mata 5.1: Hari Buroh Sa Dunia 1966"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11289 · `beacon-news` · "Beacon News"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11291 · `to-study-pact-between-china-ussr` · "To Study Pact Between China & Ussr"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11292 · `concerning-the-intra-party-ideological-dispute-on-the-two-divergent-anticolonial-lines-of-struggle` · "Concerning the Intra Party Ideological Dispute on the Two Divergent Anticolonial Lines of Struggle"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11293 · `kim-ii-sung` · "Kim Ii Sung"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11297 · `bendera-benteng-suara-dan-bichara-partai-rakyat-malaya-untuk-anggota-saja` · "Bendera Benteng: Suara dan Bichara Partai Rakyat Malaya (Untuk Anggota Saja)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11298 · `happiness-is-a-warm-gun` · "Happiness Is a Warm Gun"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11299 · `puff-the-magic-dragon` · "Puff the Magic Dragon"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11300 · `harga-padi-telah-turun-semula` · "Harga Padi Telah Turun Semula"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11301 · `lagu` · "Lagu"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11302 · `suratan2-yang-mengandongi-shaer2-dan-muzik-dalam-lagu-lagu-yang-tajok-nya-ialah-1-nyanyian-latehan-askar2-2-satu-bungkusan-hadiah-untok-melahirkan-penghargaan-3-latehan-bayonet2` · "Suratan2 yang Mengandongi Shaer2 dan Muzik dalam Lagu Lagu yang Tajok-nya Ialah: 1. Nyanyian Latehan Askar2, 2. Satu Bungkusan Hadiah Untok Melahirkan Penghargaan, 3. Latehan Bayonet2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11303 · `perutusan-khas-hari-raya-haji-yang-di-chetak-dalam-bahasa-malaysia-yang-di-mulai-dengan-perkataan2-kpd-manusia2-yang-maseh-berugama-terutama-mereka-yang-maseh-islam-dan-di-akhiri-dengan-perk` · "Perutusan Khas Hari Raya Haji"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11305 · `naik-gaji` · "Naik Gaji"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11307 · `hot-summer` · "Hot Summer"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11308 · `romance-of-lust-or-early-experience` · "Romance of Lust or Early Experience"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11312 · `a-man-with-a-maid` · "A Man with a Maid"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11313 · `happy-meetings` · "Happy Meetings"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11314 · `golden-night` · "Golden Night"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11316 · `happy-meeting` · "Happy Meeting"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11320 · `chontoh-mulia-perjuangan-massa-untok-memperingati-ulang-tahun-pertama-kematian-shahid-lim-soon-seng` · "Chontoh Mulia Perjuangan Massa-untok Memperingati Ulang-tahun Pertama Kematian Shahid Lim Soon Seng"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11321 · `far-eastern-economic-review` · "Far Eastern Economic Review"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11322 · `chetusan-yang-di-mulai-dengan-perkataan2-chetusan-ia-lah-chetusan-suara-majoriti-rakyat-dan-diakhiri-dengan-perkataan2-yang-lebih-tulin-bagi-malaya` · "Chetusan"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11323 · `spark-yang-di-mulai-dengan-perkataan2-spark-is-the-courageous-voice-of-the-oppressed-majority-dan-di-akhiri-dengan-perkataan2-and-oppressors-is-lighter-than-a-feather` · "Spark" yang Di-mulai Dengan Perkataan2 "spark Is the Courageous Voice of the Oppressed Majority...."dan Di-akhiri Dengan Perkataan2 "....and Oppressors Is Lighter Than a Feather"."

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11324 · `chetusan-yang-di-mulai-dengan-perkataan2-bahasa-cina-dan-di-akhiri-dengan-perkataan2-bahasa-cina` · "Chetusan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11325 · `chetusan-yang-di-mulai-dengan-perkataan2-bahasa-tamil-dan-di-akhiri-dengan-perkataan2-bahasa-tamil` · "Chetusan"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11328 · `misi-bagi-parti-kominis-china-semasa-peperangan-anti-jepun-kedudukan-parti-kominis-china-dalam-perjuangan-nasional` · "Misi Bagi Parti Kominis China Semasa Peperangan Anti Jepun Kedudukan Parti Kominis China dalam Perjuangan Nasional"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11330 · `mimbar-rakyat` · "Mimbar Rakyat"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11331 · `bendera-banteng` · "Bendera Banteng"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11332 · `mother-india` · "Mother India"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11333 · `kebaikan-rengkasan-tulisan-china` · "Kebaikan Rengkasan Tulisan China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11334 · `kejayaan-tertanggong-kepada-daya-manusia` · "Kejayaan Tertanggong Kepada Daya Manusia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11335 · `ayer-mata-ibu` · "Ayer Mata Ibu"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11349 · `love-together` · "Love Together"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11356 · `suara-siswa-jilid-2-bil-2-disember-1970` · "Suara Siswa Jilid 2 Bil.2 Disember, 1970"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11357 · `bulanan-riam` · "Bulanan Riam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11358 · `bulanan-seni-sastera` · "Bulanan Seni Sastera"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11359 · `bulanan-pembangunan` · "Bulanan Pembangunan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11360 · `majalah-triwulanan-kehidupan-seni-sastera` · "Majalah Triwulanan Kehidupan Seni Sastera"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11361 · `keluaran-khas-mengenai-pertonjokan2-amal-oleh-rombongan-bintang2-perak-hongkong-di-malaysia-1971` · "Keluaran Khas Mengenai Pertonjokan2 Amal Oleh Rombongan Bintang2 Perak Hongkong Di-malaysia, 1971"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11362 · `pengerusi-mao-yang-di-sayangi-anda-ia-lah-mata-hari-merah-yang-bersinar-dalam-sanubari2-kami-nombor-xm-1022` · "Pengerusi Mao yang Di-sayangi, Anda Ia-lah Mata Hari Merah yang Bersinar dalam Sanubari2 Kami Nombor - XM - 1022"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11363 · `muzik-pendahuluan-bagi-chetakan-ulangan` · "Muzik Pendahuluan Bagi Chetakan Ulangan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11364 · `pahlawan-pengerusi-mao-ada-lah-paling-taat-kepada-parti-nombor-m-804` · "Pahlawan Pengerusi Mao Ada-lah Paling Taát Kepada Parti Nombor - M- 804"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11365 · `memuji-wong-kit-dengan-nyanyian-dan-belajar-lah-daripada-wong-kit-nombor-m-769` · "Memuji Wong Kit Dengan Nyanyian dan Belajar-lah Daripada Wong Kit Nombor - M - 769"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11366 · `piring-hitam-mas-sempena-lawatan-rombongan-bintang2-perak-ka-malaysia-nombor-mlp-325` · "Piring Hitam Mas Sempena Lawatan Rombongan Bintang2 Perak Ka-malaysia Nombor MLP - 325"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11367 · `the-muslims-malays-of-south-thailand-orang2-melayu-islam-di-negeri-thai-selatan` · "The Muslims Malays of South Thailand (Orang2 Melayu Islam di -negeri Thai Selatan)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11368 · `flossie` · "Flossie"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11371 · `autobiography-of-a-louse-volume-ii` · "Autobiography of a Louse Volume Ii"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11374 · `adventures-in-american-and-story-of-mike` · "Adventures in American and Story of Mike"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11381 · `only-a-boy` · "Only a Boy"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11385 · `autobiography-of-a-flea` · "Autobiography of a Flea"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11400 · `flosste` · "Flosste"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11423 · `mao-tse-tung-yang-agong-ada-lah-gilang-gemilang` · "Mao Tse-tung yang Agong Ada-lah Gilang Gemilang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11424 · `pit-tuan` · "Pit Tuan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11425 · `sadikit-sabanyak-tinjauan-di-negeri-negeri-china` · "Sadikit-sabanyak Tinjauan Di-negeri-negeri China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11426 · `selamat-tahun-baharu-suratan-ini-mulai-dengan-perkataan2` · "Selamat Tahun Baharu Suratan Ini Mulai Dengan Perkataan2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11428 · `temptation-of-the-hot-spring` · "Temptation of the Hot Spring"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11430 · `armoured-car-of-the-flesh-war` · "Armoured Car of the Flesh War"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11431 · `blossom-flowers-and-the-full-moon` · "Blossom Flowers and the Full Moon"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11435 · `selangor-persatuan-murid2-tua-sekolah-kampong-baharu-serdang-perayaan-ulang-tahun-kedua-persatuan-malam-irama-1971` · "Selangor Persatuan Murid2 Tua Sekolah Kampong Baharu Serdang Perayaan Ulang Tahun Kedua Persatuan Malam Irama 1971"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11442 · `suratan2-dalam-bahasa-china-yang-mengandongi-perkataan2-dan-muzik-dalam-lagu2-yang-tajok2nya-ia-lah-terdapat-sebanyak-13-tajuk` · "Suratan2 dalam Bahasa China yang Mengandongi Perkataan2 dan Muzik dalam Lagu2 yang Tajok2Nya Ia-lah: (terdapat Sebanyak 13 Tajuk)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11444 · `the-constitution-of-the-communist-party-of-malaya-30-apr-72` · "The Constitution of the Communist Party of Malaya-30 Apr 72"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11446 · `china-pictorial-no-8-aug-1972` · "China Pictorial No.8 Aug, 1972"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11451 · `the-lovely-affair-of-a-dissolute-women` · "The Lovely Affair of a Dissolute Women"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11453 · `the-queen-of-education` · "The Queen of Education"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11454 · `quadricycle` · "Quadricycle"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11459 · `i-margo` · "I Margo"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11463 · `blue-cover-mystery-magazine` · "Blue Cover Mystery Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11464 · `suara-msdr` · "Suara MSDR"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11465 · `time` · "Time"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11469 · `the-story-of-a-croaching-tiger` · "The Story of a "croaching Tiger""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11470 · `offering-a-pot-of-tea` · "Offering a Pot of Tea"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11471 · `a-heap-of-ground-nuts` · "A Heap of Ground-nuts"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11472 · `fighting-north-and-south` · "Fighting North and South"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11473 · `kill-the-enemy-bravely` · "Kill the Enemy Bravely"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11474 · `close-friendship` · "Close Friendship"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11475 · `little-soldier-cheong-ha` · "Little Soldier Cheong Ha"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11476 · `childhood-gorkys-story-part-1` · "Childhood Gorky's Story Part 1"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11477 · `cleverness-of-young-guide-little-sentry-of-wufu-town-part-1` · "Cleverness of Young Guide-little Sentry of Wufu Town (part 1)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11478 · `harassing-the-enemies-in-a-battle-in-front-of-the-village-little-sentry-of-wu-fu-town-part-ii` · "Harassing the Enemies in a Battle in Front of the Village-little Sentry of Wu Fu Town (part Ii)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11479 · `marshaf-al-harmain-koran-yang-tidak-cukup-ayat-ayatnya` · "Marshaf Al Harmain (koran yang Tidak Cukup Ayat-ayatnya)"

- placeholder: `Anonymous` (id=33); year=?; lang=ar
- evidence: (no/empty description)

### book 11480 · `new-chance` · "New Chance"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11481 · `mayfair` · "Mayfair"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11482 · `curious` · "Curious"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11483 · `knave` · "Knave"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11484 · `fotostrip` · "Fotostrip"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11485 · `pretty-girl` · "Pretty Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11486 · `girls-of-the-month` · "Girls of the Month"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11487 · `the-swinger` · "The Swinger"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11488 · `we-all-need-someone` · "We All Need Someone"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11489 · `adam-film-world` · "Adam Film World"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11490 · `mans-life` · "Man's Life"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11491 · `family-vengeance` · "Family Vengeance"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11492 · `fetish-and-fantasy` · "Fetish and Fantasy"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11493 · `femme-fatale` · "Femme Fatale"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11494 · `bondage-classics` · "Bondage Classics"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11495 · `aggressive-gals` · "Aggressive Gals"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11496 · `dusky` · "Dusky"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11497 · `bachelor-girls` · "Bachelor Girls"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11498 · `bound-in-terror` · "Bound in Terror"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11499 · `revenge-of-the-wantons` · "Revenge of the Wantons"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11500 · `finite-boundage` · "Finite Boundage"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11501 · `backstage-doll-in-bondage` · "Backstage Doll in Bondage"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11502 · `topper-spring-annual` · "Topper Spring Annual"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11503 · `topper-summer-annual` · "Topper Summer Annual"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11504 · `rogue-spring-annual` · "Rogue Spring Annual"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11515 · `scoring-dan-greenburg` · "Scoring dan Greenburg"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11518 · `lady-mildfreds-memoirs` · "Lady Mildfred's Memoirs"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11521 · `the-dirty-rotten-truth` · "The Dirty Rotten Truth"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11522 · `lesbos-a-photo-book-of-lesbian-love` · "Lesbos-a Photo Book of Lesbian Love"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11526 · `men-only` · "Men Only"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11527 · `club-international` · "Club International"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11528 · `trade-mark` · "Trade Mark"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11540 · `ketua-mao-rakyat-malaya-memuji-kau-panjang-usia` · "Ketua Mao, Rakyat Malaya Memuji Kau Panjang Usia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11541 · `gunong` · "Gunong"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11542 · `panji` · "Panji"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11543 · `rakyat-malaya-menjunjung-tinggi2-panji-merah-besar-perjuangan-bersenjata-maju-tak-gentar` · "Rakyat Malaya Menjunjung Tinggi2 Panji Merah Besar Perjuangan Bersenjata Maju Tak Gentar"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11544 · `menyenandong-parti-komunis-malaya` · "Menyenandong Parti Komunis Malaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11545 · `menyenandong-tentera-pembebasan-nasional-malaya` · "Menyenandong Tentera Pembebasan Nasional Malaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11546 · `parti-nan-jaya-pernyataan-nan-jaya` · "Parti Nan Jaya, Pernyataan Nan Jaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11547 · `menyenandong-perlembagaan-parti-yang-baru` · "Menyenandong Perlembagaan Parti yang Baru"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11548 · `bersorak-lahirnya-ulang-tahun-ke-40-parti-nan-jaya` · "Bersorak Lahirnya Ulang Tahun Ke- 40 Parti Nan Jaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11549 · `menyenandongkan-ulang-tahun-ke-20-hari-tentera-1-february` · "Menyenandongkan Ulang Tahun ke -20 Hari Tentera "1 February""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11550 · `pasokan-penggempur-yang-heroik-sedang-mara` · "Pasokan Penggempur yang Heroik Sedang Mara"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11551 · `balek-ke-basis-lama` · "Balek Ke- Basis Lama"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11552 · `menyenandongkan-5-baik` · "Menyenandongkan "5 Baik""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11553 · `dua-puloh-tahun-bertempor-merintis-jalan-raya-merah` · "Dua Puloh Tahun Bertempor Merintis Jalan Raya Merah"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11554 · `lagu-gerilawati` · "Lagu Gerilawati"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11555 · `menegakkan-jasa` · "Menegakkan Jasa"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11556 · `menyenandongkan-sajak-ketua-mao` · "Menyenandongkan Sajak Ketua Mao"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11557 · `gunong-tahan-tinggi-menawan` · "Gunong Tahan Tinggi Menawan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11558 · `kiriman-kepada-rakan-seperjuangan-yang-karib` · "Kiriman Kepada Rakan Seperjuangan yang Karib"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11559 · `merindukan-kawan-seperjuangan-karib` · "Merindukan Kawan Seperjuangan Karib"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11560 · `bersorak-pembukaan-sekolah-parti` · "Bersorak Pembukaan Sekolah Parti"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11561 · `memuji-kemenangan-besar-tahun-baru-vietnam` · "Memuji Kemenangan Besar Tahun Baru Vietnam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11562 · `lagu-peringatan-hari-pahlawan-1-september` · "Lagu Peringatan Hari Pahlawan "1 September""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11563 · `memuja-ulang-tahun-ke-100-keputeraan-guru-agung-lenin` · "Memuja Ulang Tahun ke 100 Keputeraan Guru Agung Lenin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11564 · `malam-hari-raya` · "Malam Hari Raya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11565 · `tentera-dan-rakyat-menyanyi-lagu-kemenangan-dengan-gembira` · "Tentera dan Rakyat Menyanyi Lagu Kemenangan Dengan Gembira"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11566 · `kanak-kanak-barisan-pembebasan` · "Kanak-kanak Barisan Pembebasan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11567 · `api` · "Api"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11568 · `build-the-pki-along-the-marxist-leninist-to-lead-the-peoples-democratic-revolution-in-indonesia` · "Build the Pki Along the Marxist-leninist to Lead the People's Democratic Revolution in Indonesia"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11569 · `marakkan-perjuangan-lencana` · "Marakkan Perjuangan (lencana)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11570 · `tasik-utara-lencana` · "Tasik Utara (lencana)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11572 · `economic-reporter` · "Economic Reporter"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11573 · `new-thought` · "New Thought"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11576 · `hong-kong-workers` · "Hong Kong Workers"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11578 · `book-at-a-glance` · "Book at a Glance"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11579 · `red-sun-in-the-hearts-of-the-sah-yee-people` · "Red Sun in the Hearts of the Sah Yee People"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11580 · `the-great-peking` · "The Great Peking"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11581 · `ah-wah-people-sing-new-song` · "Ah Wah People Sing New Song"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11582 · `singing-never-ends-in-chang-mountain` · "Singing Never Ends in Chang Mountain"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11583 · `red-sun-shines-over-border` · "Red Sun Shines Over Border"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11584 · `artist-magazine` · "Artist Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11585 · `causeway-newspaper` · "Causeway (newspaper)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11586 · `the-china-monthly` · "The China Monthly"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11588 · `the-last-two-million-years` · "The Last Two Million Years"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11589 · `oui` · "Oui"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11590 · `playboy-past-present-future` · "Playboy Past, Present, Future"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11591 · `penthouse-forum` · "Penthouse Forum"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11592 · `playgirl` · "Playgirl"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11593 · `continental-film-review` · "Continental Film Review"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11594 · `funny-half-hour` · "Funny Half Hour"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11595 · `international-man` · "International Man"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11596 · `private` · "Private"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11597 · `private-girl` · "Private Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11598 · `cinema` · "Cinema"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11599 · `adult-cinema` · "Adult Cinema"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11600 · `in-this-world-gorkys-story-part-ii` · "In This World- Gorky's Story Part Ii"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11601 · `male-erotic-zones` · "Male Erotic Zones"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11602 · `bondage` · "Bondage"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11603 · `female-forum` · "Female Forum"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11605 · `suratan-dalam-bahasa-kebangsaan-yang-bertajuk-pilihanraya-cara-parti-parti-kanan-sejak-1955` · "Suratan dalam Bahasa Kebangsaan yang Bertajuk "pilihanraya Cara Parti-parti Kanan Sejak 1955"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11606 · `lagu-merdu-untuk-parti-jaya-the-words-and-music-of-this-sung` · "Lagu Merdu untuk Parti Jaya (the Words and Music of This Sung)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11607 · `pkm-bintang-merah-bercahaya-the-words-and-music-of-this-song` · "PKM Bintang Merah Bercahaya (the Words and Music of This Song)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11608 · `china-pictorial-no-1-1975` · "China Pictorial No. 1/1975"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11609 · `china-pictorial-no-2-1975` · "China Pictorial No.2 / 1975"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11610 · `china-pictorial-no-6-1975` · "China Pictorial No.6 / 1975"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11611 · `solidarity` · "Solidarity"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11612 · `the-invisible-secret-weapon-of-mao-tze-tung-the-peoples-militia-of-china` · "The Invisible Secret Weapon of Mao Tze-tung: the People's Militia of China"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11613 · `badan-pengamal-rasuah-siri-kedua` · "Badan Pengamal Rasuah Siri Kedua"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11615 · `a-document-the-text-where-of-commences-with-the-words-kami-sekumpulan-rakyat-malaysia-dated-2nd-sept-1975-printed-in-bahasa-msia-with-certified-copies-of-five-extracts-of-title-from-the-land-re` · "A Document the Text Where of Commences with the Words "kami Sekumpulan Rakyat Malaysia"dated 2Nd Sept 1975, Printed in Bahasa M'sia with Certified Copies of Five Extracts of Title from the Land Re"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11616 · `anak-tani-machang-sudah-jadi-jutawan-dated-2nd-sept-1975-purported-to-have-been-written-by-kumpulan-anti-rasuah-negara` · "Anak Tani Machang Sudah Jadi Jutawan Dated 2Nd Sept 1975 (purported to Have Been Written BY: Kumpulan Anti Rasuah Negara)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11617 · `para-pemimpin-dan-nasionalis-melayu-di-malaysia-a-letter-form-addressed-to-the-above-title-dated-1st-oct-1975-purported-to-have-been-written-by-angkatan-barisan-bertindak-melayu-markas-1-1` · "Para Pemimpin dan Nasionalis Melayu di Malaysia - ( a Letter Form Addressed to the Above Title) Dated 1St Oct 1975 (purported to Have Been Written BY: Angkatan Barisan Bertindak Melayu, Markas 1, 1"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11618 · `suara-rakyat-bil-12-tahun-pertama-bertarikh-6hb-disember-1975` · "Suara Rakyat (Bil. 12, Tahun Pertama, 6 December 1975)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11620 · `along-the-path-of-golden-light` · "Along The Path of Golden Light"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11621 · `malaya-news-service` · "Malaya News Service"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11624 · `basic-knowledge-on-military-science` · "Basic Knowledge On Military Science"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11626 · `swiss-press-review-and-news-report-vol-xvi-no-43-bertarikh-27hb-oktober-1975` · "Swiss Press Review and News Report Vol. XVI No. 43 bertarikh 27hb Oktober, 1975"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11627 · `new-year-address-of-the-great-leader-comrade-kim-ii-sung-general-secretary-of-the-central-committee-of-the-korkers-party-of-korea-and-president-of-the-state-of-the-democratic-peoples-republic-of` · "New Year Address of the Great Leader Comrade Kim Ii Sung, General Secretary of the Central Committee of the Korkers Party of Korea and President of the State of the Democratic People's Republic Of"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11628 · `mao-tse-tung` · "Mao Tse-tung"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11629 · `pictorial-magazine-on-the-death-of-chairman-mao-tse-tung` · "Pictorial Magazine On The Death of Chairman Mao Tse-tung"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11630 · `mao-tse-tung-passes-away` · "Mao Tse-tung Passes Away"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11631 · `kematian-mao-tse-tung` · "Kematian Mao-Tse-tung"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11632 · `the-message-of-the-quran-oleh-hashim-amir-ali` · "The Message of the Quran Oleh Hashim Amir-ali"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11636 · `suratan-bertajuk-umat-islam-perlu-perhebatkan-lagi-perjuangan-untuk-kebenaran-dan-keadilan-bertarikh-6-oktober-1975` · "Suratan bertajuk "UMAT ISLAM PERLU PERHEBATKAN LAGI PERJUANGAN UNTUK KEBENARAN DAN KEADILAN" BERTARIKH 6 Oktober 1975"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11637 · `suluh-keadilan-jadikan-hari-raya-sebagai-hari-mengorbankan-lagi-perjuangan-umat-islam-bertarikh-disember-1975` · "Suluh Keadilan — Jadikan Hari Raya Sebagai Hari Mengorbankan Lagi Perjuangan Umat Islam"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11639 · `suara-demokrasi` · "Suara Demokrasi"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- co-credited (non-placeholder): _Pelajar=pelajar Demokratik Tanahair_
- evidence: (no/empty description)

### book 11640 · `the-perspective-keluaran-no-69-bertarikh-16-2-1976` · "THE PERSPECTIVE (Keluaran No. 69 bertarikh 16/2/1976)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11641 · `mangsa-kekejaman-fasis-thai-barisan-nasional-pembebasan-patani` · "Mangsa Kekejaman Fasis Thai ( Barisan Nasional Pembebasan Patani)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11643 · `suluh-keadilan-jadikan-hari-raya-sebagai-hari-mengorbankan-lagi-perjuangan-umat-islam-disember-1975` · "Suluh Keadilan - Jadikan Hari Raya Sebagai Hari Mengorbankan Lagi Perjuangan Umat Islam - Disember 1975"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11645 · `suara-demokrasi-pelajar-pelajar-demokratik-tanahair` · "Suara Demokrasi (pelajar-pelajar Demokratik Tanahair)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11646 · `i-love-pekings-tien-an-men` · "I Love Peking's Tien an Men"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11647 · `a-brilliant-spectacle` · "A Brilliant Spectacle"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11648 · `like-fish-and-water` · "Like Fish and Water"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11649 · `shachiapang` · "Shachiapang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11650 · `the-red-flower-of-tachai-blossoms-everywhere` · "The Red Flower of Tachai Blossoms Everywhere"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11651 · `the-yellow-river-the-red-lantern` · "The Yellow River; the Red Lantern"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11652 · `wide-angle-48-bertarikh-16-9-76-termasuk-keluaran-yang-lalu-dan-yang-akan-datang` · "Wide Angle (issue 48, 16 September 1976)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11653 · `the-perspective-76-bertarikh-16-9-76-termasuk-keluaran-yang-lalu-dan-yang-akan-datang` · "The Perspective (issue 76, 16 September 1976)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11654 · `asian-student-news-termasuk-keluaran-keluaran-yang-lalu-dan-yang-akan-datang` · "ASIAN STUDENT NEWS (Termasuk keluaran-keluaran yang lalu dan yang akan datang)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11655 · `wide-angel-48-bertarikh-16-9-76-termasuk-keluaran-yang-lalu-dan-akan-datang` · "Wide Angle (issue 48, 16 September 1976)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11656 · `the-perspective-76-bertarikh-16-9-76-termasuk-keluaran-yang-lalu-dan-akan-datang` · "The Perspective (issue 76, 16 September 1976)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11660 · `suratan-bertajuk-baca-dan-fikir-semasak-masaknya` · "suratan bertajuk "BACA DAN FIKIR SEMASAK-MASAKNYA""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11661 · `baca-dan-fikir-semasak-masaknya` · "Baca dan Fikir Semasak-masaknya"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11666 · `suratan-bertajuk-mic-anti-islam` · "Suratan bertajuk "MIC ANTI ISLAM""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11667 · `suratan-bertajuk-dr-mahathir-dan-bukunya-the-malay-dilemma` · "Suratan bertajuk "DR. MAHATHIR DAN BUKUNYA THE MALAY DILEMMA' ""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11668 · `suratan-bertajuk-m-i-c-is-anti-islam-and-a-threat-to-religious-harmony` · "Suratan bertajuk "M.I.C. IS ANTI-ISLAM AND A THREAT TO RELIGIOUS HARMONY""

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11670 · `majalah-dian-bulan-september-1978` · "Majalah Dian Bulan September 1978"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11672 · `exposing-the-betrayers-of-the-chinese-peoples` · "Exposing the Betrayers of the Chinese Peoples"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11674 · `some-articles-on-striving-for-marxism-leninism-in-australia` · "Some Articles on Striving for Marxism Leninism in Australia"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11675 · `confucius-sage-of-the-reactionary-classes` · "Confucius — Sage of the Reactionary Classes"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11676 · `mine-walfare` · "Mine Walfare"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11677 · `1-1-mahathir-menyalahgunakan-kuasa-1-2-mahathir-mengkhianati-bumiputra-1-3-mahathir-anti-dakwah-anti-islam-1-4-mahathir-perlaku-teknik-kotor` · "Mahathir Menyalahgunakan Kuasa"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11682 · `risalah-yang-bertajuk-penekanan-terhadap-gerakan-islam` · "Risalah yang bertajuk "PENEKANAN TERHADAP GERAKAN ISLAM""

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11683 · `risalah-yang-bertajuk-ancaman-komunisma-di-malaysia` · "Risalah yang bertajuk "Ancaman Komunisma di Malaysia""

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11684 · `ancaman-komunisma-di-malaysia` · "Ancaman Komunisma di Malaysia"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11689 · `manusia-bertanya-tuhan-allah-menjawab` · "Manusia Bertanya Tuhan Allah Menjawab"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11690 · `siapa-yang-suka-akan-gelap` · "Siapa yang Suka Akan Gelap"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11691 · `hidup-yang-sungguh-bererti-bagi-saudara` · "Hidup yang Sungguh Bererti Bagi Saudara"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11692 · `saksi-yang-setia` · "Saksi yang Setia"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11693 · `malaysia-negara-rakyat-china-anggota-dap-selurohnya` · "Malaysia Negara Rakyat China.anggota Dap Selurohnya"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11694 · `malaysia-negara-china` · "Malaysia Negara China"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11696 · `lembahnya-nan-gersang` · "Lembahnya Nan Gersang"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11699 · `remberance-of-the-youth-movement` · "Remberance of the Youth Movement"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11700 · `risalah-bertajuk-vox-populi-united-we-liberate` · "risalah bertajuk "VOX POPULI-UNITED WE LIBERATE""

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11701 · `terang-boelan` · "Terang Boelan"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11702 · `risalah-bertajuk-jawatankuasa-berhubung-tanahair-benua-besar-china-cawangan-malaysia` · "Risalah bertajuk "JAWATANKUASA BERHUBUNG TANAHAIR BENUA BESAR CHINA-CAWANGAN MALAYSIA""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11704 · `risalah-bertajuk-malaysia-negara-rakyat-china-anggota-dap-seluruh-cawangan-perak` · "Risalah bertajuk "MALAYSIA NEGARA RAKYAT CHINA-ANGGOTA DAP SELURUH CAWANGAN PERAK""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11707 · `hancurkan-komplot-bn-yang-hendak-menarik-balik-pas-ke-dalam-bn` · "Hancurkan Komplot BN yang Hendak Menarik Balik Pas ke dalam BN"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11708 · `seruan-keadilan-dan-sebarang-terjemahannya` · "Seruan Keadilan (dan Sebarang Terjemahannya)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11710 · `alkitab` · "Alkitab"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 11711 · `the-heroes` · "The Heroes"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11712 · `drunken-fist` · "Drunken Fist"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11713 · `biography-of-the-wild-wolf` · "Biography of the Wild Wolf"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11714 · `the-buddhas-palm` · "The Buddha's Palm"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11715 · `the-tai-chi-sect` · "The Tai-chi Sect"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11716 · `whirl-wind` · "Whirl Wind"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11717 · `little-eagle` · "Little Eagle"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11718 · `young-bar-girl` · "Young Bar Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11719 · `strong-mantis` · "Strong Mantis"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11720 · `bruce-lee` · "Bruce Lee"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11721 · `the-chairmans-message-to-the-bangsa-moro-people-for-unity` · "The Chairman's Message To The Bangsa Moro People For Unity"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11722 · `nadi-insan-bulan-disember-1982` · "Nadi Insan (December 1982)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11723 · `kalam-hidup` · "Kalam Hidup"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 11724 · `perjanjian-baru` · "Perjanjian Baru"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 11725 · `suratan-yang-mengandungi-ayat-ayat-suci-al-quran-bersama-sama-dengan-atau-dimana-di-belakangnya-terdapat-gambar-gambar-binatang-binatang-atau-benda-benda-yang-dihina-atau-yang-dianggap-najis-di-dalam` · "Suratan yang mengandungi ayat-ayat suci al-Quran bersama-sama dengan, atau dimana di belakangnya terdapat gambar-gambar binatang-binatang atau benda-benda yang dihina atau yang dianggap najis di dalam"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 11726 · `nadi-insan-bil-51-bulan-julai-1983` · "Nadi Insan (Bil. 51, July 1983)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11733 · `risalah-bertajuk-perang-yang-dipaksa` · "Risalah bertajuk "PERANG YANG DIPAKSA""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11734 · `risalah-bertajuk-pakatan-jahat-kuasa-kuasa-besar-terhadap-islam-imam-khomeini` · "Risalah bertajuk "PAKATAN JAHAT KUASA-KUASA BESAR TERHADAP ISLAM-IMAM KHOMEINI""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11735 · `risalah-bertajuk-we-are-the-brown-indians` · "Risalah bertajuk "WE ARE THE BROWN INDIANS""

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11736 · `risalah-bertajuk-barisan-bersatu-keadilan-masyarakat-malaya-8-perkara-penting-untuk-pembelaan` · "Risalah bertajuk "BARISAN BERSATU KEADILAN MASYARAKAT MALAYA: 8 PERKARA PENTING UNTUK PEMBELAAN""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11762 · `my-curiosity` · "My Curiosity"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11763 · `the-adventure` · "The Adventure"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11764 · `the-fantasies-magazine` · "The Fantasies Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11765 · `yellow-book` · "Yellow Book"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11766 · `green-cover-mystery-magazine` · "Green Cover Mystery Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11767 · `the-discovery-magazine` · "The Discovery Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11783 · `seksologi` · "Seksologi"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- co-credited (non-placeholder): _Helmy Halim_
- evidence: (no/empty description)

### book 11792 · `rahsia-hati` · "Rahsia Hati"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11794 · `fire-unicorn` · "Fire Unicorn"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11795 · `youth` · "Youth"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11806 · `untuk-mereka-yang-berkorban-di-sri-langka-bagi-tamil-eelam-majalah-tanda-penghargaan` · "Untuk Mereka Yang Berkorban Di Sri Langka Bagi Tamil Eelam: Majalah Tanda Penghargaan"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11809 · `spirit-world-speaks-where-is-his-majesty-the-king-the-sixth-ruler-of-malaysia` · "Spirit World Speaks-Where Is His Majesty The King The Sixth Ruler of Malaysia"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- co-credited (non-placeholder): _Clara Christina Matthews Amanuensis_
- evidence: (no/empty description)

### book 11811 · `imperialism-no-democracy-yes-student-movements-in-the-asean-region` · "Imperialism-No! Democracy-Yes! Student Movements In The Asean Region"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11814 · `kecil-kecil-lembu-jaga` · "Kecil-kecil Lembu Jaga"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11815 · `pergi-pasar-malam-shes-a-lady` · "Pergi Pasar Malam (She's A Lady)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11816 · `naik-kuda` · "Naik Kuda"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11818 · `the-sign-of-the-scorpion` · "The Sign of the Scorpion"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11820 · `arabella` · "Arabella"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11826 · `voise-of-the-people` · "Voise Of The People"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11828 · `confessions-of-a-male-dancer` · "Confessions of a Male Dancer"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11829 · `good-recomendation` · "Good Recomendation"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11830 · `hong-kong-97` · "Hong Kong 97"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11831 · `richman-bi-weekly` · "Richman Bi-weekly"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11832 · `grandfather` · "Grandfather"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11833 · `mens-own` · "Men's Own"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11834 · `more-magazine` · "More Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11835 · `men` · "Men"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11836 · `james-bond-magazine` · "James Bond Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11837 · `report-of-the-cherry` · "Report of the Cherry"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11838 · `hello` · "Hello"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11839 · `hong-kong-86` · "Hong Kong 86"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11840 · `gold-haired-pussy-cat` · "Gold-haired Pussy Cat"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11841 · `butterflies-and-beautiful-flowers` · "Butterflies And Beautiful Flowers"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11842 · `pretty-girl-and-romantic-boy` · "Pretty Girl and Romantic Boy"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11843 · `feeling-of-a-young-girl` · "Feeling of A Young Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11845 · `menjawab-cabaran-buku-hadis-satu-penilaian-semula` · "Menjawab Cabaran Buku Hadis Satu Penilaian Semula"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11846 · `jawapan-kepada-buku-hadis-satu-penilaian-semula` · "Jawapan Kepada Buku "Hadis Satu Penilaian Semula""

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11847 · `minah` · "Minah"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11848 · `jangan-pegang-dik` · "Jangan Pegang Dik"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11849 · `in-the-morning` · "In The Morning"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11850 · `es-lilin` · "ES Lilin"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11851 · `buah-babuai` · "Buah Babuai"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11852 · `tody-minum` · "Tody minum"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11853 · `mak-we-ku` · "Mak We Ku"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11854 · `bengawan-so-long` · "Bengawan So Long"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11895 · `maharaja-china-yang-lucah` · "Maharaja China yang lucah"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11896 · `lelaki-dan-wanita` · "Lelaki dan Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11897 · `seks-cinta-dan-perkahwinan` · "Seks, Cinta dan Perkahwinan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11898 · `kelab-lucu` · "Kelab Lucu"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11899 · `kenikmatan-kelas-pertama` · "Kenikmatan Kelas Pertama"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11900 · `ghairah-tengah-malam` · "Ghairah Tengah Malam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11901 · `soalan-soalan-mengenai-kedua-dua-jantina` · "Soalan-soalan Mengenai Kedua-dua Jantina"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11902 · `tikar-tikar-jade` · "Tikar-tikar Jade"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11903 · `surat-surat-lelaki-dan-wanita` · "Surat-surat Lelaki dan Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11904 · `hi` · "Hi!"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11905 · `69-jenaka-dewasa` · "69 Jenaka Dewasa"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11911 · `quran-the-final-scripture-authorized-english-version` · "Quran: The Final Scripture (Authorized English Version)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11913 · `teman-seks` · "Teman Seks"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11914 · `perempuan-yang-gilakan-seks` · "Perempuan Yang Gilakan Seks"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11915 · `bunga-bunga-berkembang-di-musim-bunga` · "Bunga-bunga Berkembang Di Musim Bunga"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11916 · `orang-yang-bermain-dengan-api` · "Orang Yang Bermain Dengan Api"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11917 · `gadis-lacur` · "Gadis Lacur"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11918 · `wanita-masyhur` · "Wanita Masyhur"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11919 · `gadis-thai` · "Gadis Thai"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11920 · `gadis-yang-cantik` · "Gadis Yang Cantik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11921 · `kisah-cinta-saya-dengan-encik-x` · "Kisah Cinta Saya Dengan Encik X"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11922 · `majalah-fantastik` · "Majalah Fantastik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11931 · `the-adventure-of-a-schoolboy` · "The Adventure Of A Schoolboy"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11936 · `101-sexual-positions` · "101 Sexual Positions"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11937 · `lagu-lagu-long-march` · "Lagu-lagu "Long March""

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11938 · `majalah-intan-biru` · "Majalah Intan Biru"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11939 · `majalah-merah-kuning-dan-hitam` · "Majalah Merah Kuning dan Hitam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11940 · `suami-yang-berahi` · "Suami Yang Berahi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11941 · `cerita-cerita-hantu` · "Cerita-cerita Hantu"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11943 · `love-life-cross-road` · "Love Life (Cross Road)"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 11961 · `me` · "Me"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11964 · `pilihan-lagu-lagu-peperangan-menentang-jepun-jilid-2` · "Pilihan Lagu-Lagu Peperangan Menentang Jepun-Jilid 2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11966 · `neraka` · "Neraka"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 11970 · `the-hot-new-game` · "The Hot New Game"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11971 · `cheri` · "Cheri"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11972 · `unite-no-25` · "Unite No. 25"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11973 · `nugget` · "Nugget"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11974 · `gallery` · "Gallery"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11975 · `live` · "Live"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11976 · `high-society` · "High Society"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11977 · `partner-number-one` · "Partner Number One"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11978 · `superstars-of-sex` · "Superstars Of Sex"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11979 · `the-girls-of-penthouse` · "The Girls of Penthouse"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11980 · `people` · "People"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11981 · `honey` · "Honey"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11982 · `hongkong-europe-american-copy` · "Hongkong (Europe & American Copy)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11983 · `newlook` · "Newlook"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11986 · `kemuncak` · "Kemuncak"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11987 · `dunia-yang-baik` · "Dunia Yang Baik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11988 · `super-star-antarabangsa` · "Super Star Antarabangsa"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11989 · `naga` · "Naga"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11990 · `hans-untuk-lelaki` · "Hans Untuk Lelaki"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11991 · `paladine` · "Paladine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11992 · `rekod-sulit-wei-wei-lee` · "Rekod Sulit Wei Wei Lee"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11996 · `the-trouble-with-girls-vol-2-3` · "The Trouble with Girls Vol 2#3"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 11998 · `konserto-biola-liang-shang-po-dan-chu-ying-tai` · "Konserto Biola Liang Shang-Po dan Chu Ying-Tai"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 11999 · `percutian-yang-romantik-romantic-holidays` · "Percutian Yang Romantik (Romantic Holidays)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12000 · `gadis-remaja-young-lady` · "Gadis Remaja (Young Lady)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12001 · `helang-biru-blue-eagle` · "Helang Biru (Blue Eagle)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12002 · `percintaan-di-gelanggang-ragbi-love-at-the-rugby-field` · "Percintaan Di Gelanggang Ragbi (Love At The Rugby Field)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12003 · `raja-penipu-yang-bernama-lo-xiao-qian-master-conman-lo-xiao-qian` · "Raja Penipu Yang Bernama Lo Xiao Qian (Master Conman Lo Xiao Qian)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12004 · `impian-seorang-peminat` · "Impian Seorang Peminat"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12005 · `berangan-angan-day-dream` · "Berangan-angan (Day Dream)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12006 · `sungai-besar-berdarah-big-bloody-river` · "Sungai Besar Berdarah (Big Bloody River)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12007 · `waris-inheritor` · "Waris (Inheritor)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12008 · `mimpi-yang-hancur-broken-dream` · "Mimpi Yang Hancur (Broken Dream)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12010 · `mana-mana-logo-dalam-rekabentuk-daun-ganja-yang-dikelilingi-dengan-perkataan-perkataan` · "Mana-mana Logo dalam rekabentuk daun ganja yang dikelilingi dengan perkataan-perkataan"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 12017 · `adam-eve-customers-tell-all` · "Adam & Eve Customers Tell All"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12023 · `what-rugby-jokes-did-next` · "What Rugby Jokes Did Next"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12039 · `rip-off-no-18` · "Rip Off No. 18"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12043 · `terperangkap-di-sarang` · "Terperangkap Di Sarang"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12048 · `pengetahuan-perubatan-untuk-wanita-medical-knowledge-for-women` · "Pengetahuan Perubatan Untuk Wanita (Medical Knowledge for Women)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12049 · `mengurut-mengikut-kaedah-acupuncture-dengan-ilustrasi-untuk-pelajar-baru-massage-on-acupuncture-points-for-beginners` · "Mengurut Mengikut Kaedah Acupuncture Dengan Ilustrasi Untuk Pelajar Baru (Massage On Acupuncture Points For Beginners)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12055 · `seni-erotik-su-nu-erotic-art-of-su-nu` · "Seni Erotik Su Nu (Erotic Art Of Su Nu)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12057 · `malam-yang-membakar` · "Malam Yang Membakar"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12059 · `kemuncak-peak` · "Kemuncak (Peak)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12060 · `tuan-muda-young-master` · "Tuan Muda (Young Master)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12062 · `morbid-angel-altars-of-madness` · "Morbid Angel Altars of Madness"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12063 · `thiraichithra` · "Thiraichithra"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 12064 · `hawa-hawa` · "Hawa-Hawa"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 12065 · `vinotha-siripu-koojathi-kooja` · "Vinotha Siripu Koojathi Kooja"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 12089 · `the-kamasutra-of-vatsyayana-special-collectors-edition-includes-explicit-photographs` · "The Kamasutra Of Vatsyayana Special Collector's Edition. Includes Explicit Photographs"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12091 · `sexual-secrets-of-the-zodiac` · "Sexual Secrets Of The Zodiac"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12093 · `playboys-girls-of-summers-86-sunsational-sirens-salute-summer` · "Playboy's Girls of Summer's 86-Sunsational Sirens Salute Summer"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12094 · `playboys-playmates-of-the-year` · "Playboy's Playmates of the Year"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12095 · `lui` · "Lui"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 12096 · `d-cup-honeys` · "D-Cup Honeys"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12099 · `big-bottoms-no-8` · "Big Bottoms No.8"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12100 · `celebrity-skin` · "Celebrity Skin"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12101 · `celebrity-skin-high-society-collectors-edition-no-10` · "Celebrity Skin- High Society Collector's Edition No. 10"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12105 · `lelaki-gagah` · "Lelaki Gagah"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12106 · `manusia-yang-ganjil` · "Manusia Yang Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12107 · `yang-ganjil-sekali-dalam-siri-majalah-manusia-ganjil` · "Yang Ganjil Sekali Dalam Siri Majalah Manusia Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12108 · `cerita-ganjil-yang-menarik-dalam-siri-majalah-manusia-ganjil` · "Cerita Ganjil Yang Menarik Dalam Siri Majalah Manusia Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12109 · `koleksi-cerita-berahi` · "Koleksi Cerita Berahi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12110 · `apa-yang-menarik` · "Apa Yang Menarik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12111 · `masyarakat-majmuk` · "Masyarakat Majmuk"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12112 · `rekod-cerita-ganjil-records-of-fabulous-stories` · "Rekod Cerita Ganjil (records Of Fabulous Stories)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12113 · `mencari-rahsia` · "Mencari Rahsia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12114 · `dunia-menarik` · "Dunia Menarik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12116 · `dunia-kaleidoskop` · "Dunia Kaleidoskop"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12117 · `no-28-sesuatu-yang-ganjil-no-28` · "No. 28 (Sesuatu Yang Ganjil) No.28"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12118 · `gambar-gambar-lucah-amy-yip` · "Gambar-gambar Lucah Amy Yip/"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12119 · `rekod-cerita-ganjil-fabulous-records` · "Rekod Cerita Ganjil (Fabulous Records)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12120 · `majalah-cerita-ganjil` · "Majalah Cerita Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12121 · `no-29-ganjil-no-29` · "No. 29 (Ganjil) No. 29"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12122 · `koleksi-cerita-seks` · "Koleksi Cerita Seks"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12123 · `koleksi-cerita-erotika` · "Koleksi Cerita Erotika"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12124 · `legenda-ganjil` · "Legenda Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12125 · `wanita-yang-cantik` · "Wanita Yang Cantik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12126 · `koleksi-cerita-ganjil` · "Koleksi Cerita Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12127 · `cerita-berahi` · "Cerita Berahi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12128 · `wanita-wanita-yang-cantik-sekali` · "Wanita-Wanita Yang Cantik Sekali"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12129 · `lagenda-dunia` · "Lagenda Dunia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12130 · `wanita-wanita-yang-cantik` · "Wanita-Wanita Yang Cantik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12131 · `laporan-ganjil-mengenai-cerita-berahi` · "Laporan Ganjil mengenai cerita Berahi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12132 · `no-11-sahabat-no-11` · "No. 11 (Sahabat) No.11"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12133 · `joan-chan-dalam-majalah-penthouse` · "Joan Chan Dalam Majalah Penthouse"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12134 · `koleksi-gambar-gambar-bogel-bintang-filem` · "Koleksi Gambar-Gambar Bogel Bintang Filem"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12135 · `no-201-laporan-khas-no-201` · "No. 201 (Laporan Khas) No. 201"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12136 · `catatan-peristiwa-ganjil` · "Catatan Peristiwa Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12137 · `gadis-hebat` · "Gadis Hebat"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12138 · `no-201-dunia-yang-ganjil-no-201` · "No. 201 (Dunia Yang Ganjil) No 201"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12139 · `no-18-mini-no-18` · "No. 18 (Mini) No. 18"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12140 · `koleksi-gambar-gambar-gadis-comel` · "Koleksi Gambar-Gambar Gadis Comel"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12141 · `baru-dan-ganjil` · "Baru dan Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12142 · `koleksi-gambar-gambar-amy-yip` · "Koleksi Gambar-Gambar Amy Yip"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12143 · `koleksi-gambar-gambar-bogel` · "Koleksi Gambar-Gambar Bogel"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12147 · `the-wantons` · "The Wantons"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12150 · `more-rugby-jokes` · "More Rugby Jokes"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12169 · `the-holy-quran-with-english-translation-and-commentary-volume-ii-part-1` · "The Holy Quran with English Translation and Commentary Volume II (Part 1)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12180 · `tree-of-knowledge-part-7-weekly-encyclopedia` · "TREE OF KNOWLEDGE Part 7 (Weekly encyclopedia)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12185 · `unleashed-where-no-life-dwells` · "UNLEASHED where no life dwells"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12186 · `sodom-mortal-way-of-live` · "Sodom Mortal Way of Live"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12187 · `massacre-from-beyond` · "Massacre from Beyond"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12188 · `risk-the-reborn` · "Risk the Reborn"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12189 · `dance-91-the-final-volume` · "Dance '91 the Final Volume"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12190 · `amy-yip-yang-berbuah-dada-besar-dan-berotak` · "Amy Yip Yang Berbuah Dada Besar Dan Berotak"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12191 · `prophet-mohammad` · "Prophet Mohammad"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12194 · `reaching-muslims-today` · "Reaching Muslims Today"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12205 · `risdah-kamarul-huda` · "Risdah Kamarul Huda"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12225 · `the-romance-lust` · "The Romance Lust"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12229 · `cerita-cerita-ajaib-dunia` · "Cerita-Cerita Ajaib Dunia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12230 · `pencuri-dan-pelacur` · "Pencuri dan Pelacur"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12231 · `gadis-gadis-cantik` · "Gadis-Gadis Cantik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12232 · `dunia-lelaki` · "Dunia Lelaki"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12233 · `berita-rahsia` · "Berita Rahsia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12234 · `wanita-yang-jelita` · "Wanita Yang Jelita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12235 · `koleksi-cerita-cerita-ajaib` · "Koleksi Cerita-Cerita Ajaib"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12236 · `koleksi-foto-wang-xiao-feng-dalam-penthouse` · "Koleksi Foto Wang Xiao Feng Dalam Penthouse"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12237 · `dunia-ganjil` · "Dunia Ganjil"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12238 · `sedutan-khas-mengenai-keberahian` · "Sedutan Khas Mengenai Keberahian"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12239 · `lembah-ria` · "Lembah Ria"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12240 · `perempuan-liar` · "Perempuan Liar"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12241 · `jed` · "Jed"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12242 · `topeng` · "Topeng"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12243 · `dunia-baru` · "Dunia Baru"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12244 · `dunia-ganjil-fantastic-world` · "Dunia Ganjil (Fantastic World)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12245 · `dunia-aneh` · "Dunia Aneh"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12247 · `pembongkaran-rahsia` · "Pembongkaran Rahsia"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12248 · `kes-kes-luar-biasa` · "Kes-Kes Luar Biasa"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12253 · `libertore-video-clips` · "LIBERTORE (Video Clips)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12264 · `the-pirelli-calendar-album` · "The Pirelli Calendar Album"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12276 · `gigolo` · "Gigolo"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- co-credited (non-placeholder): _Wei Wei_
- evidence: (no/empty description)

### book 12301 · `mutiara-timur-iii` · "Mutiara Timur III"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12302 · `lagu-lagu-popular-hokkien-nostalgik-yang-berselera-tambahan-gs-778` · "Lagu-lagu Popular Hokkien Nostalgik Yang Berselera Tambahan GS-778"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12303 · `lagu-lagu-popular-hokkien-yang-berselera-tambahan-gs-780` · "Lagu-lagu Popular Hokkien Yang Berselera Tambahan GS-780"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12304 · `lagu-lagu-popular-hokkien-yang-berselera-tambahan-gs-89-777` · "Lagu-lagu Popular Hokkien Yang Berselera Tambahan GS-89-777"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12311 · `the-picture` · "The Picture"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12313 · `the-journal-of-erotica` · "The Journal of Erotica"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12314 · `hajime-sorayama` · "Hajime Sorayama"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12315 · `hr-giger-arht` · "HR Giger Arht"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12316 · `suara-acheh-merdeka` · "Suara Acheh Merdeka"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12319 · `cakera-padat-bertajuk-the-east-is-red-selected-songs-1-the-east-is-red-2-the-october-wind-from-the-north-3-peasants1-song-4-workers-peasants-and-soldiers-unite-5-autumn-harvest-uprising-6-chingka` · "Cakera padat bertajuk "THE EAST IS RED Selected Songs" 1.The East Is Red 2.The October Wind From The North 3.Peasants1 Song 4.Workers, Peasants And Soldiers, Unite! 5.Autumn Harvest Uprising 6.Chingka"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12320 · `pelacur-muda-aku-mencintaimu` · "Pelacur Muda Aku Mencintaimu"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12321 · `perempuan-jalang` · "Perempuan Jalang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12322 · `zaman-kegila-gilaan` · "Zaman Kegila-gilaan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12323 · `cergas-dan-berwarna-warni` · "Cergas Dan Berwarna-Warni"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12324 · `badan-montok` · "Badan Montok"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12326 · `suasana` · "Suasana"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12330 · `majalah-gaya` · "Majalah Gaya"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12331 · `percintaan-sulit` · "Percintaan Sulit"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12332 · `perbualan-yang-penuh-mistri` · "Perbualan Yang Penuh Mistri"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12333 · `majalah-ajaib` · "Majalah Ajaib"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12335 · `ratna-sari-dewi-rima-surya-janda-presiden-yang-ber` · "Ratna Sari Dewi (rima Surya) Janda Presiden yang Ber...."

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12337 · `album-celebriti-super-mengancam` · "Album CELEBRITI-Super Mengancam"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12341 · `cahaya-di-ufuk-timur-nada-murni` · "Cahaya Di Ufuk Timur (Nada Murni)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12342 · `panduan-menghadapi-sakit` · "Panduan Menghadapi Sakit"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12347 · `next-men-power-part-3-of-4` · "Next Men Power Part 3 of 4"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12348 · `breathtaker` · "Breathtaker"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12354 · `darul-arqam-25-tahun-perjuangan-abuya-syeikh-imam-ashaari-muhammad-at-tamimi` · "Darul Arqam 25 Tahun Perjuangan Abuya Syeikh Imam Ashaari Muhammad At-tamimi"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12360 · `fardhu-ain` · "Fardhu Ain"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12364 · `al-arqam` · "Al Arqam"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12394 · `keistimewaan-wanita-solehah` · "Keistimewaan Wanita Solehah"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12395 · `keistimewaan-cantik-dan-akhlak-pada-wanita` · "Keistimewaan Cantik dan Akhlak Pada Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12396 · `keistimewaan-kasih-sayang-dalam-rumahtangga` · "Keistimewaan Kasih Sayang Dalam Rumahtangga"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12397 · `keistimewaan-wanita-penyayang` · "Keistimewaan Wanita Penyayang"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12398 · `keistimewaan-berkasih-sayang` · "Keistimewaan Berkasih Sayang"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12399 · `perutusan-dari-timur` · "Perutusan DAri Timur"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12401 · `panduan-hidup-mukmin` · "Panduan Hidup Mukmin"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12408 · `jenaka-dakwah-hidupkan-budaya-lepak` · "Jenaka Dakwah Hidupkan Budaya LEpak"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12411 · `panduan-wanita-solehah` · "Panduan Wanita Solehah"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12427 · `siri-terkini-era-kasih-sayang` · "Siri Terkini Era Kasih Sayang-"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12429 · `isu-arqam-pm-siri-2` · "Isu Arqam-PM Siri 2"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12430 · `isu-arqam-pusat-islam-siri-3-4-12-21-22-25-27-dan-28` · "Isu Arqam- Pusat Islam Siri 3,4,12,21,22,25,27, dan 28"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12431 · `dialog-abuya-pusat-islam-sessi-01-sessi-02-dan-sessi-03` · "Dialog Abuya- Pusat Islam Sessi 01 Sessi 02 dan Sessi 03"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12432 · `isu-ak-arqam-siri-6-7-8-9-10-11-13-14-15-19-20-23-30-32-33-34-35-dan-siri-36` · "Isu Ak Arqam Siri 6, 7, 8, 9, 10,11, 13, 14, 15, 19, 20, 23, 30, 32, 33, 34, 35 dan Siri 36"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12433 · `siri-5-tamrin-ghafar-mp-kenyataan-akhbar` · "Siri 5 Tamrin Ghafar MP Kenyataan Akhbar"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12434 · `kenapa-timbul-kontroversi-syahadah-aurad-muhammadiah` · "Kenapa Timbul Kontroversi Syahadah Aurad Muhammadiah?"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12435 · `pertandingan-satu-lawan-satuabuya-iman-ashaari-vs-dr-mahathir` · "Pertandingan Satu Lawan SatuAbuya Iman Ashaari VS Dr. Mahathir"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12436 · `al-arqam-group-of-companies-pamplets` · "Al-Arqam Group Of Companies (pamplets)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12437 · `25-years-of-darul-arqam-the-struggle-of-abuya-sheikh-imam-ashaari-muhammad-at-tamimi-pamplet` · "25 Years Of Darul Arqam The Struggle Of Abuya Sheikh Imam Ashaari Muhammad At-Tamimi (pamplet)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12438 · `gelora-hidup` · "Gelora Hidup"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12442 · `motley-crue` · "Motley Crue"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12448 · `warner-music-rock-too-hot-to-handle` · "Warner Music Rock -too Hot to Handle"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12451 · `cik-pencuri-miss-thief` · "Cik Pencuri (Miss Thief)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12452 · `mingguan-pop-features` · "Mingguan Pop (Features)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12453 · `percintaan-pasangan-the-lustful-couple` · "Percintaan Pasangan (The Lustful Couple)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12454 · `percintaan-malam-pertama-first-night-love` · "Percintaan Malam Pertama (First Night Love)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12455 · `dunia-yang-indah-wonderful-world` · "Dunia Yang Indah (Wonderful World)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12456 · `ciuman-larut-malam-midnight-kiss` · "Ciuman Larut Malam (Midnight Kiss)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12459 · `cerita-seks-dissolute-story` · "Cerita Seks (Dissolute Story)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12460 · `bunga-tuberose-tuberose` · "Bunga Tuberose (tuberose)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12461 · `koleksi-gambar-gambar-ellen-chen-collection-of-ellen-chens-photos` · "Koleksi Gambar-gambar Ellen Chen (Collection Of Ellen Chen's Photos)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12462 · `koleksi-cerita-cerita-ajaib-fabulous-stories` · "Koleksi Cerita-cerita Ajaib (Fabulous Stories)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12463 · `godaan-yang-kuat-great-charms` · "Godaan Yang Kuat (Great Charms)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12464 · `dunia-berdua-duaan-a-world-of-two-persons` · "Dunia Berdua-duaan (A World Of Two Persons)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12466 · `api-membara-flame` · "Api Membara (Flame)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12468 · `cerita-ghairah-amorous-story` · "Cerita Ghairah (Amorous Story)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12478 · `godaan-temptation` · "Godaan (Temptation)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12482 · `adik-beradik-baru-new-sisters` · "Adik-beradik Baru (New Sisters)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12483 · `kisah-gadis-ibu-kota-city-girl` · "Kisah Gadis Ibu Kota (City Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12484 · `maksiat-sins` · "Maksiat (Sins)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12485 · `kisah-seks-bintang-filem-sex-story-of-a-film-star` · "Kisah Seks Bintang Filem (Sex Story of a Film Star)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12486 · `kisah-musim-bunga-beautiful-spring` · "Kisah Musim Bunga (Beautiful Spring)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12487 · `kisah-dunia-keluaran-khas-world-story-special-edition` · "Kisah Dunia Keluaran Khas (World Story Special Edition)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12488 · `perempuan-gasang-wanton-girl` · "Perempuan Gasang (Wanton Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12489 · `kelab-kaki-perempuan-playboy-club` · "Kelab Kaki Perempuan (Playboy Club)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12490 · `pesolek-hangat-hot-girl-beautician` · "Pesolek Hangat (Hot Girl Beautician)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12491 · `cerita-hantu-ghost-story` · "Cerita Hantu (Ghost story)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12492 · `mingguan-kekasih-lovers-weekly` · "Mingguan Kekasih (Lovers' Weekly)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12497 · `the-five-doors` · "The Five Doors"

- placeholder: `Anonymous` (id=33); year=?; lang=ja
- evidence: (no/empty description)

### book 12499 · `iqra` · "Iqra'"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12500 · `muzik-untuk-orang-dewasa-jld-1-2-3-music-for-adults-vol-1-2-3` · "Muzik Untuk Orang Dewasa Jld. 1,2,3 (Music For Adults Vol. 1,2,3)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12501 · `gadis-berdada-besar-the-girl-with-big-bosom` · "Gadis Berdada Besar (The Girl With Big Bosom)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12502 · `anak-dara-yang-miang-lewd-virgin` · "Anak Dara Yang Miang (Lewd Virgin)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12503 · `dataran-kegembiraan-joyous-square` · "Dataran Kegembiraan (Joyous Square)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12504 · `catatan-ajaib-record-of-strange-events` · "Catatan Ajaib (Record of Strange Events)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12505 · `pasang-perbani-spring-tide` · "Pasang Perbani (Spring Tide)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12506 · `gadis-jelita-yang-menukar-jantina-a-sex-changed-girl` · "Gadis Jelita Yang Menukar Jantina (A Sex-Changed Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12507 · `majalah-gembira-joy-magazine` · "Majalah Gembira (Joy Magazine)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12508 · `majalah-dunia-world-magazine` · "Majalah Dunia (World Magazine)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12509 · `laporan-eksklusif-exclusive-report` · "Laporan Eksklusif (Exclusive Report)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12510 · `gadis-lacur-erotic-girl` · "Gadis Lacur (Erotic Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12511 · `genit-coquette` · "Genit (Coquette)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12512 · `gadis-miang` · "Gadis Miang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12513 · `gadis-jelita-beautiful-girl` · "Gadis Jelita (Beautiful Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12514 · `gadis-hangat-95-95-hot-girl` · "Gadis Hangat 95 (95 Hot Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12515 · `mingguan-dunia-world-weekly` · "Mingguan Dunia (world Weekly)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12516 · `percintaan-di-tahun-baru-love-stories` · "Percintaan Di Tahun Baru (love Stories)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12517 · `ombak-panas-hot-wave` · "Ombak Panas (Hot Wave)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12524 · `cerita-cerita-lucah-lewd-stories` · "Cerita-Cerita Lucah (Lewd Stories)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12527 · `no-1-abalone` · "No. 1 Abalone"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12528 · `kupu-kupu-butterfly` · "Kupu-kupu (Butterfly)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12529 · `kisah-seorang-gadis-yang-miang-stories-of-a-lewd-girl` · "Kisah Seorang Gadis Yang Miang(Stories Of A Lewd Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12531 · `cerpen-tentang-seorang-wanita-yang-hebat-short-stories-of-a-lewd-girl` · "Cerpen Tentang Seorang Wanita Yang Hebat (Short Stories Of A Lewd Girl)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12532 · `miang-lascivious` · "Miang (Lascivious)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12540 · `karma-akhirat` · "Karma Akhirat"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12541 · `sejarah-nabi-zulkifli` · "Sejarah Nabi Zulkifli"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12542 · `riwayat-nabi-yunus-a-s` · "Riwayat Nabi Yunus A.S"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12543 · `riwayat-bilal` · "Riwayat Bilal"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12544 · `riwayat-siti-asiah-dan-masyitoh` · "Riwayat Siti Asiah dan Masyitoh"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12545 · `riwayat-nabi-musa-a-s-dan-qarun` · "Riwayat Nabi Musa A.S dan Qarun"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12546 · `adam-dan-hawa` · "Adam Dan Hawa"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12547 · `riwayat-nabi-sulaiman-a-s-dengan-burung-garuda` · "Riwayat Nabi Sulaiman a.s. dengan burung Garuda"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12548 · `kisah-alqomah-kutukan-seorang-ibu` · "Kisah: Al'Qomah Kutukan Seorang Ibu"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12549 · `abrahah-raja-terkutuk` · "Abrahah (Raja Terkutuk)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12550 · `bangkit-dari-kubur` · "Bangkit Dari Kubur"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- co-credited (non-placeholder): _Ustaz Musannif Effendie Alwi.S_
- evidence: (no/empty description)

### book 12551 · `hari-pembalasan` · "Hari Pembalasan"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12552 · `rasul-allah-kedatangan-iblis` · "Rasul Allah Kedatangan Iblis"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12553 · `dajjal-nabi-palsu` · "Dajjal (Nabi Palsu)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12554 · `kisah-nabi-musa-a-s` · "Kisah: Nabi Musa A.S"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12555 · `lelaki-misteri` · "Lelaki Misteri"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12556 · `kutu-embun` · "Kutu Embun"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12557 · `pejuang-wanita` · "Pejuang Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12580 · `mimpi-seorang-perempuan-simpanan` · "Mimpi Seorang Perempuan Simpanan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12600 · `mujarrobat-melayu` · "Mujarrobat Melayu"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12660 · `firman-allah-yang-hidup` · "Firman Allah Yang Hidup"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12667 · `perjanjian-baru-mazmur-dan-amsal` · "Perjanjian Baru Mazmur dan Amsal"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12677 · `shuffle` · "Shuffle"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12688 · `the-sex-box` · "The Sex Box"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12689 · `hasselbland-austrian-super-circuit-96` · "Hasselbland Austrian Super Circuit '96"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12695 · `sex-a-man-guide` · "Sex a Man Guide"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12701 · `bini-muda-berumur-enam-belas-tahun` · "Bini Muda Berumur Enam Belas Tahun"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12703 · `d-watak-seorang-bapa-ayam` · "Watak Seorang Bapa Ayam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12704 · `tiang-agama` · "Tiang Agama"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12712 · `mujarrobat-madiinatul-asroor` · "Mujarrobat Madiinatul Asroor"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12722 · `inilah-hikayat-nur-muhammad-dan-nabi-bercukur-dan-nabi-wafat-adanya` · "Inilah Hikayat Nur Muhammad dan Nabi Bercukur dan Nabi Wafat Adanya"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12737 · `gelora` · "Gelora"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12739 · `artis-artis-bernoda` · "Artis-artis Bernoda"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12754 · `bekal-hidup` · "Bekal Hidup"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12762 · `sorga-firdaus-2` · "Sorga Firdaus 2"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12763 · `syurga-di-bawah-tapak-kaki-ibu-dengan-iman-dan-takwa` · "Syurga di Bawah Tapak Kaki Ibu Dengan Iman dan Takwa"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12765 · `berdasarkan-al-hadits-dengan-riwayat-risalah-durhaka` · "Berdasarkan Al-hadits' Dengan Riwayat:risalah Durhaka"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12781 · `gadis-liar-berumur-16-tahun` · "Gadis Liar Berumur 16 tahun"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12782 · `pemandu-pelancong-wanita` · "Pemandu Pelancong Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12783 · `gadis-jelita` · "Gadis Jelita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12784 · `genit-bandar` · "Genit Bandar"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12785 · `jururawat-gasang` · "Jururawat Gasang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12786 · `gadis-rupawan` · "Gadis Rupawan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12787 · `kisah-miang-gadis-jelita` · "Kisah Miang Gadis Jelita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12788 · `peperangan-zaman-moden-antara-lelaki-perempuan-gadis-miang` · "Peperangan Zaman Moden Antara Lelaki & Perempuan-Gadis Miang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12789 · `peperangan-zaman-moden-antara-lelaki-perempuan-wanita-genit` · "Peperangan Zaman Moden Antara Lelaki & Perempuan-Wanita Genit"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12790 · `peperangan-zaman-moden-antara-lelaki-perempuan-perlakuan-seks-yang-keterlaluan` · "Peperangan Zaman Moden Antara Lelaki & Perempuan-Perlakuan Seks Yang Keterlaluan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12791 · `lelaki-perempuan-berpakaian-berwarna-warni` · "Lelaki Perempuan Berpakaian Berwarna Warni"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12793 · `hotline` · "Hotline"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12794 · `gadis-naif` · "Gadis Naif"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12795 · `gadis-genit` · "Gadis Genit"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12796 · `akasi` · "Akasi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12797 · `one-night-stand` · "One Night Stand"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12798 · `bisikan-tengah-malam` · "Bisikan Tengah Malam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12799 · `kekasih-yang-seksi` · "Kekasih Yang Seksi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12800 · `burung-berapi` · "Burung Berapi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12802 · `beppin` · "Beppin"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12813 · `my-secret-life-part-two` · "MY Secret Life Part Two"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12822 · `maxim-edisi-uk` · "Maxim (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12823 · `maxim-edisi-us` · "Maxim (edisi US)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12824 · `loaded-edisi-uk` · "Loaded (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12825 · `fast-car-edisi-uk` · "Fast Car (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12826 · `boys-toys` · "Boys Toys"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12827 · `arena` · "Arena"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12828 · `cosmopolitan-uk-november-2003` · "Cosmopolitan (UK) (November 2003)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12829 · `hammer-edisi-uk` · "Hammer (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12830 · `stuff` · "Stuff"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12831 · `gq-julai-2003` · "GQ (Julai 2003"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12832 · `zink-edisi-usa` · "Zink (edisi USA)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12833 · `max-power-edisi-uk` · "Max Power (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12834 · `ralph-edisi-australia` · "Ralph (edisi Australia)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12835 · `ice-edisi-uk` · "Ice (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12836 · `bizarre-edisi-uk` · "Bizarre (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12837 · `ironman-edisi-kanada` · "Ironman (edisi Kanada)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12838 · `the-face-edisi-uk` · "The Face (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12839 · `redline-edisi-uk` · "Redline (Edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12840 · `revs-edisi-uk` · "Revs (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12841 · `bikes-edisi-uk` · "Bikes (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12842 · `vegas-edisi-uk` · "Vegas (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12843 · `front-edisi-uk` · "Front (edisi UK)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12844 · `fhm-for-him-magazine-edisi-uk` · "FHM (For Him Magazine) Edisi UK"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12845 · `fhm-for-him-magazine-edisi-usa` · "FHM (For Him Magazine) Edisi USA"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12846 · `american-curves` · "American Curves"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12851 · `great-religions-of-the-world` · "Great Religions of the World"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12869 · `rahsia-wanita` · "Rahsia Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12882 · `pink-lady` · "Pink Lady"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12883 · `hot-girl` · "Hot! Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12884 · `wanita-seksi` · "Wanita Seksi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12885 · `godaan-seks` · "Godaan Seks"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12886 · `cinta-haram` · "Cinta Haram"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12887 · `sexy-girl` · "Sexy Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12888 · `kak-long` · "Kak Long"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12889 · `body-girl` · "Body Girl"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12890 · `wanita-yang-merayau-sepanjang-malam` · "Wanita yang Merayau Sepanjang Malam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12891 · `si-comel` · "Si Comel"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12892 · `cinta-liar` · "Cinta Liar"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12893 · `gadis-yang-mengejar-nafsu` · "Gadis yang Mengejar Nafsu"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12894 · `mimpi-pisang` · "Mimpi Pisang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12895 · `isteri-muda-yang-berlaku-curang` · "Isteri Muda yang Berlaku Curang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12896 · `pasangan-berahi` · "Pasangan Berahi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12897 · `gadis-hamba-nafsu` · "Gadis Hamba Nafsu"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12898 · `wanita-yang-kesepian` · "Wanita yang Kesepian"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12899 · `wanita-jelita` · "Wanita Jelita"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12900 · `kisah-tengah-malam` · "Kisah Tengah Malam"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12901 · `perempuan-tidak-bermoral` · "Perempuan Tidak Bermoral"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12902 · `guru-dara` · "Guru Dara"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12903 · `kisah-doktor-yang-tak-siuman` · "Kisah Doktor yang Tak Siuman"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12904 · `cinta-kota` · "Cinta Kota"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12905 · `dunia-ceria` · "Dunia Ceria"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12906 · `dunia-romantik` · "Dunia Romantik"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12907 · `lelaki-yang-bertanggung-jawab` · "Lelaki yang Bertanggung Jawab"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12908 · `artikel-bertajuk-cartoon-not-much-impact-here` · "Artikel bertajuk "Cartoon not much impact here""

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12909 · `artikel-bertajuk-media-eropah-siarkan-semula-karikatur-meningkatkan-kontroversi-akhbar-denmark-hina-agama-islam-mohom-maaf-yang-disiarkan-dalam-akhbar-guan-ming-daily-edisi-petang-pada-3-februari-2` · "Artikel bertajuk "Media Eropah siarkan semula karikatur meningkatkan kontroversi Akhbar Denmark hina agama Islam, mohom maaf" Yang disiarkan dalam akhbar Guan Ming Daily Edisi Petang pada 3 Februari 2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 12910 · `cannabis-culture` · "Cannabis Culture"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12911 · `weed-world` · "Weed World"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12912 · `high-times` · "High Times"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12959 · `siapakah-muslim` · "Siapakah Muslim?"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 12963 · `the-passion-of-the-christ-kesengsaraan-al-masihi` · "The Passion Of the Christ Kesengsaraan Al-Masihi"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12976 · `now-you-can-knows-what-muslims-believe` · "Now You Can Knows What Muslims Believe"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 12990 · `inside-islam-the-faith-the-people-and-the-conflicts-of-the-words-fastest-growing-religion` · "Inside Islam the Faith, the People and the Conflicts of the Word`s Fastest Growing Religion"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 12997 · `ombak-hidup-mengalami-damai-di-masa-taufan` · "Ombak Hidup Mengalami Damai di Masa Taufan"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13000 · `masalah-seksual-lelaki-rawatan-alternatif` · "Masalah Seksual Lelaki & Rawatan Alternatif"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13021 · `16-years-old-virgin-met-sex-maniac` · "16 Years Old Virgin Met Sex Maniac"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13022 · `ibu-tiri-berumur-30-tahun-yang-seksi` · "Ibu Tiri Berumur 30 Tahun Yang Seksi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13023 · `gadis-miang-makan-pisang` · "Gadis Miang Makan Pisang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13035 · `hero-berani` · "Hero Berani"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13036 · `water-novels` · "Water Novels"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13037 · `sweet-pocket` · "Sweet Pocket"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13038 · `gadis-tidak-sopan` · "Gadis Tidak Sopan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13039 · `gaya-seksi-musim-bunga` · "Gaya Seksi Musim Bunga"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13040 · `sukar-dilupakan` · "Sukar Dilupakan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13041 · `merangsang-keseronokan` · "Merangsang Keseronokan"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13042 · `ralph` · "Ralph"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13043 · `gaya-seksi-musim-panas` · "Gaya Seksi Musim Panas"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13053 · `rahsia-jalan-yang-lurus` · "Rahsia Jalan Yang Lurus"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13055 · `av-angel` · "AV Angel"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13057 · `ananda-vikatan-dis-12-2007` · "Ananda Vikatan Dis 12, 2007"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 13058 · `kumudam-12-12-2007` · "Kumudam 12-12-2007"

- placeholder: `Anonymous` (id=33); year=?; lang=ta
- evidence: (no/empty description)

### book 13059 · `cinta-awak-dalam-sehari` · "Cinta AWAK dalam sehari"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13066 · `rintihan-jiwa-seorang-lesbian` · "Rintihan Jiwa Seorang LESBIAN"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13067 · `oh-fazrah` · "Oh Fazrah"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13082 · `petua-cemerlang-suami-isteri` · "Petua Cemerlang Suami Isteri"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13083 · `sensasi-3` · "Sensasi #3"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13084 · `sensasi-majalah-lelaki-millennium` · "SENSASI - majalah lelaki millennium"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13089 · `gelora-nafsu-7` · "Gelora Nafsu #7"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13092 · `tips-tips-bahagia-bersama-pasangan` · "Tips-tips Bahagia Bersama Pasangan"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13094 · `sensasi-edisi-ke-2` · "SENSASI Edisi ke-2"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13099 · `hard-magazine` · "Hard Magazine"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13100 · `gadis-jelita-yang-matang` · "Gadis Jelita Yang Matang"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13101 · `dewi-pesona` · "Dewi Pesona"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13103 · `x-president-no-6` · "X President No. 6"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13107 · `islam-evil-in-the-name-of-god` · "Islam Evil in the Name of God"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 13127 · `ultraman-the-ultra-power` · "Ultraman The Ultra Power"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13139 · `kisah-paling-menarik-yang-pernah-diceritakan` · "Kisah Paling Menarik Yang Pernah Diceritakan"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 13166 · `apa-apa-pakaian-berwarna-kuning-dan-yang-mengandungi-perkataan-bersih-4-dan-apa-apa-bahan-bercetak-lain-dan-risalah-yang-mendorong-kepada-perhimpunan-bersih-4` · "Apa-Apa pakaian berwarna kuning dan yang mengandungi perkataan "Bersih 4" dan apa-apa bahan bercetak lain dan risalah yang mendorong kepada perhimpunan Bersih 4"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13191 · `isu-semasa-dalam-risalah-kahwin-campur-antara-muslim-dengan-non-muslim` · "Isu Semasa Dalam Risalah: Kahwin Campur Antara Muslim Dengan Non Muslim"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13197 · `syiar-manifestasi-tuhan-dalam-wanita` · "Syi'ar Manifestasi Tuhan Dalam Wanita"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 13218 · `maxim-vol-18-no-9-november-2014-usa-edition` · "Maxim (Vol 18, No 9 November 2014) (USA Edition)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 13219 · `al-fatihin-surat-kabar-bagi-muhajirin-berbahasa-melayu-di-daulah-islamiyyah` · "Al-Fatihin: Surat Kabar Bagi Muhajirin Berbahasa Melayu Di Daulah Islamiyyah"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13224 · `black-men-special-edition` · "Black Men Special Edition"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 13226 · `tafsir-al-usyr-al-akhir-dari-al-quran-al-karim-jus-28-29-30-disertai-hukum-hukum-penting-bagi-seorang-muslim` · "Tafsir Al-'Usyr Al-Akhir dari Al-Quran Al-Karim Jus (28,29,30) Disertai Hukum-Hukum Penting bagi Seorang Muslim"

- placeholder: `Anonymous` (id=33); year=?; lang=id
- evidence: (no/empty description)

### book 13230 · `maxim-vol18-no5-june-2014-usa-edition` · "Maxim (Vol18 No5 June 2014) (USA Edition)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 13279 · `loaded-issue-242-june-2014` · "Loaded (issue 242 June 2014)"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (no/empty description)

### book 13280 · `qun-jiao-wang-shi` · "Qun Jiao Wang Shi"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13281 · `36f-da-bo-mei-de-you-huo` · "36F Da Bo Mei De You Huo"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13282 · `guo-nan-nv-no-2` · "Guo Nan NV No.2"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13299 · `album-gambar-sejarah-parti-komunis-malaya-i` · "Album Gambar Sejarah Parti Komunis Malaya (I)"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13301 · `infernal-goatrashing-aggression` · "Infernal Goatrashing Aggression"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13310 · `apa-apa-penerbitan-yang-berkaitan-dengan-lesbian-gay-bisexual-transgender-gueer-and-plus-lgbtq-dalam-apa-apa-bentuk-yang-terdapat-pada-jam-swatch-dalam-apa-apa-koleksi-termasuk-kotak` · "Apa-apa Penerbitan yang Berkaitan Dengan Lesbian, Gay, Bisexual, Transgender,gueer and + Plus (lgbtq+) dalam Apa-apa Bentuk yang Terdapat pada Jam Swatch dalam Apa-apa Koleksi Termasuk Kotak, ...."

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13318 · `suka-duka-perjalanan-dhul-qarnain-cyrus-the-great-dan-iskandar-agung` · "Suka Duka Perjalanan Dhul-qarnain Cyrus the Great dan Iskandar Agung"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13324 · `suhuf-abraham` · "Suhuf Abraham"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13335 · `memoir-shamsiah-fakeh-dari-awas-ke-rejimen-ke-10` · "Memoir Shamsiah Fakeh dari Awas ke Rejimen Ke-10"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (no/empty description)

### book 13336 · `20` · "国 内 革 命战争 时 期（五） -- 马 共 20 个 月 反 围 剿 胜 利 结 束"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

### book 13354 · `belarus-at-the-crossroads` · "Belarus at the Crossroads"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13362 · `belarus-above-everything` · "Belarus Above Everything"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13365 · `records-of-the-society-of-belarusian-history-enthusiasts-named-after-vaclau-lastouski-challenges-of-the-russian-world-and-belarus` · "Records of the Society of Belarusian History Enthusiasts named after Vacłaŭ Łastoŭski. Challenges of the 'Russian world' and Belarus"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13368 · `post-soviet-transit-between-democracy-and-dictatorship` · "Post-Soviet Transit: Between Democracy and Dictatorship"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13369 · `problems-of-humanitarian-security-in-belarus` · "Problems of humanitarian security in Belarus"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13372 · `transformation-of-belarusians-mentality-in-the-21st-century` · "Transformation of Belarusians' mentality in the 21st century"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13379 · `polskie-piesni-patriotyczne` · "Polskie pieśni patriotyczne"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13410 · `pavel-sheremet-svetlana-kalinkina-the-accidental-president-st-petersburg-limbus-press-2004-18-03-2025-as-well-as-its-copies-or-other-book-editions` · "Pavel Sheremet, Svetlana Kalinkina, The Accidental President (St. Petersburg: Limbus Press, 2004) 18.03.2025* *As well as its copies or other book editions"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13416 · `the-idiot-is-the-real-one-minsk-warsaw-moscow-kontra-press-2001` · "The Idiot Is the Real One… (Minsk–Warsaw–Moscow, KONTRA-PRESS , 2001)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13417 · `fedor-von-bock-i-stood-at-the-gates-of-moscow-moscow-yauza-press-202-4` · "Fedor von Bock, I Stood at the Gates of Moscow (Moscow: Yauza-Press , 202 4 (?))"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13418 · `erich-von-manstein-lost-victories-tsentrpoligraf-2023` · "Erich von Manstein, Lost Victories (Tsentrpoligraf, 2023(?))"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13419 · `erwin-rommel-combat-operations-in-north-africa-and-on-the-western-front-in-europe-1940-1944-tsentrpoligraf-2023` · "Erwin Rommel, Combat Operations in North Africa and on the Western Front in Europe, 1940–1944 (Tsentrpoligraf, 2023)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13420 · `gene-sharp-from-dictatorship-to-democracy-scriptorium-2020` · "Gene Sharp, From Dictatorship to Democracy (Scriptorium, 2020)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13422 · `verbrannte-dorfer-nationalsozialistische-verbrechen-an-der-landlichen-bevolkerung-in-polen-und-der-sowjetunion-im-zweiten-weltkrieg` · "Verbrannte Dorfer. Nationalsozialistische Verbrechen an der landlichen Bevolkerung in Polen und der Sowjetunion im Zweiten Weltkrieg"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13423 · `leanid-laures-the-ivanouskis-labiodka-publishing-solutions-2025` · "Leanid Łaŭreš, The Ivanoŭskis' Labiodka (Publishing Solutions, 2025)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13427 · `timothy-snyder-on-freedom-kyiv-nash-format-2023` · "Timothy Snyder, On Freedom (Kyiv: Nash Format, 2023(?))"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13428 · `valancin-akudovic-the-code-of-absence-lohvinau` · "Valancin Akudovič, The Code of Absence (Łohvinaŭ)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13429 · `valancin-akudovic-one-must-imagine-sisyphus-happy-lohvinau` · "Valancin Akudovič, One Must Imagine Sisyphus Happy (Łohvinaŭ)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13430 · `valer-hapiejeu-volniery-the-harbinger-januskievic-2023` · "Valer Hapiejeŭ, Volniery. The Harbinger (Januškievič, 2023)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13431 · `valer-hapiejeu-volniery-the-endless-day-januskievic-2024` · "Valer Hapiejeŭ, Volniery. The Endless Day (Januškievič, 2024)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13435 · `heinz-guderian-panzer-leader-tsentrpoligraf-2022` · "Heinz Guderian, Panzer Leader (Tsentrpoligraf, 2022 (?))"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13436 · `eliash-bart-dzha-the-legend-of-the-stolen-heart-technalohija-2023` · "Eliash Bart, Dzha: The Legend of the Stolen Heart (Technałohija, 2023)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13438 · `pavel-antipov-to-arrive-somewhere-do-something-and-leave-miane-niama-2025` · "Pavel Antipov, To Arrive Somewhere, Do Something, and Leave (Miane Niama, 2025)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13439 · `yuri-felshtinsky-natalia-radinas-belarus-a-journalist-against-the-dictator-isia-media-verlag-2025` · "Yuri Felshtinsky, Natalia Radina's Belarus. A Journalist Against the Dictator (ISIA Media Verlag, 2025)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13440 · `makar-the-last-generation` · "Makar, The Last Generation"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13441 · `kamila-cien-next-stop-death` · "Kamiła Cień, Next Stop – Death"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13442 · `maks-scur-where-we-are-not` · "Maks Ščur, Where We Are Not"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13443 · `alaksandr-cvikievic-historical-works-volume-1` · "Alaksandr Cvikievič, Historical Works. Volume 1"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13444 · `local-elections-in-the-contemporary-political-history-of-belarus` · "Local Elections in the Contemporary Political History of Belarus"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13445 · `the-human-rights-situation-in-belarus-in-2008-analytical-review-minsk-2009` · "The Human Rights Situation in Belarus in 2008. Analytical Review (Minsk, 2009)"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13446 · `the-contemporary-history-of-belarusian-parliamentarism` · "The Contemporary History of Belarusian Parliamentarism"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 13447 · `collection-of-analytical-reports` · "Collection of Analytical Reports"

- placeholder: `Anonymous` (id=33); year=?; lang=?
- evidence: (no/empty description)

### book 14317 · `untitled-chinese-publication-kdn-p-u-a-70-2026` · "Untitled Chinese publication (KDN P.U. (A) 70 / 2026)"

- placeholder: `Anonymous` (id=33); year=?; lang=zh
- evidence: (no/empty description)

## NO_SIGNAL (22)

> description aanwezig maar geen patroon — handmatige inspectie nodig

### book 1066 · `the-tale-of-steven` · "The Tale of Steven"

- placeholder: `Anonymous` (id=33); year=2022; lang=en
- evidence: (description present but no pattern matched)
- desc: _The Tale of Steven" follows the journey of a young man named Steven as he navigates the challenges of identity, belonging, and self-discovery in a world filled with societal expectations. Throughout his adventure, he enc…_

### book 1068 · `aku-malaysia` · "Aku"

- placeholder: `Anonymous` (id=33); year=2022; lang=ms
- evidence: (description present but no pattern matched)
- desc: _Aku" by Anonymous is a poignant exploration of identity and personal struggle, chronicling the journey of a young protagonist who grapples with societal expectations and self-discovery. Through vivid storytelling and ric…_

### book 1067 · `jacobs-room-to-choose` · "Jacob's Room To Choose"

- placeholder: `Anonymous` (id=33); year=2019; lang=en
- evidence: (description present but no pattern matched)
- desc: _Jacob's Room to Choose" is a poignant picture book that explores themes of gender identity and self-discovery through the story of Jacob, a child who challenges traditional gender norms. As Jacob navigates a classroom se…_

### book 1084 · `guerillas-of-the-kingdom-of-samsung` · "Guerillas of the Kingdom of Samsung"

- placeholder: `Anonymous` (id=33); year=2006; lang=ko
- evidence: (description present but no pattern matched)
- desc: _Guerillas of the Kingdom of Samsung" explores the intertwining lives of characters caught in the high-stakes world of technology and corporate espionage, driven by their ambitions within the shadowy empire of a powerful …_

### book 1037 · `diva-obsexion` · "Diva Obsexion"

- placeholder: `Anonymous` (id=33); year=1995; lang=it
- evidence: (description present but no pattern matched)
- desc: _Diva Obsexion" by Anonymous delves into the complexities of fame, sexuality, and personal identity through the eyes of its protagonist, a struggling artist who navigates the chaotic world of performance and desire. As th…_

### book 1038 · `the-great-big-narcotics-cookbook` · "The Great Big Narcotics Cookbook"

- placeholder: `Anonymous` (id=33); year=1991; lang=en
- evidence: (description present but no pattern matched)
- desc: _The Great Big Narcotics Cookbook" is an unconventional guide that explores the synthesis of various drugs, blending factual information with elements of counterculture and rebellion. Through its detailed recipes and anec…_

### book 1029 · `more-joy-of-sex` · "More Joy of Sex"

- placeholder: `Anonymous` (id=33); year=1973; lang=en
- evidence: (description present but no pattern matched)
- desc: _More Joy of Sex," a sequel to the original classic, explores the complexities of sexual intimacy, relationships, and pleasure. Through detailed illustrations and candid discussions, it emphasizes the importance of commun…_

### book 34 · `go-ask-alice` · "Go Ask Alice"

- placeholder: `Anonymous` (id=33); year=1971; lang=en
- evidence: (description present but no pattern matched)
- desc: _Go Ask Alice is a cautionary young adult novel presented as the diary of a teenage girl who descends into drug use, instability, and exploitation. Its diary form gives the story an intimate, confessional tone, even thoug…_

### book 1036 · `boobytraps` · "Boobytraps"

- placeholder: `Anonymous` (id=33); year=1965; lang=en
- evidence: (description present but no pattern matched)
- desc: _Boobytraps" by Anonymous explores the complexities of modern relationships through a series of interconnected stories that reveal the emotional minefields individuals navigate in pursuit of love and connection. The book …_

### book 581 · `the-protocols-of-the-elders-of-zion` · "The Protocols of the Elders of Zion"

- placeholder: `Unknown` (id=421); year=1903; lang=en
- evidence: (description present but no pattern matched)
- desc: _A fabricated antisemitic text purporting to document a Jewish conspiracy for world domination, created by the Russian Tsarist secret police around 1903, has been repeatedly exposed as a forgery yet continues to circulate…_

### book 579 · `one-thousand-and-one-nights` · "One Thousand and One Nights"

- placeholder: `Anonymous` (id=33); year=1706; lang=en
- evidence: (description present but no pattern matched)
- desc: _The Arabic story collection known in English as the Arabian Nights — incorporating Persian, Indian, and Arab tales accumulated over centuries — has been banned or restricted repeatedly across the Arab world for its eroti…_

### book 631 · `the-bible` · "The Bible"

- placeholder: `Various Authors` (id=455); year=1455; lang=en
- evidence: (description present but no pattern matched)
- desc: _The world's most widely distributed book has also been one of the most frequently banned — by Roman emperors, medieval Church authorities who wanted a Latin monopoly, Reformation-era Catholic authorities who burned verna…_

### book 1001 · `abortion-internationally` · "Abortion Internationally"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (description present but no pattern matched)
- desc: _A 1983 National Abortion Campaign pamphlet surveying abortion law internationally, banned in Ireland for promoting abortion._

### book 1002 · `abortion-our-struggle-for-control` · "Abortion: Our Struggle for Control"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (description present but no pattern matched)
- desc: _A 1983 National Abortion Campaign pamphlet framing reproductive rights as a feminist political cause, banned in Ireland._

### book 1016 · `la-vie-parisienne` · "La Vie Parisienne"

- placeholder: `Anonymous` (id=33); year=?; lang=fr
- evidence: (description present but no pattern matched)
- desc: _La Vie Parisienne," attributed to an anonymous author, is a satirical work that offers a vibrant portrayal of Parisian life in the 19th century, focusing on the moral ambiguities and social dynamics of the city's elite. …_

### book 1021 · `the-hindu-art-of-love` · "The Hindu Art of Love"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (description present but no pattern matched)
- desc: _The Hindu Art of Love," attributed to an anonymous author, delves into the intricacies of love, desire, and sensuality within the framework of Hindu philosophy. Through a series of poetic verses and practical advice, it …_

### book 1040 · `the-seventh-acolyte-reader` · "The Seventh Acolyte Reader"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (description present but no pattern matched)
- desc: _The Seventh Acolyte Reader" is a gripping exploration of faith, power, and the human condition through the eyes of a cult of acolytes serving a mysterious deity. As they grapple with their beliefs and the moral complexit…_

### book 1041 · `holiday-snapshots` · "Holiday Snapshots"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (description present but no pattern matched)
- desc: _Holiday Snapshots" is a reflective collection of vignettes that capture the essence of fleeting moments experienced by travelers during their vacations. Through a tapestry of diverse characters and settings, the book exp…_

### book 1046 · `the-bargaining-for-israel` · "The Bargaining for Israel: In the Shadow of Armageddon"

- placeholder: `Anonymous` (id=33); year=?; lang=en
- evidence: (description present but no pattern matched)
- desc: _The Bargaining for Israel: In the Shadow of Armageddon" follows an anonymous protagonist navigating the turbulent political landscape of a near-future Israel on the brink of collapse. The novel explores themes of surviva…_

### book 1059 · `mutiara-sastra-ali` · "Mutiara Sastra Ali: Muhammad Hashem Edisi Surat & Aforisme"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (description present but no pattern matched)
- desc: _Mutiara Sastra Ali: Muhammad Hashem Edisi Surat & Aforisme" is a compilation of letters and aphorisms that reflect deep philosophical insights and moral lessons, conveying timeless wisdom through the lens of human experi…_

### book 1060 · `perjalanan-yang-cemerlang` · "Perjalanan yang Cemerlang 1930–1980"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (description present but no pattern matched)
- desc: _Perjalanan yang Cemerlang 1930–1980" is a reflective exploration of significant historical events and societal changes in Southeast Asia during the mid-20th century, detailing the struggles and triumphs of various commun…_

### book 1072 · `komrad-asi-rejimen-10` · "Komrad Asi Rejimen 10: Dalam Denyut Nihilisme Sejarah"

- placeholder: `Anonymous` (id=33); year=?; lang=ms
- evidence: (description present but no pattern matched)
- desc: _Komrad Asi Rejimen 10: Dalam Denyut Nihilisme Sejarah" explores the existential struggles of its characters against the backdrop of a tumultuous historical landscape. Through a narrative steeped in nihilism, it delves in…_
