# Data Quality Dry Run

Run at: 2026-06-03T05:44:52.569Z

Drie buckets per record: `confident` (automatisch hoog vertrouwen), `default` (geïmporteerd, niets mis), `flagged` (minimaal één probleem).

## Books

Totaal: **14038**

| Bucket | Count | % |
|---|---:|---:|
| confident | 5924 | 42.2% |
| default | 6651 | 47.4% |
| flagged | 1463 | 10.4% |

### Confident books — sample (top 25 by score, oudste eerst)

| ID | Slug | Title | Auteur | Score | Signalen |
|---:|---|---|---|---:|---|
| 4 | 1984 | 1984 | George Orwell | 5/5 | canonical-id, bans:0v/23t/12c, sources:0v/22t, editorial-complete, author-legit |
| 5 | the-bluest-eye | The Bluest Eye | Toni Morrison | 5/5 | canonical-id, bans:1v/67t/1c, sources:0v/67t, editorial-complete, author-legit |
| 6 | the-satanic-verses | The Satanic Verses | Salman Rushdie | 5/5 | canonical-id, bans:15v/24t/22c, sources:0v/30t, editorial-complete, author-legit |
| 7 | and-tango-makes-three | And Tango Makes Three | Justin Richardson, Peter Parnell | 5/5 | canonical-id, bans:2v/14t/4c, sources:0v/15t, editorial-complete, author-legit |
| 8 | animal-farm | Animal Farm | George Orwell | 5/5 | canonical-id, bans:0v/10t/10c, sources:0v/5t, editorial-complete, author-legit |
| 9 | the-handmaids-tale | The Handmaid's Tale | Margaret Atwood | 5/5 | canonical-id, bans:1v/84t/2c, sources:0v/84t, editorial-complete, author-legit |
| 10 | lady-chatterleys-lover | Lady Chatterley's Lover | D.H. Lawrence | 5/5 | canonical-id, bans:2v/12t/12c, sources:0v/12t, editorial-complete, author-legit |
| 11 | the-da-vinci-code | The Da Vinci Code | Dan Brown | 5/5 | canonical-id, bans:1v/10t/9c, sources:0v/6t, editorial-complete, author-legit |
| 12 | brave-new-world | Brave New World | Aldous Huxley | 5/5 | canonical-id, bans:0v/40t/5c, sources:0v/40t, editorial-complete, author-legit |
| 17 | the-grapes-of-wrath | The Grapes of Wrath | John Steinbeck | 5/5 | canonical-id, bans:1v/5t/3c, sources:0v/6t, editorial-complete, author-legit |
| 18 | the-color-purple | The Color Purple | Alice Walker | 5/5 | canonical-id, bans:1v/63t/3c, sources:0v/63t, editorial-complete, author-legit |
| 19 | beloved | Beloved | Toni Morrison | 5/5 | canonical-id, bans:1v/54t/2c, sources:0v/55t, editorial-complete, author-legit |
| 20 | slaughterhouse-five | Slaughterhouse-Five | Kurt Vonnegut | 5/5 | canonical-id, bans:0v/47t/1c, sources:0v/47t, editorial-complete, author-legit |
| 22 | a-clockwork-orange | A Clockwork Orange | Anthony Burgess | 5/5 | canonical-id, bans:5v/31t/1c, sources:0v/35t, editorial-complete, author-legit |
| 23 | the-lord-of-the-flies | The Lord of the Flies | William Golding | 5/5 | canonical-id, bans:0v/7t/2c, sources:0v/7t, editorial-complete, author-legit |
| 25 | i-know-why-the-caged-bird-sings | I Know Why the Caged Bird Sings | Maya Angelou | 5/5 | canonical-id, bans:0v/51t/2c, sources:0v/51t, editorial-complete, author-legit |
| 26 | native-son | Native Son | Richard Wright | 5/5 | canonical-id, bans:0v/28t/1c, sources:0v/28t, editorial-complete, author-legit |
| 27 | the-diary-of-a-young-girl | The Diary of a Young Girl | Anne Frank | 5/5 | canonical-id, bans:0v/4t/3c, sources:0v/5t, editorial-complete, author-legit |
| 29 | the-perks-of-being-a-wallflower | The Perks of Being a Wallflower | Stephen Chbosky | 5/5 | canonical-id, bans:2v/106t/2c, sources:0v/106t, editorial-complete, author-legit |
| 30 | speak | Speak | Laurie Halse Anderson | 5/5 | canonical-id, bans:0v/54t/1c, sources:0v/54t, editorial-complete, author-legit |
| 31 | the-kite-runner | The Kite Runner | Khaled Hosseini | 5/5 | canonical-id, bans:0v/87t/2c, sources:0v/87t, editorial-complete, author-legit |
| 43 | the-house-on-mango-street | The House on Mango Street | Sandra Cisneros | 5/5 | canonical-id, bans:0v/6t/1c, sources:0v/6t, editorial-complete, author-legit |
| 44 | catch-22 | Catch-22 | Joseph Heller | 5/5 | canonical-id, bans:0v/6t/1c, sources:0v/6t, editorial-complete, author-legit |
| 48 | a-separate-peace | A Separate Peace | John Knowles | 5/5 | canonical-id, bans:0v/8t/1c, sources:0v/8t, editorial-complete, author-legit |
| 51 | lolita | Lolita | Vladimir Nabokov | 5/5 | canonical-id, bans:2v/16t/11c, sources:0v/17t, editorial-complete, author-legit |

### Flagged books — flag-frequentie

| Flag | Count |
|---|---:|
| only-placeholder-authors | 1198 |
| ai-drafted-empty-desc | 126 |
| cover-placeholder | 68 |
| no-author | 50 |
| no-source-citations | 37 |
| no-bans | 1 |

### Flagged books — sample (eerste 30)

| ID | Slug | Title | Auteur | Flags |
|---:|---|---|---|---|
| 49 | their-eyes-were-watching-god | Their Eyes Were Watching God | Zora Neale Hurston | cover-placeholder |
| 83 | the-giver | The Giver | Lois Lowry | cover-placeholder |
| 366 | monsters | Monsters | Ian Thorne | cover-placeholder |
| 563 | son-lois-lowry | Son | Lois Lowry | no-source-citations |
| 781 | devil-on-the-cross | Devil on the Cross | Ngũgĩ wa Thiong'o | cover-placeholder |
| 803 | msf-field-guide | Médecins Sans Frontières: Field Guide | Médecins Sans Frontières | no-bans |
| 804 | the-general-in-his-labyrinth | The General in His Labyrinth | Gabriel García Márquez | no-source-citations |
| 897 | once-a-jolly-hangman | Once a Jolly Hangman | Alan Shadrake | cover-placeholder |
| 996 | the-prophet-gibran | The Prophet | Kahlil Gibran | no-source-citations |
| 1002 | abortion-our-struggle-for-control | Abortion: Our Struggle for Control | Anonymous | only-placeholder-authors |
| 1037 | diva-obsexion | Diva Obsexion | Anonymous | only-placeholder-authors |
| 1038 | the-great-big-narcotics-cookbook | The Great Big Narcotics Cookbook | Anonymous | only-placeholder-authors |
| 1046 | the-bargaining-for-israel | The Bargaining for Israel: In the Shadow of Armageddon | Anonymous | only-placeholder-authors |
| 1059 | mutiara-sastra-ali | Mutiara Sastra Ali: Muhammad Hashem Edisi Surat & Aforisme | Anonymous | only-placeholder-authors |
| 1060 | perjalanan-yang-cemerlang | Perjalanan yang Cemerlang 1930–1980 | Anonymous | only-placeholder-authors |
| 1067 | jacobs-room-to-choose | Jacob's Room To Choose | Anonymous | only-placeholder-authors |
| 1068 | aku-malaysia | Aku | Anonymous | cover-placeholder |
| 1072 | komrad-asi-rejimen-10 | Komrad Asi Rejimen 10: Dalam Denyut Nihilisme Sejarah | Anonymous | only-placeholder-authors |
| 1084 | guerillas-of-the-kingdom-of-samsung | Guerillas of the Kingdom of Samsung | Anonymous | cover-placeholder, only-placeholder-authors |
| 1177 | revealed | Revealed | P. C. Cast | ai-drafted-empty-desc |
| 1187 | the-league-of-super-feminists | The League of Super Feminists | Mirion Malle | cover-placeholder |
| 1214 | pride-championing-lgbtq-rights | #Pride: Championing LGBTQ Rights | Rebecca Felix | ai-drafted-empty-desc |
| 1216 | heartstopper-vol-4 | Heartstopper, Vol. 4 | Alice Oseman | cover-placeholder |
| 1474 | today-tonight-tomorrow | Today, Tonight, Tomorrow | Rachel Lynn Solomon | ai-drafted-empty-desc |
| 1744 | be-gay-do-comics-queer-history-memoir-and-satire | Be Gay, Do Comics: Queer History, Memoir, and Satire | The Nib | ai-drafted-empty-desc |
| 1892 | queer-as-all-get-out-10-people-whove-inspired-me | Queer As All Get Out: 10 People Who've Inspired Me | Shelby Criswell | cover-placeholder |
| 2002 | forgive-me-leonard-peacock | Forgive Me, Leonard Peacock | Matthew Quick | ai-drafted-empty-desc |
| 2095 | lgbt-intolerance | LGBT Intolerance | A.W. Buckey | cover-placeholder |
| 2096 | lgbtq-at-work-your-personal-and-working-life | LGBTQ at Work: Your Personal and Working Life | Melissa Albright-Jenkins | cover-placeholder |
| 2109 | the-teenage-guys-survival-guide-the-real-deal-on-going-out-growing-up-and-other-guy-stuff | The Teenage Guy's Survival Guide: The Real Deal on Going Out, Growing Up, and Other Guy Stuff | Jeremy Daldry | cover-placeholder |

### Default books — sample (eerste 20, om te zien wat in het midden valt)

| ID | Slug | Title | Auteur | Score | Welke signalen miste |
|---:|---|---|---|---:|---|
| 28 | the-hunger-games | The Hunger Games | Suzanne Collins | 3/5 | bans, editorial |
| 42 | flowers-for-algernon | Flowers for Algernon | Daniel Keyes | 4/5 | editorial |
| 54 | naked-lunch | Naked Lunch | William S. Burroughs | 4/5 | editorial |
| 77 | the-sound-and-the-fury | The Sound and the Fury | William Faulkner | 3/5 | bans, editorial |
| 78 | song-of-solomon | Song of Solomon | Toni Morrison | 4/5 | editorial |
| 79 | go-tell-it-on-the-mountain | Go Tell It on the Mountain | James Baldwin | 3/5 | bans, editorial |
| 96 | the-house-of-the-spirits | The House of the Spirits | Isabel Allende | 4/5 | editorial |
| 117 | myra-breckinridge | Myra Breckinridge | Gore Vidal | 2/5 | bans, sources, editorial |
| 129 | fight-club | Fight Club | Chuck Palahniuk | 4/5 | editorial |
| 132 | sold-patricia-mccormick | Sold | Patricia McCormick | 4/5 | editorial |
| 144 | sophies-choice | Sophie's Choice | William Styron | 4/5 | editorial |
| 146 | soul-mountain | Soul Mountain | Gao Xingjian | 3/5 | bans, editorial |
| 156 | marriage-and-morals | Marriage and Morals | Bertrand Russell | 2/5 | bans, sources, editorial |
| 158 | a-feast-for-the-seaweeds | A Feast for the Seaweeds | Haidar Haidar | 3/5 | canonical-id, bans |
| 162 | an-area-of-darkness | An Area of Darkness | V. S. Naipaul | 2/5 | bans, sources, editorial |
| 187 | snow-falling-on-cedars | Snow Falling on Cedars | David Guterson | 4/5 | editorial |
| 190 | mother-courage-and-her-children | Mother Courage and Her Children | Bertolt Brecht | 2/5 | bans, sources, editorial |
| 200 | a-court-of-mist-and-fury | A Court of Mist and Fury | Sarah J. Maas | 4/5 | editorial |
| 206 | perfect-eh | Perfect (EH) | Ellen Hopkins | 2/5 | bans, sources, editorial |
| 215 | mondays-not-coming | Monday's Not Coming | Tiffany D. Jackson | 3/5 | editorial, author-legit |

## Authors

Totaal: **8664**

| Bucket | Count | % |
|---|---:|---:|
| confident | 1639 | 18.9% |
| default | 7006 | 80.9% |
| flagged | 19 | 0.2% |

### Confident authors — sample (eerste 25)

| ID | Slug | Name | Books | Confident books | Signalen |
|---:|---|---|---:|---:|---|
| 5 | george-orwell | George Orwell | 8 | 6 | birth-year, bio, photo, confident-books:6, birth-country |
| 6 | toni-morrison | Toni Morrison | 6 | 5 | birth-year, bio, photo, confident-books:5, birth-country |
| 7 | salman-rushdie | Salman Rushdie | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 8 | justin-richardson | Justin Richardson | 2 | 2 | birth-year, bio, confident-books:2, birth-country |
| 9 | peter-parnell | Peter Parnell | 1 | 1 | birth-year, bio, confident-books:1, birth-country |
| 10 | margaret-atwood | Margaret Atwood | 9 | 9 | birth-year, bio, photo, confident-books:9, birth-country |
| 11 | dh-lawrence | D.H. Lawrence | 3 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 12 | dan-brown | Dan Brown | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 13 | aldous-huxley | Aldous Huxley | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 15 | j-d-salinger | J.D. Salinger | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 16 | mark-twain | Mark Twain | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 17 | john-steinbeck | John Steinbeck | 5 | 5 | birth-year, bio, photo, confident-books:5, birth-country |
| 18 | alice-walker | Alice Walker | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 19 | kurt-vonnegut | Kurt Vonnegut | 7 | 6 | birth-year, bio, photo, confident-books:6, birth-country |
| 20 | ken-kesey | Ken Kesey | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 21 | anthony-burgess | Anthony Burgess | 2 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 22 | william-golding | William Golding | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 23 | ray-bradbury | Ray Bradbury | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 24 | maya-angelou | Maya Angelou | 6 | 6 | birth-year, bio, photo, confident-books:6, birth-country |
| 25 | richard-wright | Richard Wright | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 27 | suzanne-collins | Suzanne Collins | 3 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 28 | stephen-chbosky | Stephen Chbosky | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 29 | laurie-halse-anderson | Laurie Halse Anderson | 10 | 8 | birth-year, bio, photo, confident-books:8, birth-country |
| 30 | khaled-hosseini | Khaled Hosseini | 4 | 4 | birth-year, bio, photo, confident-books:4, birth-country |
| 31 | philip-pullman | Philip Pullman | 6 | 6 | birth-year, bio, photo, confident-books:6, birth-country |

### Flagged authors — flag-frequentie

| Flag | Count |
|---|---:|
| no-books | 13 |
| placeholder | 6 |

### Flagged authors — sample (eerste 30)

| ID | Slug | Name | Books | Flags |
|---:|---|---|---:|---|
| 33 | anonymous | Anonymous | 1320 | placeholder |
| 97 | edna-st-vincent-millay | Edna St. Vincent Millay | 0 | no-books |
| 103 | nikolai-gogol | Nikolai Gogol | 0 | no-books |
| 107 | yevgenia-ginzburg | Yevgenia Ginzburg | 0 | no-books |
| 346 | alice-seabold | Alice Seabold | 0 | no-books |
| 421 | unknown-author | Unknown | 1 | placeholder |
| 455 | various-authors | Various Authors | 2 | placeholder |
| 554 | peter-sotos | Peter Sotos | 0 | no-books |
| 692 | brian-hioe | Brian Hioe (ed.) | 0 | no-books |
| 1820 | no-further-information-available | No Further Information Available | 20 | placeholder |
| 4235 | no-further-information | No Further Information | 1 | placeholder |
| 4320 | theo-van-gogh | Theo van Gogh | 0 | no-books |
| 4391 | unknown | Unknown | 2 | placeholder |
| 4599 | david-hamilton | David Hamilton | 0 | no-books |
| 5785 | shahrnoosh-parsipour | Shahrnoosh Parsipour | 0 | no-books |
| 8176 | voon-ho-yin | Voon Ho Yin | 0 | no-books |
| 9281 | gaidar-arkadi | Gaidar, Arkadi | 0 | no-books |
| 9488 | roca-elena | Roca, Elena | 0 | no-books |
| 9581 | walter-gerard | Walter, Gerard | 0 | no-books |

## Canary checks

Zoek bekende titels op om te zien of de heuristiek ze in `confident` plaatst:

| Titel | Verdict | Score | Signalen / flags |
|---|---|---:|---|
| 1984 (1984) | confident | 5/5 | canonical-id, bans:0v/23t/12c, sources:0v/22t, editorial-complete, author-legit |
| Nineteen Eighty-Four | _niet gevonden_ | — | — |
| Animal Farm (animal-farm) | confident | 5/5 | canonical-id, bans:0v/10t/10c, sources:0v/5t, editorial-complete, author-legit |
| Brave New World (brave-new-world) | confident | 5/5 | canonical-id, bans:0v/40t/5c, sources:0v/40t, editorial-complete, author-legit |
| Lolita (lolita) | confident | 5/5 | canonical-id, bans:2v/16t/11c, sources:0v/17t, editorial-complete, author-legit |
| The Satanic Verses (the-satanic-verses) | confident | 5/5 | canonical-id, bans:15v/24t/22c, sources:0v/30t, editorial-complete, author-legit |
| To Kill a Mockingbird (to-kill-a-mockingbird) | confident | 4/5 | canonical-id, sources:0v/3t, editorial-complete, author-legit |
| Fahrenheit 451 (fahrenheit-451) | confident | 4/5 | canonical-id, sources:0v/3t, editorial-complete, author-legit |
| The Handmaid's Tale (the-handmaids-tale) | confident | 5/5 | canonical-id, bans:1v/84t/2c, sources:0v/84t, editorial-complete, author-legit |
| Ulysses (ulysses) | confident | 5/5 | canonical-id, bans:2v/13t/3c, sources:0v/13t, editorial-complete, author-legit |
| The Bible (the-bible) | confident | 3/5 | canonical-id, sources:0v/2t, editorial-complete |
| The Quran | _niet gevonden_ | — | — |
| One Thousand and One Nights (one-thousand-and-one-nights) | confident | 4/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete |
| Lysistrata (lysistrata) | confident | 4/5 | canonical-id, sources:0v/3t, editorial-complete, author-legit |
| Ars Amatoria (ars-amatoria) | confident | 3/5 | canonical-id, sources:0v/2t, editorial-complete |
