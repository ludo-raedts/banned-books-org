# PEN stamped-years audit — first_published_year ∈ {2024, 2025} vs OpenLibrary

Bron van de fout: `import-pen.ts` regel 604 — `first_published_year: ol.publishYear ?? ev.year ?? null`:
bij een lege OpenLibrary-lookup werd het BAN-jaar als publicatiejaar gestempeld (batch 2026-05-02/03).

- Gecheckt: **1297** rijen
- Bevestigd correct (OL == DB): **13**
- **FOUT, high-conf (work/isbn-tier): 839** → `data/publication-year-fixes-highconf.json`
- Fout, review-tier (vrije zoek): 41
- Onverifieerbaar (watchlist): 404 — waarvan 100 intern onmogelijk (ban vóór pub-jaar)

## Fout — high-conf (fix-kandidaten)

| id | slug | DB | OL | tier | ban≥ | title | author |
|----|------|---:|---:|------|-----:|-------|--------|
| 4443 | vincent-van-gogh-the-complete-paintings | 2025 | 1914 | isbn | 2025 | Vincent van Gogh: The Complete Paintings | Rainer Metzger |
| 4197 | goya | 2025 | 1919 | work | 2025 | Goya | Francisco Goya |
| 5266 | you-brought-me-the-ocean | 2024 | 1920 | isbn | 2022 | You Brought Me the Ocean | Alex Sanchez |
| 4187 | georgia-okeeffe | 2025 | 1960 | isbn | 2025 | Georgia O'Keeffe | O'Keeffe |
| 3971 | the-ku-klux-klan-a-century-of-infamy | 2025 | 1965 | isbn | 2025 | The Ku Klux Klan: A Century of Infamy | William Pierce Randel |
| 4251 | leonardo-da-vinci-artist-inventor-and-scientist-of-the-renaissance | 2025 | 1967 | isbn | 2025 | Leonardo da Vinci: Artist, Inventor and Scientist of the Renaissance | Francesca Romei |
| 4261 | manet | 2025 | 1967 | isbn | 2025 | Manet | John Richardson |
| 3536 | claywork-form-and-idea-in-ceramic-design | 2025 | 1975 | isbn | 2025 | Claywork: Form and Idea in Ceramic Design | Leon Nigrosh |
| 4213 | holbein | 2025 | 1976 | isbn | 2025 | Holbein | Helen Langdon |
| 3716 | gods-images-the-bible-a-new-vision | 2025 | 1977 | isbn | 2025 | God's Images: The Bible, A New Vision | James Dickey |
| 4173 | donatello | 2025 | 1978 | work | 2025 | Donatello | Giovanna Gaeta Bertela |
| 4911 | the-executioner | 2024 | 1982 | isbn | 2024 | The Executioner | Jay Bennett |
| 3784 | kite | 2025 | 1985 | isbn | 2025 | Kite | Ed Minus |
| 3530 | choices-making-right-decisions-in-a-complex-world | 2025 | 1986 | isbn | 2025 | Choices: Making Right Decisions in a Complex World | Lewis B. Smedes |
| 3418 | a-soaring-spirit-timeframe-600-400-bc | 2025 | 1987 | isbn | 2025 | A Soaring Spirit: Timeframe 600-400 BC | Time-Life Books |
| 3426 | age-of-god-kings-timeframe-3000-1500-bc | 2025 | 1987 | isbn | 2025 | Age of God-Kings: Timeframe 3000-1500 BC | Time-Life Books |
| 3428 | alcohol-the-real-story | 2025 | 1987 | work | 2025 | Alcohol: The Real Story | David R. Stronck |
| 3508 | case-histories | 2025 | 1987 | work | 2025 | Case Histories | Dianne Hales |
| 3644 | empires-ascendant-timeframe-400-bc-ad-200 | 2025 | 1987 | isbn | 2025 | Empires Ascendant: Timeframe 400 BC-AD 200 | Time-Life Books |
| 3926 | the-barbarian-tides-timeframe-1500-600-bc | 2025 | 1987 | isbn | 2025 | The Barbarian Tides: Timeframe 1500-600 BC | Time-Life Books |
| 4019 | tobacco-the-real-story | 2025 | 1987 | isbn | 2025 | Tobacco: The Real Story | David R. Stronck |
| 3388 | dr-xargles-book-of-earthlets | 2025 | 1988 | isbn | 2025 | Dr. Xargle's Book of Earthlets | Tony Willis |
| 3906 | skeleton-discover-the-evolution-structure-and-functions-of-bones | 2025 | 1988 | isbn | 2025 | Skeleton: Discover the Evolution, Structure, and Functions of Bones | Steve Parker |
| 4065 | who-uses-drugs | 2025 | 1988 | work | 2025 | Who Uses Drugs | Peter Gwynne |
| 2721 | a-time-to-kill | 2024 | 1989 | isbn | 2023 | A Time to Kill | John Grishman |
| 4179 | filippo-lippi | 2025 | 1989 | isbn | 2025 | Filippo Lippi | Glorio Fossi |
| 4453 | yayoi-kusama | 2025 | 1989 | isbn | 2025 | Yayoi Kusama | Yayoi Kusama |
| 3925 | the-artists-eye | 2025 | 1990 | isbn | 2025 | The Artist's Eye | Harriet Shorr |
| 6028 | the-voices-of-rape | 2025 | 1990 | isbn | 2023 | The Voices of Rape | Janet Bode |
| 3538 | cocaine | 2025 | 1991 | isbn | 2025 | Cocaine | Rhoda McFarland |
| 3628 | drugs-and-sports | 2025 | 1991 | work | 2025 | Drugs and Sports | Katherine S. Talmadge |
| 3630 | drugs-and-the-family | 2025 | 1991 | isbn | 2025 | Drugs and the Family | Susan DeStefano |
| 3740 | heroin | 2025 | 1991 | isbn | 2025 | Heroin | Sandra Lee Smith |
| 3959 | the-holocaust | 2025 | 1991 | isbn | 2025 | The Holocaust | Abraham Resnick |
| 3660 | explorers | 2025 | 1992 | work | 2025 | Explorers | David Marshall |
| 4185 | frida-kahlo-1907-1954-pain-and-passion | 2025 | 1992 | isbn | 2025 | Frida Kahlo, 1907-1954: Pain and Passion | Andrea Kettenmann |
| 5080 | ranma-1-2-vol-21 | 2024 | 1992 | work | 2024 | Ranma 1/2, Vol. 21 | Rumiko Takahashi |
| 2686 | what-on-earth-is-a-pangolin | 2025 | 1994 | isbn | 2023 | What on Earth Is a Pangolin? | Edward R. Ricciuti |
| 3774 | john-hedgecoes-new-book-of-photography | 2025 | 1994 | isbn | 2025 | John Hedgecoe's New Book of Photography | John Hedgecoe |
| 3923 | the-american-revolution-give-me-liberty-or-give-me-death | 2025 | 1994 | isbn | 2025 | The American Revolution: "Give Me Liberty or Give Me Death!" | Deborah Kent |
| 3935 | the-complete-kodak-book-of-photography | 2025 | 1994 | isbn | 2025 | The Complete Kodak Book of Photography | Thomas Dickey |
| 4267 | masterpieces-the-best-loved-paintings-from-americas-museums | 2025 | 1995 | isbn | 2025 | Masterpieces: The Best-Loved Paintings from America's Museums | David Frankel |
| 4297 | oceanic-art | 2025 | 1995 | isbn | 2025 | Oceanic Art | Nicholas Thomas |
| 4421 | the-story-of-sculpture-from-prehistory-to-the-present | 2025 | 1995 | isbn | 2025 | The Story of Sculpture: From Prehistory to the Present | Francesca Romei |
| 5765 | medicine | 2024 | 1995 | isbn | 2024 | Medicine | Steve Parker |
| 3430 | alexander-and-his-times | 2025 | 1996 | isbn | 2025 | Alexander and His Times | Frederic Theule |
| 3500 | caesar-and-rome | 2025 | 1996 | isbn | 2025 | Caesar and Rome | Charlotte Bernard |
| 3849 | michelangelo-and-his-times | 2025 | 1996 | work | 2025 | Michelangelo and His Times | Veronique Milande |
| 3883 | ramses-ii-and-egypt | 2025 | 1996 | isbn | 2025 | Ramses II and Egypt | Olivier Tiano |
| 3987 | the-nervous-system | 2025 | 1996 | isbn | 2025 | The Nervous System | Nuria Roca |
| 4017 | through-indian-eyes-the-untold-story-of-native-american-peoples | 2025 | 1996 | isbn | 2025 | Through Indian Eyes: The Untold Story of Native American Peoples | Reader's Digest |
| 4141 | chardin | 2025 | 1996 | isbn | 2025 | Chardin | Gabriel Naughton |
| 4317 | religion | 2025 | 1996 | work | 2025 | Religion | Myrtle Langley |
| 4399 | the-journey-of-diego-rivera | 2025 | 1996 | isbn | 2025 | The Journey of Diego Rivera | Ernest Goldstein |
| 2766 | tell-no-one-who-you-are-the-hidden-childhood-of-regine-miller | 2024 | 1997 | isbn | 2024 | Tell No One Who You Are: The Hidden Childhood of Regine Miller | Walter Buchignani |
| 3478 | bioethics-sex-genetics-human-reproduction | 2025 | 1997 | isbn | 2025 | Bioethics: Sex, Genetics & Human Reproduction | Warren T. Reich |
| 3632 | drugs-and-your-parents | 2025 | 1997 | isbn | 2025 | Drugs and Your Parents | Rhoda McFarland |
| 3642 | edge | 2025 | 1997 | isbn | 2025 | Edge | Michael Cadnum |
| 3861 | native-american-literature | 2025 | 1997 | isbn | 2025 | Native American Literature | Katherine Gleason |
| 3866 | north-american-art-to-1900 | 2025 | 1997 | work | 2025 | North American Art to 1900 | Arleen Pancza-Graham |
| 3919 | teenage-pregnancy | 2025 | 1997 | work | 2025 | Teenage Pregnancy | Stephen P. Thompson |
| 4445 | what-life-was-like-at-the-dawn-of-democracy-classical-athens-525-322-bc | 2025 | 1997 | isbn | 2025 | What Life Was Like at the Dawn of Democracy: Classical Athens, 525-322 BC | Time-Life Books |
| 5885 | rurouni-kenshin-vol-1-meiji-swordsman-romantic-story | 2025 | 1997 | isbn | 2025 | Rurouni Kenshin, Vol. 1: Meiji Swordsman Romantic Story | Nobuhiro Watsuki |
| 2758 | secrets-of-the-mummies | 2024 | 1998 | isbn | 2024 | Secrets of the Mummies | Harriet Griffey |
| 3989 | the-oklahoma-city-bombing-terror-in-the-heartland | 2025 | 1998 | isbn | 2025 | The Oklahoma City Bombing: Terror in the Heartland | Victoria Sherrow |
| 4107 | art-attack-a-short-cultural-history-of-the-avant-garde | 2025 | 1998 | isbn | 2025 | Art Attack: A Short Cultural History of the Avant-Garde | Marc Aronson |
| 4137 | chagall | 2025 | 1998 | isbn | 2025 | Chagall | Gill Polonsky |
| 4189 | giotto-di-bondon-about-1267-1337 | 2025 | 1998 | isbn | 2025 | Giotto di Bondon: About 1267-1337 | Anne Mueller |
| 4301 | paul-cezanne | 2025 | 1998 | isbn | 2025 | Paul Cézanne | Trewin Copplestone |
| 5487 | christmas-in-mexico | 2024 | 1998 | isbn | 2024 | Christmas in México | Cheryl L. Enderlein |
| 5995 | the-renaissance | 2025 | 1998 | isbn | 2022 | The Renaissance | Tony Allan |
| 2727 | business-ethics-in-islam | 2024 | 1999 | isbn | 2024 | Business Ethics in Islam | Mushtaq Ahmad |
| 3552 | crimes-against-children-child-abuse-and-neglect | 2025 | 1999 | isbn | 2025 | Crimes Against Children: Child Abuse and Neglect | Tracee De Hahn |
| 3658 | everything-you-need-to-know-about-going-to-the-gynecologist | 2025 | 1999 | isbn | 2025 | Everything You Need to Know About Going to the Gynecologist | Shifra N. Diamond |
| 3722 | greece | 2025 | 1999 | work | 2025 | Greece | Yeoh Hong Nam |
| 3798 | liberation-teens-in-the-concentration-camps-and-the-teen-soldiers-who-liberated-them | 2025 | 1999 | isbn | 2025 | Liberation: Teens in the Concentration Camps and the Teen Soldiers Who Liberated Them | E. Tina Tito |
| 3840 | media-violence | 2025 | 1999 | work | 2025 | Media Violence | William Dudley |
| 3957 | the-hidden-children-of-the-holocaust-teens-who-hid-from-the-nazis | 2025 | 1999 | isbn | 2025 | The Hidden Children of the Holocaust: Teens Who Hid from the Nazis | Ester Kustanowitz |
| 5541 | elske | 2024 | 1999 | isbn | 2024 | Elske | Cynthia Voigt |
| 3450 | angels | 2025 | 2000 | work | 2025 | Angels | Patricia D. Netzley |
| 3534 | civil-war | 2025 | 2000 | isbn | 2025 | Civil War | John Stanchack |
| 3652 | euthanasia | 2025 | 2000 | isbn | 2025 | Euthanasia | James D. Torr |
| 3887 | real-boys-voices-boys-speak-out-about-drugs-sex-violence-bullying-sports-school-parents-and-so-much-more | 2025 | 2000 | isbn | 2025 | Real Boys' Voices: Boys Speak Out About Drugs, Sex, Violence, Bullying, Sports, School, Parents, and So Much More | William S. Pollack |
| 3941 | the-death-penalty-for-teens-a-pro-con-issue | 2025 | 2000 | isbn | 2025 | The Death Penalty for Teens: A Pro/Con Issue | Nancy Day |
| 3991 | the-pequots | 2025 | 2000 | isbn | 2025 | The Pequots | Shirlee Newman |
| 4073 | witches | 2025 | 2000 | isbn | 2025 | Witches | Stuart Kallen |
| 4159 | diego-velazquez-1599-1660-the-face-of-spain | 2025 | 2000 | isbn | 2025 | Diego Velazquez 1599-1660: The Face of Spain | Norbert Wolf |
| 4357 | tattoo-history-source-book-an-anthology-of-historical-records-of-tattooing-throughout-the-world | 2025 | 2000 | isbn | 2025 | Tattoo History Source Book: An Anthology of Historical Records of Tattooing Throughout the World | Steve Gilbert |
| 4411 | the-panorama-of-the-renaissance | 2025 | 2000 | isbn | 2025 | The Panorama of the Renaissance | Margaret Aston |
| 4454 | your-travel-guide-to-ancient-greece | 2025 | 2000 | isbn | 2025 | Your Travel Guide to Ancient Greece | Nancy Day |
| 5428 | ancient-medicine-from-sorcery-to-surgery | 2024 | 2000 | isbn | 2024 | Ancient Medicine: From Sorcery to Surgery | Michael Woods |
| 5468 | booker-t-washington-gran-educador-norteamericano | 2024 | 2000 | isbn | 2024 | Booker T. Washington: Gran educador Norteamericano | Eric Braun |
| 5479 | cesar-chavez-fighting-for-farmworkers | 2024 | 2000 | isbn | 2024 | Cesar Chavez: Fighting for Farmworkers | Eric Braun |
| 5933 | thanksgiving | 2025 | 2000 | isbn | 2025 | Thanksgiving | David F. Marx |
| 5983 | the-little-red-train-el-trenecito-rojo | 2025 | 2000 | isbn | 2025 | The Little Red Train: El trenecito rojo | Carl Sommer |
| 1224 | annexed | 2025 | 2001 | isbn | 2023 | Annexed | Sharon Dogar |
| 1437 | 2024-a-graphic-novel | 2025 | 2001 | isbn | 2025 | 2024: A Graphic Novel | Ted Rall |
| 3393 | dragon-ball-vol-5 | 2025 | 2001 | isbn | 2023 | Dragon Ball, Vol. 5 | Akira Toriyama |
| 3776 | judaism | 2025 | 2001 | work | 2023 | Judaism | Cath Senker |
| 3782 | king-arthur | 2025 | 2001 | work | 2025 | King Arthur | Michael Wyly |
| 3845 | megans-law-protection-or-privacy | 2025 | 2001 | isbn | 2025 | Megan's Law: Protection or Privacy | Margie Druss Fodor |
| 3892 | safe-teen-powerful-alternatives-to-violence | 2025 | 2001 | isbn | 2025 | Safe Teen: Powerful Alternatives to Violence | Anita Roberts |
| 3951 | the-good-fight-how-world-war-ii-was-won | 2025 | 2001 | isbn | 2025 | The Good Fight: How World War II Was Won | Stephen E. Ambrose |
| 3982 | the-media-the-impact-on-our-lives | 2025 | 2001 | isbn | 2025 | The Media: The Impact on Our Lives | Julian Petley |
| 4032 | vampires | 2025 | 2001 | work | 2025 | Vampires | Russell Roberts |
| 4045 | violence-opposing-viewpoints | 2025 | 2001 | isbn | 2025 | Violence: Opposing Viewpoints | Laura K. Egendorf |
| 4417 | the-quest-for-paradise-visions-of-heaven-and-eternity-in-the-worlds-myths-and-religions | 2025 | 2001 | isbn | 2025 | The Quest for Paradise: Visions of Heaven and Eternity in the World's Myths and Religions | John Ashton |
| 4989 | in-the-houses-of-the-holy-led-zeppelin-and-the-power-of-rock-music | 2024 | 2001 | isbn | 2024 | In the Houses of the Holy: Led Zeppelin and the Power of Rock Music | Susan Fast |
| 5491 | classical-art-from-greece-to-rome | 2024 | 2001 | isbn | 2024 | Classical Art from Greece to Rome | Mary Beard |
| 2705 | max-in-the-house-of-spies-a-tale-of-world-war-ii | 2024 | 2002 | isbn | 2024 | Max in the House of Spies: A Tale of World War II | Adam Gidwitz |
| 3396 | dragon-ball-vol-8 | 2025 | 2002 | work | 2023 | Dragon Ball, Vol. 8 | Akira Toriyama |
| 3440 | amy | 2025 | 2002 | isbn | 2025 | Amy | Mary Hooper |
| 3772 | jesus-and-christianity | 2025 | 2002 | isbn | 2025 | Jesus and Christianity | Alan Brown |
| 3852 | moses-and-judaism | 2025 | 2002 | isbn | 2025 | Moses and Judaism | Sharon Barron |
| 3868 | one-hot-second-stories-about-desire | 2025 | 2002 | isbn | 2022 | One Hot Second: Stories About Desire | Cathy Young |
| 3880 | pornography | 2025 | 2002 | work | 2025 | Pornography | Helen Cothran |
| 3930 | the-buddha-and-buddhism | 2025 | 2002 | isbn | 2025 | The Buddha and Buddhism | Kerena Marchant |
| 4307 | pierre-auguste-renoir | 2025 | 2002 | isbn | 2025 | Pierre Auguste Renoir | Trewin Copplestone |
| 4323 | richard-jolley-sculptor-of-glass | 2025 | 2002 | isbn | 2025 | Richard Jolley: Sculptor of Glass | Richard Jolley |
| 4379 | the-everything-classical-mythology-book-greek-and-roman-gods-goddesses-heroes-and-monsters-from-ares-to-zeus | 2025 | 2002 | isbn | 2025 | The Everything Classical Mythology Book: Greek and Roman Gods, Goddesses, Heroes, and Monsters from Ares to Zeus | Lesley Bolton |
| 5621 | headin-for-better-times-the-arts-of-the-great-depression | 2024 | 2002 | isbn | 2024 | Headin' For Better Times: The Arts of the Great Depression | Duane Damon |
| 2043 | poseidon | 2025 | 2003 | isbn | 2025 | Poseidon | B. A. Hoena |
| 2679 | remember-when | 2025 | 2003 | isbn | 2023 | Remember When | Nora Roberts |
| 3390 | dragon-ball-vol-2 | 2025 | 2003 | isbn | 2025 | Dragon Ball, Vol. 2 | Akira Toriyama |
| 3764 | international-terrorism | 2025 | 2003 | work | 2025 | International Terrorism | Charlie Fuller |
| 3920 | teens-at-risk | 2025 | 2003 | work | 2025 | Teens At Risk | Auriana Ojeda |
| 4041 | violence-in-our-schools-halls-of-hope-halls-of-fear | 2025 | 2003 | isbn | 2025 | Violence in Our Schools: Halls of Hope, Halls of Fear | Tamra B. Orr |
| 4315 | ready-set-grow-a-whats-happening-to-my-body-book-for-younger-girls | 2025 | 2003 | isbn | 2025 | Ready, Set, Grow!: A "What's Happening to My Body?" Book for Younger Girls | Lynda Madaras |
| 5485 | children-who-kill-profiles-of-pre-teen-and-teenage-killers | 2024 | 2003 | isbn | 2024 | Children Who Kill: Profiles of Pre-Teen and Teenage Killers | Carol Anne Davis |
| 5972 | the-glass-cafe-or-the-stripper-and-the-state-how-my-mother-started-a-war-with-the-system-that-made-us-kind-of-rich-and-a-little-bit-famous | 2025 | 2003 | isbn | 2025 | The Glass Café: Or, The Stripper and the State; How My Mother Started a War with the System that Made Us Kind of Rich and a Little Bit Famous | Gary Paulsen |
| 2114 | its-your-world-if-you-dont-like-it-change-it-activism-for-teenagers | 2024 | 2004 | isbn | 2024 | It's Your World - If You Don't Like It, Change It: Activism for Teenagers | Mikki Halpin |
| 2235 | darkest-hour | 2025 | 2004 | work | 2025 | Darkest Hour | Meg Cabot |
| 2393 | meg-nightstalkers | 2025 | 2004 | isbn | 2025 | MEG: Nightstalkers | Steve Alten |
| 2697 | barracoon-adapted-for-young-readers | 2024 | 2004 | isbn | 2024 | Barracoon: Adapted for Young Readers | Zora Neale Hurston; Ibram X. Kendi; Jazzmen Lee-Johnson |
| 2932 | bend-dont-shatter-poets-on-the-beginning-of-desire | 2025 | 2004 | isbn | 2021 | Bend, Don't Shatter: Poets on the Beginning of Desire | T. Cole Rachel |
| 3413 | 21st-century-science-medicine | 2025 | 2004 | isbn | 2025 | 21st-Century Science Medicine | Robin Kerrod |
| 3568 | cyclops | 2025 | 2004 | isbn | 2025 | Cyclops | Don Nardo |
| 3600 | date-violence | 2025 | 2004 | isbn | 2022 | Date Violence | Elaine Landau |
| 3794 | land-and-resources-of-ancient-rome | 2025 | 2004 | isbn | 2025 | Land and Resources of Ancient Rome | Daniel C. Gedacht |
| 3842 | medieval-europe | 2025 | 2004 | isbn | 2025 | Medieval Europe | Susie Hodge |
| 3893 | sarah-dessen-from-burritos-to-box-office | 2025 | 2004 | isbn | 2025 | Sarah Dessen: From Burritos to Box Office | Wendy J. Glenn |
| 3998 | the-senses | 2025 | 2004 | work | 2025 | The Senses | Rufus Bellamy |
| 4001 | the-skeletal-and-muscular-systems | 2025 | 2004 | work | 2025 | The Skeletal and Muscular systems | Susan Glass |
| 4217 | how-to-read-a-painting-lessons-from-the-old-masters | 2025 | 2004 | isbn | 2025 | How to Read a Painting: Lessons from the Old Masters | Patrick de Rynck |
| 4498 | bleach-vol-8 | 2024 | 2004 | isbn | 2024 | Bleach, Vol. 8 | Tite Kubo |
| 5577 | folk-and-fairy-tales-a-handbook | 2024 | 2004 | isbn | 2024 | Folk and Fairy Tales: A Handbook | D. L. Ashliman |
| 5613 | halloween | 2024 | 2004 | isbn | 2024 | Halloween | Steve Potts |
| 2015 | life-in-ancient-egypt | 2025 | 2005 | isbn | 2025 | Life in Ancient Egypt | Paul Challen |
| 2632 | wrecked | 2024 | 2005 | isbn | 2024 | Wrecked | E. R. Frank |
| 3371 | cantarella-vol-1 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 1 | You Higuri |
| 3372 | cantarella-vol-2 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 2 | You Higuri |
| 3373 | cantarella-vol-3 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 3 | You Higuri |
| 3374 | cantarella-vol-4 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 4 | You Higuri |
| 3375 | cantarella-vol-5 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 5 | You Higuri |
| 3376 | cantarella-vol-6 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 6 | You Higuri |
| 3377 | cantarella-vol-7 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 7 | You Higuri |
| 3378 | cantarella-vol-8 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 8 | You Higuri |
| 3379 | cantarella-vol-9 | 2024 | 2005 | isbn | 2024 | Cantarella, Vol. 9 | You Higuri |
| 3856 | my-sad-is-all-gone-a-familys-triumph-over-violent-autism | 2025 | 2005 | isbn | 2025 | My Sad Is All Gone: A Family's Triumph Over Violent Autism | Thelma Wheatley |
| 3874 | persecution-and-emigration | 2025 | 2005 | isbn | 2025 | Persecution and Emigration | David Downing |
| 3876 | photocraft | 2025 | 2005 | isbn | 2025 | Photocraft | Frankel Lovett Herter |
| 3947 | the-first-americans-the-story-of-where-they-came-from-and-who-they-became | 2025 | 2005 | isbn | 2025 | The First Americans: The Story of Where They Came From and Who They Became | Anthony F. Aveni |
| 3961 | the-holocaust-a-primary-source-history | 2025 | 2005 | isbn | 2025 | The Holocaust: A Primary Source History | Judy Bartel |
| 4063 | what-motivates-suicide-bombers | 2025 | 2005 | isbn | 2025 | What Motivates Suicide Bombers? | Lauri S. Friedman |
| 4383 | the-figure-in-clay-contemporary-sculpting-techniques-by-master-artists | 2025 | 2005 | isbn | 2025 | The Figure in Clay: Contemporary Sculpting Techniques by Master Artists | Suzanne Tourtillott |
| 4973 | girlness-deal-with-it-body-and-soul | 2024 | 2005 | isbn | 2024 | Girlness: Deal With it Body and Soul | Diane Peters |
| 5376 | a-maze-me-poems-for-girls | 2024 | 2005 | isbn | 2024 | A Maze Me: Poems for Girls | Naomi Shihab Nye |
| 1360 | would-i-lie-to-you | 2025 | 2006 | isbn | 2023 | Would I Lie to You | Cecily von Ziegesar |
| 1611 | the-little-black-book-for-girlz-a-book-on-healthy-sexuality | 2025 | 2006 | isbn | 2025 | The Little Black Book for Girlz: A Book on Healthy Sexuality | St. Stephen's Community House |
| 1808 | gender-identity-the-ultimate-teen-guide | 2025 | 2006 | isbn | 2021 | Gender Identity: The Ultimate Teen Guide | Cynthia L. Winfield |
| 2125 | crush | 2025 | 2006 | isbn | 2021 | Crush | Carrie Mac |
| 2747 | odds-are-good-an-oddly-enough-and-odder-than-ever-omnibus | 2024 | 2006 | isbn | 2024 | Odds Are Good: An Oddly Enough and Odder Than Ever Omnibus | Bruce Coville |
| 3359 | interracial-relationships | 2024 | 2006 | work | 2024 | Interracial Relationships | Bruce Alderman |
| 3424 | aftermath-and-remembrance | 2025 | 2006 | work | 2025 | Aftermath and Remembrance | David Downing |
| 3708 | getting-it | 2025 | 2006 | isbn | 2021 | Getting It | Alex Sanchez |
| 3986 | the-nazi-death-camps | 2025 | 2006 | isbn | 2025 | The Nazi Death Camps | David Downing |
| 4034 | vietnam | 2025 | 2006 | isbn | 2025 | Vietnam | Discovery Channel |
| 4133 | caravaggio-the-art-of-realism | 2025 | 2006 | isbn | 2025 | Caravaggio: The Art of Realism | John L. Varriano |
| 4419 | the-snow-globe-family | 2025 | 2006 | isbn | 2025 | The Snow Globe Family | Jane O'Connor |
| 4803 | the-testament | 2024 | 2006 | isbn | 2024 | The Testament | Eric Van Lustbader |
| 4967 | gay-lesbian-bisexual-and-transgender-events-1848-2006 | 2024 | 2006 | isbn | 2024 | Gay, Lesbian, Bisexual, and Transgender Events, 1848-2006 | Lillian Faderman |
| 5416 | amelia-earhart-legendary-aviator | 2024 | 2006 | isbn | 2024 | Amelia Earhart: Legendary Aviator | Jameson Anderson |
| 5501 | cubism | 2024 | 2006 | isbn | 2024 | Cubism | Cynthia Mines |
| 5881 | robert-louis-stevensons-treasure-island | 2025 | 2006 | isbn | 2025 | Robert Louis Stevenson's Treasure Island | Wim Coleman |
| 6006 | the-story-behind-toni-morrisons-the-bluest-eye | 2025 | 2006 | isbn | 2025 | The Story Behind ... Toni Morrison's The Bluest Eye | Mary Colson |
| 1101 | exit-here | 2025 | 2007 | isbn | 2023 | Exit Here. | Jason Myers |
| 2243 | deadline | 2025 | 2007 | isbn | 2023 | Deadline | Chris Crutcher |
| 2551 | the-circle-of-blood | 2025 | 2007 | isbn | 2023 | The Circle of Blood | Alane Ferguson |
| 3353 | frequently-asked-questions-about-dating-teen-life | 2024 | 2007 | isbn | 2024 | Frequently Asked Questions About Dating: Teen Life | Vanessa Baish |
| 3498 | busted | 2025 | 2007 | isbn | 2025 | Busted | Phil Bildner |
| 3506 | carved-in-stone-clues-about-cultures | 2025 | 2007 | isbn | 2025 | Carved in Stone: Clues About Cultures | Yvonne Morrison |
| 3514 | cherokee-rose | 2025 | 2007 | work | 2025 | Cherokee Rose | Leni Donlan |
| 3522 | child-abuse | 2025 | 2007 | isbn | 2023 | Child Abuse | William Dudley |
| 3574 | darfur-african-genocide | 2025 | 2007 | isbn | 2025 | Darfur: African Genocide | John Xavier |
| 4007 | the-timeline-of-the-civil-war | 2025 | 2007 | work | 2025 | The Timeline of the Civil War | John Wright |
| 4083 | 100-questions-youd-never-ask-your-parents-straight-answers-to-teens-questions-about-sex-sexuality-and-health | 2025 | 2007 | isbn | 2021 | 100 Questions You'd Never Ask Your Parents: Straight Answers to Teens' Questions About Sex, Sexuality, and Health | Elisabeth Henderson |
| 4163 | dionysus | 2025 | 2007 | isbn | 2025 | Dionysus | Russell Roberts |
| 4275 | michelangelo-buonarroti | 2025 | 2007 | work | 2025 | Michelangelo Buonarroti | Gabriele Bartz |
| 4305 | perseus | 2025 | 2007 | isbn | 2025 | Perseus | Susan Sales Harkins |
| 5038 | not-in-room-204-breaking-the-silence-of-abuse | 2024 | 2007 | isbn | 2024 | Not in Room 204: Breaking the Silence of Abuse | Shannon Riggs |
| 5462 | black-eyed-suzie | 2024 | 2007 | isbn | 2024 | Black-eyed Suzie | Susan Shaw |
| 5928 | surrealism | 2025 | 2007 | work | 2025 | Surrealism | Hal Marcovitz |
| 6038 | theodore-roosevelt-bear-of-a-president | 2025 | 2007 | isbn | 2025 | Theodore Roosevelt: Bear of a President | Nathan Olson |
| 1281 | dishes | 2025 | 2008 | work | 2022 | Dishes | Rich Wallace |
| 1404 | the-way-we-work-getting-to-know-the-amazing-human-body | 2024 | 2008 | isbn | 2024 | The Way We Work: Getting to Know the Amazing Human Body | David Macaulay |
| 1977 | homosexuality | 2024 | 2008 | work | 2024 | Homosexuality | Cynthia A. Bily |
| 3362 | mixed-messages-interpreting-body-image-and-social-norms | 2024 | 2008 | work | 2024 | Mixed Messages: Interpreting Body Image and Social Norms | Thea Palad |
| 3770 | jealousy | 2025 | 2008 | work | 2025 | Jealousy | Roman Espejo |
| 3834 | massacre-at-virginia-tech-disaster-survival | 2025 | 2008 | isbn | 2025 | Massacre at Virginia Tech: Disaster & Survival | Richard Worth |
| 4029 | two-parties-one-tux-and-a-very-short-film-about-the-grapes-of-wrath | 2025 | 2008 | isbn | 2021 | Two Parties, One Tux, and a Very Short Film about The Grapes of Wrath | Steven Goldman |
| 4529 | falling-hard-100-love-poems-by-teenagers | 2024 | 2008 | isbn | 2024 | Falling Hard: 100 Love Poems by Teenagers | Betsy Franco |
| 5194 | the-questions-within | 2024 | 2008 | isbn | 2021 | The Questions Within | Teresa Schaeffer |
| 5400 | alive-4-the-final-evolution | 2024 | 2008 | isbn | 2024 | Alive 4: The Final Evolution | Tadashi Kawashima |
| 5605 | gothic-art | 2024 | 2008 | isbn | 2024 | Gothic Art | Jessica Gunderson |
| 5743 | louvre-400-masterpieces | 2024 | 2008 | isbn | 2024 | Louvre: 400 Masterpieces | Daniel Soulié |
| 5857 | quest | 2025 | 2008 | isbn | 2025 | Quest | Kathleen Benner Duble |
| 5863 | realism | 2025 | 2008 | work | 2025 | Realism | Jessica Gunderson |
| 5873 | renaissance-art | 2025 | 2008 | isbn | 2025 | Renaissance Art | Stuart A. Kallen |
| 5883 | romanticism | 2025 | 2008 | isbn | 2025 | Romanticism | Jessica Gunderson |
| 6094 | whaam-the-art-and-life-of-roy-lichtenstein | 2025 | 2008 | isbn | 2025 | Whaam!: The Art and Life of Roy Lichtenstein | Susan Goldman Rubin |
| 1242 | hunted | 2025 | 2009 | isbn | 2021 | Hunted | P. C. Cast |
| 1266 | bait | 2025 | 2009 | isbn | 2021 | Bait | Alex Sanchez |
| 1980 | soul-eater-vol-1 | 2024 | 2009 | work | 2022 | Soul Eater, Vol. 1 | Atsushi Ohkubo |
| 2341 | impossible | 2025 | 2009 | isbn | 2023 | Impossible | Nancy Werlin |
| 2459 | pretty-dead | 2025 | 2009 | isbn | 2023 | Pretty Dead | Francesca Lia Block |
| 2660 | bed-of-roses | 2025 | 2009 | isbn | 2023 | Bed of Roses | Nora Roberts |
| 3040 | finding-out-an-introduction-to-lgbt-studies | 2025 | 2009 | isbn | 2025 | Finding Out: An Introduction to LGBT Studies | Deborah T. Meem |
| 3246 | smashing-the-stereotypes-what-does-it-mean-to-be-gay-lesbian-bisexual-or-transgender | 2025 | 2009 | isbn | 2025 | Smashing the Stereotypes: What Does It Mean To Be Gay, Lesbian, Bisexual, or Transgender? | Jaime A. Seba |
| 3604 | deadly-school-and-campus-violence | 2025 | 2009 | isbn | 2025 | Deadly School and Campus Violence | Corona Brezina |
| 3638 | economy-and-industry-in-ancient-greece | 2025 | 2009 | work | 2025 | Economy and Industry in Ancient Greece | Melanie Ann Apel |
| 3750 | home-life-in-ancient-egypt | 2025 | 2009 | isbn | 2025 | Home Life in Ancient Egypt | Leslie C. Kaplan |
| 3752 | home-life-in-ancient-greece | 2025 | 2009 | isbn | 2025 | Home Life in Ancient Greece | Melanie Ann Apel |
| 3796 | leonardo-da-vinci | 2025 | 2009 | isbn | 2023 | Leonardo Da Vinci | Catherine Nichols |
| 3902 | shadowland | 2025 | 2009 | isbn | 2024 | Shadowland | Alyson Noël |
| 3912 | suicide-bombers | 2025 | 2009 | work | 2025 | Suicide Bombers | Robert Greenberger |
| 4028 | truce | 2025 | 2009 | isbn | 2025 | Truce | Jim Murphy |
| 4367 | the-beautiful-stories-of-life-six-greeks-myths-retold | 2025 | 2009 | isbn | 2022 | The Beautiful Stories of Life: Six Greeks Myths, Retold | Cynthia Rylant |
| 4735 | the-color-of-heaven | 2024 | 2009 | work | 2024 | The Color of Heaven | Kim Dong Hwa |
| 4985 | ice-song | 2024 | 2009 | isbn | 2024 | Ice Song | Kirsten Imani Kasai |
| 5346 | 13-artists-children-should-know | 2024 | 2009 | isbn | 2024 | 13 Artists Children Should Know | Angela Wenzel |
| 5677 | impressionism | 2024 | 2009 | work | 2024 | Impressionism | Jessica Gunderson |
| 5715 | kung-fu | 2024 | 2009 | work | 2024 | Kung Fu | Tim O'Shei |
| 5791 | muchacho | 2024 | 2009 | isbn | 2024 | Muchacho | LouAnne Johnson |
| 5897 | seeing-red | 2025 | 2009 | isbn | 2025 | Seeing Red | Anne Louise MacDonald |
| 5952 | the-contemporary-art-book-the-essential-guide-to-200-of-the-worlds-most-widely-exhibited-artists | 2025 | 2009 | isbn | 2025 | The Contemporary Art Book: The Essential Guide to 200 of the World's Most Widely Exhibited Artists | Charlotte Bonham Carter |
| 5961 | the-early-modern-world-1492-to-1783 | 2025 | 2009 | isbn | 2025 | The Early Modern World, 1492 to 1783 | Helen Dywer |
| 1408 | its-christmas-david | 2025 | 2010 | isbn | 2024 | It's Christmas, David | David Shannon |
| 1818 | home-and-family-relationships | 2025 | 2010 | work | 2024 | Home and Family Relationships | Tamra B. Orr |
| 1990 | soul-eater-vol-3 | 2024 | 2010 | isbn | 2022 | Soul Eater, Vol. 3 | Atsushi Ohkubo |
| 2495 | runaway | 2025 | 2010 | isbn | 2025 | Runaway | Meg Cabot |
| 2571 | the-julian-game | 2025 | 2010 | work | 2025 | The Julian Game | Adele Griffin |
| 2661 | christian-the-hugging-lion | 2025 | 2010 | isbn | 2023 | Christian, the Hugging Lion | Justin Richardson |
| 2878 | abnormal-psychology | 2025 | 2010 | isbn | 2025 | Abnormal Psychology | Helen Dwyer |
| 2900 | ap-psychology | 2025 | 2010 | work | 2025 | AP Psychology | Allyson Weseley |
| 2908 | are-americas-wealthy-too-powerful | 2025 | 2010 | isbn | 2025 | Are America's Wealthy Too Powerful? | Lankford. Ronald D. |
| 3355 | gay-power-the-stonewall-riots-and-the-gay-rights-movememnt-1969 | 2024 | 2010 | isbn | 2024 | Gay Power! The Stonewall Riots and the Gay Rights Movememnt, 1969 | Betsy Kuhn |
| 3366 | teen-sex | 2024 | 2010 | work | 2023 | Teen Sex | Olivia Ferguson |
| 3411 | theres-going-to-be-a-baby | 2024 | 2010 | work | 2024 | There's Going To Be A Baby | John Burningham |
| 3458 | art-and-culture-of-the-medieval-world | 2025 | 2010 | work | 2025 | Art and Culture of the Medieval World | Steven S. Delaware |
| 3460 | art-and-culture-of-the-renaissance-world | 2025 | 2010 | isbn | 2025 | Art and Culture of the Renaissance World | Lauren Murphy |
| 4027 | troubadour | 2025 | 2010 | work | 2025 | Troubadour | Mary Hoffman |
| 4209 | hephaestus | 2025 | 2010 | isbn | 2025 | Hephaestus | Kayleen Reusser |
| 4263 | mary-mccartney-from-where-i-stand | 2025 | 2010 | isbn | 2025 | Mary McCartney: From Where I Stand | Mary McCartney |
| 4435 | tribe-endangered-peoples-around-the-world | 2025 | 2010 | isbn | 2025 | Tribe: Endangered Peoples Around the World | Piers Gibbon |
| 4942 | coming-out-telling-family-and-friends | 2024 | 2010 | isbn | 2021 | Coming Out: Telling Family and Friends | Jaime A. Seba |
| 5444 | at-work-twenty-five-contemporary-chinese-artists | 2024 | 2010 | isbn | 2024 | At Work: Twenty-five Contemporary Chinese Artists | Jon Burris |
| 5456 | benito-runs | 2024 | 2010 | isbn | 2024 | Benito Runs | Justine Fontes |
| 5523 | dumile-feni-the-story-of-a-great-artist | 2024 | 2010 | isbn | 2024 | Dumile Feni: The Story of a Great Artist | Prince Mbusi Dube |
| 5571 | fire-in-the-sky | 2024 | 2010 | work | 2024 | Fire in the Sky | Erin Hunter |
| 5635 | hero | 2024 | 2010 | isbn | 2023 | Hero | Mike Lupica |
| 5919 | something-like-fate | 2025 | 2010 | work | 2023 | Something Like Fate | Susane Colasanti |
| 5986 | the-lying-game | 2025 | 2010 | isbn | 2025 | The Lying Game | Sara Shepard |
| 9426 | on-the-volcano | 2024 | 2010 | isbn | 2024 | On the Volcano | James Nelson |
| 1330 | sparks-the-epic-completely-true-blue-almost-holy-quest-of-debbie | 2025 | 2011 | isbn | 2023 | Sparks: The epic, Completely True Blue, (Almost) Holy Quest of Debbie | S.J. Adams |
| 1786 | crossing-lines | 2025 | 2011 | isbn | 2021 | Crossing Lines | Paul Volponi |
| 1790 | discrimination | 2025 | 2011 | work | 2025 | Discrimination | Christina Fisanick |
| 2104 | transgender-people | 2024 | 2011 | isbn | 2024 | Transgender People | Roman Espejo |
| 2371 | leverage | 2025 | 2011 | isbn | 2023 | Leverage | Joshua Cohen |
| 2621 | vanished-books-one-two-when-lightning-strikes-code-name-cassandra | 2025 | 2011 | isbn | 2025 | Vanished: Books One & Two: When Lightning Strikes; Code Name Cassandra | Meg Cabot |
| 2856 | 500-ap-psychology-questions-to-know-by-test-day | 2025 | 2011 | isbn | 2025 | 500 AP Psychology Questions to Know By Test Day | Lauren William |
| 2998 | counseling-lgbtq-americans | 2025 | 2011 | isbn | 2025 | Counseling LGBTQ Americans | Dennis A. Frank |
| 3054 | gay-believers-homosexuality-and-religion | 2025 | 2011 | isbn | 2021 | Gay Believers: Homosexuality and Religion | Emily Sanna |
| 3086 | homophobia-from-social-stigma-to-hate-crimes | 2025 | 2011 | isbn | 2021 | Homophobia: From Social Stigma to Hate Crimes | Bill Palmer |
| 3244 | should-parents-be-allowed-to-choose-the-sex-of-their-children | 2025 | 2011 | isbn | 2025 | Should Parents Be Allowed to Choose the Sex of their Children | Tamara Thompson |
| 3323 | what-causes-sexual-orientation-genetics-biology-psychology | 2025 | 2011 | isbn | 2025 | What Causes Sexual Orientation?: Genetics, Biology, Psychology | Bill Palmer |
| 3412 | you-the-owners-manual-for-teens-a-guide-to-a-healthy-body-and-happy-life | 2024 | 2011 | isbn | 2024 | You: The Owner's Manual for Teens: A Guide to a Healthy Body and Happy Life | Michael F. Roizen |
| 4289 | myths-legends-an-illustrated-guide-to-their-origins-and-meanings | 2025 | 2011 | isbn | 2025 | Myths & Legends: An Illustrated Guide To Their Origins and Meanings | Philip Wilkinson |
| 4488 | before | 2024 | 2011 | isbn | 2023 | Before | Anna Todd |
| 4607 | mangaman | 2024 | 2011 | work | 2023 | Mangaman | Barry Lyga |
| 4765 | the-gunslinger-the-journey-begins | 2024 | 2011 | isbn | 2024 | The Gunslinger - The Journey Begins | Robin Furth |
| 4944 | cosmetic-surgery | 2024 | 2011 | isbn | 2024 | Cosmetic Surgery | Roman Espejo |
| 5386 | a-strange-wilderness-the-lives-of-the-great-mathematicians | 2024 | 2011 | isbn | 2024 | A Strange Wilderness: The Lives of the Great Mathematicians | Amir D. Aczel |
| 5497 | cougars | 2024 | 2011 | work | 2024 | Cougars | John Hamilton |
| 5661 | human-body-a-book-with-guts | 2024 | 2011 | isbn | 2024 | Human Body: A Book with Guts! | Dan Green |
| 5663 | humvees | 2024 | 2011 | isbn | 2024 | Humvees | John Hamilton |
| 5821 | orchards | 2025 | 2011 | isbn | 2025 | Orchards | Holly Thompson |
| 5833 | paladins | 2025 | 2011 | isbn | 2025 | Paladins | John Hamilton |
| 5837 | paragons-and-paragone-van-eyck-raphael-michelangelo-caravaggio-bernini | 2025 | 2011 | isbn | 2025 | Paragons and Paragone: Van Eyck, Raphael, Michelangelo, Caravaggio, Bernini | Rudolf Preimesberger |
| 5927 | strykers | 2025 | 2011 | isbn | 2025 | Strykers | John Hamilton |
| 5991 | the-orphan-of-awkward-falls | 2025 | 2011 | isbn | 2025 | The Orphan of Awkward Falls | Keith Graves |
| 10097 | datos-geniales-sobre-beisbol-cool-baseball-facts | 2024 | 2011 | isbn | 2024 | Datos geniales sobre béisbol/Cool Baseball Facts | Kathryn Clay |
| 1274 | bloodrose-nightshade-novel | 2025 | 2012 | isbn | 2023 | Bloodrose: Nightshade Novel | Andrea Robertson |
| 2041 | medieval-european-art-and-architecture | 2025 | 2012 | isbn | 2024 | Medieval European Art and Architecture | Don Nardo |
| 2169 | all-you-never-wanted | 2025 | 2012 | isbn | 2023 | All You Never Wanted | Adele Griffin |
| 2317 | heaven | 2024 | 2012 | isbn | 2023 | Heaven | Alexandra Adornetto |
| 2401 | mister-deaths-blue-eyed-girls | 2025 | 2012 | isbn | 2023 | Mister Death's Blue-Eyed Girls | Mary Downing Hahn |
| 2557 | the-diviners | 2025 | 2012 | isbn | 2023 | The Diviners | Libba Bray |
| 3203 | omg-queer-short-stories-by-queer-youth | 2025 | 2012 | isbn | 2025 | OMG Queer: Short Stories by Queer Youth | Katherine Lynch |
| 3367 | teenage-sex-and-pregnancy | 2024 | 2012 | isbn | 2021 | Teenage Sex and Pregnancy | Peggy J. Parks |
| 3384 | attack-on-titan-vol-2 | 2024 | 2012 | work | 2009 | Attack on Titan, Vol 2 | Hajime Isayama |
| 4013 | the-warriors-heart-becoming-a-man-of-compassion-and-courage | 2025 | 2012 | isbn | 2025 | The Warrior's Heart : Becoming a Man of Compassion and Courage | Eric Greitens |
| 4022 | top-10-worst-things-about-ancient-egypt-you-wouldnt-want-to-know | 2025 | 2012 | isbn | 2025 | Top 10 Worst Things About Ancient Egypt You Wouldn't Want To Know! | Victoria England |
| 4023 | top-10-worst-things-about-ancient-greece-you-wouldnt-want-to-know | 2025 | 2012 | isbn | 2025 | Top 10 Worst Things about Ancient Greece You Wouldn't Want to Know! | Victoria England |
| 4024 | top-10-worst-things-about-ancient-rome-you-wouldnt-want-to-know | 2025 | 2012 | isbn | 2025 | Top 10 Worst Things About Ancient Rome You Wouldn't Want to Know! | Victoria England |
| 4235 | joan-miro-1893-1983-the-poet-among-the-surrealists | 2025 | 2012 | isbn | 2025 | Joan Miro, 1893-1983: The Poet Among the Surrealists | Janis Mink |
| 4497 | bleach-vol-42 | 2024 | 2012 | isbn | 2024 | Bleach, Vol. 42 | Tite Kubo |
| 4871 | enemies | 2024 | 2012 | isbn | 2024 | Enemies | Tim Bowler |
| 4913 | a-guys-guide-to-sexuality-and-sexual-identity-in-the-21st-century | 2024 | 2012 | isbn | 2021 | A Guy's Guide to Sexuality and Sexual Identity in the 21st Century | Joe Craig |
| 5102 | sexual-orientation | 2024 | 2012 | isbn | 2024 | Sexual Orientation | Lauri S. Scherer |
| 5164 | the-fight | 2024 | 2012 | isbn | 2021 | The Fight | Elizabeth Karre |
| 5238 | wandering-son-vol-3 | 2024 | 2012 | isbn | 2024 | Wandering Son, Vol. 3 | Takako Shimura |
| 5326 | gone-gone-gone | 2025 | 2012 | isbn | 2021 | Gone, Gone, Gone | Hannah Moskowitz |
| 5378 | a-midsummer-tights-dream | 2024 | 2012 | isbn | 2024 | A Midsummer Tights Dream | Louise Rennison |
| 5426 | ancient-egyptian-art-and-architecture | 2024 | 2012 | isbn | 2024 | Ancient Egyptian Art and Architecture | Don Nardo |
| 5427 | ancient-greece-and-rome-myths-and-beliefs | 2024 | 2012 | isbn | 2024 | Ancient Greece and Rome: Myths and Beliefs | Tony Allan |
| 5436 | are-there-rainbows-on-the-moon-over-200-weird-and-wonderful-science-questions-answered | 2024 | 2012 | isbn | 2024 | Are There Rainbows on the Moon: Over 200 Weird and Wonderful Science Questions Answered | Erwin Brecher |
| 5503 | dance-team | 2024 | 2012 | isbn | 2024 | Dance Team | Charnan Simon |
| 5675 | illusions | 2024 | 2012 | isbn | 2024 | Illusions | Aprilynne Pike |
| 5831 | overexposed | 2025 | 2012 | isbn | 2025 | Overexposed | Susan J. Korman |
| 5843 | pinch-hit | 2025 | 2012 | isbn | 2025 | Pinch Hit | Tim Green |
| 6062 | two-truths-and-a-lie | 2025 | 2012 | work | 2025 | Two Truths and a Lie | Sara Shepard |
| 6127 | womens-issues-in-margaret-atwoods-the-handmaids-tale | 2025 | 2012 | work | 2025 | Women's Issues in Margaret Atwood's The Handmaid's Tale | David E. Nelson |
| 1262 | anatomy-of-a-single-girl | 2025 | 2013 | isbn | 2022 | Anatomy of a Single Girl | Daria Snadowsky |
| 1390 | lgbtq-families-the-ultimate-teen-guide | 2025 | 2013 | isbn | 2021 | LGBTQ Families: The Ultimate Teen Guide | Eva Apelqvist |
| 1802 | gender-identity-teen-mental-health | 2025 | 2013 | isbn | 2025 | Gender Identity (Teen Mental Health) | Nicki Peter Petrikowski |
| 2037 | greek-mythology-for-beginners | 2025 | 2013 | isbn | 2024 | Greek Mythology for Beginners | Joe Lee |
| 2447 | panic | 2025 | 2013 | isbn | 2021 | Panic | Sharon M. Draper |
| 2785 | galatea-a-short-story | 2025 | 2013 | isbn | 2025 | Galatea: A Short Story | Madeline Miller |
| 3234 | respecting-diversity | 2025 | 2013 | isbn | 2025 | Respecting diversity | Anastasia Suen |
| 3692 | for-the-good-of-mankind-the-shameful-history-of-human-medical-experimentation | 2025 | 2013 | isbn | 2025 | For the Good of Mankind?: The Shameful History of Human Medical Experimentation | Vicki O. Wittenstein |
| 4105 | art-and-architecture-in-mexico | 2025 | 2013 | isbn | 2025 | Art and Architecture in Mexico | James Oles |
| 4161 | digital-art-a-complete-guide-to-making-your-own-computer-artworks | 2025 | 2013 | isbn | 2025 | Digital Art: A Complete Guide to Making Your Own Computer Artworks | David Cousens |
| 4437 | twisted-myths-20-classic-stories-with-a-dark-and-dangerous-heart | 2025 | 2013 | isbn | 2025 | Twisted Myths: 20 Classic Stories With a Dark and Dangerous Heart | Maura McHugh |
| 4769 | the-gunslinger-the-way-station | 2024 | 2013 | isbn | 2024 | The Gunslinger - The Way Station | Robin Furth |
| 5216 | they-call-me-a-hero-a-memoir-of-my-youth | 2024 | 2013 | isbn | 2024 | They Call Me a Hero: A Memoir of My Youth | Daniel Hernandez |
| 5430 | andy-warhol | 2024 | 2013 | isbn | 2024 | Andy Warhol | Joseph D. Ketner II |
| 5466 | blue-bloods-the-graphic-novel | 2025 | 2013 | isbn | 2025 | Blue Bloods: The Graphic Novel | Melissa de la Cruz; Robert Venditti |
| 5514 | diego-rivera-an-artist-for-the-people | 2024 | 2013 | isbn | 2024 | Diego Rivera: An Artist for the People | Susan Goldman Rubin |
| 5657 | hooked-when-addiction-hits-home | 2024 | 2013 | isbn | 2024 | Hooked: When Addiction Hits Home | Chloe Shantz-Hilkes |
| 5747 | manga-dinosaurs | 2024 | 2013 | isbn | 2024 | Manga Dinosaurs | Richard Jones |
| 5749 | manga-dragons | 2024 | 2013 | isbn | 2024 | Manga Dragons | Richard Jones |
| 5753 | manga-superheroes | 2024 | 2013 | work | 2024 | Manga Superheroes | Richard Jones |
| 6106 | when-you-were-here | 2025 | 2013 | isbn | 2025 | When You Were Here | Daisy Whitney |
| 1093 | skin-and-bones | 2025 | 2014 | isbn | 2023 | Skin and Bones | Sherry Shahan |
| 1812 | gender-issues-living-with-a-special-need | 2025 | 2014 | isbn | 2025 | Gender Issues (Living with a Special Need) | Kenneth McIntosh |
| 1961 | transgender-lives-complex-stories-complex-voices | 2025 | 2014 | isbn | 2022 | Transgender Lives: Complex Stories, Complex Voices | Kirstin Cronn-Mills |
| 1996 | soul-eater-vol-9 | 2024 | 2014 | work | 2023 | Soul Eater, Vol. 9 | Atsushi Ohkubo |
| 2177 | ashes-to-ashes | 2024 | 2014 | work | 2023 | Ashes to Ashes | Jenny Han |
| 2568 | the-here-and-now | 2025 | 2014 | isbn | 2023 | The Here and Now | Ann Brashares |
| 2627 | white-space | 2025 | 2014 | isbn | 2023 | White Space | Ilsa J. Bick |
| 2676 | my-hero-academia-origin-vol-5 | 2025 | 2014 | isbn | 2025 | My Hero Academia: Origin, Vol. 5 | Kōhei Horikoshi |
| 2732 | eloise-and-the-strange-museum-visit-learning-to-make-reasoned-ethical-decisions | 2024 | 2014 | isbn | 2024 | Eloise and the Strange Museum Visit: Learning to Make Reasoned, Ethical Decisions | Tosca Killoran |
| 3056 | gay-characters-in-theater-movies-and-television-new-roles-new-attitudes | 2025 | 2014 | isbn | 2025 | Gay Characters in Theater, Movies, and Television: New Roles, New Attitudes | Jaime A. Seba |
| 3138 | lgbt-youth-issues-today-a-reference-handbook | 2025 | 2014 | isbn | 2025 | LGBT Youth Issues Today: A Reference Handbook | David E. Newton |
| 3250 | speaking-out-queer-youth-in-focus | 2025 | 2014 | isbn | 2025 | Speaking Out: Queer Youth in Focus | Rachelle Lee Smith |
| 3257 | teens-lgbt-issues | 2025 | 2014 | isbn | 2025 | Teens & LGBT Issues | Hal Marcovitz |
| 3291 | the-transgender-child-revised-updated-edition-a-handbook-for-parents-and-professionals-supporting-transgender-and-non-binary-children | 2025 | 2014 | isbn | 2025 | The Transgender Child: Revised & Updated Edition: A Handbook for Parents and Professionals Supporting Transgender and Non-binary Children | Stephanie A. Brill |
| 3356 | how-can-teen-pregnancy-be-reduced | 2024 | 2014 | isbn | 2024 | How Can Teen Pregnancy Be Reduced | Barbara Sheen |
| 3408 | the-merciless | 2025 | 2014 | isbn | 2025 | The Merciless | Danielle Vega |
| 3736 | haunted-homes | 2025 | 2014 | work | 2025 | Haunted Homes | Barbara Cox |
| 3994 | the-right-fight | 2025 | 2014 | isbn | 2025 | The Right Fight | Chris Lynch |
| 4033 | van-gogh | 2025 | 2014 | work | 2025 | Van Gogh | Richard A. Bowen |
| 4243 | kill-shakespeare-vol-4-the-mask-of-night | 2025 | 2014 | isbn | 2025 | Kill Shakespeare, Vol. 4 - The Mask of Night | Conor McCreery |
| 4438 | uelsmann-untitled-a-retrospective | 2025 | 2014 | isbn | 2025 | Uelsmann Untitled: A Retrospective | Jerry Uelsmann |
| 5354 | a-blind-spot-for-boys | 2024 | 2014 | isbn | 2024 | A Blind Spot for Boys | Justina Chen |
| 5435 | arcadys-goal | 2024 | 2014 | isbn | 2024 | Arcady's Goal | Eugene Yelchin |
| 5565 | famous-last-words | 2024 | 2014 | isbn | 2024 | Famous Last Words | Katie Alender |
| 5641 | hidden-girl-the-true-story-of-a-modern-day-child-slave | 2024 | 2014 | isbn | 2024 | Hidden Girl: The True Story of a Modern-Day Child Slave | Shyima Hall |
| 5643 | hider-seeker-secret-keeper | 2024 | 2014 | isbn | 2024 | Hider, Seeker, Secret Keeper | Elizabeth Kiem |
| 5915 | sliding-on-the-edge | 2025 | 2014 | isbn | 2025 | Sliding on the Edge | C. Lee McKenzie |
| 9027 | the-system | 2024 | 2014 | isbn | 2024 | The System | Teshelle Combs |
| 2555 | the-devil-you-know | 2025 | 2015 | isbn | 2023 | The Devil You Know | Trish Doller |
| 2617 | undertow | 2025 | 2015 | isbn | 2023 | Undertow | Michael Buckley |
| 2663 | families-families-families | 2025 | 2015 | work | 2023 | Families, Families, Families! | Suzanne Lang |
| 2744 | my-family-your-family | 2024 | 2015 | isbn | 2024 | My Family, Your Family | Lisa Bullard |
| 3052 | gay-and-lesbian-history-for-kids-the-century-long-struggle-lgbt-rights-with-21-activities | 2025 | 2015 | isbn | 2023 | Gay and Lesbian History for Kids: The Century-Long Struggle LGBT Rights, with 21 Activities | Jerome Pohlen |
| 3278 | the-gender-quest-workbook-a-guide-for-teens-and-young-adults-exploring-gender-identity | 2025 | 2015 | isbn | 2022 | The Gender Quest Workbook: A Guide for Teens and Young Adults Exploring Gender Identity | Rylan Jay Testa |
| 3748 | hitlers-last-days-the-death-of-the-nazi-regime-and-the-worlds-most-notorious-dictator | 2025 | 2015 | isbn | 2025 | HItler's Last Days: The Death of the Nazi Regime and the World's Most Notorious Dictator | Bill O'Reilly |
| 3800 | life-as-a-gladiator-an-interactive-history-adventure | 2025 | 2015 | isbn | 2025 | Life as A Gladiator: An Interactive History Adventure | Michael Burgan |
| 3979 | the-making-of-a-navy-seal-my-story-of-surviving-the-toughest-challenge-and-training-the-best | 2025 | 2015 | isbn | 2025 | The Making of a Navy Seal: My Story of Surviving the Toughest Challenge and Training the Best | Brandon Webb |
| 4069 | why-did-hiroshima-happen | 2025 | 2015 | work | 2025 | Why Did Hiroshima Happen? | Reg Grant |
| 4233 | jean-michel-basquiat | 2025 | 2015 | isbn | 2025 | Jean-Michel Basquiat | Eleanor Nairne |
| 4329 | rot-ruin-warrior-smart | 2025 | 2015 | isbn | 2025 | Rot & Ruin: Warrior Smart | Jonathan Maberry |
| 4387 | the-handy-mythology-answer-book | 2025 | 2015 | isbn | 2025 | The Handy Mythology Answer Book | David Adams Leeming |
| 4471 | a-work-of-art | 2024 | 2015 | isbn | 2024 | A Work of Art | Melody Maysonet |
| 4701 | someday | 2024 | 2015 | isbn | 2022 | Someday | David Levithan |
| 4922 | an-infinite-number-of-parallel-universes-in-real-life-you-need-real-friends | 2024 | 2015 | isbn | 2024 | An Infinite Number of Parallel Universes: In Real Life, You Need Real Friends | Randy Ribay |
| 4928 | beyond-clueless | 2024 | 2015 | isbn | 2024 | Beyond Clueless | Linas Alsenas |
| 4941 | combat-zone | 2024 | 2015 | isbn | 2021 | Combat Zone | Patrick Jones |
| 4958 | fathersonfather | 2024 | 2015 | isbn | 2024 | Fathersonfather | Evan Jacobs |
| 4974 | girls-vs-guys-surprising-differences-between-the-sexes | 2024 | 2015 | isbn | 2021 | Girls vs. Guys: Surprising Differences Between the Sexes | Michael J. Rosen |
| 5470 | breakthrough-how-three-people-saved-blue-babies-and-changed-medicine-forever | 2024 | 2015 | isbn | 2024 | Breakthrough! How Three People Saved "Blue Babies" and Changed Medicine Forever | Jim Murphy |
| 5659 | how-not-to-disappear | 2024 | 2015 | isbn | 2024 | How Not to Disappear | Clare Furniss |
| 5795 | myths-of-the-ancient-greeks | 2024 | 2015 | isbn | 2024 | Myths of the Ancient Greeks | Pliny O'Brian |
| 5805 | next-top-villain | 2025 | 2015 | isbn | 2025 | Next Top Villain | Suzanne Selfors |
| 5853 | public-enemies | 2025 | 2015 | isbn | 2023 | Public Enemies | Ann Aguirre |
| 10136 | hoop-city-baltimore | 2024 | 2015 | isbn | 2024 | Hoop City: Baltimore | Sam Moussavi |
| 1205 | striving-for-equality-lgbtq-athletes-claim-the-field | 2025 | 2016 | isbn | 2021 | Striving for Equality: LGBTQ Athletes Claim the Field | Kirstin Cronn-Mills |
| 1207 | transgender-rights-and-issues | 2024 | 2016 | isbn | 2021 | Transgender Rights and Issues | Andrea Pelleschi |
| 1352 | under-the-lights | 2025 | 2016 | isbn | 2022 | Under the Lights | Abbi Glines |
| 1388 | laverne-cox | 2025 | 2016 | work | 2024 | Laverne Cox | Erin Staley |
| 1784 | critical-perspectives-on-gender-identity | 2025 | 2016 | isbn | 2023 | Critical Perspectives on Gender Identity | Nicki Peter Petrikowski |
| 1806 | gender-identity-the-search-for-self | 2025 | 2016 | isbn | 2021 | Gender Identity: The Search for Self | Kate Light |
| 1951 | the-stonewall-riots-the-fight-for-lgbt-rights | 2025 | 2016 | isbn | 2024 | The Stonewall Riots: The Fight for LGBT Rights | Tristan Poehlmann |
| 2084 | whatever-or-how-junior-year-became-totally-f-ked | 2024 | 2016 | isbn | 2021 | Whatever.: or how junior year became totally f$@ked | S. J. Goslee |
| 2767 | the-best-man | 2024 | 2016 | isbn | 2021 | The Best Man | Richard Peck |
| 3036 | feminism-reinventing-the-f-word | 2025 | 2016 | isbn | 2025 | Feminism: Reinventing the F-Word | Nadia Abushanab Higgins |
| 3208 | other-please-specify-queer-methods-in-sociology | 2025 | 2016 | isbn | 2025 | Other, Please Specify: Queer Methods in Sociology | D'Lane R. Compton |
| 3305 | transphobia-deal-with-it-and-be-a-gender-transcender | 2025 | 2016 | isbn | 2025 | Transphobia: Deal with It and Be A Gender Transcender | J. Wallace Skelton |
| 3341 | who-are-you-the-kids-guide-to-gender-identity | 2025 | 2016 | isbn | 2025 | Who Are You? The Kid's Guide to Gender Identity | Brook Pessin-Wedbee |
| 3468 | autumns-kiss | 2025 | 2016 | isbn | 2025 | Autumn's Kiss | Bella Thorne |
| 3572 | dali | 2025 | 2016 | work | 2025 | Dali | Jessica Toyne |
| 4215 | hollow-city-the-graphic-novel | 2025 | 2016 | isbn | 2022 | Hollow City: The Graphic Novel | Ransom Riggs |
| 4325 | richard-matheson-master-of-terror-graphic-novel-collection | 2025 | 2016 | isbn | 2025 | Richard Matheson: Master of Terror Graphic Novel Collection | Ted Adams; Chris Ryall; Steve Niles; Ian Edginton |
| 4451 | william-eggleston-portraits | 2025 | 2016 | isbn | 2025 | William Eggleston: Portraits | Phillip Prodger |
| 4487 | beck | 2024 | 2016 | isbn | 2024 | Beck | Mal Peet |
| 4691 | shirley-jacksons-the-lottery-the-authorized-graphic-adaptation | 2024 | 2016 | isbn | 2021 | Shirley Jackson's "The Lottery": The Authorized Graphic Adaptation | Miles Hyman |
| 4885 | irreversible | 2024 | 2016 | isbn | 2024 | Irreversible | Chris Lynch |
| 4977 | health-issues-when-youre-transgender | 2024 | 2016 | isbn | 2024 | Health Issues When You're Transgender | Susan Meyer |
| 5010 | living-with-religion-and-faith | 2024 | 2016 | work | 2021 | Living with Religion and Faith | Robert Rodi |
| 5018 | maria | 2024 | 2016 | work | 2024 | Maria | Sylvia Aguilar Zeleny |
| 5228 | transgender-rights-and-protections | 2024 | 2016 | isbn | 2021 | Transgender Rights and Protections | Rebecca T. Klein |
| 5451 | bad-kitty-goes-to-the-vet | 2024 | 2016 | isbn | 2005 | Bad Kitty Goes to the Vet | Nick Bruel |
| 5484 | chihuly-on-fire | 2024 | 2016 | isbn | 2024 | Chihuly: On Fire | Dale Chihuly |
| 5603 | goliath-beetles | 2024 | 2016 | work | 2024 | Goliath Beetles | Grace Hansen |
| 5875 | reproductive-rights-who-decides | 2025 | 2016 | isbn | 2025 | Reproductive Rights: Who Decides? | Vicki O. Wittenstein |
| 5940 | the-baroque-period | 2025 | 2016 | isbn | 2025 | The Baroque Period | Anne Fitzpatrick |
| 5963 | the-endocrine-and-reproductive-systems | 2025 | 2016 | work | 2025 | The Endocrine and Reproductive Systems | Joseph Midthun |
| 6084 | we-believe-you-survivors-of-campus-sexual-assault-speak-out | 2025 | 2016 | isbn | 2025 | We Believe You: Survivors of Campus Sexual Assault Speak Out | Annie E. Clark |
| 7619 | ajin-demi-human | 2025 | 2016 | isbn | 2025 | Ajin: Demi-Human | Gamon Sakurai |
| 9810 | the-word-for-yes | 2024 | 2016 | isbn | 2024 | The Word for Yes | Claire Needell |
| 1356 | vigilante | 2025 | 2017 | isbn | 2024 | Vigilante | Kady Cross |
| 1393 | queer-there-and-everywhere-23-people-who-changed-the-world | 2025 | 2017 | isbn | 2021 | Queer, There and Everywhere: 23 People Who Changed the World | Sarah Prager |
| 1834 | jazz-jennings-voice-for-lgbtq-youth | 2025 | 2017 | isbn | 2024 | Jazz Jennings: Voice for LGBTQ Youth | Ellen Rodger |
| 1848 | lgbtq-human-rights-movement | 2025 | 2017 | isbn | 2024 | LGBTQ Human Rights Movement | Theresa Morlock |
| 1866 | love-is-love | 2025 | 2017 | isbn | 2024 | Love is Love | Mette Bach |
| 1976 | youre-in-the-wrong-bathroom-and-20-other-myths-and-misconceptions-about-transgender-and-gender-nonconforming-people | 2025 | 2017 | isbn | 2024 | You're in the Wrong Bathroom!: And 20 Other Myths and Misconceptions About Transgender and Gender-Nonconforming People | Laura Erickson-Schroth |
| 2078 | right-where-you-left-me | 2024 | 2017 | work | 2024 | Right Where You Left Me | Calla Devlin |
| 2079 | spontaneous | 2024 | 2017 | isbn | 2023 | Spontaneous | Aaron Starmer |
| 2197 | blight | 2025 | 2017 | isbn | 2025 | Blight | Alexandra Duncan |
| 2225 | confessions-of-a-high-school-disaster | 2025 | 2017 | isbn | 2023 | Confessions of a High School Disaster | Emma Chastain |
| 2519 | starfish | 2025 | 2017 | isbn | 2023 | Starfish | Akemi Dawn Bowman |
| 2664 | fathers-are-part-of-a-family | 2025 | 2017 | isbn | 2023 | Fathers are Part of a Family | Lucia Tarbox Raatma |
| 2675 | mothers-are-part-of-a-family | 2025 | 2017 | isbn | 2023 | Mothers Are Part of A Family | Lucia Tarbox Raatma |
| 2783 | this-would-make-a-good-story-someday | 2024 | 2017 | isbn | 2023 | This Would Make a Good Story Someday | Dana Alison Levy |
| 2886 | all-you-need-is-love-celebrating-families-of-all-shapes-and-sizes | 2025 | 2017 | isbn | 2025 | All You Need Is Love: Celebrating Families of All Shapes and Sizes | Shanni Collins |
| 2988 | confronting-racism | 2025 | 2017 | isbn | 2025 | Confronting Racism | Maryellen Lo Bosco |
| 2996 | coping-with-racial-inequality | 2025 | 2017 | isbn | 2025 | Coping with Racial Inequality | Tamra B. Orr |
| 3118 | inside-the-lgbtq-movement | 2025 | 2017 | work | 2025 | Inside the LGBTQ+ Movement | Jennifer Lombardo |
| 3228 | racial-profiling-everyday-inequality | 2025 | 2017 | isbn | 2025 | Racial Profiling: Everyday Inequality | Alison Marie Behnke |
| 3229 | racism-in-america-a-long-history-of-hate | 2025 | 2017 | isbn | 2025 | Racism in America: A Long History of Hate | Meghan Green |
| 3334 | when-a-bully-is-president-truth-and-creativity-for-oppressive-times | 2025 | 2017 | isbn | 2025 | When a Bully Is President: Truth and Creativity for Oppressive Times | Gonzalez. Maya |
| 3349 | your-rights-as-an-lgbtq-teen | 2025 | 2017 | isbn | 2022 | Your Rights as an LGBTQ+ Teen | Barbra Penne |
| 3380 | ghost-houses | 2024 | 2017 | isbn | 2024 | Ghost Houses | Jessica Rudolph |
| 3406 | olympians-artemis-wild-goddess-of-the-hunt | 2025 | 2017 | isbn | 2025 | Olympians: Artemis - Wild Goddess of the Hunt | George O'Connor |
| 3934 | the-complete-book-of-dogs | 2025 | 2017 | isbn | 2025 | The Complete Book of Dogs | Rosie Pilbeam |
| 4563 | i-see-london-i-see-france | 2024 | 2017 | isbn | 2024 | I See London, I see France | Sarah Mlynowski |
| 4579 | just-a-girl | 2024 | 2017 | isbn | 2024 | Just a Girl | Carrie Mesrobian |
| 4595 | long-way-home | 2024 | 2017 | isbn | 2024 | Long Way Home | Katie McGarry |
| 4663 | recipe-for-hate | 2024 | 2017 | isbn | 2024 | Recipe for Hate | Warren Kinsella |
| 4789 | the-pain-eater | 2024 | 2017 | isbn | 2024 | The Pain Eater | Beth Goobie |
| 4831 | user | 2024 | 2017 | work | 2024 | User | Devin K. Grayson |
| 4981 | human-rights-in-focus-the-lgbt-community | 2024 | 2017 | isbn | 2024 | Human Rights in Focus: The LGBT Community | Damon Karson |
| 4986 | identify | 2024 | 2017 | isbn | 2024 | Identify | Lesley Choyce |
| 4987 | identifying-as-transgender | 2024 | 2017 | isbn | 2021 | Identifying as Transgender | Sara Woods |
| 5001 | lgbt-families-lesbian-gay-bisexual-and-transgender | 2024 | 2017 | isbn | 2024 | LGBT Families: Lesbian, Gay, Bisexual, and Transgender | Hilary W. Poole |
| 5198 | the-rules-and-regulations-for-mediating-myths-magic | 2024 | 2017 | isbn | 2024 | The Rules and Regulations for Mediating Myths & Magic | F.T. Lukens |
| 5232 | understanding-sexual-identity-and-orientation | 2024 | 2017 | isbn | 2024 | Understanding Sexual Identity and Orientation | Kris Hirschmann |
| 5823 | our-countrys-presidents-5th-ed-a-complete-encyclopedia-of-the-u-s-presidency | 2025 | 2017 | isbn | 2025 | Our Country's Presidents 5th Ed.: A Complete Encyclopedia of the U.S. Presidency | Ann Bausum |
| 5847 | pretty | 2025 | 2017 | work | 2025 | Pretty | Justin Sayre |
| 5867 | recuerda-aquella-vez | 2025 | 2017 | isbn | 2025 | Recuerda aquella vez | Adam Silvera |
| 5903 | sex-and-gender-a-reference-handbook | 2025 | 2017 | isbn | 2025 | Sex and Gender: A Reference Handbook | David E. Newton |
| 6086 | we-now-return-to-regular-life | 2025 | 2017 | isbn | 2021 | We Now Return to Regular Life | Martin Wilson |
| 10086 | critical-perspectives-on-sexual-harassment-and-gender-violence | 2024 | 2017 | isbn | 2024 | Critical Perspectives on Sexual Harassment and Gender Violence | Bridey Being |
| 1123 | brazen-rebel-ladies-who-rocked-the-world | 2025 | 2018 | isbn | 2022 | Brazen: Rebel Ladies Who Rocked the World | Pénélope Bagieu |
| 1132 | the-handsome-girl-and-her-beautiful-boy | 2025 | 2018 | isbn | 2021 | The Handsome Girl and Her Beautiful Boy | B. T. Gottfred |
| 1217 | a-sin-such-as-this | 2025 | 2018 | isbn | 2023 | A Sin Such As This | Ellen Hopkins |
| 1756 | beyond-gender-binaries-the-history-of-trans-intersex-and-third-gender-individuals | 2025 | 2018 | isbn | 2024 | Beyond Gender Binaries: The History of Trans, Intersex, and Third-Gender Individuals | Rita Santos |
| 1778 | confronting-lgbtq-discrimination | 2025 | 2018 | isbn | 2024 | Confronting LGBTQ+ Discrimination | Avery Elizabeth Hurt |
| 1942 | the-lgbt-rights-movement | 2025 | 2018 | work | 2024 | The LGBT Rights Movement | Pat Rarus |
| 1962 | transgender-rights-striving-for-equality | 2025 | 2018 | isbn | 2022 | Transgender Rights: Striving for Equality | The New York Times Editorial Staff |
| 2063 | as-she-fades | 2024 | 2018 | isbn | 2024 | As She Fades | Abbi Glines |
| 2135 | 9-days-and-9-nights | 2025 | 2018 | isbn | 2023 | 9 Days and 9 Nights | Katie Cotugno |
| 2429 | nothing-left-to-burn | 2025 | 2018 | isbn | 2023 | Nothing Left to Burn | Heather Ezell |
| 2643 | maestros | 2025 | 2018 | isbn | 2023 | Maestros | Steve Skroce |
| 2954 | burying-white-privilege-resurrecting-a-badass-christianity | 2025 | 2018 | isbn | 2025 | Burying White Privilege: Resurrecting a Badass Christianity | Miguel A. De La Torre |
| 2994 | coping-with-hate-and-intolerance | 2025 | 2018 | isbn | 2025 | Coping with Hate and Intolerance | Avery Elizabeth Hurt |
| 3136 | lgbt-discrimination | 2025 | 2018 | work | 2025 | LGBT Discrimination | Heidi Carolyn Feldman |
| 3152 | looking-at-privilege-and-power | 2025 | 2018 | isbn | 2025 | Looking at Privilege and Power | Kelly Glass |
| 3176 | male-privilege | 2025 | 2018 | isbn | 2025 | Male Privilege | Duchess Harris |
| 3180 | masculinity-in-the-twenty-first-century | 2025 | 2018 | isbn | 2025 | Masculinity in the Twenty-First Century | M.M. Eboch |
| 3198 | navigating-intersectionality-how-race-class-and-gender-overlap | 2025 | 2018 | isbn | 2025 | Navigating Intersectionality: How Race, Class, and Gender Overlap | Jamila Osman |
| 3216 | phoenix-goes-to-school-a-story-to-support-transgender-and-gender-diverse-children | 2025 | 2018 | isbn | 2021 | Phoenix Goes to School: A Story to Support Transgender and Gender Diverse Children | Michelle Finch |
| 3225 | racial-discrimination | 2025 | 2018 | isbn | 2025 | Racial Discrimination | Peggy J. Parks |
| 3277 | the-gender-identity-workbook-for-kids-a-guide-to-exploring-who-you-are | 2025 | 2018 | isbn | 2025 | The Gender Identity Workbook for Kids: A Guide to Exploring Who You Are | Kelly Storck |
| 3302 | transgender-activists-and-celebrities | 2025 | 2018 | isbn | 2022 | Transgender Activists and Celebrities | The New York Times Editorial Staff |
| 3320 | we-are-not-yet-equal-understanding-our-racial-divide | 2025 | 2018 | isbn | 2022 | We Are Not Yet Equal: Understanding Our Racial Divide | Carol Anderson |
| 3335 | when-they-call-you-a-terrorist-young-adult-edition-a-story-of-black-lives-matter-and-the-power-to-change-the-world | 2025 | 2018 | isbn | 2022 | When They Call You a Terrorist (Young Adult Edition): A Story of Black Lives Matter and the Power to Change the World | Patrisse Khan-Cullors |
| 3350 | zoom-in-on-equality | 2025 | 2018 | isbn | 2025 | Zoom in on Equality | Heather Moore Niver |
| 3444 | ancient-egypt | 2025 | 2018 | isbn | 2025 | Ancient Egypt | Anita Ganeri |
| 3896 | screenshot | 2025 | 2018 | isbn | 2025 | Screenshot | Donna Cooner |
| 4147 | classical-mythology-myths-and-legends-of-the-ancient-world | 2025 | 2018 | isbn | 2025 | Classical Mythology: Myths and Legends of the Ancient World | Nathaniel Hawthorne |
| 4175 | edward-hopper-a-modern-master | 2025 | 2018 | isbn | 2022 | Edward Hopper: A Modern Master | Ita G. Berkow |
| 4221 | i-too-sing-america-the-harlem-renaissance-at-100 | 2025 | 2018 | isbn | 2025 | I Too Sing America: The Harlem Renaissance at 100 | Wil Haygood |
| 4519 | dogchild | 2024 | 2018 | isbn | 2024 | Dogchild | Kevin Brooks |
| 4621 | my-hero-academia-vigilantes-vol-1 | 2024 | 2018 | isbn | 2024 | My Hero Academia, Vigilantes Vol. 1 | Hideyuki Furuhashi |
| 4647 | plague-land | 2024 | 2018 | isbn | 2024 | Plague Land | Alex Scarrow |
| 4793 | the-rising-gold | 2024 | 2018 | isbn | 2024 | The Rising Gold | Ava Jae |
| 4797 | the-stan | 2024 | 2018 | work | 2024 | The Stan | Kevin Knodell |
| 4853 | wilder | 2024 | 2018 | isbn | 2023 | Wilder | Andrew Simonet |
| 4891 | losers-bracket | 2025 | 2018 | isbn | 2025 | Losers Bracket | Chris Crutcher |
| 4931 | bleach-vol-23 | 2024 | 2018 | isbn | 2022 | Bleach, Vol. 23 | Tite Kubo |
| 5004 | lgbtq-the-survival-guide-for-lesbian-gay-bisexual-transgender-and-questioning-teens | 2024 | 2018 | isbn | 2024 | LGBTQ: The Survival Guide for Lesbian, Gay, Bisexual, Transgender, and Questioning Teens | Kelly Huegel |
| 5072 | queer-as-a-five-dollar-bill-what-if-you-knew-a-secret-from-history-that-could-change-the-world | 2024 | 2018 | isbn | 2024 | Queer as a Five-Dollar Bill: What if You Knew a Secret from History that Could Change the World? | Lee Wind |
| 5090 | representing-the-rainbow-in-young-adult-literature-lgbtq-content-since-1969 | 2024 | 2018 | isbn | 2024 | Representing the Rainbow in Young Adult Literature: LGBTQ+ Content Since 1969 | Christine A. Jenkins |
| 5100 | self-ish-a-transgender-awakening | 2024 | 2018 | isbn | 2022 | SELF-ish: A Transgender Awakening | Chloe Schwenke |
| 5226 | transgender-health-issues | 2024 | 2018 | isbn | 2024 | Transgender Health Issues | Sarah Boslaugh |
| 5380 | a-mouth-is-always-muzzled-six-dissidents-five-continents-and-the-art-of-resistance | 2024 | 2018 | isbn | 2024 | A Mouth is Always Muzzled: Six Dissidents, Five Continents, and the Art of Resistance | Natalie Hopkinson |
| 5394 | a-warp-in-time | 2024 | 2018 | isbn | 2024 | A Warp in Time | Jude Watson |
| 5433 | animation-and-presentation-from-scratch-an-augmented-reading-experience | 2024 | 2018 | isbn | 2024 | Animation and Presentation From Scratch: An Augmented Reading Experience | Rachel Ziter |
| 5493 | coding-in-scratch-for-beginners | 2024 | 2018 | isbn | 2024 | Coding in Scratch for Beginners | Rachel Ziter |
| 5573 | flawed | 2024 | 2018 | work | 2022 | Flawed | Andrea Dorfman |
| 5731 | lifeblood | 2025 | 2018 | isbn | 2023 | Lifeblood | Gena Showalter |
| 10100 | the-leading-edge-of-now | 2024 | 2018 | isbn | 2024 | The Leading Edge of Now | Marci Lyn Curtis |
| 1199 | trans-love-sex-romance-and-being-you | 2025 | 2019 | isbn | 2022 | Trans+: Love, Sex, Romance, and Being You | Kathryn Gonzales |
| 1203 | sissy-a-coming-of-gender-story | 2025 | 2019 | isbn | 2024 | Sissy: A Coming of Gender Story | Jacob Tobia |
| 1214 | pride-championing-lgbtq-rights | 2024 | 2019 | isbn | 2024 | #Pride: Championing LGBTQ Rights | Rebecca Felix |
| 1370 | being-transgender-in-america | 2025 | 2019 | isbn | 2024 | Being Transgender in America | Duchess Harris |
| 1382 | freeing-finch | 2025 | 2019 | isbn | 2024 | Freeing Finch | Ginny Rorby |
| 1385 | growing-up-lgbtq | 2025 | 2019 | isbn | 2024 | Growing Up LGBTQ | Duchess Harris |
| 1389 | lgbtq-discrimination-in-america | 2025 | 2019 | isbn | 2024 | LGBTQ Discrimination in America | Duchess Harris |
| 1396 | some-girls-bind | 2025 | 2019 | isbn | 2024 | Some Girls Bind | R James |
| 1402 | understanding-gender | 2025 | 2019 | work | 2021 | Understanding Gender | Juno Dawson |
| 1443 | cold-day-in-the-sun | 2025 | 2019 | isbn | 2023 | Cold Day in the Sun | Sara L. Biren |
| 1450 | gravity | 2025 | 2019 | isbn | 2022 | Gravity | Sarah Deming |
| 1642 | the-talk-conversations-about-race-love-and-truth | 2025 | 2019 | isbn | 2022 | The Talk: Conversations about Race, Love and Truth | Wade Hudson |
| 1710 | the-meaning-of-birds | 2025 | 2019 | isbn | 2021 | The Meaning of Birds | Jaye Robin Brown |
| 1782 | coping-with-gender-fluidity | 2025 | 2019 | isbn | 2024 | Coping with Gender Fluidity | Stephanie Lundquist-Arora |
| 1804 | gender-identity-beyond-pronouns-and-bathrooms | 2025 | 2019 | isbn | 2022 | Gender Identity: Beyond Pronouns and Bathrooms | Maria Cook |
| 1810 | gender-in-the-21st-century | 2025 | 2019 | isbn | 2023 | Gender in the 21st Century | M.M. Eboch |
| 1852 | lgbtq-service-in-the-armed-forces | 2025 | 2019 | isbn | 2024 | LGBTQ Service in the Armed Forces | Duchess Harris |
| 1908 | seeing-gender-an-illustrated-guide-to-identity-and-expression | 2025 | 2019 | isbn | 2022 | Seeing Gender: An Illustrated Guide to Identity and Expression | Iris Gottlieb |
| 1975 | you-be-you-a-kids-guide-to-gender-sexuality-and-family | 2025 | 2019 | isbn | 2024 | You Be You!: A Kid's Guide to Gender, Sexuality, and Family | Jonathan Branfman |
| 2092 | i-am-water | 2024 | 2019 | isbn | 2022 | I Am Water | Meg Specksgoor |
| 2095 | lgbt-intolerance | 2024 | 2019 | isbn | 2024 | LGBT Intolerance | A.W. Buckey |
| 2139 | a-question-of-holmes | 2025 | 2019 | isbn | 2023 | A Question of Holmes | Brittany Cavallaro |
| 2161 | all-for-one | 2025 | 2019 | isbn | 2023 | All for One | Melissa de la Cruz |
| 2257 | dough-boys | 2025 | 2019 | isbn | 2025 | Dough Boys | Paula Chase |
| 2850 | blacklivesmatter-protesting-racism | 2025 | 2019 | isbn | 2021 | #BlackLivesMatter: Protesting Racism | Rachael L. Thomas |
| 3120 | intersectionality-and-identity-politics | 2025 | 2019 | isbn | 2025 | Intersectionality and Identity Politics | M.M. Eboch |
| 3243 | she-he-they-me-for-the-sisters-misters-and-binary-resisters | 2025 | 2019 | isbn | 2022 | She/He/They/Me: For the Sisters, Misters, and Binary Resisters | Robyn Ryle |
| 3245 | skate-for-your-life | 2025 | 2019 | isbn | 2025 | Skate for Your Life | Leo Baker |
| 3274 | the-fight-for-lgbtq-rights | 2025 | 2019 | isbn | 2025 | The Fight for LGBTQ+ Rights | Devlin Smith |
| 3329 | what-makes-you-beautiful | 2025 | 2019 | work | 2025 | What Makes You Beautiful | Bridget Liang |
| 3332 | whats-gender-identity | 2025 | 2019 | work | 2023 | What's Gender Identity? | Katie Kawa |
| 4047 | virtue-vengeance | 2025 | 2019 | isbn | 2025 | Virtue & Vengeance | Tomi Adeyemi |
| 4603 | making-a-play | 2024 | 2019 | work | 2022 | Making a Play | Abbi Glines |
| 4679 | season-of-the-witch | 2024 | 2019 | work | 2023 | Season of the Witch | Sara Rees Brennan |
| 4914 | a-high-five-for-glenn-burke | 2024 | 2019 | isbn | 2023 | A High Five for Glenn Burke | Phil Bildner |
| 4937 | can-we-achieve-gender-equality | 2024 | 2019 | isbn | 2024 | Can We Achieve Gender Equality | Kevin Cunningham |
| 4951 | double-challenge-being-lgbtq-and-a-minority | 2024 | 2019 | isbn | 2024 | Double Challenge: Being LGBTQ and a Minority | Rebecca Kaplan |
| 4982 | i-new-and-selected-poems | 2024 | 2019 | isbn | 2024 | I: New and Selected Poems | Toi Derricotte |
| 5003 | lgbtq-without-borders-international-life | 2024 | 2019 | isbn | 2024 | LGBTQ Without Borders: International Life | Jeremy Quist |
| 5034 | never-contented-things | 2024 | 2019 | isbn | 2024 | Never-Contented Things | Sarah Porter |
| 5066 | pride-the-lgbtq-rights-movement-a-photographic-journey | 2024 | 2019 | isbn | 2024 | Pride: The LGBTQ+ Rights Movement: A Photographic Journey | Christopher Measom |
| 5120 | sorted-growing-up-coming-out-and-finding-my-place | 2024 | 2019 | isbn | 2021 | Sorted: Growing Up, Coming Out, and Finding My Place | Jackson Bird |
| 5184 | the-lost-coast | 2024 | 2019 | isbn | 2024 | The Lost Coast | A. R. Capetta |
| 5252 | when-youre-ready-coming-out | 2024 | 2019 | isbn | 2024 | When You're Ready: Coming Out | Katherine Lacaze |
| 5264 | you-are-not-alone-finding-your-lgbtq-community | 2024 | 2019 | isbn | 2024 | You Are Not Alone: Finding Your LGBTQ Community | Jeremy Quist |
| 5328 | light-it-up | 2025 | 2019 | isbn | 2022 | Light It Up | Kekla Magoon |
| 5342 | metoo-unveiling-abuse | 2024 | 2019 | isbn | 2024 | #MeToo: Unveiling Abuse | Megan Borgert-Spaniol |
| 5344 | womensmarch-insisting-on-equality | 2024 | 2019 | isbn | 2024 | #WomensMarch: Insisting on Equality | Rebecca Felix |
| 5505 | deadly-little-scandals | 2024 | 2019 | isbn | 2024 | Deadly Little Scandals | Jennifer Lynn Barnes |
| 5507 | dealing-with-teen-pregnancy | 2024 | 2019 | isbn | 2024 | Dealing with Teen Pregnancy | Kristin Thiel |
| 5517 | dr-buenavista-look | 2024 | 2019 | work | 2024 | Dr. Buenavista, Look | Enric Jardí |
| 5695 | invisible-heroes-of-world-war-ii-extraordinary-wartime-stories-of-ordinary-people | 2024 | 2019 | isbn | 2024 | Invisible Heroes of World War II: Extraordinary Wartime Stories of Ordinary People | Jerry Borrowman |
| 5893 | santiagos-road-home | 2025 | 2019 | isbn | 2024 | Santiago's Road Home | Alexandra Diaz |
| 9026 | the-syndicate | 2024 | 2019 | isbn | 2024 | The Syndicate | Teshelle Combs |
| 9071 | by-any-means-necessary | 2024 | 2019 | isbn | 2024 | By Any Means Necessary | Cam Montgomery |
| 9243 | a-veil-removed | 2024 | 2019 | isbn | 2024 | A Veil Removed | Michelle Cox |
| 9656 | weirdo-series-extra-weird | 2024 | 2019 | isbn | 2021 | WeirDo Series: Extra Weird! | Anh Do |
| 9665 | weirdo-series-super-weird | 2024 | 2019 | isbn | 2021 | WeirDo Series: Super Weird! | Anh Do |
| 9806 | the-paris-project | 2024 | 2019 | isbn | 2024 | The Paris Project | Donna Gephart |
| 1171 | lightbringer | 2025 | 2020 | isbn | 2023 | Lightbringer | Claire Legrand |
| 1423 | gender-identity | 2024 | 2020 | isbn | 2021 | Gender Identity | Char Light |
| 1762 | blood-sport | 2025 | 2020 | isbn | 2021 | Blood Sport | Tash McAdam |
| 1822 | identity-a-story-of-transitioning | 2025 | 2020 | isbn | 2021 | Identity: A Story of Transitioning | Corey Maison |
| 1874 | middle-schools-a-drag-you-better-werk | 2025 | 2020 | isbn | 2021 | Middle School's a Drag, You Better Werk! | Greg Howard |
| 1896 | queerfully-and-wonderfully-made-a-guide-for-lgbtq-christian-teens | 2025 | 2020 | isbn | 2025 | Queerfully and Wonderfully Made: A Guide for LGBTQ+ Christian Teens | Leigh Finke |
| 1900 | rainbow-revolutionaries-fifty-lgbtq-people-who-made-history | 2025 | 2020 | isbn | 2021 | Rainbow Revolutionaries: Fifty LGBTQ+ People Who Made History | Sarah Prager |
| 1916 | she-he-they-them-understanding-gender-identity | 2025 | 2020 | isbn | 2024 | She He They Them: Understanding Gender Identity | Rebecca Stanborough |
| 2044 | the-big-questions-book-of-sex-and-consent | 2025 | 2020 | isbn | 2022 | The Big Questions Book of Sex and Consent | Donna Freitas |
| 2097 | lgbtq-in-america | 2024 | 2020 | isbn | 2023 | LGBTQ In America | Barbara Sheen |
| 2165 | all-the-pretty-things | 2025 | 2020 | isbn | 2023 | All the Pretty Things | Emily Arsenault |
| 2303 | golden-arm | 2025 | 2020 | isbn | 2025 | Golden Arm | Carl Deuker |
| 2493 | rules-for-being-a-girl | 2025 | 2020 | isbn | 2025 | Rules for Being a Girl | Candace Bushnell |
| 2880 | activist-athletes-when-sports-and-politics-mix | 2025 | 2020 | isbn | 2025 | Activist Athletes: When Sports and Politics Mix | The New York Times Editorial Staff |
| 2906 | ap-q-a-psychology-600-questions-and-answers | 2025 | 2020 | isbn | 2025 | AP Q&A Psychology: 600 Questions and Answers | Robert McEntarffer |
| 2918 | auntie-uncle-drag-queen-hero | 2025 | 2020 | isbn | 2025 | Auntie Uncle: Drag Queen Hero | Ellie Royce |
| 2926 | be-amazing-a-history-of-pride | 2025 | 2020 | isbn | 2025 | Be Amazing: A History of Pride | Desmond Napoles |
| 3028 | equality-social-justice-and-our-future | 2025 | 2020 | isbn | 2025 | Equality, Social Justice and Our Future | Sabrina Adams |
| 3096 | how-to-they-them-a-visual-guide-to-nonbinary-pronouns-and-the-world-of-gender-fluidity | 2025 | 2020 | isbn | 2025 | How to They/Them: A Visual Guide to Nonbinary Pronouns and the World of Gender Fluidity | Stuart Getty |
| 3150 | long-time-coming-reckoning-with-race-in-america | 2025 | 2020 | isbn | 2025 | Long Time Coming: Reckoning with Race in America | Michael Eric Dyson |
| 3231 | rainbow-village-a-story-to-help-children-celebrate-diversity | 2025 | 2020 | isbn | 2025 | Rainbow Village: A Story to Help Children Celebrate Diversity | Emmi Smid |
| 3242 | shes-my-dad-a-story-for-children-who-have-a-transgender-parent-or-relative | 2025 | 2020 | isbn | 2024 | She's My Dad!: A Story for Children Who Have a Transgender Parent or Relative | Sarah Savage |
| 3255 | sylvia-and-marsha-start-a-revolution-the-story-of-the-trans-women-of-color-who-made-lgbtq-history | 2025 | 2020 | isbn | 2025 | Sylvia and Marsha Start a Revolution!: The Story of the Trans Women of Color Who Made LGBTQ+ History | Joy Michael Ellison |
| 3271 | the-every-body-book-the-lgbtq-inclusive-guide-for-kids-about-sex-gender-bodies-and-families | 2025 | 2020 | isbn | 2025 | The Every Body Book: The LGBTQ+ Inclusive Guide for Kids about Sex, Gender, Bodies and Families | Rachel E. Simon |
| 3397 | dragon-ball-vol-9 | 2025 | 2020 | work | 2023 | Dragon Ball, Vol. 9 | Akira Toriyama |
| 3700 | free-to-be-me-an-lgbtq-journal-of-love-pride-and-finding-your-inner-rainbow | 2025 | 2020 | isbn | 2025 | Free To Be Me: An LGBTQ+ Journal of Love, Pride and Finding Your Inner Rainbow | Dom & Ink |
| 3780 | kent-state | 2025 | 2020 | isbn | 2025 | Kent State | Deborah Wiles |
| 4119 | blue-period-vol-5 | 2025 | 2020 | work | 2025 | Blue Period, Vol. 5 | Tsubasa Yamaguchi |
| 4375 | the-daughters-of-ys | 2025 | 2020 | isbn | 2022 | The Daughters of Ys | M. T. Anderson |
| 4436 | troy-the-greek-myths-reimagined | 2025 | 2020 | isbn | 2025 | Troy: The Greek Myths Reimagined | Stephen Fry |
| 4541 | guantanamo-voices-true-accounts-from-the-worlds-infamous-prison | 2024 | 2020 | isbn | 2024 | Guantanamo Voices: True Accounts from the World's Infamous Prison | Sarah Mirk |
| 4643 | path-of-night | 2024 | 2020 | isbn | 2024 | Path of Night | Sara Rees Brennan |
| 4683 | send-pics | 2024 | 2020 | isbn | 2023 | Send Pics | Lauren McLaughlin |
| 4993 | into-the-real | 2024 | 2020 | isbn | 2021 | Into the Real | Z Brewer |
| 5002 | lgbtq-rights-and-activism | 2024 | 2020 | work | 2023 | LGBTQ Rights and Activism | Stephen Currie |
| 5005 | lgbtq-discrimination | 2024 | 2020 | isbn | 2024 | LGBTQ+ Discrimination | Rachael Morlock |
| 5074 | queerstory-an-infographic-history-of-the-fight-for-lgbtq-rights | 2024 | 2020 | isbn | 2024 | Queerstory: An Infographic History of the Fight for LGBTQ+ Rights | Linda Riley |
| 5116 | somebody-told-me | 2024 | 2020 | work | 2022 | Somebody Told Me | Mia Siegert |
| 5236 | violence-against-the-lgbtq-community | 2024 | 2020 | work | 2024 | Violence Against the LGBTQ Community | Hal Marcovitz |
| 5248 | when-light-shatters | 2024 | 2020 | work | 2024 | When Light Shatters | Laney Wylde |
| 5269 | you-dont-live-here | 2024 | 2020 | isbn | 2023 | You Don't Live Here | Robyn Schneider |
| 5288 | hate-crime-in-america-from-prejudice-to-violence | 2024 | 2020 | isbn | 2024 | Hate Crime in America: From Prejudice to Violence | Danielle Smith-Llera |
| 5569 | finding-your-identity | 2024 | 2020 | isbn | 2024 | Finding Your Identity | Kate Morrow |
| 5623 | healthy-romantic-relationships | 2024 | 2020 | isbn | 2024 | Healthy Romantic Relationships | Alexis Burling |
| 6048 | this-light-between-us | 2025 | 2020 | isbn | 2025 | This Light Between Us | Andrew Xia Fukuda |
| 6068 | understanding-reproductive-health | 2025 | 2020 | isbn | 2025 | Understanding Reproductive Health | Jeanne Marie Ford |
| 6115 | who-was-harvey-milk | 2025 | 2020 | isbn | 2023 | Who Was Harvey Milk? | Corinne Grinapol |
| 1694 | stamped-for-kids-racism-antiracism-and-you | 2024 | 2021 | isbn | 2022 | Stamped (For Kids): Racism, Antiracism, and You | Jason Reynolds; Ibram X. Kendi; Sonja Cherry-Paul; Rachelle Baker |
| 1704 | juliet-takes-a-breath-the-graphic-novel | 2025 | 2021 | isbn | 2023 | Juliet Takes a Breath: The Graphic Novel | Gabby Rivera |
| 1772 | boys-run-the-riot-vol-4 | 2025 | 2021 | isbn | 2024 | Boys Run the Riot, Vol. 4 | Keito Gaku |
| 1888 | people-of-pride-25-great-lgbto-americans | 2025 | 2021 | isbn | 2024 | People of Pride: 25 Great LGBTO Americans | Chase Clemesha |
| 1934 | the-un-popular-vote | 2025 | 2021 | isbn | 2022 | The (Un)Popular Vote | Jasper Sanchez |
| 2059 | i-am-margaret-moore | 2025 | 2021 | isbn | 2023 | I Am Margaret Moore | Hannah Capin |
| 2101 | rising-out | 2024 | 2021 | isbn | 2022 | Rising Out | M. Azmitia |
| 2437 | one-great-lie | 2025 | 2021 | isbn | 2023 | One Great Lie | Deb Caletti |
| 2604 | the-wish | 2025 | 2021 | isbn | 2025 | The Wish | Nicholas Sparks |
| 2626 | when-we-make-it-a-nuyorican-novel | 2024 | 2021 | isbn | 2023 | When We Make It: A Nuyorican Novel | Elisabet Velasquez |
| 2665 | friends-forever | 2025 | 2021 | isbn | 2022 | Friends Forever | Shannon Hale |
| 2864 | a-history-of-racism-in-america | 2025 | 2021 | isbn | 2025 | A History of Racism in America | Craig E. Blohm |
| 2916 | atrocities-in-action | 2025 | 2021 | work | 2025 | Atrocities in Action | Kevin P. Winn |
| 2940 | black-nerd-problems-essays | 2025 | 2021 | isbn | 2025 | Black Nerd Problems: Essays | William Evans |
| 3072 | growing-up-trans-in-our-own-words | 2025 | 2021 | isbn | 2025 | Growing Up Trans: In Our Own Words | Lindsay Herriot |
| 3090 | how-can-i-be-an-ally | 2025 | 2021 | work | 2025 | How Can I Be An Ally | El-Mekki Fatima |
| 3126 | it-doesnt-have-to-be-awkward-dealing-with-relationships-consent-and-other-hard-to-talk-about-stuff | 2025 | 2021 | isbn | 2022 | It Doesn't Have to Be Awkward: Dealing with Relationships, Consent, and Other Hard-to-Talk-About Stuff | Drew Pinsky |
| 3222 | puberty-is-gross-but-also-really-awesome | 2025 | 2021 | isbn | 2022 | Puberty is Gross but Also Really Awesome | Gina Loveless |
| 3253 | stars-in-their-eyes | 2025 | 2021 | isbn | 2025 | Stars in their Eyes | Jessica Walton |
| 3285 | the-racial-justice-movement | 2025 | 2021 | isbn | 2025 | The Racial Justice Movement | Kara L. Laughlin |
| 3327 | what-is-the-black-lives-matter-movement | 2025 | 2021 | isbn | 2025 | What is the Black Lives Matter Movement? | Hendreich Nichols |
| 3328 | what-is-white-privilege | 2025 | 2021 | isbn | 2025 | What Is White Privilege? | Leigh Ann Erickson |
| 3344 | with-honor-and-integrity-transgender-troops-in-their-own-words | 2025 | 2021 | isbn | 2025 | With Honor and Integrity: Transgender Troops in Their Own Words | Máel Embser-Herbert |
| 3718 | going-viral-a-socially-distant-love-story | 2025 | 2021 | isbn | 2023 | Going Viral: A Socially Distant Love Story | Katie Cicatelli-Kuc |
| 4117 | black-art-a-cultural-history | 2025 | 2021 | isbn | 2025 | Black Art: A Cultural History | Richard J. Powell |
| 4201 | greek-myths-a-new-retelling | 2025 | 2021 | isbn | 2025 | Greek Myths: A New Retelling | Charlotte Higgins |
| 4281 | moriarty-the-patriot-vol-3 | 2025 | 2021 | isbn | 2025 | Moriarty the Patriot, Vol. 3 | Ryosuke Takeuchi |
| 4343 | sleeping-beauties-vol-1 | 2025 | 2021 | work | 2025 | Sleeping Beauties, Vol. 1 | Rio Youers |
| 4927 | before-we-were-blue | 2024 | 2021 | isbn | 2024 | Before We Were Blue | E. J. Schwartz |
| 4943 | confessions-of-a-teenage-drag-king | 2024 | 2021 | isbn | 2024 | Confessions of a Teenage Drag King | Markus Harwood-Jones |
| 4961 | follow-your-arrow | 2024 | 2021 | isbn | 2022 | Follow Your Arrow | Jessica Verdi |
| 4965 | frio-cae-blanco | 2024 | 2021 | isbn | 2024 | Frío cae blanco | Gabrielle Prendergast |
| 4984 | im-a-wild-seed-my-graphic-memoir-on-queerness-and-decolonizing-the-world | 2024 | 2021 | isbn | 2022 | I'm a Wild Seed: My Graphic Memoir on Queerness and Decolonizing the World | Sharon Lee De La Cruz |
| 5007 | like-other-girls | 2024 | 2021 | isbn | 2023 | Like Other Girls | Britta Lundin |
| 5032 | needlework | 2024 | 2021 | isbn | 2024 | Needlework | Julia Watts |
| 5042 | on-top-of-glass-my-stories-as-a-queer-girl-in-figure-skating | 2024 | 2021 | isbn | 2024 | On Top of Glass: My Stories as a Queer Girl in Figure Skating | Karina Manta |
| 5124 | stand-up-for-lgbtq-rights | 2024 | 2021 | work | 2024 | Stand Up for LGBTQ rights | Don Nardo |
| 5180 | the-key-to-you-and-me | 2024 | 2021 | isbn | 2022 | The Key to You and Me | Jaye Robin Brown |
| 5294 | jacobs-school-play-starring-he-she-and-they | 2024 | 2021 | isbn | 2024 | Jacob's School Play: Starring He, She, and They | Ian Hoffman |
| 5450 | bad-girls-never-say-die | 2024 | 2021 | isbn | 2024 | Bad Girls Never Say Die | Jennifer Mathieu |
| 5467 | body-image-and-dysmorphia | 2024 | 2021 | isbn | 2024 | Body Image and Dysmorphia | A.W. Buckey |
| 5516 | donald-trump | 2024 | 2021 | work | 2024 | Donald Trump | Alex Monroe |
| 5589 | girl-on-the-line | 2024 | 2021 | isbn | 2022 | Girl on the Line | Faith Gardner |
| 5871 | remote-control | 2025 | 2021 | isbn | 2025 | Remote Control | Nnedi Okorafor |
| 5954 | the-curse-of-the-mummy-uncovering-tutankhamuns-tomb | 2025 | 2021 | isbn | 2025 | The Curse of the Mummy: Uncovering Tutankhamun's Tomb | Candace Fleming |
| 1162 | cold | 2025 | 2022 | isbn | 2024 | Cold | Mariko Tamaki |
| 1264 | arden-grey | 2025 | 2022 | isbn | 2024 | Arden Grey | Ray Stoeve |
| 1298 | howl | 2025 | 2022 | isbn | 2024 | Howl | Shaun David Hutchinson |
| 1324 | serendipity-ten-romantic-tropes-transformed | 2025 | 2022 | isbn | 2024 | Serendipity: Ten Romantic Tropes Transformed | Marissa Meyer |
| 1383 | galaxy-the-prettiest-star | 2025 | 2022 | isbn | 2024 | Galaxy: The Prettiest Star | Jadzia Axelrod |
| 1398 | the-best-liars-in-riverview | 2025 | 2022 | isbn | 2024 | The Best Liars in Riverview | Lin Thompson |
| 1419 | kingdom-of-the-feared | 2024 | 2022 | work | 2024 | Kingdom of the Feared | Kerri Maniscalco |
| 1748 | beating-heart-baby | 2025 | 2022 | isbn | 2024 | Beating Heart Baby | Min. Lio |
| 1754 | better-than-we-found-it-conversations-to-help-save-the-world | 2025 | 2022 | isbn | 2024 | Better Than We Found It: Conversations to Help Save the World | Joseph. Frederick |
| 1918 | sir-callie-and-the-champions-of-helston | 2025 | 2022 | isbn | 2024 | Sir Callie and the Champions of Helston | Esme Symcs-Smilh |
| 1945 | the-one-true-me-and-you | 2025 | 2022 | isbn | 2024 | The One True Me and You | Remi K. England |
| 1953 | the-talk | 2025 | 2022 | isbn | 2025 | The Talk | Alicia Williams |
| 2036 | brave-new-world-a-graphic-novel | 2025 | 2022 | isbn | 2025 | Brave New World: A Graphic Novel | Aldous Huxley; Fred Fordham |
| 2107 | speak-up | 2024 | 2022 | isbn | 2024 | Speak Up! | Rebecca Burgess |
| 2695 | adrift | 2024 | 2022 | isbn | 2024 | Adrift | Tanya Guerrero |
| 2700 | hear-me | 2024 | 2022 | isbn | 2024 | Hear Me | Kerry O'Malley Cerra |
| 2707 | over-and-out | 2024 | 2022 | isbn | 2024 | Over and Out | Jenni L. Walsh |
| 2708 | remember-me-gone | 2024 | 2022 | isbn | 2024 | Remember Me Gone | Stacy Stokes |
| 2710 | ride-on | 2024 | 2022 | isbn | 2024 | Ride On | Faith Erin Hicks |
| 2759 | some-kind-of-hate | 2024 | 2022 | isbn | 2024 | Some Kind of Hate | Sarah Darer Littman |
| 2952 | brown-enough-true-stories-about-love-violence-the-student-loan-crisis-hollywood-race-familia-and-making-it-in-america | 2025 | 2022 | isbn | 2025 | Brown Enough: True Stories about Love, Violence, the Student Loan Crisis - Hollywood, Race, Familia, and Making it in America | Christopher Rivas |
| 2970 | chefs-kiss | 2025 | 2022 | isbn | 2025 | Chef's Kiss | J.J. Alexander |
| 3002 | cramm-this-book-so-you-know-wtf-is-going-on-in-the-world-today | 2025 | 2022 | isbn | 2025 | Cramm This Book: So You Know WTF Is Going On in the World Today | Olivia Seltzer |
| 3014 | dismantling-global-white-privilege-equity-for-a-post-western-world | 2025 | 2022 | isbn | 2025 | Dismantling Global White Privilege: Equity for a Post-Western World | Chandran Nai |
| 3116 | if-youre-a-kid-like-gavin-the-true-story-of-a-young-trans-activist | 2025 | 2022 | isbn | 2024 | If You're a Kid Like Gavin: The True Story of a Young Trans Activist | Gavin Grimm |
| 3172 | m-is-for-monster | 2025 | 2022 | isbn | 2025 | M is for Monster | Talia Dutton |
| 3195 | my-own-way-celebrating-gender-freedom-for-kids | 2025 | 2022 | isbn | 2025 | My Own Way: Celebrating Gender Freedom for Kids | Joana Estrela; Jay Hulme |
| 3213 | paydens-pronoun-party | 2025 | 2022 | isbn | 2025 | Payden's Pronoun Party | Blue Jaryn |
| 3215 | phoenix-gets-greater | 2025 | 2022 | isbn | 2025 | Phoenix Gets Greater | Marty Wilson-Trudeau |
| 3217 | pink-blue-and-you-questions-for-kids-about-gender-stereotypes | 2025 | 2022 | isbn | 2025 | Pink, Blue, and You! Questions for Kids about Gender Stereotypes | Elise Gravel; Mykaell Blais |
| 3224 | racial-bias-is-change-possible | 2025 | 2022 | isbn | 2025 | Racial Bias: Is Change Possible? | Barbara Diggs |
| 3235 | riley-reynolds-crushes-costume-day | 2025 | 2022 | isbn | 2025 | Riley Reynolds Crushes Costume Day | Jay Albee |
| 3260 | the-antiracism-handbook-practical-tools-to-shift-your-mindset-and-uproot-racism-in-your-life-and-community | 2025 | 2022 | isbn | 2025 | The Antiracism Handbook: Practical Tools to Shift Your Mindset and Uproot Racism in Your Life and Community | Thema Bryant |
| 3261 | the-antiracist-kid-a-book-about-identity-justice-and-activism | 2025 | 2022 | isbn | 2025 | The Antiracist Kid: A Book About Identity, Justice, and Activism | Tiffany Jewell |
| 3282 | the-one-who-loves-you-the-most | 2025 | 2022 | work | 2025 | The One Who Loves You the Most | Medina |
| 3293 | the-truth-about-white-lies | 2025 | 2022 | isbn | 2025 | The Truth About White Lies | Olivia A. Cole |
| 3306 | true-you-a-gender-joumey | 2025 | 2022 | isbn | 2025 | True You: A Gender Joumey | Gwen Agna |
| 3348 | you-ology-a-puberty-guide-for-every-body | 2025 | 2022 | isbn | 2025 | You-ology: A Puberty Guide for Every Body | Melisa Holmes |
| 3382 | we-survived-the-holocaust-the-bluma-and-felix-goldberg-story | 2024 | 2022 | isbn | 2024 | We Survived the Holocaust: The Bluma and Felix Goldberg Story | Frank W. Baker |
| 4345 | sleeping-beauties-vol-2 | 2025 | 2022 | work | 2025 | Sleeping Beauties, Vol. 2 | Rio Youers |
| 4452 | witches-the-complete-collection | 2025 | 2022 | isbn | 2025 | Witches: The Complete Collection | Daisuke Igarashi |
| 4467 | you-know-sex-bodies-gender-puberty-and-other-things | 2025 | 2022 | isbn | 2025 | You Know, Sex - Bodies, Gender, Puberty and Other Things! | Cory Silverberg |
| 4777 | the-last-field-party | 2024 | 2022 | isbn | 2024 | The Last Field Party | Abbi Glines |
| 4917 | aces-wild-a-heist | 2024 | 2022 | isbn | 2024 | Aces Wild: A Heist | Amanda DeWitt |
| 4924 | asexual | 2024 | 2022 | work | 2024 | Asexual | Jeremy Quist |
| 4930 | bisexual-and-pansexual | 2024 | 2022 | isbn | 2024 | Bisexual and Pansexual | Lara Stewart Manetta |
| 4950 | dig-two-graves | 2024 | 2022 | work | 2024 | Dig Two Graves | Gretchen McNeil |
| 4953 | drizzle-dreams-and-lovestruck-things | 2024 | 2022 | work | 2024 | Drizzle, Dreams, and Lovestruck Things | Maya Prasad |
| 4969 | gender-expansive | 2024 | 2022 | isbn | 2024 | Gender Expansive | Jeremy Quist |
| 4992 | intersex | 2024 | 2022 | work | 2024 | Intersex | Jeremy Quist |
| 5017 | male-to-female-transgender-and-transfeminine-identities | 2024 | 2022 | isbn | 2024 | Male To Female Transgender and Transfeminine Identities | Rin Ryan |
| 5020 | melt-with-you | 2024 | 2022 | isbn | 2024 | Melt With You | Jennifer Dugan |
| 5052 | pauli-murray-the-life-of-a-pioneering-feminist-and-civil-rights-activist | 2024 | 2022 | isbn | 2024 | Pauli Murray: The Life of a Pioneering Feminist and Civil Rights Activist | Rosita Stevens-Holsey |
| 5064 | polyamorous | 2024 | 2022 | work | 2024 | Polyamorous | Sarah Lorenz-Coryell |
| 5092 | right-where-i-left-you | 2024 | 2022 | isbn | 2024 | Right Where I Left You | Julian Winters |
| 5196 | the-real-riley-mayes | 2024 | 2022 | isbn | 2023 | The Real Riley Mayes | Rachel Elliott |
| 5276 | build-strong-communities-the-power-of-empathy-and-respect | 2024 | 2022 | isbn | 2024 | Build Strong Communities: The Power of Empathy and Respect | Maribel Valdez Gonzalez |
| 5280 | confessions-of-an-alleged-good-girl | 2024 | 2022 | isbn | 2024 | Confessions of An Alleged Good Girl | Joya Goffney |
| 5308 | sylvia-rivera | 2024 | 2022 | isbn | 2024 | Sylvia Rivera | Kaitlyn Duling |
| 5324 | yes-no-a-first-conversation-about-consent | 2024 | 2022 | isbn | 2024 | Yes! No! A First Conversation about Consent | Megan Madison |
| 5932 | teen-killers-in-love | 2025 | 2022 | isbn | 2025 | Teen Killers in Love | Lily Sparks |
| 6166 | health | 2024 | 2022 | isbn | 2024 | Health | McGraw Hill |
| 7861 | the-rumor-game | 2024 | 2022 | isbn | 2023 | The Rumor Game | Dhonielle Clayton |
| 9931 | kapaemahu | 2024 | 2022 | work | 2024 | Kapaemahu | Hinaleimoana Wong-Kalu |
| 1212 | plan-a | 2025 | 2023 | isbn | 2024 | Plan A | Deb Caletti |
| 1218 | margo-zimmerman-gets-the-girl | 2025 | 2023 | work | 2025 | Margo Zimmerman Gets the Girl | Brianna Shrum |
| 1373 | camp-quiltbag | 2025 | 2023 | work | 2023 | Camp Quiltbag | Nicole Melleby |
| 1376 | dear-mothman | 2025 | 2023 | work | 2024 | Dear Mothman | Robin Gow |
| 1381 | flor-fights-back-a-stonewall-riots-survival-story | 2025 | 2023 | isbn | 2023 | Flor Fights Back: A Stonewall Riots Survival Story | Joy Michael Ellison |
| 1684 | accountable-the-true-story-of-a-racist-social-media-account-and-the-teenagers-whose-lives-it-changed | 2024 | 2023 | isbn | 2024 | Accountable: The True Story of a Racist Social Media Account and the Teenagers Whose Lives it Changed | Dashka Slater |
| 1740 | ander-santi-were-here | 2025 | 2023 | isbn | 2024 | Ander & Santi Were Here | Jonny Garza Villa |
| 1760 | bianca-torre-is-afraid-of-everything | 2025 | 2023 | isbn | 2024 | Bianca Torre is Afraid of Everything | Justine Pucella Winans |
| 1794 | elle-campbell-wins-their-weekend | 2025 | 2023 | isbn | 2024 | Elle Campbell Wins Their Weekend | Ben Kahn |
| 1920 | sir-callie-and-the-dragons-roost | 2025 | 2023 | isbn | 2024 | Sir Callie and the Dragon's Roost | Esme Symcs-Smilh |
| 1922 | skating-on-mars | 2025 | 2023 | isbn | 2024 | Skating on Mars | Caroline Huntoon |
| 1948 | the-queer-girl-is-going-to-be-okay | 2025 | 2023 | isbn | 2024 | The Queer Girl is Going to Be Okay | Dale Walls |
| 2053 | into-the-light | 2025 | 2023 | isbn | 2024 | Into the Light | Mark Oshiro |
| 2701 | in-nightfall | 2024 | 2023 | isbn | 2024 | In Nightfall | Suzanne Young |
| 2716 | we-are-big-time | 2024 | 2023 | isbn | 2024 | We Are Big Time | Hena Khan |
| 2718 | cupids-revenge | 2025 | 2023 | isbn | 2025 | Cupid's Revenge | Wibke Brueggemann |
| 2786 | check-mate | 2025 | 2023 | isbn | 2025 | Check & Mate | Ali Hazelwood |
| 2848 | grandads-pride | 2025 | 2023 | isbn | 2025 | Grandad's Pride | Harry Woodgate |
| 2884 | all-bodies-are-wonderful-use-science-to-celebrate-everyones-body | 2025 | 2023 | isbn | 2025 | All Bodies Are Wonderful: Use Science to Celebrate Everyone's Body! | Cox. Beth |
| 2920 | baby-drag-queen | 2025 | 2023 | isbn | 2025 | Baby Drag Queen | C.A. Tanaka |
| 3010 | desert-queen | 2025 | 2023 | isbn | 2025 | Desert Queen | Jyoti Rajan Gopal |
| 3062 | gender-dysphoria | 2025 | 2023 | isbn | 2025 | Gender Dysphoria | Rose McCarthy |
| 3070 | green | 2025 | 2023 | isbn | 2025 | Green | Alex Gino |
| 3078 | he-she-they-how-we-talk-about-gender-and-why-it-matters | 2025 | 2023 | isbn | 2025 | He/She/They: How We Talk About Gender and Why It Matters | Schuyler Bailar |
| 3092 | how-to-be-a-young-antiracist | 2025 | 2023 | isbn | 2025 | How to Be a (Young) Antiracist | Ibram X. Kendi |
| 3098 | i-am-an-antiracist-superhero | 2025 | 2023 | work | 2025 | I Am An AntiRacist Superhero | Jennifer Nicole Bacon |
| 3112 | if-i-can-give-you-that | 2025 | 2023 | isbn | 2025 | If I Can Give You That | Michael Gray Bulla |
| 3146 | living-with-gender-dysphoria | 2025 | 2023 | work | 2025 | Living with Gender Dysphoria | Rachel Kehoe |
| 3200 | no-one-left-but-you | 2025 | 2023 | isbn | 2025 | No One Left But You | Tash McAdam |
| 3205 | one-true-wish | 2025 | 2023 | isbn | 2025 | One True Wish | Lauren Kate |
| 3223 | rachel-levine | 2025 | 2023 | work | 2025 | Rachel Levine | Lisa Bunker |
| 3239 | saint-junipers-folly | 2025 | 2023 | isbn | 2025 | Saint Juniper's Folly | Crespo. Alex |
| 3241 | say-the-right-thing-how-to-talk-about-identity-diversity-and-justice | 2025 | 2023 | isbn | 2025 | Say the Right Thing: How to Talk About Identity, Diversity, and Justice | Kenji Yoshino |
| 3252 | stand-up-and-speak-out-against-racism | 2025 | 2023 | isbn | 2025 | Stand Up and Speak Out Against Racism | Yassmin Abdel-Magied |
| 3254 | stay-up-racism-resistance-and-reclaiming-black-freedom | 2025 | 2023 | isbn | 2025 | Stay up: racism, resistance, and reclaiming Black freedom | Dill. Khodi |
| 3287 | the-science-of-identity | 2025 | 2023 | isbn | 2025 | The Science of Identity | Scientific American |
| 3298 | throw-like-a-girl-cheer-like-a-boy-the-evolution-of-gender-identity-and-race-in-sports | 2025 | 2023 | isbn | 2025 | Throw Like a Girl, Cheer Like A Boy: The Evolution of Gender, Identity, and Race in Sports | Robyn Ryle |
| 3303 | transmogrify-14-fantastical-tales-of-trans-magic | 2025 | 2023 | isbn | 2025 | Transmogrify! 14 Fantastical Tales of Trans Magic | G. Haron Davis |
| 3313 | venom-vow | 2025 | 2023 | work | 2025 | Venom & Vow | Anna-Marie McLemore |
| 4231 | its-totally-normal-an-lgbtqia-guide-to-puberty-sex-and-gender | 2025 | 2023 | isbn | 2025 | It's Totally Normal!: An LGBTQIA+ Guide to Puberty, Sex, and Gender | Monika Gupta Mehta |
| 4457 | forget-me-not | 2025 | 2023 | isbn | 2023 | Forget Me Not | Alyson Derrick |
| 4470 | a-long-stretch-of-bad-days | 2024 | 2023 | isbn | 2024 | A Long Stretch of Bad Days | Mindy McGinnis |
| 4599 | lying-in-the-deep | 2024 | 2023 | isbn | 2024 | Lying in the Deep | Diana Urban |
| 4915 | a-hundred-vicious-turns | 2024 | 2023 | isbn | 2024 | A Hundred Vicious Turns | Lee Paige O'Brien |
| 4925 | batcat-vol-1 | 2025 | 2023 | isbn | 2025 | Batcat, Vol. 1 | Meggie Ramm |
| 4934 | brooms | 2024 | 2023 | work | 2024 | Brooms | Jasmine Walls |
| 4962 | forever-is-now | 2024 | 2023 | isbn | 2024 | Forever is Now | Mariama J. Lockington |
| 4964 | friday-im-in-love | 2024 | 2023 | isbn | 2024 | Friday I'm in Love | Camryn Garrett |
| 4978 | hockey-girl-loves-drama-boy | 2024 | 2023 | isbn | 2024 | Hockey Girl Loves Drama Boy | Faith Erin Hicks |
| 4980 | how-to-find-a-missing-girl | 2024 | 2023 | isbn | 2024 | How to Find a Missing Girl | Victoria Wlosok |
| 4983 | ill-take-everything-you-have | 2024 | 2023 | isbn | 2024 | I'll Take Everything You Have | James Klise |
| 4994 | jude-saves-the-world | 2024 | 2023 | work | 2024 | Jude Saves the World | Ronnie Riley |
| 4995 | just-lizzie | 2024 | 2023 | isbn | 2024 | Just Lizzie | Karen Wilfrid |
| 4999 | last-chance-dance | 2024 | 2023 | isbn | 2024 | Last Chance Dance | Lakita Wilson |
| 5006 | lies-we-sing-to-the-sea | 2024 | 2023 | isbn | 2024 | Lies We Sing to the Sea | Sarah Underwood |
| 5011 | look-on-the-bright-side | 2024 | 2023 | isbn | 2024 | Look on the Bright Side | Lily Williams |
| 5060 | planning-perfect | 2024 | 2023 | isbn | 2024 | Planning Perfect | Haley Neil |
| 5068 | pritty | 2024 | 2023 | isbn | 2024 | Pritty | Keith F. Miller Jr. |
| 5070 | project-nought | 2024 | 2023 | isbn | 2024 | Project Nought | Chelsey Furedi |
| 5082 | ravensong | 2024 | 2023 | isbn | 2024 | Ravensong | Cayla Fay |
| 5108 | she-is-a-haunting | 2024 | 2023 | isbn | 2024 | She is a Haunting | Trang Thanh Tran |
| 5128 | strictly-no-heroics | 2024 | 2023 | isbn | 2024 | Strictly No Heroics | B.L. Radley |
| 5156 | the-drowning-summer | 2024 | 2023 | isbn | 2023 | The Drowning Summer | C.L. Herman |
| 5192 | the-princess-and-the-grilled-cheese-sandwich | 2024 | 2023 | work | 2024 | The Princess and the Grilled Cheese Sandwich | Deya Muniz |
| 5212 | the-year-my-life-went-down-the-toilet | 2024 | 2023 | isbn | 2024 | The Year My Life Went Down the Toilet | Jake Maia Arlow |
| 5218 | this-dark-descent | 2024 | 2023 | isbn | 2024 | This Dark Descent | Kalyn Josephson |
| 5254 | where-the-lockwood-grows | 2024 | 2023 | isbn | 2024 | Where the Lockwood Grows | Olivia A. Cole |
| 5282 | deephaven-a-gothic-middle-grade-novel-of-secrets-shadows-and-unraveling-darkness-at-deephaven-academy | 2024 | 2023 | isbn | 2024 | Deephaven: A Gothic Middle Grade Novel of Secrets, Shadows, and Unraveling Darkness at Deephaven Academy | Ethan M. Aldridge |
| 5667 | i-kick-and-i-fly | 2024 | 2023 | isbn | 2024 | I Kick and I Fly | Ruchira Gupta |
| 5779 | michigan-vs-the-boys | 2024 | 2023 | isbn | 2024 | Michigan vs. The Boys | Carrie S. Allen |
| 5787 | monstrous-a-transracial-adoption-story | 2024 | 2023 | isbn | 2024 | Monstrous: A Transracial Adoption Story | Sarah Myer |
| 5920 | something-like-home | 2025 | 2023 | isbn | 2025 | Something Like Home | Andrea Beatriz Arango |
| 6151 | dear-medusa | 2024 | 2023 | isbn | 2024 | Dear Medusa | Olivia A. Cole |
| 1842 | just-shy-of-ordinary | 2025 | 2024 | isbn | 2024 | Just Shy of Ordinary | A. J. Sass |
| 1858 | linus-and-etta-could-use-a-win | 2025 | 2024 | isbn | 2024 | Linus and Etta Could Use a Win | Caroline Huntoon |
| 1882 | okay-cupid | 2025 | 2024 | isbn | 2024 | Okay, Cupid | Mason Deaver |
| 2120 | wander-in-the-dark | 2025 | 2024 | isbn | 2025 | Wander in the Dark | Jumata Emill |
| 2944 | bless-the-blood-a-cancer-memoir | 2025 | 2024 | isbn | 2025 | Bless the Blood: A Cancer Memoir | Walela Nehanda |
| 2948 | breathe-journeys-to-healthy-binding | 2025 | 2024 | isbn | 2025 | Breathe: Journeys to Healthy Binding | Maia Kobabe |
| 2958 | canto-contigo | 2025 | 2024 | isbn | 2025 | Canto Contigo | Jonny Garza Villa |
| 3084 | homebody-a-graphic-memoir-of-gender-identity-exploration | 2025 | 2024 | isbn | 2025 | Homebody: A Graphic Memoir of Gender Identity Exploration | Theo Parish |
| 3130 | j-is-for-justice-an-activism-alphabet | 2025 | 2024 | isbn | 2025 | J is for Justice! An Activism Alphabet | Veronica I. Arreola |
| 3170 | lunar-boy | 2025 | 2024 | isbn | 2025 | Lunar Boy | Cin Wibowo; Jes Wibowo |
| 3178 | marleys-pride | 2025 | 2024 | work | 2025 | Marley's Pride | Joelle Retener |
| 3192 | most-ardently-a-pride-prejudice-remix | 2025 | 2024 | isbn | 2025 | Most Ardently: A Pride & Prejudice Remix | Gabe Cole Novoa |
| 3210 | out-of-blue-comes-green | 2025 | 2024 | isbn | 2025 | Out of Blue Comes Green | M.E. Corey |
| 3286 | the-ribbon-skirt | 2025 | 2024 | isbn | 2025 | The Ribbon Skirt | Cameron Mukwa |
| 3319 | we-are-mayhem | 2025 | 2024 | isbn | 2025 | We Are Mayhem | Beck Rourke-Mooney |
| 4149 | collide | 2025 | 2024 | isbn | 2025 | Collide | Bal Khabra |
| 4926 | batcat-sink-or-swim | 2025 | 2024 | isbn | 2025 | Batcat: Sink or Swim! | Meggie Ramm |

## Fout — review-tier (niet auto-appliën)

| id | slug | DB | OL | tier | ban≥ | title | author |
|----|------|---:|---:|------|-----:|-------|--------|
| 2724 | behind-the-mask | 2024 | 1902 | search | 2024 | Behind the Mask | Edith Hall |
| 4000 | the-short-novels-of-john-steinbeck | 2025 | 1953 | search | 2025 | The short novels of John Steinbeck | John Steinbeck |
| 4095 | alphonse-mucha | 2025 | 1967 | search | 2025 | Alphonse Mucha | Alphonse Mucha |
| 4203 | gustav-klimt-drawings-paintings | 2025 | 1968 | search | 2025 | Gustav Klimt: Drawings & Paintings | Gustav Klimt |
| 3389 | dragon-ball-vol-1 | 2025 | 1985 | search | 2025 | Dragon Ball, Vol. 1 | Akira Toriyama |
| 3724 | greece-temples-tombs-treasures | 2025 | 1994 | search | 2025 | Greece: Temples, Tombs & Treasures | Time-Life Books |
| 2011 | grays-anatomy-the-anatomical-basis-of-medicine-and-surgery | 2025 | 1995 | search | 2025 | Gray's Anatomy: The Anatomical Basis of Medicine and Surgery | Peter L. Williams |
| 4103 | annotated-art | 2025 | 1995 | search | 2025 | Annotated Art | Robert Cumming |
| 2687 | wings | 2025 | 1996 | search | 2021 | Wings | Danielle Steel |
| 4269 | matisse | 2025 | 2001 | search | 2025 | Matisse | Gabriele Crepaldi |
| 4442 | velazquez | 2025 | 2001 | search | 2025 | Velázquez | Rosa Giorgi |
| 5431 | angel | 2024 | 2001 | search | 2005 | Angel | James Patterson |
| 3857 | mysteries-of-history | 2025 | 2003 | search | 2025 | Mysteries of History | Robert Stewart |
| 5905 | sex-opposing-viewpoints | 2025 | 2006 | search | 2025 | Sex: Opposing Viewpoints | Mary E. Williams |
| 2221 | code-name-cassandra | 2025 | 2007 | search | 2025 | Code Name Cassandra | Meg Cabot |
| 5962 | the-elements | 2024 | 2007 | search | 2024 | The Elements | Adrian Dingle |
| 1577 | shut-up | 2025 | 2008 | search | 2023 | Shut Up! | Marilyn Reynolds |
| 5707 | kieli | 2024 | 2008 | search | 2024 | Kieli | Yukako Kabei |
| 3391 | dragon-ball-vol-3 | 2025 | 2009 | search | 2025 | Dragon Ball, Vol. 3 | Akira Toriyama |
| 4369 | the-body-book-for-boys | 2025 | 2010 | search | 2025 | The Body Book for Boys | Jonathan Mar |
| 1240 | hidden | 2025 | 2012 | search | 2021 | Hidden | P. C. Cast |
| 2618 | underworld | 2025 | 2012 | search | 2025 | Underworld | Meg Cabot |
| 5274 | aphrodite-goddess-of-love-and-beauty | 2024 | 2012 | search | 2024 | Aphrodite: Goddess of Love and Beauty | Teri Temple |
| 5988 | the-melancholy-of-haruhi-suzumiya | 2025 | 2013 | search | 2022 | The Melancholy of Haruhi Suzumiya | Nagaru Tanigawa |
| 2153 | against-the-tide | 2025 | 2014 | search | 2025 | Against the Tide | Tui Sutherland |
| 4093 | all-you-need-is-kill-book-1 | 2025 | 2014 | search | 2025 | All You Need is Kill, Book 1 | Takeshi Obata |
| 4219 | human-anatomy-the-definitive-visual-guide | 2025 | 2014 | search | 2025 | Human Anatomy: The Definitive Visual Guide | Alice Roberts |
| 2327 | homecoming | 2025 | 2015 | search | 2022 | Homecoming | Kass Morgan |
| 1263 | anne-franks-diary-the-graphic-adaptation | 2025 | 2018 | search | 2022 | Anne Frank's Diary: The Graphic Adaptation | Ari Folman |
| 2763 | tbh-this-is-so-awkward | 2024 | 2018 | search | 2024 | TBH, This is So Awkward | Lisa Greenwald |
| 3331 | whats-diversity | 2025 | 2018 | search | 2025 | What's diversity? | Anthony. David |
| 4623 | my-hero-academia-vigilantes-vol-2 | 2024 | 2018 | search | 2024 | My Hero Academia, Vigilantes Vol. 2 | Hideyuki Furuhashi |
| 4649 | plague-land-no-escape | 2024 | 2018 | search | 2024 | Plague Land No Escape | Alex Scarrow |
| 4651 | plague-land-reborn | 2024 | 2018 | search | 2024 | Plague Land Reborn | Alex Scarrow |
| 4087 | a-story-of-medicine-in-50-discoveries-from-mummies-to-gene-splicing | 2025 | 2019 | search | 2025 | A Story of Medicine in 50 Discoveries: From Mummies to Gene Splicing | Marguerite Vigliani |
| 4721 | sword-of-destiny | 2024 | 2019 | search | 2024 | Sword of Destiny | Andrzej Sapkowski |
| 2537 | symptoms-of-a-heartbreak | 2025 | 2020 | search | 2023 | Symptoms of a Heartbreak | Sona Charaipotra |
| 4923 | answers-in-the-pages | 2024 | 2022 | search | 2024 | Answers in the Pages | David Levithan |
| 2882 | afterglow | 2025 | 2023 | search | 2025 | Afterglow | Phil Stamper |
| 4089 | al-capone | 2025 | 2023 | search | 2025 | Al Capone | Swann Meralli |
| 5352 | 8-tiny-reindeer-an-advent-calendar-adventure | 2024 | 2023 | search | 2024 | 8 Tiny Reindeer: An Advent Calendar Adventure | Robert Tinkler |

## Onverifieerbaar & intern onmogelijk (ban vóór DB-pubjaar)

| id | slug | DB | OL | tier | ban≥ | title | author |
|----|------|---:|---:|------|-----:|-------|--------|
| 1153 | assassination-classroom-vol-11 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 11 | Yūsei Matsui |
| 1154 | assassination-classroom-vol-2 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 2 | Yūsei Matsui |
| 1155 | assassination-classroom-vol-3 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 3 | Yūsei Matsui |
| 1156 | assassination-classroom-vol-4 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 4 | Yūsei Matsui |
| 1157 | assassination-classroom-vol-5 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 5 | Yūsei Matsui |
| 1158 | assassination-classroom-vol-6 | 2025 |  |  | 2022 | Assassination Classroom, Vol. 6 | Yūsei Matsui |
| 1159 | assassination-classroom-vol-7 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 7 | Yūsei Matsui |
| 1160 | assassination-classroom-vol-8 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 8 | Yūsei Matsui |
| 1187 | the-league-of-super-feminists | 2025 |  |  | 2022 | The League of Super Feminists | Mirion Malle |
| 1289 | fairy-tail-vol-5 | 2025 |  |  | 2024 | Fairy Tail, Vol. 5 | Hiro Mashima |
| 1321 | rise | 2025 |  |  | 2024 | Rise | Andrea Robertson |
| 1335 | the-detour | 2025 |  |  | 2022 | The Detour | S.A. Bodeen |
| 1359 | wolfsbane | 2025 |  |  | 2023 | Wolfsbane | Andrea Robertson |
| 1377 | different-kinds-of-fruit | 2025 |  |  | 2022 | Different Kinds of Fruit | Kyle Lukoff |
| 1403 | you-do-you-figuring-out-your-body-dating-and-sexuality | 2025 |  |  | 2023 | You Do You: Figuring Out Your Body, Dating, and Sexuality | Sarah Mirk |
| 1411 | fire-force-vol-1 | 2025 |  |  | 2022 | Fire Force, Vol. 1 | Atsushi Ohkubo |
| 1489 | assassination-classroom-vol-9 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 9 | Yūsei Matsui |
| 1744 | be-gay-do-comics-queer-history-memoir-and-satire | 2025 |  |  | 2022 | Be Gay, Do Comics: Queer History, Memoir, and Satire | The Nib |
| 1768 | boys-run-the-riot-vol-2 | 2025 |  |  | 2024 | Boys Run the Riot, Vol. 2 | Keito Gaku |
| 1770 | boys-run-the-riot-vol-3 | 2025 |  |  | 2024 | Boys Run the Riot, Vol. 3 | Keito Gaku |
| 1774 | bum-the-page-a-true-story-of-torching-doubts-blazing-trails-and-igniting-change | 2025 |  |  | 2024 | Bum the Page: A True Story of Torching Doubts, Blazing Trails, and Igniting Change | Danica Roem |
| 1776 | chaz-bono | 2025 |  |  | 2024 | Chaz Bono | Marty Gitlin |
| 1868 | magical-boy-vol-1 | 2025 |  |  | 2023 | Magical Boy, Vol 1 | The Kao |
| 1890 | pride-an-inspirational-history-of-the-lgbtq-community | 2025 |  |  | 2024 | Pride: An Inspirational History of the LGBTQ+ Community | Stella Caldwell |
| 1914 | sexuality-and-gender-identity | 2025 |  |  | 2024 | Sexuality and Gender Identity | Hilary W. Poole |
| 1935 | the-beautiful-something-else | 2025 |  |  | 2024 | The Beautiful Something Else | Ash Van Otterloo |
| 1936 | the-dog-knight | 2025 |  |  | 2024 | The Dog Knight | Jeremy Whitley |
| 1941 | the-house-that-whispers | 2025 |  |  | 2023 | The House that Whispers | Lin Thompson |
| 1946 | the-otherwoods | 2025 |  |  | 2024 | The Otherwoods | Justine Pucella Winans |
| 1950 | the-stonewall-riots-making-a-stand-for-lgbtq-rights | 2025 |  |  | 2024 | The Stonewall Riots: Making a Stand for LGBTQ Rights | Archie Bongiovanni |
| 1954 | the-wicked-bargain | 2025 |  |  | 2024 | The Wicked Bargain | Gabe Cole Novoa |
| 1974 | white-privilege | 2025 |  |  | 2024 | White Privilege | M.T. Blakemore |
| 1981 | soul-eater-vol-10 | 2024 |  |  | 2023 | Soul Eater, Vol. 10 | Atsushi Ohkubo |
| 1983 | soul-eater-vol-12 | 2024 |  |  | 2023 | Soul Eater, Vol. 12 | Atsushi Ohkubo |
| 1984 | soul-eater-vol-13 | 2024 |  |  | 2023 | Soul Eater, Vol. 13 | Atsushi Ohkubo |
| 1988 | soul-eater-vol-17 | 2024 |  |  | 2023 | Soul Eater, Vol. 17 | Atsushi Ohkubo |
| 1991 | soul-eater-vol-4 | 2024 |  |  | 2022 | Soul Eater, Vol. 4 | Atsushi Ohkubo |
| 1992 | soul-eater-vol-5 | 2024 |  |  | 2022 | Soul Eater, Vol. 5 | Atsushi Ohkubo |
| 1993 | soul-eater-vol-6 | 2024 |  |  | 2023 | Soul Eater, Vol. 6 | Atsushi Ohkubo |
| 1994 | soul-eater-vol-7 | 2024 |  |  | 2023 | Soul Eater, Vol. 7 | Atsushi Ohkubo |
| 1995 | soul-eater-vol-8 | 2024 |  |  | 2023 | Soul Eater, Vol. 8 | Atsushi Ohkubo |
| 2032 | art-that-changed-the-world-transformative-art-movements-and-the-paintings-that-inspired-them | 2025 |  |  | 2024 | Art That Changed the World: Transformative Art Movements and the Paintings That Inspired Them | Ian Chilvers |
| 2072 | look | 2024 |  |  | 2023 | Look | Zan Romanoff |
| 2417 | night-blood | 2025 |  |  | 2023 | Night Blood | Elly Blake |
| 2650 | assassination-classroom-vol-12 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 12 | Yūsei Matsui |
| 2651 | assassination-classroom-vol-13 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 13 | Yūsei Matsui |
| 2652 | assassination-classroom-vol-14 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 14 | Yūsei Matsui |
| 2653 | assassination-classroom-vol-15 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 15 | Yūsei Matsui |
| 2654 | assassination-classroom-vol-16 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 16 | Yūsei Matsui |
| 2655 | assassination-classroom-vol-17 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 17 | Yūsei Matsui |
| 2657 | assassination-classroom-vol-19 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 19 | Yūsei Matsui |
| 2658 | assassination-classroom-vol-20 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 20 | Yūsei Matsui |
| 2659 | assassination-classroom-vol-21 | 2025 |  |  | 2023 | Assassination Classroom, Vol. 21 | Yūsei Matsui |
| 2667 | happily-ever-after | 2025 |  |  | 2023 | Happily Ever After | Nora Roberts |
| 2673 | meow-or-never | 2025 |  |  | 2023 | Meow or Never | Jazz Taylor |
| 2791 | a-game-of-thrones-the-graphic-novel-vol-4 | 2025 |  |  | 2022 | A Game of Thrones: The Graphic Novel, Vol. 4 | George R. R. Martin |
| 2892 | an-abc-of-equality-vol-1 | 2025 |  |  | 2023 | An ABC of Equality, Vol 1 | Chana Ginelle Ewing |
| 2936 | beware-the-kitten-holy | 2025 |  |  | 2024 | Beware the Kitten Holy | ND Stevenson |
| 2950 | bright-world | 2025 |  |  | 2022 | Bright World | Stan Stanley |
| 3046 | friendship-to-the-max | 2025 |  |  | 2024 | Friendship to the Max | ND Stevenson |
| 3273 | the-feminism-book | 2025 |  |  | 2023 | The Feminism Book | Georgie Carroll |
| 3275 | the-gay-rights-movement | 2025 |  |  | 2022 | The Gay Rights Movement | Eric Braun |
| 3294 | the-watchers-test | 2025 |  |  | 2022 | The Watcher's Test | Hamish Steele |
| 3566 | cursed | 2025 |  |  | 2023 | Cursed | Marissa Meyer |
| 3905 | sisters-hermanas | 2025 |  |  | 2021 | Sisters/Hermanas | Gary Paulsen |
| 4247 | last-man-the-royal-cup | 2025 |  |  | 2022 | Last Man: The Royal Cup | Bastien Vivès |
| 4407 | the-mythology-book | 2025 |  |  | 2023 | The Mythology Book | Georgie Carroll |
| 4551 | help-for-the-haunted-heroine | 2024 |  |  | 2023 | Help for the Haunted Heroine | John Searles |
| 4575 | jojos-bizarre-adventure-part-1-phantom-blood-vol-2 | 2024 |  |  | 2022 | Jojo's Bizarre Adventure: Part 1 - Phantom Blood, Vol. 2 | Hirohiko Araki |
| 4577 | jojos-bizarre-adventure-part-1-phantom-blood-vol-3 | 2024 |  |  | 2022 | Jojo's Bizarre Adventure: Part 1 - Phantom Blood, Vol. 3 | Hirohiko Araki |
| 4709 | soul-eater-vol-21 | 2024 |  |  | 2023 | Soul Eater, Vol. 21 | Atsushi Ohkubo |
| 4711 | soul-eater-vol-22 | 2024 |  |  | 2023 | Soul Eater, Vol. 22 | Atsushi Ohkubo |
| 4713 | soul-eater-vol-23 | 2024 |  |  | 2023 | Soul Eater, Vol. 23 | Atsushi Ohkubo |
| 4857 | 1q84 | 2024 |  |  | 2023 | 1Q84 | Haruki Murakami |
| 4970 | gender-issues | 2024 |  |  | 2021 | Gender Issues | Cindy Croft |
| 5110 | short-stuff-a-young-adult-lgbtq-anthology | 2024 |  |  | 2022 | Short Stuff: A Young Adult LGBTQ+ Anthology | Alysia Constantine |
| 5296 | more-than-a-game-race-gender-and-politics-in-sports | 2024 |  |  | 2021 | More Than a Game: Race, Gender, and Politics in Sports | Matt Doeden |
| 5981 | the-language-of-seabirds | 2025 |  |  | 2023 | The Language of Seabirds | Will Taylor |
| 7550 | lgbt-families | 2024 |  |  | 2021 | LGBT Families | Leanna Currie-McGhee |
| 7563 | abortion | 2025 |  |  | 2021 | Abortion | No Further Information Available |
| 7580 | teen-pregnancy | 2025 |  |  | 2021 | Teen pregnancy | No Further Information Available |
| 7751 | minecraft-vol-1 | 2024 |  |  | 2023 | Minecraft, Vol 1 | Sfé R. Monster |
| 7901 | vanilla | 2024 |  |  | 2023 | Vanilla | Bill Merrell |
| 9654 | weirdo-series-crazy-weird | 2024 |  |  | 2021 | WeirDo Series: Crazy Weird! | Anh Do |
| 9655 | weirdo-series-even-weirder | 2024 |  |  | 2021 | WeirDo Series: Even Weirder! | Anh Do |
| 9657 | weirdo-series-hopping-weird | 2024 |  |  | 2021 | WeirDo Series: Hopping Weird! | Anh Do |
| 9658 | weirdo-series-mega-weird | 2024 |  |  | 2021 | WeirDo Series: Mega Weird! | Anh Do |
| 9659 | weirdo-series-messy-weird | 2024 |  |  | 2021 | WeirDo Series: Messy Weird! | Anh Do |
| 9660 | weirdo-series-planet-weird | 2024 |  |  | 2021 | WeirDo Series: Planet Weird | Anh Do |
| 9661 | weirdo-series-really-weird | 2024 |  |  | 2021 | WeirDo Series: Really Weird! | Anh Do |
| 9662 | weirdo-series-spinning-weird | 2024 |  |  | 2021 | WeirDo Series: Spinning Weird | Anh Do |
| 9663 | weirdo-series-splashy-weird | 2024 |  |  | 2021 | WeirDo Series: Splashy Weird! | Anh Do |
| 9664 | weirdo-series-spooky-weird | 2024 |  |  | 2021 | WeirDo Series: Spooky Weird! | Anh Do |
| 9666 | weirdo-series-tasty-weird | 2024 |  |  | 2021 | WeirDo Series: Tasty Weird! | Anh Do |
| 9667 | weirdo-series-totally-weird | 2024 |  |  | 2021 | WeirDo Series: Totally Weird! | Anh Do |
| 9668 | weirdo-series-vote-weirdo | 2024 |  |  | 2021 | WeirDo Series: Vote Weirdo | Anh Do |
| 9670 | weirdo-series-weirdomania | 2024 |  |  | 2021 | WeirDo Series: Weirdomania! | Anh Do |
| 9742 | hoonani-hula-warrior | 2024 |  |  | 2021 | Ho'onani: Hula Warrior | Heather Gale |
| 10149 | hana-kimi-for-you-in-full-blossom | 2024 |  |  | 2023 | Hana-Kimi: For You in Full Blossom | Hisaya Nakajo |
| 18818 | the-story-of-rap | 2024 |  |  | 2021 | The Story of Rap | Lindsey Sagar |
---

## Toegepast 2026-08-08 (handmatige review vóór apply)

Van de 839 high-conf fixes zijn er **836 toegepast** via `apply-publication-year-fixes.ts --apply`
(CSV-backup: `data/publication-year-fixes-backup-2026-08-08.csv`, gitignored):

- **Handmatig gepatcht** (OL-jaar was junk, echt jaar uit gedocumenteerde bron):
  #1224 Annexed 2001→**2010**, #5266 You Brought Me the Ocean 1920→**2020** (eeuw-typo),
  #4187 Georgia O'Keeffe (Viking) 1960→**1976**.
- **Gedropt → watchlist** (OL work-merge met junk-jaar, echt jaar onzeker):
  #4443 Vincent van Gogh: The Complete Paintings (1914 bij Metzger = onmogelijk, Taschen ~1990),
  #4197 Goya (1919), #4251 Leonardo da Vinci (Romei, Masters of Art ~1994, niet 1967).

Rijtelling: fpy∈{2024,2025} van 499+798=1.297 → 215+263=**478**
(461 niet-gefixte + 17 gefixte 2025→2024). Restant-watchlist: 41 review-tier + 404
onverifieerbaar + 3 gedropte, waarvan 111 intern onmogelijk (ban vóór pub-jaar) —
follow-up via de bestaande keten `verify-years-llm.ts` → `resolve-proposed-years.ts`.

## Follow-up keten uitgevoerd 2026-08-08

Watchlist (448 ids, `data/pen-stamped-years-watchlist-ids.json`) door de bestaande keten:

1. `verify-years-llm.ts --ids-file=… --apply` (nieuwe scope-flag): **12 gecorrigeerd**
   (o.a. Sword of Destiny→1992, 1Q84→2009), 436 door naar stap 2 als 'proposed'.
2. `resolve-proposed-years.ts --apply` (verdict-enum gefixt: `openlibrary_correct`
   werd door gpt-4o geïmproviseerd maar door de code genegeerd): **15 gecorrigeerd**
   (o.a. Complete Persepolis→2007, Hidden→2012, Dragon Ball Vol. 1→1985), 421 leave.

Eindstand fpy∈{2024,2025}: 478 → **451** (205×2024 + 246×2025). Totaal keten:
836 + 12 + 15 = **863 hersteld** van de oorspronkelijke 1.297. Het restant is de
onverifieerbare long tail (per-volume manga zonder OL `first_publish_date`,
obscure serie-nonfictie) + de 13 bevestigd-echte recente titels.
`audit-integrity.ts` exit 0; ban-before-publication 397→384, baseline her-ankerd.
