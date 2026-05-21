# Data Quality Dry Run

Run at: 2026-05-18T13:48:46.783Z

Drie buckets per record: `confident` (automatisch hoog vertrouwen), `default` (geïmporteerd, niets mis), `flagged` (minimaal één probleem).

## Books

Totaal: **5581**

| Bucket | Count | % |
|---|---:|---:|
| confident | 2553 | 45.7% |
| default | 2885 | 51.7% |
| flagged | 143 | 2.6% |

### Confident books — sample (top 25 by score, oudste eerst)

| ID | Slug | Title | Auteur | Score | Signalen |
|---:|---|---|---|---:|---|
| 4 | 1984 | 1984 | George Orwell | 5/5 | canonical-id, bans:0v/10t/10c, sources:0v/7t, editorial-complete, author-legit |
| 6 | the-satanic-verses | The Satanic Verses | Salman Rushdie | 5/5 | canonical-id, bans:0v/18t/14c, sources:0v/11t, editorial-complete, author-legit |
| 7 | and-tango-makes-three | And Tango Makes Three | Justin Richardson, Peter Parnell | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 8 | animal-farm | Animal Farm | George Orwell | 5/5 | canonical-id, bans:0v/10t/10c, sources:0v/4t, editorial-complete, author-legit |
| 10 | lady-chatterleys-lover | Lady Chatterley's Lover | D.H. Lawrence | 5/5 | canonical-id, bans:0v/6t/6c, sources:0v/4t, editorial-complete, author-legit |
| 11 | the-da-vinci-code | The Da Vinci Code | Dan Brown | 5/5 | canonical-id, bans:0v/7t/7c, sources:0v/3t, editorial-complete, author-legit |
| 12 | brave-new-world | Brave New World | Aldous Huxley | 5/5 | canonical-id, bans:0v/5t/5c, sources:0v/4t, editorial-complete, author-legit |
| 51 | lolita | Lolita | Vladimir Nabokov | 5/5 | canonical-id, bans:0v/11t/8c, sources:0v/7t, editorial-complete, author-legit |
| 52 | ulysses | Ulysses | James Joyce | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/2t, editorial-complete, author-legit |
| 58 | the-trial | The Trial | Franz Kafka | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/2t, editorial-complete, author-legit |
| 60 | american-psycho | American Psycho | Bret Easton Ellis | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 63 | the-communist-manifesto | The Communist Manifesto | Karl Marx, Friedrich Engels | 5/5 | canonical-id, bans:0v/4t/4c, sources:0v/4t, editorial-complete, author-legit |
| 72 | the-tin-drum | The Tin Drum | Günter Grass | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/2t, editorial-complete, author-legit |
| 93 | the-decameron | The Decameron | Giovanni Boccaccio | 5/5 | canonical-id, bans:0v/5t/5c, sources:0v/4t, editorial-complete, author-legit |
| 106 | the-god-of-small-things | The God of Small Things | Arundhati Roy | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/4t, editorial-complete, author-legit |
| 116 | the-jungle | The Jungle | Upton Sinclair | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 125 | persepolis | Persepolis | Marjane Satrapi | 5/5 | canonical-id, bans:0v/4t/3c, sources:0v/4t, editorial-complete, author-legit |
| 179 | droll-stories | Droll Stories | Honoré de Balzac | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/4t, editorial-complete, author-legit |
| 191 | the-painted-bird | The Painted Bird | Jerzy Kosiński | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 557 | mein-kampf | Mein Kampf | Adolf Hitler | 5/5 | canonical-id, bans:0v/8t/6c, sources:0v/4t, editorial-complete, author-legit |
| 558 | the-anarchist-cookbook | The Anarchist Cookbook | William Powell | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 576 | the-story-of-o | The Story of O | Pauline Réage | 5/5 | canonical-id, bans:0v/6t/6c, sources:0v/6t, editorial-complete, author-legit |
| 593 | lajja | Lajja | Taslima Nasrin | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 597 | married-love | Married Love | Marie Stopes | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete, author-legit |
| 604 | the-social-contract | The Social Contract | Jean-Jacques Rousseau | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/2t, editorial-complete, author-legit |

### Flagged books — flag-frequentie

| Flag | Count |
|---|---:|
| cover-placeholder | 66 |
| no-source-citations | 44 |
| only-placeholder-authors | 31 |
| ai-drafted-empty-desc | 2 |
| no-bans | 1 |

### Flagged books — sample (eerste 30)

| ID | Slug | Title | Auteur | Flags |
|---:|---|---|---|---|
| 560 | das-kapital | Das Kapital | Karl Marx | no-source-citations |
| 561 | spycatcher | Spycatcher | Peter Wright | no-source-citations |
| 563 | son-lois-lowry | Son | Lois Lowry | no-source-citations |
| 803 | msf-field-guide | Médecins Sans Frontières: Field Guide | Médecins Sans Frontières | no-bans |
| 804 | the-general-in-his-labyrinth | The General in His Labyrinth | Gabriel García Márquez | no-source-citations |
| 835 | the-quran-albania | The Quran | Various Authors | only-placeholder-authors |
| 897 | once-a-jolly-hangman | Once a Jolly Hangman | Alan Shadrake | cover-placeholder |
| 996 | the-prophet-gibran | The Prophet | Kahlil Gibran | no-source-citations |
| 1002 | abortion-our-struggle-for-control | Abortion: Our Struggle for Control | Anonymous | only-placeholder-authors |
| 1017 | the-thing-wentworth-james | The Thing | Gertie de S. Wentworth-James | ai-drafted-empty-desc |
| 1024 | questions-and-answers-on-communism | Questions and Answers on Communism | J. R. Campbell | ai-drafted-empty-desc |
| 1037 | diva-obsexion | Diva Obsexion | Anonymous | only-placeholder-authors |
| 1038 | the-great-big-narcotics-cookbook | The Great Big Narcotics Cookbook | Anonymous | only-placeholder-authors |
| 1046 | the-bargaining-for-israel | The Bargaining for Israel: In the Shadow of Armageddon | Anonymous | only-placeholder-authors |
| 1059 | mutiara-sastra-ali | Mutiara Sastra Ali: Muhammad Hashem Edisi Surat & Aforisme | Anonymous | only-placeholder-authors |
| 1060 | perjalanan-yang-cemerlang | Perjalanan yang Cemerlang 1930–1980 | Anonymous | only-placeholder-authors |
| 1067 | jacobs-room-to-choose | Jacob's Room To Choose | Anonymous | only-placeholder-authors |
| 1072 | komrad-asi-rejimen-10 | Komrad Asi Rejimen 10: Dalam Denyut Nihilisme Sejarah | Anonymous | only-placeholder-authors |
| 1084 | guerillas-of-the-kingdom-of-samsung | Guerillas of the Kingdom of Samsung | Anonymous | cover-placeholder, only-placeholder-authors |
| 1187 | the-league-of-super-feminists | The League of Super Feminists | Mirion Malle | cover-placeholder |
| 1216 | heartstopper-vol-4 | Heartstopper, Vol. 4 | Alice Oseman | cover-placeholder |
| 1892 | queer-as-all-get-out-10-people-whove-inspired-me | Queer As All Get Out: 10 People Who've Inspired Me | Shelby Criswell | cover-placeholder |
| 2095 | lgbt-intolerance | LGBT Intolerance | A.W. Buckey | cover-placeholder |
| 2096 | lgbtq-at-work-your-personal-and-working-life | LGBTQ at Work: Your Personal and Working Life | Melissa Albright-Jenkins | cover-placeholder |
| 2109 | the-teenage-guys-survival-guide-the-real-deal-on-going-out-growing-up-and-other-guy-stuff | The Teenage Guy's Survival Guide: The Real Deal on Going Out, Growing Up, and Other Guy Stuff | Jeremy Daldry | cover-placeholder |
| 2731 | el-libro-de-la-familia-the-family-book-spanish-edition | El Libro de la Familia/The Family Book (Spanish Edition) | Todd Parr | cover-placeholder |
| 2732 | eloise-and-the-strange-museum-visit-learning-to-make-reasoned-ethical-decisions | Eloise and the Strange Museum Visit: Learning to Make Reasoned, Ethical Decisions | Tosca Killoran | cover-placeholder |
| 2762 | tbh-idk-whats-next | TBH, IDK What's Next | Lisa Greenwald | cover-placeholder |
| 2764 | tbh-too-much-drama | TBH, Too Much Drama | Lisa Greenwald | cover-placeholder |
| 2826 | unbroken-a-world-war-ii-story-of-survival-resilience-and-redemption | Unbroken: A World War II Story of Survival, Resilience, and Redemption | Lauren Hillenbrand | cover-placeholder |

### Default books — sample (eerste 20, om te zien wat in het midden valt)

| ID | Slug | Title | Auteur | Score | Welke signalen miste |
|---:|---|---|---|---:|---|
| 27 | the-diary-of-a-young-girl | The Diary of a Young Girl | Anne Frank | 4/5 | editorial |
| 28 | the-hunger-games | The Hunger Games | Suzanne Collins | 3/5 | bans, editorial |
| 34 | go-ask-alice | Go Ask Alice | Anonymous | 2/5 | bans, sources, author-legit |
| 40 | james-and-the-giant-peach | James and the Giant Peach | Roald Dahl | 2/5 | bans, sources, editorial |
| 42 | flowers-for-algernon | Flowers for Algernon | Daniel Keyes | 2/5 | bans, sources, editorial |
| 53 | tropic-of-cancer | Tropic of Cancer | Henry Miller | 4/5 | editorial |
| 54 | naked-lunch | Naked Lunch | William S. Burroughs | 4/5 | editorial |
| 69 | the-awakening | The Awakening | Kate Chopin | 2/5 | bans, sources, editorial |
| 77 | the-sound-and-the-fury | The Sound and the Fury | William Faulkner | 2/5 | bans, sources, editorial |
| 78 | song-of-solomon | Song of Solomon | Toni Morrison | 2/5 | bans, sources, editorial |
| 79 | go-tell-it-on-the-mountain | Go Tell It on the Mountain | James Baldwin | 2/5 | bans, sources, editorial |
| 86 | one-day-in-the-life-of-ivan-denisovich | One Day in the Life of Ivan Denisovich | Aleksandr Solzhenitsyn | 2/5 | bans, sources, editorial |
| 96 | the-house-of-the-spirits | The House of the Spirits | Isabel Allende | 2/5 | bans, sources, editorial |
| 117 | myra-breckinridge | Myra Breckinridge | Gore Vidal | 2/5 | bans, sources, editorial |
| 129 | fight-club | Fight Club | Chuck Palahniuk | 2/5 | bans, sources, editorial |
| 132 | sold-patricia-mccormick | Sold | Patricia McCormick | 3/5 | bans, editorial |
| 139 | nickel-and-dimed | Nickel and Dimed | Barbara Ehrenreich | 2/5 | bans, sources, editorial |
| 142 | kaffir-boy | Kaffir Boy | Mark Mathabane | 3/5 | bans, editorial |
| 144 | sophies-choice | Sophie's Choice | William Styron | 3/5 | bans, editorial |
| 146 | soul-mountain | Soul Mountain | Gao Xingjian | 3/5 | bans, editorial |

## Authors

Totaal: **3742**

| Bucket | Count | % |
|---|---:|---:|
| confident | 1001 | 26.8% |
| default | 2718 | 72.6% |
| flagged | 23 | 0.6% |

### Confident authors — sample (eerste 25)

| ID | Slug | Name | Books | Confident books | Signalen |
|---:|---|---|---:|---:|---|
| 5 | george-orwell | George Orwell | 8 | 7 | birth-year, bio, photo, confident-books:7, birth-country |
| 6 | toni-morrison | Toni Morrison | 5 | 4 | birth-year, bio, photo, confident-books:4, birth-country |
| 7 | salman-rushdie | Salman Rushdie | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |
| 8 | justin-richardson | Justin Richardson | 2 | 2 | birth-year, bio, confident-books:2, birth-country |
| 9 | peter-parnell | Peter Parnell | 1 | 1 | birth-year, bio, confident-books:1, birth-country |
| 10 | margaret-atwood | Margaret Atwood | 7 | 6 | birth-year, bio, photo, confident-books:6, birth-country |
| 11 | dh-lawrence | D.H. Lawrence | 4 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 12 | dan-brown | Dan Brown | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 13 | aldous-huxley | Aldous Huxley | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 15 | j-d-salinger | J.D. Salinger | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 16 | mark-twain | Mark Twain | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 17 | john-steinbeck | John Steinbeck | 4 | 4 | birth-year, bio, photo, confident-books:4, birth-country |
| 18 | alice-walker | Alice Walker | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 19 | kurt-vonnegut | Kurt Vonnegut | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 20 | ken-kesey | Ken Kesey | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 21 | anthony-burgess | Anthony Burgess | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 22 | william-golding | William Golding | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 23 | ray-bradbury | Ray Bradbury | 1 | 1 | birth-year, bio, photo, confident-books:1, birth-country |
| 24 | maya-angelou | Maya Angelou | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 25 | richard-wright | Richard Wright | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 27 | suzanne-collins | Suzanne Collins | 3 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 28 | stephen-chbosky | Stephen Chbosky | 2 | 2 | birth-year, bio, photo, confident-books:2, birth-country |
| 29 | laurie-halse-anderson | Laurie Halse Anderson | 8 | 6 | birth-year, bio, photo, confident-books:6, birth-country |
| 30 | khaled-hosseini | Khaled Hosseini | 4 | 4 | birth-year, bio, photo, confident-books:4, birth-country |
| 31 | philip-pullman | Philip Pullman | 3 | 3 | birth-year, bio, photo, confident-books:3, birth-country |

### Flagged authors — flag-frequentie

| Flag | Count |
|---|---:|
| no-books | 16 |
| placeholder | 6 |
| death-before-birth | 1 |

### Flagged authors — sample (eerste 30)

| ID | Slug | Name | Books | Flags |
|---:|---|---|---:|---|
| 33 | anonymous | Anonymous | 24 | placeholder |
| 97 | edna-st-vincent-millay | Edna St. Vincent Millay | 0 | no-books |
| 103 | nikolai-gogol | Nikolai Gogol | 0 | no-books |
| 104 | fyodor-dostoevsky | Fyodor Dostoevsky | 0 | no-books |
| 105 | leo-tolstoy | Leo Tolstoy | 0 | no-books |
| 106 | maxim-gorky | Maxim Gorky | 0 | no-books |
| 107 | yevgenia-ginzburg | Yevgenia Ginzburg | 0 | no-books |
| 169 | beatrice-sparks | Beatrice Sparks | 0 | no-books |
| 176 | jung-chang-halliday | Jung Chang | 0 | no-books |
| 186 | elizabeth-smart | Elizabeth Smart | 1 | death-before-birth |
| 191 | water-for-elephants | Sara Gruen | 0 | no-books |
| 196 | walter-dean-myers-2 | Walter Dean Myers | 0 | no-books |
| 202 | liam-obrien | Tim O'Brien | 0 | no-books |
| 346 | alice-seabold | Alice Seabold | 0 | no-books |
| 421 | unknown-author | Unknown | 1 | placeholder |
| 431 | benjamin-alire-saenz | Benjamin Alire Sáenz | 0 | no-books |
| 455 | various-authors | Various Authors | 2 | placeholder |
| 584 | elif-safak | Elif Şafak | 0 | no-books |
| 692 | brian-hioe | Brian Hioe (ed.) | 0 | no-books |
| 1820 | no-further-information-available | No Further Information Available | 20 | placeholder |
| 2068 | m-s-hennessey | M.S. Hennessey | 0 | no-books |
| 4235 | no-further-information | No Further Information | 1 | placeholder |
| 4391 | unknown | Unknown | 2 | placeholder |

## Canary checks

Zoek bekende titels op om te zien of de heuristiek ze in `confident` plaatst:

| Titel | Verdict | Score | Signalen / flags |
|---|---|---:|---|
| 1984 (1984) | confident | 5/5 | canonical-id, bans:0v/10t/10c, sources:0v/7t, editorial-complete, author-legit |
| Nineteen Eighty-Four (nineteen-eighty-four-1949) | confident | 4/5 | canonical-id, sources:0v/2t, editorial-complete, author-legit |
| Animal Farm (animal-farm) | confident | 5/5 | canonical-id, bans:0v/10t/10c, sources:0v/4t, editorial-complete, author-legit |
| Brave New World (brave-new-world) | confident | 5/5 | canonical-id, bans:0v/5t/5c, sources:0v/4t, editorial-complete, author-legit |
| Lolita (lolita) | confident | 5/5 | canonical-id, bans:0v/11t/8c, sources:0v/7t, editorial-complete, author-legit |
| The Satanic Verses (the-satanic-verses) | confident | 5/5 | canonical-id, bans:0v/18t/14c, sources:0v/11t, editorial-complete, author-legit |
| To Kill a Mockingbird (to-kill-a-mockingbird) | confident | 3/5 | canonical-id, editorial-complete, author-legit |
| Fahrenheit 451 (fahrenheit-451) | confident | 4/5 | canonical-id, sources:0v/2t, editorial-complete, author-legit |
| The Handmaid's Tale (the-handmaids-tale) | confident | 4/5 | canonical-id, sources:0v/2t, editorial-complete, author-legit |
| Ulysses (ulysses) | confident | 5/5 | canonical-id, bans:0v/3t/3c, sources:0v/2t, editorial-complete, author-legit |
| The Bible (the-bible) | default | 2/5 | canonical-id, editorial-complete |
| The Quran (the-quran-albania) | flagged | 1/5 | only-placeholder-authors |
| One Thousand and One Nights (one-thousand-and-one-nights) | confident | 4/5 | canonical-id, bans:0v/3t/3c, sources:0v/3t, editorial-complete |
| Lysistrata (lysistrata) | confident | 4/5 | canonical-id, sources:0v/2t, editorial-complete, author-legit |
| Ars Amatoria (ars-amatoria) | default | 2/5 | canonical-id, editorial-complete |
