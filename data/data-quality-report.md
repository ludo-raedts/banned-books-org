# Data Quality Dry Run

Run at: 2026-06-17T07:48:41.528Z

Drie buckets per record: `confident` (automatisch hoog vertrouwen), `default` (geïmporteerd, niets mis), `flagged` (minimaal één probleem).

## Books

Totaal: **15856**

| Bucket | Count | % |
|---|---:|---:|
| confident | 5157 | 32.5% |
| default | 8374 | 52.8% |
| flagged | 2325 | 14.7% |

### Confident books — sample (top 25 by score, oudste eerst)

| ID | Slug | Title | Auteur | Score | Signalen |
|---:|---|---|---|---:|---|
| 4 | 1984 | 1984 | George Orwell | 5/5 | canonical-id, bans:0v/25t/12c, sources:0v/25t, editorial-complete, author-legit |
| 5 | the-bluest-eye | The Bluest Eye | Toni Morrison | 5/5 | canonical-id, bans:1v/115t/1c, sources:0v/118t, editorial-complete, author-legit |
| 6 | the-satanic-verses | The Satanic Verses | Salman Rushdie | 5/5 | canonical-id, bans:15v/23t/22c, sources:0v/29t, editorial-complete, author-legit |
| 7 | and-tango-makes-three | And Tango Makes Three | Justin Richardson, Peter Parnell | 5/5 | canonical-id, bans:1v/23t/4c, sources:0v/24t, editorial-complete, author-legit |
| 8 | animal-farm | Animal Farm | George Orwell | 5/5 | canonical-id, bans:0v/13t/11c, sources:0v/13t, editorial-complete, author-legit |
| 9 | the-handmaids-tale | The Handmaid's Tale | Margaret Atwood | 5/5 | canonical-id, bans:1v/109t/2c, sources:0v/109t, editorial-complete, author-legit |
| 10 | lady-chatterleys-lover | Lady Chatterley's Lover | D.H. Lawrence | 5/5 | canonical-id, bans:2v/13t/13c, sources:0v/14t, editorial-complete, author-legit |
| 11 | the-da-vinci-code | The Da Vinci Code | Dan Brown | 5/5 | canonical-id, bans:1v/10t/9c, sources:0v/10t, editorial-complete, author-legit |
| 12 | brave-new-world | Brave New World | Aldous Huxley | 5/5 | canonical-id, bans:0v/45t/5c, sources:0v/45t, editorial-complete, author-legit |
| 13 | to-kill-a-mockingbird | To Kill a Mockingbird | Harper Lee | 5/5 | canonical-id, bans:0v/7t/1c, sources:0v/7t, editorial-complete, author-legit |
| 16 | of-mice-and-men | Of Mice and Men | John Steinbeck | 5/5 | canonical-id, bans:0v/6t/1c, sources:0v/6t, editorial-complete, author-legit |
| 17 | the-grapes-of-wrath | The Grapes of Wrath | John Steinbeck | 5/5 | canonical-id, bans:1v/5t/3c, sources:0v/6t, editorial-complete, author-legit |
| 18 | the-color-purple | The Color Purple | Alice Walker | 5/5 | canonical-id, bans:1v/65t/3c, sources:0v/65t, editorial-complete, author-legit |
| 19 | beloved | Beloved | Toni Morrison | 5/5 | canonical-id, bans:0v/79t/2c, sources:0v/80t, editorial-complete, author-legit |
| 20 | slaughterhouse-five | Slaughterhouse-Five | Kurt Vonnegut | 5/5 | canonical-id, bans:0v/60t/1c, sources:0v/60t, editorial-complete, author-legit |
| 22 | a-clockwork-orange | A Clockwork Orange | Anthony Burgess | 5/5 | canonical-id, bans:3v/30t/1c, sources:0v/32t, editorial-complete, author-legit |
| 23 | the-lord-of-the-flies | The Lord of the Flies | William Golding | 5/5 | canonical-id, bans:0v/7t/2c, sources:0v/7t, editorial-complete, author-legit |
| 25 | i-know-why-the-caged-bird-sings | I Know Why the Caged Bird Sings | Maya Angelou | 5/5 | canonical-id, bans:0v/54t/2c, sources:0v/54t, editorial-complete, author-legit |
| 26 | native-son | Native Son | Richard Wright | 5/5 | canonical-id, bans:0v/30t/1c, sources:0v/30t, editorial-complete, author-legit |
| 27 | the-diary-of-a-young-girl | The Diary of a Young Girl | Anne Frank | 5/5 | canonical-id, bans:0v/4t/3c, sources:0v/5t, editorial-complete, author-legit |
| 29 | the-perks-of-being-a-wallflower | The Perks of Being a Wallflower | Stephen Chbosky | 5/5 | canonical-id, bans:2v/139t/2c, sources:0v/139t, editorial-complete, author-legit |
| 30 | speak | Speak | Laurie Halse Anderson | 5/5 | canonical-id, bans:0v/68t/1c, sources:0v/68t, editorial-complete, author-legit |
| 31 | the-kite-runner | The Kite Runner | Khaled Hosseini | 5/5 | canonical-id, bans:0v/118t/2c, sources:0v/119t, editorial-complete, author-legit |
| 43 | the-house-on-mango-street | The House on Mango Street | Sandra Cisneros | 5/5 | canonical-id, bans:0v/10t/1c, sources:0v/10t, editorial-complete, author-legit |
| 44 | catch-22 | Catch-22 | Joseph Heller | 5/5 | canonical-id, bans:0v/6t/1c, sources:0v/6t, editorial-complete, author-legit |

### Flagged books — flag-frequentie

| Flag | Count |
|---|---:|
| only-placeholder-authors | 1504 |
| cover-placeholder | 840 |
| no-bans | 1 |

### Flagged books — sample (eerste 30)

| ID | Slug | Title | Auteur | Flags |
|---:|---|---|---|---|
| 158 | a-feast-for-the-seaweeds | A Feast for the Seaweeds | Haidar Haidar | cover-placeholder |
| 428 | slaughterhouse-five-the-graphic-novel | Slaughterhouse-Five: The Graphic Novel | Kurt Vonnegut | cover-placeholder |
| 451 | jump-rope-readers-tangerine-series | Jump Rope Readers Tangerine Series | Katy Wischow | cover-placeholder |
| 531 | burned-pcc | Burned (PCC) | P. C. Cast | cover-placeholder |
| 613 | kurdistan-an-interstate-colony | Kurdistan: An Interstate Colony | İsmail Beşikçi | cover-placeholder |
| 617 | taseer-of-lahore | Taseer of Lahore | Jugnu Mohsin | cover-placeholder |
| 634 | the-best-of-jb-jeyaretnam | The Best of J. B. Jeyaretnam | J. B. Jeyaretnam | cover-placeholder |
| 639 | one-sentence-about-tyranny | One Sentence About Tyranny | Gyula Illyés | cover-placeholder |
| 649 | high-times-encyclopedia | High Times Encyclopedia of Recreational Drugs | High Times Magazine (eds.) | cover-placeholder |
| 662 | the-sleepless-world | The Sleepless World | Erich Kästner | cover-placeholder |
| 690 | the-passive-organ-paul-goma | The Passive Organ | Paul Goma | cover-placeholder |
| 705 | sumatoha-radichkov | Sumatoha | Yordan Radichkov | cover-placeholder |
| 719 | o-delfim | O Delfim | José Cardoso Pires | cover-placeholder |
| 720 | ate-amanha-camaradas | Até amanhã, camaradas | Manuel Tiago | cover-placeholder |
| 721 | imperialism-kotoku-shusui | Imperialism: The Spectre of the Twentieth Century | Kōtoku Shūsui | cover-placeholder |
| 741 | prisoners-of-the-state | Prisoners of the State: The Inside Story of China's Secret System | Xu Zhiyong | cover-placeholder |
| 795 | ukraine-is-not-russia | Ukraine Is Not Russia | Leonid Kuchma | cover-placeholder |
| 796 | the-second-chechen-war | The Second Chechen War | Anna Politkovskaya | cover-placeholder |
| 803 | msf-field-guide | Médecins Sans Frontières: Field Guide | Médecins Sans Frontières | cover-placeholder, no-bans |
| 857 | hoa-kiau | Hoa Kiau | Pramoedya Ananta Toer | cover-placeholder |
| 861 | a-banquet-for-seaweed | A Banquet for Seaweed | Haidar Haidar | cover-placeholder |
| 865 | the-oath-of-the-barbarians | The Oath of the Barbarians | Boualem Sansal | cover-placeholder |
| 868 | em-camara-lenta | Em Câmara Lenta | Renato Tapajós | cover-placeholder |
| 869 | tessa-a-gata | Tessa, a Gata | Cassandra Rios | cover-placeholder |
| 870 | rangila-rasul | Rangila Rasul | M.A. Chamupati | cover-placeholder |
| 879 | yakhalinkomo | Yakhal'inkomo | Mongane Wally Serote | cover-placeholder |
| 883 | five-bandits | Five Bandits | Kim Chi-ha | cover-placeholder |
| 897 | once-a-jolly-hangman | Once a Jolly Hangman | Alan Shadrake | cover-placeholder |
| 902 | the-epic-of-sheikh-bedreddin | The Epic of Sheikh Bedreddin | Nâzım Hikmet | cover-placeholder |
| 934 | quando-os-lobos-uivam | Quando os Lobos Uivam | Aquilino Ribeiro | cover-placeholder |

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
| 162 | an-area-of-darkness | An Area of Darkness | V. S. Naipaul | 2/5 | bans, sources, editorial |
| 187 | snow-falling-on-cedars | Snow Falling on Cedars | David Guterson | 4/5 | editorial |
| 190 | mother-courage-and-her-children | Mother Courage and Her Children | Bertolt Brecht | 2/5 | bans, sources, editorial |
| 200 | a-court-of-mist-and-fury | A Court of Mist and Fury | Sarah J. Maas | 4/5 | editorial |
| 206 | perfect-eh | Perfect (EH) | Ellen Hopkins | 2/5 | bans, sources, editorial |
| 215 | mondays-not-coming | Monday's Not Coming | Tiffany D. Jackson | 3/5 | editorial, author-legit |
| 218 | shine | Shine | Lauren Myracle | 4/5 | editorial |

## Authors

Totaal: **9532**

| Bucket | Count | % |
|---|---:|---:|
| confident | 1486 | 15.6% |
| default | 8026 | 84.2% |
| flagged | 20 | 0.2% |

### Confident authors — sample (eerste 25)

| ID | Slug | Name | Books | Confident books | Signalen |
|---:|---|---|---:|---:|---|
| 5 | george-orwell | George Orwell | 6 | 5 | birth-year, bio, photo, confident-books:5, birth-country |
| 6 | toni-morrison | Toni Morrison | 8 | 7 | birth-year, bio, photo, confident-books:7, birth-country |
| 7 | salman-rushdie | Salman Rushdie | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 8 | justin-richardson | Justin Richardson | 2 | 2 | birth-year, bio, confident-books:2, birth-country |
| 9 | peter-parnell | Peter Parnell | 1 | 1 | birth-year, bio, confident-books:1, birth-country |
| 10 | margaret-atwood | Margaret Atwood | 9 | 9 | birth-year, bio, photo, confident-books:9, birth-country |
| 11 | dh-lawrence | D.H. Lawrence | 4 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 12 | dan-brown | Dan Brown | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 13 | aldous-huxley | Aldous Huxley | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 15 | j-d-salinger | J.D. Salinger | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 16 | mark-twain | Mark Twain | 3 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 17 | john-steinbeck | John Steinbeck | 5 | 5 | birth-year, bio, photo, confident-books:5, birth-country |
| 18 | alice-walker | Alice Walker | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 19 | kurt-vonnegut | Kurt Vonnegut | 7 | 5 | birth-year, bio, photo, confident-books:5, birth-country |
| 20 | ken-kesey | Ken Kesey | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 21 | anthony-burgess | Anthony Burgess | 2 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 22 | william-golding | William Golding | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 23 | ray-bradbury | Ray Bradbury | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 24 | maya-angelou | Maya Angelou | 6 | 6 | birth-year, bio, photo, confident-books:6, birth-country |
| 25 | richard-wright | Richard Wright | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 27 | suzanne-collins | Suzanne Collins | 3 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 28 | stephen-chbosky | Stephen Chbosky | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 29 | laurie-halse-anderson | Laurie Halse Anderson | 10 | 8 | birth-year, bio, photo, confident-books:8, birth-country |
| 30 | khaled-hosseini | Khaled Hosseini | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 31 | philip-pullman | Philip Pullman | 6 | 4 | birth-year, bio, photo, confident-books:4, birth-country |

### Flagged authors — flag-frequentie

| Flag | Count |
|---|---:|
| no-books | 13 |
| placeholder | 7 |

### Flagged authors — sample (eerste 30)

| ID | Slug | Name | Books | Flags |
|---:|---|---|---:|---|
| 33 | anonymous | Anonymous | 1630 | placeholder |
| 97 | edna-st-vincent-millay | Edna St. Vincent Millay | 0 | no-books |
| 103 | nikolai-gogol | Nikolai Gogol | 0 | no-books |
| 107 | yevgenia-ginzburg | Yevgenia Ginzburg | 0 | no-books |
| 421 | unknown-author | Unknown | 1 | placeholder |
| 455 | various-authors | Various Authors | 19 | placeholder |
| 554 | peter-sotos | Peter Sotos | 0 | no-books |
| 692 | brian-hioe | Brian Hioe (ed.) | 0 | no-books |
| 1820 | no-further-information-available | No Further Information Available | 19 | placeholder |
| 4235 | no-further-information | No Further Information | 1 | placeholder |
| 4320 | theo-van-gogh | Theo van Gogh | 0 | no-books |
| 4391 | unknown | Unknown | 2 | placeholder |
| 4599 | david-hamilton | David Hamilton | 0 | no-books |
| 4611 | sade | Sade | 0 | no-books |
| 5785 | shahrnoosh-parsipour | Shahrnoosh Parsipour | 0 | no-books |
| 8176 | voon-ho-yin | Voon Ho Yin | 0 | no-books |
| 9281 | gaidar-arkadi | Gaidar, Arkadi | 0 | no-books |
| 9488 | roca-elena | Roca, Elena | 0 | no-books |
| 9581 | walter-gerard | Walter, Gerard | 0 | no-books |
| 12340 | fido-nesti | Fido Nesti | 1 | placeholder |

## Canary checks

Zoek bekende titels op om te zien of de heuristiek ze in `confident` plaatst:

| Titel | Verdict | Score | Signalen / flags |
|---|---|---:|---|
| 1984 (1984) | confident | 5/5 | canonical-id, bans:0v/25t/12c, sources:0v/25t, editorial-complete, author-legit |
| Nineteen Eighty-Four | _niet gevonden_ | — | — |
| Animal Farm (animal-farm) | confident | 5/5 | canonical-id, bans:0v/13t/11c, sources:0v/13t, editorial-complete, author-legit |
| Brave New World (brave-new-world) | confident | 5/5 | canonical-id, bans:0v/45t/5c, sources:0v/45t, editorial-complete, author-legit |
| Lolita (lolita) | confident | 5/5 | canonical-id, bans:1v/18t/11c, sources:0v/21t, editorial-complete, author-legit |
| The Satanic Verses (the-satanic-verses) | confident | 5/5 | canonical-id, bans:15v/23t/22c, sources:0v/29t, editorial-complete, author-legit |
| To Kill a Mockingbird (to-kill-a-mockingbird) | confident | 5/5 | canonical-id, bans:0v/7t/1c, sources:0v/7t, editorial-complete, author-legit |
| Fahrenheit 451 (fahrenheit-451) | confident | 4/5 | canonical-id, sources:0v/4t, editorial-complete, author-legit |
| The Handmaid's Tale (the-handmaids-tale) | confident | 5/5 | canonical-id, bans:1v/109t/2c, sources:0v/109t, editorial-complete, author-legit |
| Ulysses (ulysses) | confident | 5/5 | canonical-id, bans:2v/13t/3c, sources:0v/13t, editorial-complete, author-legit |
| The Bible (the-bible) | confident | 3/5 | canonical-id, sources:0v/4t, editorial-complete |
| The Quran | _niet gevonden_ | — | — |
| One Thousand and One Nights (one-thousand-and-one-nights) | confident | 4/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete |
| Lysistrata (lysistrata) | confident | 4/5 | canonical-id, sources:0v/3t, editorial-complete, author-legit |
| Ars Amatoria (ars-amatoria) | confident | 3/5 | canonical-id, sources:0v/2t, editorial-complete |
