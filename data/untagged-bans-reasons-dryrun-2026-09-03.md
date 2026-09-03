# enrich-reasons DRY-RUN — class untagged

Run: 2026-09-03T14:30:27.433Z · model gpt-4o-mini · 143 bans classified
Nothing was written to the database.

- would stay 'other' (no specific reason found): **11**
- rows without a per-event description (book-level inference only): **3**

## Proposed reasons per slug

| slug | rows |
| --- | --- |
| sexual | 83 |
| moral | 78 |
| violence | 41 |
| language | 28 |
| obscenity | 27 |
| lgbtq | 22 |
| political | 22 |
| drugs | 19 |
| religious | 15 |
| racial | 11 |
| other | 11 |
| blasphemy | 10 |

## Per row

| ban | book | title | event | proposed | has per-event description |
| --- | --- | --- | --- | --- | --- |
| 13070 | 793 | The Adventures of Tintin in the Congo | US · 2007 · New York · Brooklyn Public Library | racial | yes |
| 13071 | 793 | The Adventures of Tintin in the Congo | BE · 2007 · Brussels | racial | yes |
| 13072 | 6 | The Satanic Verses | SD · 1988 | blasphemy, religious | yes |
| 13073 | 6 | The Satanic Verses | ZA · 1988 | religious, blasphemy | yes |
| 13075 | 6 | The Satanic Verses | SO · 1988 | blasphemy, religious | yes |
| 13076 | 6 | The Satanic Verses | BN · 1989 | blasphemy, religious | yes |
| 13077 | 6 | The Satanic Verses | SG · 1989 | religious, blasphemy | yes |
| 13078 | 6 | The Satanic Verses | VE · 1989 | religious, blasphemy | yes |
| 13079 | 22 | A Clockwork Orange | US · 1977 · Westport, Massachusetts | language, violence | yes |
| 13080 | 22 | A Clockwork Orange | US · 1982 · Anniston, Alabama | violence, sexual, language, moral | yes |
| 13081 | 200 | A Court of Mist and Fury | US · 2023 · Mason City, Iowa | sexual, obscenity, moral | yes |
| 13082 | 200 | A Court of Mist and Fury | US · 2024 · Utah · Utah State Board of Education | sexual, moral, obscenity | yes |
| 13083 | 123 | All Boys Aren't Blue | US · 2022 · Utah · Alpine School District | lgbtq, sexual, language | yes |
| 13084 | 64 | All Quiet on the Western Front | AT · 1929 | political | yes |
| 13085 | 64 | All Quiet on the Western Front | CZ · 1929 | political | yes |
| 13087 | 537 | Aristotle and Dante Discover the Secrets of the Universe | BY · 2025 | political, lgbtq | yes |
| 13088 | 365 | Call Me By Your Name | US · 2023 · Florida · St. Johns County School District | lgbtq, sexual | yes |
| 13089 | 365 | Call Me By Your Name | US · 2023 · Alaska · Matanuska-Susitna Borough School District | lgbtq, sexual | yes |
| 13090 | 133 | Crank | US · 2022 · Utah · Alpine School District | sexual, violence, language, drugs, moral | yes |
| 13091 | 133 | Crank | US · 2023 · Texas · Rockwall Independent School District | drugs, sexual, violence, language, moral | yes |
| 13092 | 814 | Did Six Million Really Die? | ZA | political | yes |
| 13093 | 186 | Drama | US · 2014 · Texas · Chapel Hill Elementary School | lgbtq, moral | yes |
| 13094 | 186 | Drama | US · 2014 · Texas · Seele Elementary School | lgbtq, moral | yes |
| 13095 | 186 | Drama | US · 2016 · Texas · Kirbyville Junior High | lgbtq, moral | yes |
| 13096 | 186 | Drama | US · 2016 · Texas · Franklin Independent School District | lgbtq, moral | yes |
| 13097 | 658 | Emile, or On Education | CH · 1762 | political, religious, moral | yes |
| 13098 | 223 | Fallout | US · 2022 · Utah · Alpine School District | drugs, sexual, moral | yes |
| 13099 | 223 | Fallout | US · 2022 · Texas · Prosper Independent School District | drugs, sexual, moral | yes |
| 13100 | 577 | Fanny Hill | GB · 1963 · Mayflower Books | sexual, obscenity, moral | yes |
| 13101 | 6225 | Forever Amber | US · 1940 | sexual, obscenity | yes |
| 13102 | 297 | Heartstopper | TR · 2021 | lgbtq, moral | yes |
| 13103 | 297 | Heartstopper | HU · 2023 | lgbtq, moral | yes |
| 13105 | 297 | Heartstopper | US · 2023 · Marion County, Mississippi · Marion County library system | lgbtq, sexual, moral | yes |
| 13106 | 267 | It | RU · 2025 | lgbtq, violence, sexual | yes |
| 13107 | 10 | Lady Chatterley's Lover | CA · 1962 · Supreme Court of Canada | sexual, obscenity, moral | yes |
| 13108 | 10 | Lady Chatterley's Lover | IN · 1964 · Supreme Court of India | sexual, obscenity, moral | yes |
| 13109 | 752 | Hubert Selby Jr.: Last Exit to Brooklyn | IT | lgbtq, sexual, violence, drugs, obscenity | yes |
| 13110 | 217 | Last Night at the Telegraph Club | US · 2025 · South Carolina · South Carolina Board of Education | sexual, lgbtq | yes |
| 13112 | 51 | Lolita | US · 2023 · North Carolina · Catawba County Schools Board of Education | sexual, moral | yes |
| 13113 | 202 | Me and Earl and the Dying Girl | US · 2023 · Cobb County, Georgia | sexual, language, moral | yes |
| 13114 | 202 | Me and Earl and the Dying Girl | US · 2025 · Abilene, Texas · Abilene ISD | language, sexual | yes |
| 13115 | 557 | Mein Kampf | LV · 1995 | racial, political | yes |
| 13116 | 54 | Naked Lunch | US · 1965 · Massachusetts · Superior Court | obscenity, drugs | yes |
| 13117 | 54 | Naked Lunch | US · 1965 · Massachusetts · Massachusetts Supreme Judicial Court | drugs, obscenity, moral | yes |
| 13118 | 54 | Naked Lunch | US · 1965 · Los Angeles · Municipal Court | obscenity, drugs | yes |
| 13119 | 135 | Nineteen Minutes | US · 2022 · Utah · Alpine School District | violence, sexual, language, moral | yes |
| 13120 | 197 | Out of Darkness | US · 2021 · Utah · Washington School District | language, sexual, racial, moral | yes |
| 13121 | 197 | Out of Darkness | US · 2022 · Texas · Keller Independent School District | sexual, violence, racial, moral | yes |
| 13122 | 197 | Out of Darkness | US · 2022 · Utah · Alpine School District | sexual, racial, obscenity, moral | yes |
| 13123 | 82 | The Absolutely True Diary of a Part-Time Indian | US · 2010 · Newcastle, Wyoming · Newcastle Middle School | language, sexual, racial | yes |
| 13125 | 5 | The Bluest Eye | US · 2025 · California · Redlands Unified School District | sexual, violence, language, moral | yes |
| 13126 | 18 | The Color Purple | IL · 2012 | political, racial, sexual, violence, language | yes |
| 13127 | 11 | The Da Vinci Code | IN · 2006 · Nagaland | religious, blasphemy | yes |
| 13129 | 264 | The DUFF: Designated Ugly Fat Friend | US · 2024 · Iowa · Gilbert School District | sexual, moral | yes |
| 13130 | 9 | The Handmaid's Tale | US · 2023 · Virginia · Hanover County School Board | sexual, obscenity, moral, religious | yes |
| 13131 | 973 | The Jewel of Medina | RS · 2008 · Beobook | religious, blasphemy | yes |
| 13132 | 29 | The Perks of Being a Wallflower | US · 2025 | lgbtq, sexual, drugs, language, moral | yes |
| 13133 | 29 | The Perks of Being a Wallflower | BY · 2025 | political, lgbtq, sexual, language, drugs, moral | yes |
| 13134 | 581 | The Protocols of the Elders of Zion | CH · 1935 · Bern · Amtsgericht (district court) | political, obscenity | yes |
| 13135 | 816 | The Red and the Black | BR · 1964 · Rio Grande do Sul | political, religious | yes |
| 13136 | 605 | The Sorrows of Young Werther | DE · 1775 · Leipzig | moral | yes |
| 13137 | 559 | The Turner Diaries | FR · 1999 | racial, political, violence | yes |
| 13138 | 7536 | Tilt | US · 2022 · Utah · Alpine School District | sexual, drugs, moral | yes |
| 13140 | 53 | Tropic of Cancer | CA · 1938 | sexual, obscenity, moral | yes |
| 13141 | 53 | Tropic of Cancer | FI · 1962 | sexual, obscenity, moral | yes |
| 13142 | 848 | Watchmen | US · 2019 · Florida · Florida state prisons | violence | yes |
| 13143 | 558 | The Anarchist Cookbook | CA | political, violence, drugs | yes |
| 20997 | 8511 | That Night | US · 2023 · Florida · Escambia County Public Schools | violence | no |
| 22215 | 9726 | The War that Saved My Life | US · 2024 · Iowa · Clear Creek-Amana Community School District | other | no |
| 23005 | 9987 | If You Leave | US · 2024 · Iowa · Western Dubuque Community School District | other | no |
| 25200 | 12856 | Mysterious Facts Gods & Demons | MY · 2005 | other | yes |
| 25240 | 12895 | Isteri Muda yang Berlaku Curang | MY · 2005 | other | yes |
| 25343 | 12995 | Petunjuk Membuat Azimat dan Benda Bertuah | MY · 2007 | other | yes |
| 26172 | 11026 | On Sparks | MY · 1951 | other | yes |
| 26397 | 11436 | Honeymoon Hotel | MY · 1972 | other | yes |
| 26451 | 11488 | We All Need Someone | MY · 1974 | other | yes |
| 26486 | 11523 | I, Jan Cremer | MY · 1974 | other | yes |
| 26488 | 11525 | It's Getting Harder All the Time | MY · 1974 | sexual, political | yes |
| 26856 | 12568 | Mayat Bertukar Bangkai Khinzir | MY · 1998 | other | yes |
| 26954 | 14317 | Untitled Chinese publication (KDN P.U. (A) 70 / 2026) | MY · 2026 | other | yes |
| 29115 | 16429 | Franz Overbeck und Friedrich Nietzsche, eine Freundschaft | DE · 1908 | political | yes |
| 29167 | 149 | Alice's Adventures in Wonderland | CN · 1911 | moral | yes |
| 29807 | 600 | Fifty Shades of Grey | BR · 2013 · Macaé | sexual, obscenity, moral | yes |
| 29808 | 65 | For Whom the Bell Tolls | TR · 1973 | political | yes |
| 29809 | 144 | Sophie's Choice | PL | racial, political | yes |
| 29810 | 144 | Sophie's Choice | ZA · 1979 | sexual, political | yes |
| 29811 | 74 | The Picture of Dorian Gray | GB · 1890 · WHSmith | lgbtq, obscenity, moral | yes |
| 29814 | 261 | This Book Is Gay | US · 2023 · Iowa · Sioux City Community School District | sexual, obscenity, lgbtq, moral | yes |
| 29815 | 7232 | Tokyo Ghoul | RU · 2021 | violence, obscenity, moral | yes |
| 29843 | 204 | A Court of Frost and Starlight | US · 2024 · Utah | sexual, obscenity, moral | yes |
| 29844 | 134 | A Court of Thorns and Roses | US · 2023 · Utah | sexual, moral | yes |
| 29845 | 201 | A Court of Wings and Ruin | US · 2023 · Utah · Utah public schools | sexual, violence | yes |
| 29846 | 201 | A Court of Wings and Ruin | US · 2024 · Tennessee · Rutherford County Schools | sexual, violence | yes |
| 29848 | 199 | Empire of Storms | US · 2024 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 29849 | 819 | Justine, or the Misfortunes of Virtue | FR · 1815 · Cour Royale de Paris | sexual, violence, obscenity, moral | yes |
| 29850 | 817 | Les Onze Mille Verges | TR · 2000 | obscenity, sexual | yes |
| 29851 | 205 | Lucky | US · 2023 · New York | sexual, violence, moral | yes |
| 29852 | 6496 | My Secret Life | US · 1932 | obscenity, sexual | yes |
| 29853 | 6496 | My Secret Life | GB · 1969 | sexual, obscenity, moral | yes |
| 29854 | 921 | Philosophical Dictionary | CH · 1765 · Geneva | political, religious, blasphemy | yes |
| 29856 | 121 | Thirteen Reasons Why | US · 2017 · Colorado · Mesa County School District | sexual, drugs | yes |
| 29857 | 181 | Water for Elephants | US · 2024 · Texas · Katy Independent School District | sexual, violence, language | yes |
| 29858 | 181 | Water for Elephants | US · 2024 · Utah · Davis School District | sexual, violence, language | yes |
| 29859 | 181 | Water for Elephants | US · 2025 · Utah · Tooele County School District | sexual, violence, language | yes |
| 29860 | 181 | Water for Elephants | US · 2025 · Utah · Cache County School District | sexual, violence, language | yes |
| 29862 | 84 | A Wrinkle in Time | US · 1984 · Polk City, Florida · elementary school | religious, moral | yes |
| 29863 | 84 | A Wrinkle in Time | US · 2000 · Alabama · school district | religious, blasphemy | yes |
| 29865 | 493 | Stamped from the Beginning: The Definitive History of Racist Ideas in America | US · 2020 | racial, political | yes |
| 29866 | 995 | Death of a Salesman | US · 2007 · New York · Brooklyn Public Library | language, sexual, political | yes |
| 29868 | 220 | Flamer | US · 2025 · Maryland · Harford County Board of Education | lgbtq, sexual, language, moral | yes |
| 29869 | 220 | Flamer | CA · 2025 · Alberta | lgbtq, sexual, language, moral | yes |
| 40542 | 134 | A Court of Thorns and Roses | US · 2024 · Utah · Utah State Board of Education | sexual, moral | yes |
| 40543 | 204 | A Court of Frost and Starlight | US · 2024 · Utah · Utah State Board of Education | sexual, moral | yes |
| 40544 | 214 | A Court of Silver Flames | US · 2024 · Utah · Utah State Board of Education | sexual, obscenity, moral | yes |
| 40545 | 224 | What Girls Are Made Of | US · 2024 · Utah · Utah State Board of Education | sexual, moral | yes |
| 40546 | 201 | A Court of Wings and Ruin | US · 2024 · Utah · Utah State Board of Education | sexual, violence | yes |
| 40549 | 7536 | Tilt | US · 2024 · Utah · Utah State Board of Education | sexual, drugs, moral | yes |
| 40550 | 223 | Fallout | US · 2024 · Utah · Utah State Board of Education | drugs, sexual, moral | yes |
| 40551 | 265 | Oryx and Crake | US · 2024 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 40552 | 254 | Blankets | US · 2024 · Utah · Utah State Board of Education | sexual, religious, obscenity, moral | yes |
| 40553 | 207 | Living Dead Girl | US · 2024 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 40554 | 216 | Damsel | US · 2025 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 40555 | 251 | Like a Love Story | US · 2025 · Utah · Utah State Board of Education | lgbtq, moral | yes |
| 40556 | 192 | Tricks | US · 2025 · Utah · Utah State Board of Education | sexual, drugs, obscenity, moral | yes |
| 40557 | 181 | Water for Elephants | US · 2025 · Utah · Utah State Board of Education | sexual, violence, language, moral | yes |
| 40558 | 121 | Thirteen Reasons Why | US · 2025 · Utah · Utah State Board of Education | sexual, violence, drugs, moral | yes |
| 40559 | 221 | Wicked: The Life and Times of the Wicked Witch of the West | US · 2026 · Utah · Utah State Board of Education | sexual, violence, political, moral | yes |
| 40560 | 135 | Nineteen Minutes | US · 2026 · Utah · Utah State Board of Education | violence, sexual, language, moral | yes |
| 40561 | 29 | The Perks of Being a Wallflower | US · 2026 · Utah · Utah State Board of Education | lgbtq, sexual, drugs, language, moral | yes |
| 40563 | 963 | Breathless | US · 2026 · Utah · Utah State Board of Education | sexual, moral | yes |
| 40564 | 225 | The Carnival at Bray | US · 2026 · Utah · Utah State Board of Education | moral | yes |
| 40565 | 227 | The Handmaid's Tale: The Graphic Novel | US · 2026 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 40566 | 242 | Red Hood | US · 2026 · Utah · Utah State Board of Education | sexual, moral | yes |
| 40567 | 120 | Looking for Alaska | US · 2026 · Utah · Utah State Board of Education | sexual, language, drugs, moral | yes |
| 40568 | 252 | Life is Funny | US · 2026 · Utah · Utah State Board of Education | violence, moral | yes |
| 40569 | 219 | The Haters | US · 2026 · Utah · Utah State Board of Education | moral | yes |
| 40570 | 5 | The Bluest Eye | US · 2026 · Utah · Utah State Board of Education | sexual, violence, language, moral | yes |
| 40571 | 237 | People Kill People | US · 2026 · Utah · Utah State Board of Education | violence, language, moral | yes |
| 40572 | 231 | A Stolen Life | US · 2026 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 40573 | 268 | A Clash of Kings | US · 2026 · Utah · Utah State Board of Education | sexual, violence, political | yes |
| 40574 | 205 | Lucky | US · 2026 · Utah · Utah State Board of Education | sexual, violence, moral | yes |
| 40575 | 1280 | Different Seasons: Four Novellas | US · 2026 · Utah · Utah State Board of Education | violence, language, moral | yes |
| 40639 | 253 | Push | US · 2026 · Utah · Utah State Board of Education | sexual, violence, moral | yes |

## Rows with a per-event description (the strongest signal)

- **ban 13070** "The Adventures of Tintin in the Congo" → `racial`
  > In October 2007, in response to a patron complaint, the Brooklyn Public Library moved the book to a locked back room; access by appointment only.
- **ban 13071** "The Adventures of Tintin in the Congo" → `racial`
  > In August 2007 Congolese student Bienvenu Mbutu Mondondo filed a complaint in Brussels demanding the book be banned as an insult to the Congolese people. The case was transferred to civil court in April 2010; in February 2012 the court ruled the book would not be banned.
- **ban 13072** "The Satanic Verses" → `blasphemy, religious`
  > Banned November 1988 for blasphemy against Islam.
- **ban 13073** "The Satanic Verses" → `religious, blasphemy`
  > Banned November 1988 under apartheid-era publications law; the ban was formally lifted in January 2002.
- **ban 13075** "The Satanic Verses" → `blasphemy, religious`
  > Banned 24 November 1988 for blasphemy against Islam.
- **ban 13076** "The Satanic Verses" → `blasphemy, religious`
  > Banned in 1989 for blasphemy against Islam.
- **ban 13077** "The Satanic Verses" → `religious, blasphemy`
  > Banned March 1989 under the Undesirable Publications Act.
- **ban 13078** "The Satanic Verses" → `religious, blasphemy`
  > Banned in June 1989 — described by contemporary accounts as the last nation to impose a restriction during the initial wave of bans.
- **ban 13079** "A Clockwork Orange" → `language, violence`
  > In 1977, A Clockwork Orange was removed from high school classrooms in Westport, Massachusetts over similar concerns with 'objectionable' language.
- **ban 13080** "A Clockwork Orange" → `violence, sexual, language, moral`
  > In 1982, A Clockwork Orange was removed from two Anniston, Alabama libraries, later to be reinstated on a restricted basis.
- **ban 13081** "A Court of Mist and Fury" → `sexual, obscenity, moral`
  > In 2023, a school district in Mason City, Iowa, banned the book from library shelves after running a list of books through ChatGPT and asking it if the books, 'contain a description or depiction of a sex act.'
- **ban 13082** "A Court of Mist and Fury" → `sexual, moral, obscenity`
  > In August 2024, A Court of Mist and Fury was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Nebo, Washington).
- **ban 13083** "All Boys Aren't Blue" → `lgbtq, sexual, language`
  > In 2022, All Boys Aren't Blue was listed among 52 books banned by the Alpine School District following the implementation of Utah law H.B. 374, 'Sensitive Materials In Schools.'
- **ban 13084** "All Quiet on the Western Front" → `political`
  > Banned in Austria as it was considered anti-war propaganda.
- **ban 13085** "All Quiet on the Western Front" → `political`
  > Banned in Czechoslovakia from its military libraries.
- **ban 13087** "Aristotle and Dante Discover the Secrets of the Universe" → `political, lgbtq`
  > In April 2025, the Lukashenko regime added the book to the List of printed publications containing information messages and materials, the distribution of which could harm the national interests of Belarus.
- **ban 13088** "Call Me By Your Name" → `lgbtq, sexual`
  > In January 2023, the book was permanently banned from libraries and classrooms in St. Johns County School District, Florida.
- **ban 13089** "Call Me By Your Name" → `lgbtq, sexual`
  > In September 2023, the book was banned from libraries and classrooms in Matanuska-Susitna Borough School District, Alaska.
- **ban 13090** "Crank" → `sexual, violence, language, drugs, moral`
  > In 2022, Crank was banned by the Alpine School District in Utah following the implementation of Utah law H.B. 374, which defined certain content as pornographic.
- **ban 13091** "Crank" → `drugs, sexual, violence, language, moral`
  > In 2023, Crank was removed from libraries in the Rockwall Independent School District in Texas for drug use and sexual explicitness without following a formal review process.
- **ban 13092** "Did Six Million Really Die?" → `political`
  > The book Did Six Million Really Die? was banned in South Africa.
- **ban 13093** "Drama" → `lgbtq, moral`
  > In Texas, Drama was banned three years consecutively between 2014 and 2018, including a ban in Chapel Hill Elementary School in Mount Pleasant, Texas, which put Drama on the American Library Association list of top 10 banned books.
- **ban 13094** "Drama" → `lgbtq, moral`
  > In 2014, Drama's use was restricted in Seele Elementary School in New Braunfels, Texas.
- **ban 13095** "Drama" → `lgbtq, moral`
  > In 2016, Drama was banned at Kirbyville Junior High in Kirbyville, Texas for being 'politically, racially, or socially offensive.'
- **ban 13096** "Drama" → `lgbtq, moral`
  > During the 2016–17 school year, Drama was banned in the Franklin Independent School District in Franklin, Texas, most likely due to the storyline involving a crush between two friends of main character Callie.
- **ban 13097** "Emile, or On Education" → `political, religious, moral`
  > Banned in Geneva in 1762 due to its controversial content.
- **ban 13098** "Fallout" → `drugs, sexual, moral`
  > In 2022, Fallout was banned by the Alpine School District in Utah following the implementation of the state’s H.B. 374 'Sensitive Materials In Schools' law, which deemed it objectionable.
- **ban 13099** "Fallout" → `drugs, sexual, moral`
  > In March 2022, Fallout was banned from libraries and classrooms by district administrators in the Prosper Independent School District in Texas.
- **ban 13100** "Fanny Hill" → `sexual, obscenity, moral`
  > In 1963, the police seized 171 copies of Fanny Hill from the Magic Shop in London and Mayflower Books was investigated for distributing the book.
- **ban 13101** "Forever Amber" → `sexual, obscenity`
  > Fourteen US states banned 'Forever Amber' as pornography, with Massachusetts being the first state to do so, citing numerous sexual references.
- **ban 13102** "Heartstopper" → `lgbtq, moral`
  > In September 2021, Turkey's Ministry of Family, Labor and Social Services labeled the publication 'harmful' and concluded that 'some elements in the books might have harmful effects on the morality of those aged below 18.'
- **ban 13103** "Heartstopper" → `lgbtq, moral`
  > In July 2023, a Hungarian bookstore was fined 12 million forints for displaying the book without packaging, following a law requiring books containing any homosexual or transgender content to be sold in closed packaging only.
- **ban 13105** "Heartstopper" → `lgbtq, sexual, moral`
  > In August 2023, the novels were temporarily pulled from shelves in the Marion County, Mississippi library system pending review by its board of supervisors following complaints of their LGBTQ themes and inclusion of boys kissing.
- **ban 13106** "It" → `lgbtq, violence, sexual`
  > In 2025, the novel was banned in Russia under the LGBT 'propaganda' law as part of a list of over 250 titles removed.
- **ban 13107** "Lady Chatterley's Lover" → `sexual, obscenity, moral`
  > In 1962, the Supreme Court of Canada ruled on the obscenity of Lady Chatterley's Lover after police seized copies from booksellers, leading to a significant legal case.
- **ban 13108** "Lady Chatterley's Lover" → `sexual, obscenity, moral`
  > In 1964, bookseller Ranjit Udeshi was prosecuted under Section 292 of the Indian Penal Code for selling an unexpurgated copy of Lady Chatterley's Lover, leading to a Supreme Court ruling.
- **ban 13109** "Hubert Selby Jr.: Last Exit to Brooklyn" → `lgbtq, sexual, violence, drugs, obscenity`
  > The novel was banned in Italy due to its frank portrayals of taboo subjects.
- **ban 13110** "Last Night at the Telegraph Club" → `sexual, lgbtq`
  > In May 2025, the South Carolina Board of Education banned the book under regulations prohibiting 'sexual material'.
- **ban 13112** "Lolita" → `sexual, moral`
  > In November 2023, the Catawba County Schools Board of Education restricted access to Lolita, requiring students to obtain a parent's permission to access the book.
- **ban 13113** "Me and Earl and the Dying Girl" → `sexual, language, moral`
  > In late 2023, Me and Earl and the Dying Girl was removed from 20 library shelves in Cobb County, Georgia due to concerns over highly inappropriate, sexually explicit content.
- **ban 13114** "Me and Earl and the Dying Girl" → `language, sexual`
  > In October 2025, Me and Earl and the Dying Girl was among 27 books considered for removal from the Abilene ISD library system after an excerpt was read aloud at a school board meeting.
- **ban 13115** "Mein Kampf" → `racial, political`
  > In 1995, Latvian authorities confiscated approximately 2,000 copies of Mein Kampf that had been released by a small publishing house and charged the director with offences under anti-racism law.
- **ban 13116** "Naked Lunch" → `obscenity, drugs`
  > In January 1965, Naked Lunch was tried in rem in Massachusetts, where the court ruled the novel obscene, leading to a ban.
- **ban 13117** "Naked Lunch" → `drugs, obscenity, moral`
  > On July 7, 1966, the Massachusetts Supreme Judicial Court overturned the ban on Naked Lunch, arguing it had social and literary value.
- **ban 13118** "Naked Lunch" → `obscenity, drugs`
  > On January 28, 1965, the city of Los Angeles tried two people for selling Naked Lunch, but the judge found the book as a whole did not violate obscenity laws.
- **ban 13119** "Nineteen Minutes" → `violence, sexual, language, moral`
  > In 2022, Nineteen Minutes was banned by the Alpine School District following the implementation of Utah law H.B. 374, 'Sensitive Materials In Schools'.
- **ban 13120** "Out of Darkness" → `language, sexual, racial, moral`
  > In December 2021, the Washington School District in St. George, Utah voted to remove 'Out of Darkness' from school libraries due to profanity and sexually explicit content after a parent's challenge.
- **ban 13121** "Out of Darkness" → `sexual, violence, racial, moral`
  > On November 19, 2021, the Keller Independent School District in Texas decided that 'Out of Darkness' would only be available in high school, requiring parental consent for checkout due to violence and difficult imagery.
- **ban 13122** "Out of Darkness" → `sexual, racial, obscenity, moral`
  > In August 2022, 'Out of Darkness' was listed among 52 books banned by the Alpine School District of Utah following the implementation of Utah law H.B. 374, which deemed the book to contain pornographic material.
- **ban 13123** "The Absolutely True Diary of a Part-Time Indian" → `language, sexual, racial`
  > In 2010, Newcastle Middle School's school board banned the book from teaching in the curriculum but allowed it in the library.
- **ban 13125** "The Bluest Eye" → `sexual, violence, language, moral`
  > In December 2025, the Redlands Unified School District restricted access to The Bluest Eye to students aged 18 and older with parental consent after a local challenge.
- **ban 13126** "The Color Purple" → `political, racial, sexual, violence, language`
  > Alice Walker declined publication of The Color Purple in Israel as part of the Boycott, Divestment and Sanctions movement, stating she would not allow her book to be published while Israel maintained its system of apartheid.
- **ban 13127** "The Da Vinci Code" → `religious, blasphemy`
  > In 2006, seven Indian states (Nagaland, Punjab, Goa, Tamil Nadu, Andhra Pradesh) banned the release or exhibition of The Da Vinci Code due to protests.
- **ban 13129** "The DUFF: Designated Ugly Fat Friend" → `sexual, moral`
  > In 2024, The DUFF was removed from the Gilbert School District in Iowa under Iowa’s Senate File 496 law restricting school library materials depicting sexual content.
- **ban 13130** "The Handmaid's Tale" → `sexual, obscenity, moral, religious`
  > In November 2023, the Hanover County School Board removed The Handmaid's Tale from school libraries after a review panel deemed it sexually explicit.
- **ban 13131** "The Jewel of Medina" → `religious, blasphemy`
  > The Serbian publisher Beobook withdrew 'The Jewel of Medina' from stores after strong reactions from the Serbian Muslim community.
- **ban 13132** "The Perks of Being a Wallflower" → `lgbtq, sexual, drugs, language, moral`
  > In 2025, Utah banned the book from all public schools in the state.
- **ban 13133** "The Perks of Being a Wallflower" → `political, lgbtq, sexual, language, drugs, moral`
  > In April 2025, the Lukashenko regime added the book to its list of printed publications containing information messages and materials, the distribution of which could harm the national interests of Belarus.
- **ban 13134** "The Protocols of the Elders of Zion" → `political, obscenity`
  > In 1935, the Amtsgericht in Bern convicted two defendants for distributing the Protocols, declaring it a forgery and obscene literature.
- **ban 13135** "The Red and the Black" → `political, religious`
  > In 1964, General Justino Alves Bastos ordered the burning of all 'subversive books' in Rio Grande do Sul, which included The Red and the Black.
- **ban 13136** "The Sorrows of Young Werther" → `moral`
  > In 1775, both the novel and the Werther clothing style were banned in Leipzig due to concerns over the 'Werther effect'.
- **ban 13137** "The Turner Diaries" → `racial, political, violence`
  > The Turner Diaries was made illegal in France in 1999 due to its advocacy of racism, antisemitism, and the use of violence.
- **ban 13138** "Tilt" → `sexual, drugs, moral`
  > In 2022, five of Hopkins's novels, including 'Tilt', were banned by the Alpine School District following the implementation of Utah law H.B. 374, which targeted sensitive materials in schools.
- **ban 13140** "Tropic of Cancer" → `sexual, obscenity, moral`
  > The book was on the list of books banned by customs as of 1938, with the Royal Canadian Mounted Police seizing copies from bookstores and public libraries in the early 1960s.
- **ban 13141** "Tropic of Cancer" → `sexual, obscenity, moral`
  > All printed copies of the Finnish versions of the book were confiscated by the state before the books were to be published in 1962, and it was not published in Finnish until 1970.
- **ban 13142** "Watchmen" → `violence`
  > In 2019, 'Watchmen' was banned in Florida state prisons for being deemed a threat to prison safety and security.
- **ban 13143** "The Anarchist Cookbook" → `political, violence, drugs`
  > A long-standing customs restriction on importing The Anarchist Cookbook into Canada was lifted in 2002 by the Canada Customs and Revenue Agency, which concluded the book "does not violate either hate or obscenity laws."
- **ban 25200** "Mysterious Facts Gods & Demons" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 2005-04-14 (P.U. (A) 156). Publisher: Grange Books. Printer: -. Language: INGGERIS.
- **ban 25240** "Isteri Muda yang Berlaku Curang" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 2005-11-24 (P.U. (A) 480). Publisher: YIN YE PRESS CO,LTD.. Printer: JIN XIN CO,LTD.. Language: CINA.
- **ban 25343** "Petunjuk Membuat Azimat dan Benda Bertuah" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 2007-04-26 (P.U. (A) 170). Publisher: CV. ANEKA. Printer: -. Language: MELAYU.
- **ban 26172** "On Sparks" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 1951-04-27 (L.N. 263). Publisher: CHUN YI PRINTING PRESS. Language: CINA.
- **ban 26397** "Honeymoon Hotel" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 1972-07-13 (P.U (A) 225). Publisher: LIVERPOOL LIBRARY PRESS. Language: INGGERIS.
- **ban 26451** "We All Need Someone" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 1974-12-26 (P.U (A) 444). Publisher: EROS PUBLICATION CO.INC.. Language: INGGERIS.
- **ban 26486** "I, Jan Cremer" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 1974-12-26 (P.U (A) 445). Publisher: PANTHER BOOKS LTD.. Printer: THE PHILIPS PARK PRESS. Language: INGGERIS.
- **ban 26488** "It's Getting Harder All the Time" → `sexual, political`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 1974-12-26 (P.U (A) 445). Publisher: TOP SELLERS LTD.. Printer: THE PHILIPS PARK PRESS. Language: INGGERIS.
- **ban 26856** "Mayat Bertukar Bangkai Khinzir" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 1998-09-10 (P.U. (A) 337). Publisher: AL-FAIZUUN ENTERPRISE. Printer: AL-FAIZUUN ENTERPRISE. Language: MELAYU.
- **ban 26954** "Untitled Chinese publication (KDN P.U. (A) 70 / 2026)" → `other`
  > Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act. Gazetted 2026-02-11 (P.U. (A) 70). Publisher: 21 世 纪 出 版 社 PENERBITAN ABAD DUA PULUH SATU. Language: CINA.
- **ban 29115** "Franz Overbeck und Friedrich Nietzsche, eine Freundschaft" → `political`
  > A six-month ban (Weimar, 1908) over remarks about a third party was lifted only after the author agreed to black out the offending passages in the second volume.
- **ban 29167** "Alice's Adventures in Wonderland" → `moral`
  > Banned in Hunan province in 1911 on the ground that 'animals should not use human language' and that it was disastrous to put animals and humans on the same level.
- **ban 29807** "Fifty Shades of Grey" → `sexual, obscenity, moral`
  > In January 2013, Judge Raphael Queiroz Campos ruled that bookstores in Macaé must either remove the Fifty Shades of Grey series from their shelves or ensure that the books are wrapped and placed out of the reach of minors.
- **ban 29808** "For Whom the Bell Tolls" → `political`
  > In 1973, the book was banned in Turkey because it included 'propaganda unfavorable to the state.'
- **ban 29809** "Sophie's Choice" → `racial, political`
  > Banned by the censors in the Communist People's Republic of Poland for its unflinching portrait of Polish anti-Semitism.
- **ban 29810** "Sophie's Choice" → `sexual, political`
  > Banned by censors working for the government of South Africa under apartheid for being a sexually explicit work.
- **ban 29811** "The Picture of Dorian Gray" → `lgbtq, obscenity, moral`
  > In 1890, WHSmith withdrew every copy of the July 1890 issue of Lippincott’s Monthly Magazine containing the story following moral outrage and accusations of indecency.
- **ban 29814** "This Book Is Gay" → `sexual, obscenity, lgbtq, moral`
  > In 2023, the Sioux City Community School District removed This Book Is Gay from their high school after it was referred to as pornographic.
- **ban 29815** "Tokyo Ghoul" → `violence, obscenity, moral`
  > In February 2021, it was reported that Tokyo Ghoul was banned from distribution on two unspecified websites in Russia.
- **ban 29843** "A Court of Frost and Starlight" → `sexual, obscenity, moral`
  > In 2024, all five books in the series, including A Court of Frost and Starlight, were banned from all Utah public schools by the state school board for containing 'objective sensitive material.'
- **ban 29844** "A Court of Thorns and Roses" → `sexual, moral`
  > In 2024, all five books in the series were among 13 banned from all Utah public schools by the state school board for containing 'objective sensitive material.'
- **ban 29845** "A Court of Wings and Ruin" → `sexual, violence`
  > In 2024, all five books in the series were among 13 banned from all Utah public schools by the state school board for containing 'objective sensitive material.'
- **ban 29846** "A Court of Wings and Ruin" → `sexual, violence`
  > In February 2024, individuals in the Rutherford County Schools library system in Tennessee were instructed to remove 20 books from all RCS library shelves, including the entire series.
- **ban 29848** "Empire of Storms" → `sexual, violence, moral`
  > In August 2024, Empire of Storms was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Washington).
- **ban 29849** "Justine, or the Misfortunes of Virtue" → `sexual, violence, obscenity, moral`
  > The book's destruction was ordered by the Cour Royale de Paris on May 19, 1815.
- **ban 29850** "Les Onze Mille Verges" → `obscenity, sexual`
  > In 2000, a Turkish publisher was convicted under the Turkish Criminal Code for publishing obscene material, leading to the seizure and destruction of all copies of the book.
- **ban 29851** "Lucky" → `sexual, violence, moral`
  > Following Anthony Broadwater's exoneration, distribution of all formats of Lucky was ceased while Sebold and the publisher determined how to revise the work.
- **ban 29852** "My Secret Life" → `obscenity, sexual`
  > In 1932, a New York publisher was arrested for issuing the first three volumes of 'My Secret Life'.
- **ban 29853** "My Secret Life" → `sexual, obscenity, moral`
  > In 1969, British printer Arthur Dobson was sentenced to two years in prison for producing a UK reprint of 'My Secret Life'.
- **ban 29854** "Philosophical Dictionary" → `political, religious, blasphemy`
  > In 1765, the Philosophical Dictionary was censored in Switzerland, where all available copies of the book were collected and burned in the town square.
- **ban 29856** "Thirteen Reasons Why" → `sexual, drugs`
  > In May 2017, the curriculum director in Mesa County School District ordered librarians to stop circulating the book due to a rash of student suicides.
- **ban 29857** "Water for Elephants" → `sexual, violence, language`
  > In August 2024, the book was banned by the Katy Independent School District in Texas.
- **ban 29858** "Water for Elephants" → `sexual, violence, language`
  > In July 2024, the book was banned by the Davis School District in Utah.
- **ban 29859** "Water for Elephants" → `sexual, violence, language`
  > In January 2025, the book was banned by the Tooele County School District in Utah.
- **ban 29860** "Water for Elephants" → `sexual, violence, language`
  > On April 28, 2025, the book was banned by the Cache County School District in Utah.
- **ban 29862** "A Wrinkle in Time" → `religious, moral`
  > In 1984, A Wrinkle in Time was challenged by an elementary school in Polk City, Florida, when parents claimed that the novel promoted witchcraft.
- **ban 29863** "A Wrinkle in Time" → `religious, blasphemy`
  > In 2000, the novel was challenged in a school district in Alabama due to the book's listing the name of Jesus Christ together with the names of great artists, philosophers, scientists, and religious leaders when referring to those who defend Earth against evil.
- **ban 29865** "Stamped from the Beginning: The Definitive History of Racist Ideas in America" → `racial, political`
  > In 2020, Stamped landed the second position on the American Library Association's list of the most commonly banned and challenged books in the United States.
- **ban 29866** "Death of a Salesman" → `language, sexual, political`
  > In 2007, 'Death of a Salesman' faced restrictions in the Brooklyn Public Library due to a patron complaint that led to its reshelving.
- **ban 29868** "Flamer" → `lgbtq, sexual, language, moral`
  > In June 2025, the Harford County Board of Education in Maryland made Flamer the first book to be banned under a new district policy that allows parents to flag books they find objectionable.
- **ban 29869** "Flamer" → `lgbtq, sexual, language, moral`
  > Flamer was banned in Alberta and is to be removed from school libraries by October 2025.
- **ban 40542** "A Court of Thorns and Roses" → `sexual, moral`
  > In August 2024, A Court of Thorns and Roses was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Jordan, Nebo, Washington).
- **ban 40543** "A Court of Frost and Starlight" → `sexual, moral`
  > In August 2024, A Court of Frost and Starlight was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Jordan, Nebo, Washington).
- **ban 40544** "A Court of Silver Flames" → `sexual, obscenity, moral`
  > In August 2024, A Court of Silver Flames was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Nebo, Washington).
- **ban 40545** "What Girls Are Made Of" → `sexual, moral`
  > In August 2024, What Girls Are Made Of was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Jordan, Washington).
- **ban 40546** "A Court of Wings and Ruin" → `sexual, violence`
  > In August 2024, A Court of Wings and Ruin was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Nebo, Washington).
- **ban 40549** "Tilt" → `sexual, drugs, moral`
  > In August 2024, Tilt was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Tooele, Washington).
- **ban 40550** "Fallout" → `drugs, sexual, moral`
  > In August 2024, Fallout was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Jordan, Washington).
- **ban 40551** "Oryx and Crake" → `sexual, violence, moral`
  > In August 2024, Oryx and Crake was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Washington).
- **ban 40552** "Blankets" → `sexual, religious, obscenity, moral`
  > In August 2024, Blankets was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Nebo, Washington).
- **ban 40553** "Living Dead Girl" → `sexual, violence, moral`
  > In November 2024, Living Dead Girl was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Tooele, Washington).
- **ban 40554** "Damsel" → `sexual, violence, moral`
  > In January 2025, Damsel was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Park City, Washington).
- **ban 40555** "Like a Love Story" → `lgbtq, moral`
  > In January 2025, Like a Love Story was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Washington).
- **ban 40556** "Tricks" → `sexual, drugs, obscenity, moral`
  > In March 2025, Tricks was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Tooele, Washington).
- **ban 40557** "Water for Elephants" → `sexual, violence, language, moral`
  > In May 2025, Water for Elephants was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Cache, Davis, Tooele).
- **ban 40558** "Thirteen Reasons Why" → `sexual, violence, drugs, moral`
  > In October 2025, Thirteen Reasons Why was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Nebo, Tooele, Washington).
- **ban 40559** "Wicked: The Life and Times of the Wicked Witch of the West" → `sexual, violence, political, moral`
  > In January 2026, Wicked: The Life and Times of the Wicked Witch of the West was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Tooele, Washington).
- **ban 40560** "Nineteen Minutes" → `violence, sexual, language, moral`
  > In January 2026, Nineteen Minutes was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Tooele, Washington).
- **ban 40561** "The Perks of Being a Wallflower" → `lgbtq, sexual, drugs, language, moral`
  > In January 2026, The Perks of Being a Wallflower was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Tooele, Washington).
- **ban 40563** "Breathless" → `sexual, moral`
  > In March 2026, Breathless was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Granite, Washington).
- **ban 40564** "The Carnival at Bray" → `moral`
  > In March 2026, The Carnival at Bray was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Granite, Washington).
- **ban 40565** "The Handmaid's Tale: The Graphic Novel" → `sexual, violence, moral`
  > In March 2026, The Handmaid's Tale: The Graphic Novel was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Granite, Washington).
- **ban 40566** "Red Hood" → `sexual, moral`
  > In March 2026, Red Hood was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Granite, Washington).
- **ban 40567** "Looking for Alaska" → `sexual, language, drugs, moral`
  > In March 2026, Looking for Alaska was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Tooele, Washington).
- **ban 40568** "Life is Funny" → `violence, moral`
  > In April 2026, Life is Funny was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Washington).
- **ban 40569** "The Haters" → `moral`
  > In April 2026, The Haters was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Washington).
- **ban 40570** "The Bluest Eye" → `sexual, violence, language, moral`
  > In April 2026, The Bluest Eye was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Washington).
- **ban 40571** "People Kill People" → `violence, language, moral`
  > In April 2026, People Kill People was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Tooele).
- **ban 40572** "A Stolen Life" → `sexual, violence, moral`
  > In April 2026, A Stolen Life was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Cache, Davis, Granite).
- **ban 40573** "A Clash of Kings" → `sexual, violence, political`
  > In April 2026, A Clash of Kings was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Alpine, Davis, Jordan).
- **ban 40574** "Lucky" → `sexual, violence, moral`
  > In June 2026, Lucky was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Granite, Tooele, Washington).
- **ban 40575** "Different Seasons: Four Novellas" → `violence, language, moral`
  > In July 2026, Different Seasons was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Jordan, Tooele, Washington).
- **ban 40639** "Push" → `sexual, violence, moral`
  > In August 2026, Push was banned from all public schools statewide in Utah by the Utah State Board of Education under House Bill 29 (Utah Code §53G-10-103), after being removed for "objective sensitive material" by at least three school districts (Davis, Granite, Washington).
