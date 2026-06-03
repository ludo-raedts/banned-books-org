# Publication-year audit (vs OpenLibrary work-key match)

- Cross-checked: **4221** books (had both year + ol_work_id)
- Work-key matched & consistent (Δ<3): **2712**
- **Flagged (Δ≥3, work-key matched): 645**
- Unverified (no OL work-key match / no OL year): 864

OL first_publish_year is a signal, not ground truth — review before applying.

## Flagged — likely wrong DB year (sorted by |Δ|)

| id | slug | DB year | OL year | Δ | title | author |
|----|------|--------:|--------:|--:|-------|--------|
| 151 | lysistrata | -411 | 1872 | -2283 | Lysistrata | Aristophanes |
| 7327 | quran | 609 | 2022 | -1413 | Quran | Unknown |
| 16455 | the-divine-comedy | 1320 | 1961 | -641 | The Divine Comedy | Dante Alighieri |
| 16451 | moriae-encomium-the-praise-of-folly | 1511 | 2012 | -501 | Moriae Encomium (The Praise of Folly) | Desiderius Erasmus |
| 9242 | trace | 2004 | 1529 | 475 | Trace | Patricia Cornwell |
| 16452 | tyndales-new-testament | 1525 | 1999 | -474 | Tyndale's New Testament | William Tyndale |
| 16457 | institutes-of-the-christian-religion | 1536 | 2009 | -473 | Institutes of the Christian Religion | John Calvin |
| 9652 | just-mercy | 2014 | 1600 | 414 | Just Mercy | Bryan Stevenson |
| 16411 | pantagruel-and-gargantua | 1532 | 1930 | -398 | Pantagruel and Gargantua | François Rabelais |
| 137 | scary-stories-to-tell-in-the-dark | 1981 | 1605 | 376 | Scary Stories to Tell in the Dark | Alvin Schwartz |
| 9173 | the-mammoth-hunters | 1985 | 1611 | 374 | The Mammoth Hunters | Jean M. Auel |
| 606 | peyton-place | 1956 | 1603 | 353 | Peyton Place | Grace Metalious |
| 78 | song-of-solomon | 1977 | 1634 | 343 | Song of Solomon | Toni Morrison |
| 9090 | the-lake-house | 2003 | 1662 | 341 | The Lake House | James Patterson |
| 16440 | the-letters-of-abelard-and-heloise | 1616 | 1901 | -285 | The Letters of Abelard and Heloise | Peter Abelard |
| 6370 | the-meritorious-price-of-our-redemption-1650 | 1650 | 1931 | -281 | The Meritorious Price of Our Redemption | William Pynchon |
| 9240 | predator | 2005 | 1742 | 263 | Predator | Patricia Cornwell |
| 16882 | historia-general-de-las-cosas-de-nueva-espana | 1577 | 1829 | -252 | Historia general de las cosas de Nueva España | Bernardino de Sahagún |
| 16401 | chronicles | 1577 | 1807 | -230 | Chronicles | Raphael Holinshed |
| 8588 | the-murder-room | 2003 | 1775 | 228 | The Murder Room | P. D. James |
| 8402 | micro | 2011 | 1805 | 206 | Micro | Michael Crichton |
| 16418 | lan-2440 | 1771 | 1977 | -206 | L'An 2440 | Louis-Sébastien Mercier |
| 116 | the-jungle | 1906 | 1707 | 199 | The Jungle | Upton Sinclair |
| 9355 | dont-say-a-word | 1991 | 1797 | 194 | Don't Say a Word | Andrew Klavan |
| 2820 | narrative-of-the-life-of-frederick-douglass | 2024 | 1845 | 179 | Narrative of the Life of Frederick Douglass | Frederick Douglass |
| 51 | lolita | 1955 | 1777 | 178 | Lolita | Vladimir Nabokov |
| 8931 | if-i-grow-up | 2007 | 1831 | 176 | If I Grow Up | Todd Strasser |
| 789 | les-120-journees-de-sodome | 1785 | 1953 | -168 | Les 120 Journées de Sodome | Marquis de Sade |
| 16458 | diarium-itineris-in-moscoviam | 1700 | 1863 | -163 | Diarium itineris in Moscoviam | Johann Georg Korb |
| 17029 | the-anti-death-league | 1966 | 1803 | 163 | The Anti-Death League | Kingsley Amis |
| 14320 | netochka-nezvanova | 1849 | 2006 | -157 | Netochka Nezvanova | Fyodor Dostoevsky |
| 7845 | when-the-wind-blows | 1998 | 1847 | 151 | When the Wind Blows | James Patterson |
| 1086 | auf-der-universitat | 1863 | 2011 | -148 | Auf der Universität | Theodor Storm |
| 8106 | the-first-wives-club | 1992 | 1848 | 144 | The First Wives Club | Olivia Goldsmith |
| 9057 | lhysterique | 2024 | 1885 | 139 | L'Hystérique | Camille Lemonnier |
| 16683 | the-brothers-karamazov | 1880 | 2015 | -135 | The Brothers Karamazov | Fyodor Dostoevsky |
| 9443 | sams-letters-to-jennifer | 2004 | 1874 | 130 | Sam's Letters to Jennifer | James Patterson |
| 7691 | afterworlds | 2014 | 1887 | 127 | Afterworlds | Scott Westerfeld |
| 1336 | the-fixer | 2025 | 1901 | 124 | The Fixer | Bernard Malamud |
| 581 | the-protocols-of-the-elders-of-zion | 1903 | 2016 | -113 | The Protocols of the Elders of Zion | Unknown |
| 9029 | the-lincoln-lawyer | 2005 | 1895 | 110 | The Lincoln Lawyer | Michael Connelly |
| 9393 | no-country-for-old-men | 2005 | 1900 | 105 | No Country for Old Men | Cormac McCarthy |
| 16660 | soul-on-ice | 1968 | 1863 | 105 | Soul on Ice | Eldridge Cleaver |
| 8427 | oliver-button-is-a-sissy | 1979 | 1879 | 100 | Oliver Button is a Sissy | Tomie DePaola |
| 10197 | my-antonia | 1918 | 1818 | 100 | My Antonia | Willa Cather |
| 8596 | a-portrait-of-the-artist-as-a-young-man | 1916 | 1818 | 98 | A Portrait of the Artist as a Young Man | James Joyce |
| 1008 | six-women | 1908 | 2005 | -97 | Six Women | Victoria Cross |
| 824 | fields-of-castile-machado | 1912 | 2007 | -95 | Fields of Castile | Antonio Machado |
| 14877 | genet | 1933 | 2018 | -85 | Genêt | Kracauer |
| 9174 | the-valley-of-horses | 1982 | 1899 | 83 | The Valley of Horses | Jean M. Auel |
| 767 | bodas-de-sangre | 1932 | 2013 | -81 | Bodas de sangre | Federico García Lorca |
| 8896 | master-of-the-game | 1982 | 1905 | 77 | Master of the Game | Sidney Sheldon |
| 16711 | a-brief-history-of-chinese-fiction | 1925 | 2000 | -75 | A Brief History of Chinese Fiction | Lu Xun |
| 9074 | the-fall | 2007 | 1938 | 69 | The Fall | Robert Muchamore |
| 14730 | la-crise-du-progres | 1936 | 2002 | -66 | La crise du progrès | Georges Friedmann |
| 3484 | black-like-me | 2025 | 1960 | 65 | Black Like Me | John Howard Griffin |
| 3965 | the-how-and-why-wonder-book-of-the-human-body | 2025 | 1961 | 64 | The How and Why Wonder Book of The Human Body | Martin Keen |
| 1019 | the-butcher-shop | 1926 | 1988 | -62 | The Butcher Shop | Jean Devanny |
| 15230 | le-viol-des-foules-par-la-propagande-politique | 1930 | 1992 | -62 | Le viol des foules par la propagande politique | Serge Tchakhotine |
| 9569 | the-watsons-go-to-birmingham-1963 | 2023 | 1963 | 60 | The Watsons Go To Birmingham - 1963 | Christopher Paul Curtis |
| 16901 | life-in-the-tomb | 1924 | 1980 | -56 | Life in the Tomb | Stratis Myrivilis |
| 944 | the-land-of-spices | 1941 | 1995 | -54 | The Land of Spices | Kate O'Brien |
| 9144 | the-young-world | 2014 | 1960 | 54 | The Young World | Chris Weitz |
| 16926 | laughable-loves | 1969 | 2023 | -54 | Laughable Loves | Milan Kundera |
| 1254 | a-day-no-pigs-would-die | 2025 | 1972 | 53 | A Day No Pigs Would Die | Robert Newton Peck |
| 16423 | atta-troll-ein-sommernachtstraum | 1847 | 1900 | -53 | Atta Troll, ein Sommernachtstraum | Heinrich Heine |
| 16888 | con-sandino-en-nicaragua | 1934 | 1987 | -53 | Con Sandino en Nicaragua | Ramón de Belausteguigoitia |
| 815 | napoleon-le-petit | 1852 | 1800 | 52 | Napoléon le Petit | Victor Hugo |
| 15129 | apocalypse-de-notre-temps | 1939 | 1991 | -52 | Apocalypse de notre temps | Henri Rollin |
| 16716 | the-legend-of-the-condor-heroes | 1957 | 2008 | -51 | The Legend of the Condor Heroes | Jin Yong |
| 16938 | life-is-elsewhere | 1973 | 2023 | -50 | Life Is Elsewhere | Milan Kundera |
| 1605 | the-gunslinger | 2025 | 1976 | 49 | The Gunslinger | Stephen King |
| 10253 | vanity-fair | 1848 | 1800 | 48 | Vanity Fair | William Makepeace Thackeray |
| 14453 | la-fin-de-leternel | 1929 | 1977 | -48 | La fin de l’Éternel | J. Benda |
| 16598 | that-smell | 1966 | 2013 | -47 | That Smell | Sonallah Ibrahim |
| 730 | on-islam-kasravi | 1944 | 1990 | -46 | On Islam | Ahmad Kasravi |
| 1613 | the-long-walk | 2025 | 1979 | 46 | The Long Walk | Stephen King |
| 3855 | mummies-made-in-egypt | 2025 | 1979 | 46 | Mummies Made in Egypt | Aliki |
| 1498 | danse-macabre | 2025 | 1980 | 45 | Danse Macabre | Stephen King |
| 724 | the-factory-ship | 1929 | 1973 | -44 | The Factory Ship | Takiji Kobayashi |
| 1163 | cujo | 2025 | 1981 | 44 | Cujo | Stephen King |
| 3915 | swimwear-in-vogue-since-1910 | 2025 | 1981 | 44 | Swimwear in Vogue Since 1910 | Christina Probert |
| 5318 | the-paper-bag-princess | 2024 | 1980 | 44 | The Paper Bag Princess | Robert Munsch |
| 8090 | the-dew-breaker | 2004 | 1960 | 44 | The Dew Breaker | Edwidge Danticat |
| 896 | midnight-in-the-century | 1939 | 1982 | -43 | Midnight in the Century | Victor Serge |
| 6154 | discovering-art-history | 2024 | 1981 | 43 | Discovering Art History | Gerald F. Brommer |
| 16413 | tartuffe | 1664 | 1707 | -43 | Tartuffe | Molière |
| 14307 | the-milkmans-on-his-way | 1982 | 2024 | -42 | The Milkman's on his Way | David Rees |
| 16746 | javier-marino | 1943 | 1985 | -42 | Javier Mariño | Gonzalo Torrente Ballester |
| 16905 | tecnica-del-colpo-di-stato | 1931 | 1973 | -42 | Tecnica del colpo di Stato | Curzio Malaparte |
| 851 | the-conjugal-dictatorship | 1976 | 2017 | -41 | The Conjugal Dictatorship of Ferdinand and Imelda Marcos | Primitivo Mijares |
| 902 | the-epic-of-sheikh-bedreddin | 1936 | 1977 | -41 | The Epic of Sheikh Bedreddin | Nâzım Hikmet |
| 1127 | skeleton-crew | 2025 | 1985 | 40 | Skeleton Crew | Stephen King |
| 1190 | the-tommyknockers | 2025 | 1985 | 40 | The Tommyknockers | Stephen King |
| 2023 | the-cyclopes | 2025 | 1986 | 39 | The Cyclopes | Bernard Evslin |
| 5735 | locked-in-time | 2024 | 1985 | 39 | Locked in Time | Lois Duncan |
| 8419 | jacques-louis-david | 2023 | 1985 | 38 | Jacques-Louis David | Luc de Nanteuil |
| 1366 | collected-poems-1947-1980 | 2025 | 1988 | 37 | Collected Poems 1947-1980 | Allen Ginsberg |
| 4535 | garden-of-shadows | 2024 | 1987 | 37 | Garden of Shadows | V.C. Andrews |
| 16774 | beyond-illusions | 1987 | 1950 | 37 | Beyond Illusions | Dương Thu Hương |
| 628 | not-out-of-hate | 1955 | 1991 | -36 | Not Out of Hate | Ma Ma Lay |
| 687 | my-century-aleksander-wat | 1977 | 2013 | -36 | My Century | Aleksander Wat |
| 901 | human-landscapes-from-my-country | 1966 | 2002 | -36 | Human Landscapes from My Country | Nâzım Hikmet |
| 2122 | bad-boy | 2025 | 1989 | 36 | Bad Boy | Diana Wieler |
| 3897 | scylla-and-charybdis | 2025 | 1989 | 36 | Scylla and Charybdis | Bernard Evslin |
| 2024 | the-human-body | 2025 | 1990 | 35 | The Human Body | Brian Ford |
| 10010 | male-female-roles | 2023 | 1988 | 35 | Male/Female Roles | Bruno Leone |
| 16764 | di-bawah-lentera-merah | 1964 | 1999 | -35 | Di Bawah Lentera Merah | Soe Hok Gie |
| 1714 | we-all-fall-down | 2025 | 1991 | 34 | We All Fall Down | Robert Cormier |
| 892 | my-uncle-napoleon | 1973 | 2006 | -33 | My Uncle Napoleon | Iraj Pezeshkzad |
| 1167 | how-the-garcia-girls-lost-their-accents | 2025 | 1992 | 33 | How the Garcia Girls Lost Their Accents | Julia Alvarez |
| 1348 | the-waste-lands | 2025 | 1992 | 33 | The Waste Lands | Stephen King |
| 6240 | therese-raquin | 1867 | 1900 | -33 | Thérèse Raquin | Émile Zola |
| 8903 | the-need-to-know-library-everything-you-need-to-know-about-date-rape | 2023 | 1990 | 33 | The Need to Know Library: Everything You Need to Know About Date Rape | Frances Shuker-Haines |
| 16737 | cerromaior | 1943 | 1976 | -33 | Cerromaior | Manuel da Fonseca |
| 3472 | aztec-inca-maya | 2025 | 1993 | 32 | Aztec Inca & Maya | Elizabeth Baquedano |
| 3602 | david-della | 2025 | 1993 | 32 | David & Della | Paul Zindel |
| 4521 | dragonfly-in-amber | 2024 | 1992 | 32 | Dragonfly in Amber | Diana Gabaldon |
| 10166 | tag-along-timothy-tours-texas | 2024 | 1992 | 32 | Tag-along Timothy Tours Texas | Jean Richardson |
| 16735 | engrenagem | 1951 | 1983 | -32 | Engrenagem | Soeiro Pereira Gomes |
| 1311 | nightmares-and-dreamscapes | 2025 | 1994 | 31 | Nightmares and Dreamscapes | Stephen King |
| 1516 | insomnia | 2025 | 1994 | 31 | Insomnia | Stephen King |
| 16921 | siedem-dalekich-rejsow | 1961 | 1992 | -31 | Siedem dalekich rejsów | Leopold Tyrmand |
| 720 | ate-amanha-camaradas | 1974 | 2004 | -30 | Até amanhã, camaradas | Manuel Tiago |
| 1702 | alice-the-brave | 2025 | 1995 | 30 | Alice the Brave | Phyllis Reynolds Naylor |
| 2018 | mythology | 2025 | 1995 | 30 | Mythology | DK |
| 14740 | la-tragedie-de-dantzig | 1935 | 1965 | -30 | La tragédie de Dantzig | Jean-Paul Garnier |
| 16745 | la-fiel-infanteria | 1943 | 1973 | -30 | La fiel infantería | Rafael García Serrano |
| 16748 | san-camilo-1936 | 1969 | 1999 | -30 | San Camilo, 1936 | Camilo José Cela |
| 16948 | frede-laku-noc | 1967 | 1997 | -30 | Frede, laku noć | Dragoslav Mihailović |
| 1131 | the-green-mile | 2025 | 1996 | 29 | The Green Mile | Stephen King |
| 3848 | mexican-central-south-american-art | 2025 | 1996 | 29 | Mexican, Central & South American Art | John Scott |
| 8981 | i-hadnt-meant-to-tell-you-this | 2023 | 1994 | 29 | I Hadn't Meant to Tell You This | Jacqueline Woodson |
| 10 | lady-chatterleys-lover | 1928 | 1900 | 28 | Lady Chatterley's Lover | D.H. Lawrence |
| 744 | epitaphios-ritsos | 1936 | 1964 | -28 | Epitaphios | Yannis Ritsos |
| 751 | the-dwarf-cho-se-hui | 1978 | 2006 | -28 | The Dwarf | Cho Se-hui |
| 1248 | mercy | 2024 | 1996 | 28 | Mercy | Jodi Picoult |
| 1506 | ghost-world | 2025 | 1997 | 28 | Ghost World | Daniel Clowes |
| 5382 | a-pair-of-socks | 2024 | 1996 | 28 | A Pair of Socks | Stuart J. Murphy |
| 16939 | the-farewell-party | 1972 | 2000 | -28 | The Farewell Party | Milan Kundera |
| 16980 | risale-i-nur | 1950 | 1978 | -28 | Risale-i Nur | Said Nursi |
| 1409 | no-david | 2025 | 1998 | 27 | No, David! | David Shannon |
| 8963 | divine-secrets-of-the-ya-ya-sisterhood | 2023 | 1996 | 27 | Divine Secrets of the Ya-Ya Sisterhood | Rebecca Wells |
| 9373 | fall-on-your-knees | 2023 | 1996 | 27 | Fall on Your Knees | Ann-Marie MacDonald |
| 16424 | buch-der-lieder | 1827 | 1800 | 27 | Buch der Lieder | Heinrich Heine |
| 1186 | the-girl-who-loved-tom-gordon | 2025 | 1999 | 26 | The Girl Who Loved Tom Gordon | Stephen King |
| 1293 | girl-with-a-pearl-earring | 2025 | 1999 | 26 | Girl with a Pearl Earring | Tracy Chevalier |
| 1329 | song-of-susannah | 2025 | 1999 | 26 | Song of Susannah | Stephen King |
| 4271 | maxfield-parrish-1870-1966 | 2025 | 1999 | 26 | Maxfield Parrish, 1870-1966 | Sylvia Yount |
| 4371 | the-childrens-dictionary-of-mythology | 2025 | 1999 | 26 | The Children's Dictionary of Mythology | David Adams Leeming |
| 7477 | emergency | 1964 | 1990 | -26 | Emergency | Richard Rive |
| 8791 | raintree-steck-vaughn-illustrated-science-encyclopedia | 2023 | 1997 | 26 | Raintree Steck-Vaughn Illustrated Science Encyclopedia | Andromeda Oxford |
| 9546 | blus-hanging | 2024 | 1998 | 26 | Blu's Hanging | Lois-Ann Yamanaka |
| 16916 | the-issa-valley | 1955 | 1981 | -26 | The Issa Valley | Czesław Miłosz |
| 115 | an-american-tragedy | 1925 | 1900 | 25 | An American Tragedy | Theodore Dreiser |
| 642 | blue-lard | 1999 | 2024 | -25 | Blue Lard | Vladimir Sorokin |
| 682 | god-dies-by-the-nile | 1974 | 1999 | -25 | God Dies by the Nile | Nawal El Saadawi |
| 1104 | alice-on-the-outside | 2024 | 1999 | 25 | Alice on the Outside | Phyllis Reynolds Naylor |
| 2033 | athena | 2025 | 2000 | 25 | Athena | B. A. Hoena |
| 2585 | the-rescue | 2025 | 2000 | 25 | The Rescue | Nicholas Sparks |
| 2754 | rogue-wave-and-other-red-blooded-sea-stories | 2024 | 1999 | 25 | Rogue Wave: And Other Red-Blooded Sea Stories | Theodore Taylor |
| 2914 | as-nature-made-him-the-boy-who-was-raised-as-a-girl | 2025 | 2000 | 25 | As Nature Made Him: The Boy Who Was Raised as A Girl | John Colapinto |
| 6263 | jew-suss-feuchtwanger | 1925 | 1900 | 25 | Jud Süß | Lion Feuchtwanger |
| 9734 | love-ellen-a-mother-daughter-journey | 2024 | 1999 | 25 | Love, Ellen: A Mother/Daughter Journey | Betty DeGeneres |
| 723 | a-handful-of-sand-takuboku | 1910 | 1934 | -24 | A Handful of Sand | Ishikawa Takuboku |
| 1368 | on-the-bright-side-im-now-the-girlfriend-of-a-sex-god | 2025 | 2001 | 24 | On the Bright Side, I'm Now the Girlfriend of a Sex God | Louise Rennison |
| 3394 | dragon-ball-vol-6 | 2025 | 2001 | 24 | Dragon Ball, Vol. 6 | Akira Toriyama |
| 3690 | flight-of-the-raven | 2025 | 2001 | 24 | Flight of the Raven | Stephanie Tolan |
| 3988 | the-new-encyclopedia-of-the-cat | 2025 | 2001 | 24 | The New Encyclopedia of the Cat | Bruce Fogle |
| 4193 | gods-goddesses-in-the-daily-life-of-the-ancient-greeks | 2025 | 2001 | 24 | Gods & Goddesses in the Daily Life of the Ancient Greeks | Fiona Macdonald |
| 5348 | 1900-10-new-ways-of-seeing | 2024 | 2000 | 24 | 1900-10: New Ways of Seeing | Jackie Gaff |
| 16713 | spring | 1938 | 1962 | -24 | Spring | Ba Jin |
| 16881 | los-dias-terrenales | 1949 | 1973 | -24 | Los días terrenales | José Revueltas |
| 16914 | ferdydurke | 1937 | 1961 | -24 | Ferdydurke | Witold Gombrowicz |
| 996 | the-prophet-gibran | 1923 | 1900 | 23 | The Prophet | Kahlil Gibran |
| 1285 | everythings-eventual-14-dark-tales | 2025 | 2002 | 23 | Everything's Eventual: 14 Dark Tales | Stephen King |
| 1291 | from-a-buick-8 | 2025 | 2002 | 23 | From a Buick 8 | Stephen King |
| 1432 | gingerbread | 2025 | 2002 | 23 | Gingerbread | Rachel Cohn |
| 1678 | you-know-you-love-me | 2025 | 2002 | 23 | You Know You Love Me | Cecily von Ziegesar |
| 3395 | dragon-ball-vol-7 | 2025 | 2002 | 23 | Dragon Ball, Vol. 7 | Akira Toriyama |
| 3688 | first-french-kiss-and-other-traumas | 2025 | 2002 | 23 | First French Kiss: And Other Traumas | Adam Bagdasarian |
| 6178 | perrines-literature-structure-sound-and-sense | 2024 | 2001 | 23 | Perrine's Literature Structure, Sound, and Sense | Thomas R. Arp |
| 8450 | merriam-websters-elementary-dictionary | 2023 | 2000 | 23 | Merriam-Webster's Elementary Dictionary | Editors of Merriam-Webster |
| 1168 | keeping-you-a-secret | 2025 | 2003 | 22 | Keeping You a Secret | Julie Anne Peters |
| 1195 | wolves-of-the-calla | 2025 | 2003 | 22 | Wolves of the Calla | Stephen King |
| 1413 | pinkalicious | 2025 | 2003 | 22 | Pinkalicious | Victoria Kann |
| 2399 | mirror-mirror | 2025 | 2003 | 22 | Mirror, Mirror | Gregory Maguire |
| 2542 | the-battle-of-jericho | 2025 | 2003 | 22 | The Battle of Jericho | Sharon M. Draper |
| 2748 | outlaw-girl-of-sherwood-forest | 2024 | 2002 | 22 | Outlaw Girl of Sherwood Forest | Nancy Springer |
| 3392 | dragon-ball-vol-4 | 2025 | 2003 | 22 | Dragon Ball, Vol. 4 | Akira Toriyama |
| 3698 | freaky-green-eyes | 2025 | 2003 | 22 | Freaky Green Eyes | Joyce Carol Oates |
| 3754 | home-life-in-ancient-rome | 2025 | 2003 | 22 | Home Life in Ancient Rome | Daniel C. Gedacht |
| 7806 | the-accident-season | 2023 | 2001 | 22 | The Accident Season | Moïra Fowley-Doyle |
| 8181 | every-time-a-rainbow-dies | 2023 | 2001 | 22 | Every Time a Rainbow Dies | Rita Williams-Garcia |
| 9869 | you-dont-know-me | 2023 | 2001 | 22 | You Don't Know Me | David Klass |
| 16954 | uten-en-trad | 1966 | 1988 | -22 | Uten en tråd | Jens Bjørneboe |
| 178 | by-grand-central-station-i-sat-down-and-wept | 1945 | 1966 | -21 | By Grand Central Station I Sat Down and Wept | Elizabeth Smart |
| 712 | el-monte-lydia-cabrera | 1954 | 1975 | -21 | El Monte | Lydia Cabrera |
| 1499 | dead-to-the-world | 2025 | 2004 | 21 | Dead to the World | Charlaine Harris |
| 1651 | ttyl | 2025 | 2004 | 21 | ttyl | Lauren Myracle |
| 2465 | princess-in-pink | 2025 | 2004 | 21 | Princess in Pink | Meg Cabot |
| 2966 | cheeky-angel-vol-2 | 2025 | 2004 | 21 | Cheeky Angel, Vol. 2 | Hiroyuki Nishimori |
| 3792 | land-and-resources-of-ancient-greece | 2025 | 2004 | 21 | Land and Resources of Ancient Greece | Melanie Ann Apel |
| 3832 | margaux-with-an-x | 2025 | 2004 | 21 | Margaux with an X | Ronald Koertge |
| 4011 | the-usborne-introduction-to-art | 2025 | 2004 | 21 | The Usborne Introduction to Art | Rosie Dickins |
| 5563 | falling-through-darkness | 2024 | 2003 | 21 | Falling Through Darkness | Carolyn MacCullough |
| 590 | i-write-what-i-like | 1978 | 1958 | 20 | I Write What I Like | Steve Biko |
| 2760 | summer-of-secrets | 2024 | 2004 | 20 | Summer of Secrets | Paul Langan |
| 3927 | the-battle-of-the-labyrinth | 2025 | 2005 | 20 | The Battle of the Labyrinth | Rick Riordan |
| 5486 | chinese-mythology-a-to-z | 2024 | 2004 | 20 | Chinese Mythology A to Z | Jeremy Roberts |
| 7632 | inu-yasha-ani-manga | 2024 | 2004 | 20 | Inu-Yasha: Ani-Manga | Rumiko Takahashi |
| 9567 | portraits-of-african-american-heroes | 2023 | 2003 | 20 | Portraits of African-American Heroes | Tonya Bolden |
| 15112 | lallemand | 1938 | 1918 | 20 | L’Allemand | Jacques Riviere |
| 16750 | cancionero-y-romancero-de-ausencias | 1958 | 1978 | -20 | Cancionero y romancero de ausencias | Miguel Hernández |
| 1143 | princess-on-the-brink | 2025 | 2006 | 19 | Princess on the Brink | Meg Cabot |
| 1355 | vegan-virgin-valentine | 2025 | 2006 | 19 | Vegan, Virgin, Valentine | Carolyn Mackler |
| 1453 | just-listen | 2025 | 2006 | 19 | Just Listen | Sarah Dessen |
| 1559 | pride-of-baghdad | 2025 | 2006 | 19 | Pride of Baghdad | Brian K. Vaughan |
| 1670 | winters-bone | 2025 | 2006 | 19 | Winter's Bone | Daniel Woodrell |
| 1682 | story-of-a-girl | 2025 | 2006 | 19 | Story of a Girl | Sara Zarr |
| 1696 | true-believer | 2024 | 2005 | 19 | True Believer | Nicholas Sparks |
| 2603 | the-warrior-heir | 2025 | 2006 | 19 | The Warrior Heir | Cinda Williams Chima |
| 2619 | valentine-princess | 2025 | 2006 | 19 | Valentine Princess | Meg Cabot |
| 7763 | youre-the-one-that-i-want | 2023 | 2004 | 19 | You're the One That I Want | Cecily von Ziegesar |
| 9802 | dark-lover | 2024 | 2005 | 19 | Dark Lover | J.R. Ward |
| 10064 | the-encyclopedia-of-unsolved-crimes-2nd-edition | 2023 | 2004 | 19 | The Encyclopedia of Unsolved Crimes | Michael Newton |
| 16635 | down-second-avenue | 1959 | 1940 | 19 | Down Second Avenue | Es'kia Mphahlele |
| 16975 | healing-the-broken-family-of-abraham | 2001 | 2020 | -19 | Healing the Broken Family of Abraham | Don McCurry |
| 37 | forever-judy-blume | 1975 | 1957 | 18 | Forever | Judy Blume |
| 1103 | betrayed | 2025 | 2007 | 18 | Betrayed | P. C. Cast |
| 1252 | 21-proms | 2025 | 2007 | 18 | 21 Proms | David Levithan |
| 1535 | lessons-from-a-dead-girl | 2025 | 2007 | 18 | Lessons from a Dead Girl | Jo Knowles |
| 1603 | the-god-box | 2025 | 2007 | 18 | The God Box | Alex Sanchez |
| 1654 | two-way-street | 2025 | 2007 | 18 | Two-Way Street | Lauren Barnholdt |
| 2307 | gym-candy | 2025 | 2007 | 18 | Gym Candy | Carl Deuker |
| 2685 | tweak-growing-up-on-methamphetamines | 2025 | 2007 | 18 | Tweak: Growing Up on Methamphetamines | Nic Sheff |
| 5300 | no-bows | 2024 | 2006 | 18 | No Bows! | Shirley Smith |
| 16601 | studies-in-muslim-apocalyptic | 2002 | 2020 | -18 | Studies in Muslim Apocalyptic | David Cook |
| 16880 | los-hijos-de-sanchez | 1964 | 1982 | -18 | Los hijos de Sánchez | Oscar Lewis |
| 16897 | geografia-general-de-los-estados-unidos-de-colombia | 1865 | 1883 | -18 | Geografía general de los Estados Unidos de Colombia | Felipe Pérez |
| 733 | touba-and-the-meaning-of-night | 1989 | 2006 | -17 | Touba and the Meaning of Night | Shahrnush Parsipur |
| 839 | the-prince-machiavelli | 1532 | 1515 | 17 | The Prince | Niccolò Machiavelli |
| 887 | nadirs-muller | 1982 | 1999 | -17 | Nadirs | Herta Müller |
| 1166 | frostbite | 2025 | 2008 | 17 | Frostbite | Richelle Mead |
| 1521 | just-after-sunset | 2025 | 2008 | 17 | Just After Sunset | Stephen King |
| 3082 | hit-the-road-manny | 2025 | 2008 | 17 | Hit the Road, Manny | Christian Burch |
| 5994 | the-quest-begins | 2025 | 2008 | 17 | The Quest Begins | Erin Hunter |
| 6124 | wolf-island | 2025 | 2008 | 17 | Wolf Island | Darren Shan |
| 6248 | how-the-red-sun-rose | 2000 | 2017 | -17 | How the Red Sun Rose | Gao Hua |
| 9421 | the-art-of-hana-kimi | 2023 | 2006 | 17 | The Art of Hana-Kimi | Hisaya Nakajo |
| 10106 | beethoven-was-one-sixteenth-black-and-other-stories | 2024 | 2007 | 17 | Beethoven Was One-sixteenth Black: and Other Stories | Nadine Gordimer |
| 10196 | id-tell-you-i-love-you-but-then-id-have-kill-you | 2023 | 2006 | 17 | I’d Tell You I Love You, But Then I’d Have Kill You | Ally Carter |
| 16896 | la-metamorfosis-de-su-excelencia | 1949 | 1966 | -17 | La metamorfosis de su excelencia | Jorge Zalamea |
| 16908 | tre-operai | 1934 | 1951 | -17 | Tre operai | Carlo Bernari |
| 691 | nostalgia-mircea-cartarescu | 1989 | 2005 | -16 | Nostalgia | Mircea Cărtărescu |
| 885 | too-loud-a-solitude | 1976 | 1992 | -16 | Too Loud a Solitude | Bohumil Hrabal |
| 1231 | change-of-heart | 2024 | 2008 | 16 | Change of Heart | Jodi Picoult |
| 1297 | hold-still | 2025 | 2009 | 16 | Hold Still | Nina LaCour |
| 1511 | handle-with-care | 2025 | 2009 | 16 | Handle with Care | Jodi Picoult |
| 1623 | the-magicians | 2025 | 2009 | 16 | The Magicians | Lev Grossman |
| 1648 | touch | 2025 | 2009 | 16 | Touch | Francine Prose |
| 2666 | goth-girl-rising | 2025 | 2009 | 16 | Goth Girl Rising | Barry Lyga |
| 3414 | a-heros-guide-to-warriors | 2025 | 2009 | 16 | A Hero's Guide to Warriors | Deborah Murrell |
| 4101 | annie-leibovitz-at-work | 2025 | 2009 | 16 | Annie Leibovitz at Work | Annie Leibovitz |
| 4109 | art-theory-for-beginners | 2025 | 2009 | 16 | Art Theory for Beginners | Richard Osborne |
| 7882 | dont-you-forget-about-me | 2023 | 2007 | 16 | Don't You Forget about Me | Cecily von Ziegesar |
| 8922 | the-case-of-the-left-handed-lady | 2023 | 2007 | 16 | The Case of the Left-Handed Lady | Nancy Springer |
| 9963 | 10th-anniversary | 2024 | 2008 | 16 | 10th Anniversary | James Patterson |
| 9980 | you-just-cant-get-enough | 2024 | 2008 | 16 | You Just Can't Get Enough | Cecily von Ziegesar |
| 16894 | una-gestapo-en-america | 1946 | 1962 | -16 | Una Gestapo en América | Juan Isidro Jimenes Grullón |
| 16930 | noaptea-de-sanziene | 1955 | 1971 | -16 | Noaptea de Sânziene | Mircea Eliade |
| 16941 | love-and-garbage | 1986 | 2002 | -16 | Love and Garbage | Ivan Klíma |
| 45 | the-bell-jar | 1963 | 1948 | 15 | The Bell Jar | Sylvia Plath |
| 62 | noli-me-tangere | 1887 | 1902 | -15 | Noli Me Tángere | José Rizal |
| 745 | axion-esti | 1959 | 1974 | -15 | Axion Esti | Odysseas Elytis |
| 935 | the-quiet-american | 1955 | 1940 | 15 | The Quiet American | Graham Greene |
| 1180 | spirit-bound | 2025 | 2010 | 15 | Spirit Bound | Richelle Mead |
| 1227 | awakened | 2025 | 2010 | 15 | Awakened | P. C. Cast |
| 1232 | clockwork-angel | 2025 | 2010 | 15 | Clockwork Angel | Cassandra Clare |
| 1322 | rules-of-attraction | 2025 | 2010 | 15 | Rules of Attraction | Simone Elkeles |
| 1337 | the-girl-who-fell-from-the-sky | 2025 | 2010 | 15 | The Girl Who Fell from the Sky | Heidi W. Durrow |
| 1449 | gone | 2025 | 2010 | 15 | Gone | Lisa McMann |
| 1619 | the-lovers-dictionary | 2025 | 2010 | 15 | The Lover's Dictionary | David Levithan |
| 1838 | jumpstart-the-world | 2025 | 2010 | 15 | Jumpstart the World | Catherine Ryan Hyde |
| 2723 | attila-the-hun-leader-of-the-barbarian-hordes | 2024 | 2009 | 15 | Attila the Hun: Leader of the Barbarian Hordes | Sean Stewart Price |
| 2808 | laid-young-peoples-experience-with-sex-in-an-easy-access-culture | 2024 | 2009 | 15 | Laid: Young People's Experience with Sex in an Easy-Access Culture | Shannon T. Boodram |
| 3859 | mystics-and-psychics | 2025 | 2010 | 15 | Mystics and Psychics | Joanne Mattern |
| 4293 | netters-anatomy-coloring-book | 2025 | 2010 | 15 | Netter's Anatomy Coloring Book | John T. Hansen |
| 5579 | food-girls-and-other-things-i-cant-have | 2024 | 2009 | 15 | Food, Girls, and Other Things I Can't Have | Allen Zadoff |
| 6056 | true-things-adults-dont-want-kids-to-know | 2025 | 2010 | 15 | True Things (Adults Don't Want Kids to Know) | Jimmy Gownley |
| 9971 | love-the-one-youre-with | 2024 | 2009 | 15 | Love the One You're With | Cecily von Ziegesar |
| 16909 | il-garofano-rosso | 1933 | 1948 | -15 | Il garofano rosso | Elio Vittorini |
| 16969 | de-zoon-van-dik-trom | 1907 | 1922 | -15 | De zoon van Dik Trom | C. Joh. Kieviet |
| 939 | red-dust-ma-jian | 1987 | 2001 | -14 | Red Dust | Ma Jian |
| 1092 | forbidden | 2025 | 2011 | 14 | Forbidden | Tabitha Suzuma |
| 1114 | beautiful-disaster | 2025 | 2011 | 14 | Beautiful Disaster | Jamie McGuire |
| 1520 | joyland | 2025 | 2011 | 14 | Joyland | Stephen King |
| 1966 | wandering-son-vol-1 | 2025 | 2011 | 14 | Wandering Son, Vol. 1 | Takako Shimura |
| 1989 | soul-eater-vol-2 | 2024 | 2010 | 14 | Soul Eater, Vol. 2 | Atsushi Ohkubo |
| 2126 | embrace | 2025 | 2011 | 14 | Embrace | Jessica Shirvington |
| 2191 | big-nate-from-the-top | 2024 | 2010 | 14 | Big Nate From the Top | Lincoln Peirce |
| 5449 | bad-deal | 2024 | 2010 | 14 | Bad Deal | Susan J. Korman |
| 5703 | keys-to-the-repository | 2024 | 2010 | 14 | Keys to the Repository | Melissa de la Cruz |
| 7232 | tokyo-ghoul | 2025 | 2011 | 14 | Tokyo Ghoul | Sui Ishida |
| 7864 | the-9th-judgment | 2024 | 2010 | 14 | The 9th Judgment | James Patterson |
| 10267 | scott-pilgrim-vol-5-scott-pilgrim-vs-the-universe | 2023 | 2009 | 14 | Scott Pilgrim Vol. 5: Scott Pilgrim vs. the Universe | Bryan Lee O'Malley |
| 15092 | la-guerre-des-femmes | 1938 | 1924 | 14 | La guerre des femmes | Antoine Redier |
| 16545 | the-last-straw | 2009 | 1995 | 14 | The Last Straw | Jeff Kinney |
| 16653 | the-children-of-soweto | 1981 | 1995 | -14 | The Children of Soweto | Mbulelo Vizikhungo Mzamane |
| 16833 | le-pauvre-christ-de-bomba | 1956 | 1970 | -14 | Le pauvre Christ de Bomba | Mongo Béti |
| 16940 | judge-on-trial | 1978 | 1992 | -14 | Judge on Trial | Ivan Klíma |
| 16970 | algemene-staatsleer | 1937 | 1951 | -14 | Algemene Staatsleer | R. Kranenburg |
| 16994 | smile-as-they-bow | 1994 | 2008 | -14 | Smile as They Bow | Nu Nu Yi |
| 68 | candide | 1759 | 1746 | 13 | Candide | Voltaire |
| 940 | the-noodle-maker | 1991 | 2004 | -13 | The Noodle Maker | Ma Jian |
| 1050 | islam-revealed | 1988 | 2001 | -13 | Islam Revealed: A Christian Arab's View of Islam | Anis Shorrosh |
| 1305 | invisible-monsters-remix | 2025 | 2012 | 13 | Invisible Monsters Remix | Chuck Palahniuk |
| 1323 | see-you-at-harrys | 2025 | 2012 | 13 | See You at Harry's | Jo Knowles |
| 1967 | wandering-son-vol-2 | 2025 | 2012 | 13 | Wandering Son, Vol. 2 | Takako Shimura |
| 2031 | ancient-roman-art-and-architecture | 2025 | 2012 | 13 | Ancient Roman Art and Architecture | Don Nardo |
| 4439 | understanding-greek-myths | 2025 | 2012 | 13 | Understanding Greek Myths | Natalie Hyde |
| 5547 | european-architecture-in-details | 2024 | 2011 | 13 | European Architecture in Details |  |
| 5777 | michelangelo-his-life-and-works-in-500-images | 2024 | 2011 | 13 | Michelangelo: His Life and Works in 500 Images | Rosalind Ormiston |
| 5953 | the-crown-of-embers | 2025 | 2012 | 13 | The Crown of Embers | Rae Carson |
| 5973 | the-gods-and-goddesses-of-greek-mythology | 2025 | 2012 | 13 | The Gods and Goddesses of Greek Mythology | Don Nardo |
| 7653 | the-earl-the-fairy | 2025 | 2012 | 13 | The Earl & the Fairy | Ayuko |
| 8310 | the-absolute-value-of-1 | 2023 | 2010 | 13 | The Absolute Value of -1 | Steven Brezenoff |
| 9965 | 2-days | 2024 | 2011 | 13 | 2 Days | L.B. Tillit |
| 10205 | abraham-lincoln-vampire-hunter | 2023 | 2010 | 13 | Abraham Lincoln: Vampire Hunter | Seth Grahame-Smith |
| 16739 | o-arcanjo-negro | 1947 | 1960 | -13 | O Arcanjo Negro | Aquilino Ribeiro |
| 833 | the-palace-of-dreams | 1981 | 1993 | -12 | The Palace of Dreams | Ismail Kadare |
| 1113 | skin | 2025 | 2013 | 12 | Skin | Donna Jo Napoli |
| 1196 | yaqui-delgado-wants-to-kick-your-ass | 2025 | 2013 | 12 | Yaqui Delgado Wants to Kick Your Ass | Meg Medina |
| 1435 | the-vincent-boys | 2025 | 2013 | 12 | The Vincent Boys | Abbi Glines |
| 1441 | chasing-shadows | 2025 | 2013 | 12 | Chasing Shadows | Swati Avasthi |
| 1494 | cherry-money-baby | 2025 | 2013 | 12 | Cherry Money Baby | John M. Cusick |
| 1514 | if-he-had-been-with-me | 2025 | 2013 | 12 | If He Had Been With Me | Laura Nowlin |
| 1539 | me-him-them-and-it | 2025 | 2013 | 12 | Me, Him, Them and It | Caela Carter |
| 1662 | uses-for-boys | 2025 | 2013 | 12 | Uses for Boys | Erica Lorraine Scheidt |
| 1968 | wandering-son-vol-4 | 2025 | 2013 | 12 | Wandering Son, Vol. 4 | Takako Shimura |
| 2441 | orphan-train | 2024 | 2012 | 12 | Orphan Train | Christina Baker Kline |
| 2836 | saga-vol-1 | 2024 | 2012 | 12 | Saga, Vol. 1 | Brian K. Vaughan |
| 5533 | el-gusano-de-tequila | 2024 | 2012 | 12 | El Gusano de Tequila | Viola Canales |
| 7984 | research-for-the-social-improvement-and-general-betterment-of-lydia-goldblatt-and-julie-graham-chang | 2023 | 2011 | 12 | Research for the Social Improvement and General Betterment of Lydia Goldblatt and Julie Graham-Chang | Amy Ignatow |
| 8271 | rival | 2023 | 2011 | 12 | Rival | Sara Bennett-Wealer |
| 8862 | neon-genesis-evangelion-3-in-1-edition-vol-1 | 2024 | 2012 | 12 | Neon Genesis Evangelion: 3-in-1 edition, Vol. 1 | Yoshiyuki Sadamoto |
| 9333 | fifty-shades-freed | 2023 | 2011 | 12 | Fifty Shades Freed | E L James |
| 9888 | edge-of-ready | 2023 | 2011 | 12 | Edge of Ready | L.B. Tillit |
| 10264 | what-cant-wait | 2023 | 2011 | 12 | What Can't Wait | Ashley Hope Perez |
| 14459 | les-dieux-tremblent | 1933 | 1921 | 12 | Les dieux tremblent | Marcel Berger |
| 15268 | lallemagne | 1940 | 1952 | -12 | L’Allemagne | Edmond Vermeil |
| 16765 | tan-malaka-pergulatan-menuju-republik | 1988 | 2000 | -12 | Tan Malaka: Pergulatan Menuju Republik | Harry A. Poeze |
| 16934 | the-cowards | 1958 | 1970 | -12 | The Cowards | Josef Škvorecký |
| 563 | son-lois-lowry | 2012 | 2001 | 11 | Son | Lois Lowry |
| 600 | fifty-shades-of-grey | 2011 | 2000 | 11 | Fifty Shades of Grey | E L James |
| 1152 | assassination-classroom-vol-1 | 2025 | 2014 | 11 | Assassination Classroom, Vol. 1 | Yūsei Matsui |
| 1192 | this-day-in-june | 2025 | 2014 | 11 | This Day in June | Gayle E. Pitman |
| 1303 | in-a-handful-of-dust | 2025 | 2014 | 11 | In a Handful of Dust | Mindy McGinnis |
| 1454 | lord-of-shadows | 2025 | 2014 | 11 | Lord of Shadows | Cassandra Clare |
| 1503 | finders-keepers | 2025 | 2014 | 11 | Finders Keepers | Stephen King |
| 1551 | one-man-guy | 2025 | 2014 | 11 | One Man Guy | Michael Barakiva |
| 1607 | the-hit | 2025 | 2014 | 11 | The Hit | Melvin Burgess |
| 2625 | when-mr-dog-bites | 2025 | 2014 | 11 | When Mr. Dog Bites | Brian Conaghan |
| 2822 | october-sky-rocket-boys | 2024 | 2013 | 11 | October Sky/Rocket Boys | Homer Hickam Jr. |
| 3916 | tales-from-my-closet | 2025 | 2014 | 11 | Tales From My Closet | Jennifer Anne Moses |
| 5555 | everybody-paints-the-lives-and-art-of-the-wyeth-family | 2024 | 2013 | 11 | Everybody Paints!: The Lives and Art of the Wyeth Family | Susan Goldman Rubin |
| 5637 | hero-on-a-bicycle | 2024 | 2013 | 11 | Hero on a Bicycle | Shirley Hughes |
| 5751 | manga-martial-arts-figures | 2024 | 2013 | 11 | Manga Martial Arts Figures | Richard Jones |
| 5901 | seraph-of-the-end-vampire-reign | 2025 | 2014 | 11 | Seraph of the End: Vampire Reign | Takaya Kagami |
| 10229 | the-death-of-bees | 2023 | 2012 | 11 | The Death of Bees | Lisa O'Donnell |
| 16460 | andersens-fairy-tales | 1835 | 1846 | -11 | Andersen's Fairy Tales | Hans Christian Andersen |
| 16692 | hend-and-the-soldiers | 2006 | 2017 | -11 | Hend and the Soldiers | Badriah Albeshr |
| 16887 | sandino-general-de-hombres-libres | 1955 | 1966 | -11 | Sandino, general de hombres libres | Gregorio Selser |
| 711 | the-palace-of-the-white-skunks | 1980 | 1990 | -10 | The Palace of the White Skunks | Reinaldo Arenas |
| 718 | livro-sexto-sophia | 1962 | 1972 | -10 | Livro Sexto | Sophia de Mello Breyner Andresen |
| 737 | beijing-coma | 2008 | 1998 | 10 | Beijing Coma | Ma Jian |
| 1052 | mini-skirts-mothers-and-muslims | 2004 | 2014 | -10 | Mini Skirts, Mothers & Muslims | Christine Mallouhi |
| 1079 | a-tale-for-2000 | 2000 | 2010 | -10 | A Tale for 2000 | Bùi Ngọc Tấn |
| 1221 | lizard-radio | 2025 | 2015 | 10 | Lizard Radio | Pat Schmatz |
| 1236 | everything-i-never-told-you | 2024 | 2014 | 10 | Everything I Never Told You | Celeste Ng |
| 1436 | wonders-of-the-invisible-world | 2025 | 2015 | 10 | Wonders of the Invisible World | Christopher Barzak |
| 1595 | the-bazaar-of-bad-dreams | 2025 | 2015 | 10 | The Bazaar of Bad Dreams | Stephen King |
| 2405 | nearly-found | 2025 | 2015 | 10 | Nearly Found | Elle Cosimano |
| 2611 | tiny-pretty-things | 2025 | 2015 | 10 | Tiny Pretty Things | Sona Charaipotra |
| 5336 | si-somos-latinos | 2024 | 2014 | 10 | ¡Sí! somos Latinos | Alma Flor Ada |
| 6344 | my-watch-2005 | 2005 | 2015 | -10 | My Watch | Olusegun Obasanjo |
| 7983 | love-and-other-fiascos-with-lydia-goldblatt-and-julie-graham-chang | 2023 | 2013 | 10 | Love and Other Fiascos with Lydia Goldblatt and Julie Graham-Chang | Amy Ignatow |
| 8296 | revenge-of-a-not-so-pretty-girl | 2023 | 2013 | 10 | Revenge of a Not-So-Pretty Girl | Carolita Blythe |
| 9897 | frequently-asked-questions-about-same-sex-marriage-and-when-a-parent-is-gay | 2023 | 2013 | 10 | Frequently Asked Questions About Same-Sex Marriage and When A Parent is Gay | Tracy Brown |
| 15286 | laffaire-dreyfus | 1940 | 1930 | 10 | L’affaire Dreyfus | Bruno Weil |
| 16983 | the-railway | 1997 | 2007 | -10 | The Railway | Hamid Ismailov |
| 169 | capital-and-ideology | 2019 | 2010 | 9 | Capital and Ideology | Thomas Piketty |
| 568 | misery-stephen-king | 1987 | 1978 | 9 | Misery | Stephen King |
| 729 | memory-for-forgetfulness | 1986 | 1995 | -9 | Memory for Forgetfulness | Mahmoud Darwish |
| 850 | el-filibusterismo | 1891 | 1900 | -9 | El Filibusterismo | José Rizal |
| 995 | death-of-a-salesman | 1949 | 1940 | 9 | Death of a Salesman | Arthur Miller |
| 1015 | sylvias-marriage | 1914 | 1905 | 9 | Sylvia's Marriage | Upton Sinclair |
| 1094 | lady-midnight | 2025 | 2016 | 9 | Lady Midnight | Cassandra Clare |
| 1141 | if-i-was-your-girl | 2025 | 2016 | 9 | If I Was Your Girl | Meredith Russo |
| 1222 | the-abcs-of-lgbt | 2025 | 2016 | 9 | The ABC's of LGBT+ | Ashley Mardell |
| 1387 | identity-and-gender | 2025 | 2016 | 9 | Identity and Gender | Charlie Ogden |
| 1488 | assassination-classroom-vol-10 | 2025 | 2016 | 9 | Assassination Classroom, Vol. 10 | Yūsei Matsui |
| 1529 | kings-rising | 2025 | 2016 | 9 | Kings Rising | C. S. Pacat |
| 1657 | understanding-sexual-orientation-and-gender-identity | 2025 | 2016 | 9 | Understanding Sexual Orientation and Gender Identity | Robert Rodi |
| 1672 | without-annette | 2025 | 2016 | 9 | Without Annette | Jane B. Mason |
| 1742 | are-you-lgbtq | 2025 | 2016 | 9 | Are You LGBTQ? | Jeanne Nagle |
| 1814 | gender-politics | 2025 | 2016 | 9 | Gender Politics | Susan Henneberg |
| 1824 | introducing-teddy | 2025 | 2016 | 9 | Introducing Teddy | Jessica Walton |
| 1846 | lana-wachowski | 2025 | 2016 | 9 | Lana Wachowski | Jeff Mapua |
| 1963 | transgender-role-models-and-pioneers | 2025 | 2016 | 9 | Transgender Role Models and Pioneers | Barbra Penne |
| 2108 | supermutant-magic-academy | 2024 | 2015 | 9 | SuperMutant Magic Academy | Jillian Tamaki |
| 3026 | equality-diversity | 2025 | 2016 | 9 | Equality & Diversity | Charlie Ogden |
| 3504 | carve-the-mark | 2025 | 2016 | 9 | Carve the Mark | Veronica Roth |
| 5441 | arte-para-ninos-con-6-grandes-artistas | 2024 | 2015 | 9 | Arte para niños con 6 grandes artistas |  |
| 6193 | simmers-dho-health-science | 2024 | 2015 | 9 | Simmers DHO Health Science | Louise Simmers |
| 7986 | the-less-than-hidden-secrets-and-final-revelations-of-lydia-goldblatt-and-julie-graham-chang | 2023 | 2014 | 9 | The Less-Than-Hidden Secrets and Final Revelations of Lydia Goldblatt and Julie Graham-Chang | Amy Ignatow |
| 8240 | dont-look-back | 2023 | 2014 | 9 | Don't Look Back | Jennifer L. Armentrout |
| 8616 | glory-obriens-history-of-the-future | 2023 | 2014 | 9 | Glory O'Brien's History of the Future | A. S. King |
| 16549 | the-third-wheel | 2012 | 2003 | 9 | The Third Wheel | Jeff Kinney |
| 16553 | double-down | 2016 | 2007 | 9 | Double Down | Jeff Kinney |
| 16626 | chewing-gum | 2008 | 2017 | -9 | Chewing Gum | Mansour Bushnaf |
| 16693 | instructions-within | 2008 | 2017 | -9 | Instructions Within | Ashraf Fayadh |
| 16760 | sociology-cambridge-o-level-coursebook | 2014 | 2023 | -9 | Sociology (Cambridge O Level Coursebook) | Jonathan Blundell |
| 16773 | the-crystal-messenger | 1988 | 1997 | -9 | The Crystal Messenger | Phạm Thị Hoài |
| 52 | ulysses | 1922 | 1914 | 8 | Ulysses | James Joyce |
| 623 | woman-at-point-zero | 1975 | 1983 | -8 | Woman at Point Zero | Nawal El Saadawi |
| 849 | from-hell-alan-moore | 1999 | 1991 | 8 | From Hell | Alan Moore |
| 866 | goat-days | 2008 | 2016 | -8 | Goat Days | Benyamin |
| 1126 | grit | 2025 | 2017 | 8 | Grit | Gillian French |
| 1202 | lgbtq-rights | 2025 | 2017 | 8 | LGBTQ Rights | Susan Henneberg |
| 1225 | antisocial | 2025 | 2017 | 8 | Antisocial | Jillian Blake |
| 1267 | ban-this-book | 2025 | 2017 | 8 | Ban This Book | Alan Gratz |
| 1341 | the-marrow-thieves | 2025 | 2017 | 8 | The Marrow Thieves | Cherie Dimaline |
| 1375 | coming-out-as-transgender | 2025 | 2017 | 8 | Coming Out As Transgender | Corona Brezina |
| 1447 | far-from-the-tree | 2025 | 2017 | 8 | Far from the Tree | Robin Benway |
| 1483 | 10-things-i-can-see-from-here | 2025 | 2017 | 8 | 10 Things I Can See From Here | Carrie Mac |
| 1490 | being-transgender | 2025 | 2017 | 8 | Being Transgender | Robert Rodi |
| 1543 | midnight-jewel | 2025 | 2017 | 8 | Midnight Jewel | Richelle Mead |
| 1698 | we-know-it-was-you | 2024 | 2016 | 8 | We Know It Was You | Maggie Thrash |
| 2281 | flame-in-the-mist | 2025 | 2017 | 8 | Flame in the Mist | Renée Ahdieh |
| 2287 | forever-or-a-long-long-time | 2025 | 2017 | 8 | Forever or a Long Long Time | Caela Carter |
| 2656 | assassination-classroom-vol-18 | 2025 | 2017 | 8 | Assassination Classroom, Vol. 18 | Yūsei Matsui |
| 2910 | are-there-two-americas | 2025 | 2017 | 8 | Are There Two Americas | Caleb Bissinger |
| 3004 | critical-perspectives-on-social-justice | 2025 | 2017 | 8 | Critical Perspectives on Social Justice | Jennifer Peters |
| 3110 | identity-politics | 2025 | 2017 | 8 | Identity Politics | Elizabeth Schmermund |
| 3357 | how-is-online-pornography-affecting-society | 2024 | 2016 | 8 | How is Online Pornography Affecting Society | Christine Wilcox |
| 5499 | cruel-crown | 2024 | 2016 | 8 | Cruel Crown | Victoria Aveyard |
| 5511 | defending-taylor | 2024 | 2016 | 8 | Defending Taylor | Miranda Kenneally |
| 5964 | the-epic-fail-of-arturo-zamora | 2025 | 2017 | 8 | The Epic Fail of Arturo Zamora | Pablo Cartaya |
| 6239 | la-comedie-humaine | 1829 | 1837 | -8 | La Comédie humaine | Honoré de Balzac |
| 6255 | one-part-woman-perumal-murugan | 2010 | 2018 | -8 | One Part Woman | Perumal Murugan |
| 7688 | captain-underpants-and-the-sensational-saga-of-sir-stink-a-lot | 2023 | 2015 | 8 | Captain Underpants and the Sensational Saga of Sir Stink-a-Lot | Dav Pilkey |
| 8423 | ill-meet-you-there | 2023 | 2015 | 8 | I'll Meet You There | Heather Demetrios |
| 9077 | the-rule-of-mirrors | 2024 | 2016 | 8 | The Rule of Mirrors | Caragh M. O'Brien |
| 9629 | big-nate-say-good-bye-to-dork-city | 2023 | 2015 | 8 | Big Nate: Say Good-bye to Dork City | Lincoln Peirce |
| 9721 | worm-loves-worm | 2024 | 2016 | 8 | Worm Loves Worm | J.J. Austrian |
| 9755 | a-family-is-a-family-is-a-family | 2024 | 2016 | 8 | A Family Is a Family Is a Family | Sara O'Leary |
| 15149 | mussolini | 1939 | 1931 | 8 | Mussolini | Adolf Saager |
| 16552 | old-school | 2015 | 2007 | 8 | Old School | Jeff Kinney |
| 16555 | diper-overlode | 2022 | 2014 | 8 | Diper Overlode | Jeff Kinney |
| 16684 | sophies-world | 1991 | 1999 | -8 | Sophie's World | Jostein Gaarder |
| 16712 | rickshaw-boy | 1937 | 1945 | -8 | Rickshaw Boy | Lao She |
| 16740 | bel-ami | 1885 | 1893 | -8 | Bel-Ami | Guy de Maupassant |
| 16849 | a-volupia-do-pecado | 1948 | 1956 | -8 | A Volúpia do Pecado | Cassandra Rios |
| 95 | canto-general | 1950 | 1943 | 7 | Canto General | Pablo Neruda |
| 109 | the-book-thief | 2005 | 1998 | 7 | The Book Thief | Markus Zusak |
| 695 | the-power-of-the-powerless | 1978 | 1985 | -7 | The Power of the Powerless | Václav Havel |
| 951 | the-story-of-zahra | 1980 | 1987 | -7 | The Story of Zahra | Hanan al-Shaykh |
| 969 | a-little-life | 2015 | 2008 | 7 | A Little Life | Hanya Yanagihara |
| 1129 | someone-i-used-to-know | 2025 | 2018 | 7 | Someone I Used to Know | Patty Blount |
| 1173 | not-even-bones | 2025 | 2018 | 7 | Not Even Bones | Rebecca Schaeffer |
| 1185 | the-fever-king | 2025 | 2018 | 7 | The Fever King | Victoria Lee |
| 1201 | black-lives-matter | 2025 | 2018 | 7 | Black Lives Matter | Duchess Harris |
| 1325 | ship-it | 2025 | 2018 | 7 | Ship It | Britta Lundin |
| 1344 | the-outsider | 2025 | 2018 | 7 | The Outsider | Stephen King |
| 1439 | a-heart-in-a-body-in-the-world | 2025 | 2018 | 7 | A Heart in a Body in the World | Deb Caletti |
| 1458 | queen-of-air-and-darkness | 2025 | 2018 | 7 | Queen of Air and Darkness | Cassandra Clare |
| 1579 | solo-quedo-nuestra-historia | 2025 | 2018 | 7 | Solo quedó nuestra historia | Adam Silvera |
| 1728 | a-quick-easy-guide-to-they-them-pronouns | 2025 | 2018 | 7 | A Quick & Easy Guide to They/Them Pronouns | Archie Bongiovanni |
| 1828 | jack-not-jackie | 2025 | 2018 | 7 | Jack (Not Jackie) | Erica Silverman |
| 2133 | the-hidden-witch | 2025 | 2018 | 7 | The Hidden Witch | Molly Knox Ostertag |
| 2141 | a-spark-of-light | 2025 | 2018 | 7 | A Spark of Light | Jodi Picoult |
| 2253 | dive-smack | 2025 | 2018 | 7 | Dive Smack | Demetra Brodsky |
| 2677 | nightingale | 2025 | 2018 | 7 | Nightingale | Amy Lukavics |
| 2774 | the-magical-misfits | 2024 | 2017 | 7 | The Magical Misfits | Neil Patrick Harris |
| 3000 | counselling-skills-for-working-with-gender-diversity-and-identity | 2025 | 2018 | 7 | Counselling Skills for Working with Gender Diversity and Identity | Beattie. Michael |
| 3088 | house-of-rougeaux | 2025 | 2018 | 7 | House of Rougeaux | Jenny Jaeckel |
| 5138 | teens-and-gender-dysphoria | 2024 | 2017 | 7 | Teens and Gender Dysphoria | Don Nardo |
| 5968 | the-first-scientist-anaximander-and-his-legacy | 2025 | 2018 | 7 | The First Scientist: Anaximander and His Legacy | Carlo Rovelli |
| 6245 | the-red-sari | 2008 | 2015 | -7 | The Red Sari | Javier Moro |
| 7645 | pokemon-sun-moon | 2025 | 2018 | 7 | Pokémon: Sun & Moon | Hidenori Kusaka |
| 7966 | recess-warriors-hero-is-a-four-letter-word | 2024 | 2017 | 7 | Recess Warriors: Hero Is A Four-Letter Word | Marcus Emerson |
| 9115 | heels-heartache-and-headlines | 2024 | 2017 | 7 | Heels, Heartache and Headlines | Ni-Ni Simone |
| 9257 | dont-get-caught | 2023 | 2016 | 7 | Don't Get Caught | Kurt Dinan |
| 14579 | contacts-et-circonstances | 1940 | 1947 | -7 | Contacts et circonstances | Paul Claudel |
| 16690 | shumaisi | 1998 | 2005 | -7 | Shumaisi | Turki al-Hamad |
| 16743 | requiem-por-un-campesino-espanol | 1953 | 1960 | -7 | Réquiem por un campesino español | Ramón J. Sender |
| 16899 | prision-verde | 1950 | 1957 | -7 | Prisión Verde | Ramón Amaya Amador |
| 16937 | the-axe | 1966 | 1973 | -7 | The Axe | Ludvík Vaculík |
| 18 | the-color-purple | 1982 | 1976 | 6 | The Color Purple | Alice Walker |
| 130 | fun-home | 2006 | 2000 | 6 | Fun Home | Alison Bechdel |
| 694 | the-garden-party-havel | 1963 | 1969 | -6 | The Garden Party | Václav Havel |
| 735 | satans-stones-ravanipur | 1990 | 1996 | -6 | Satan's Stones | Moniru Ravanipur |
| 890 | in-praise-of-hatred | 2006 | 2012 | -6 | In Praise of Hatred | Khaled Khalifa |
| 1206 | zenobia-july | 2025 | 2019 | 6 | Zenobia July | Lisa Bunker |
| 1228 | be-not-far-from-me | 2025 | 2019 | 6 | Be Not Far From Me | Mindy McGinnis |
| 1283 | empire-of-wild | 2025 | 2019 | 6 | Empire of Wild | Cherie Dimaline |
| 1316 | only-mostly-devastated | 2025 | 2019 | 6 | Only Mostly Devastated | Sophie Gonzales |
| 1371 | birthday | 2025 | 2019 | 6 | Birthday | Meredith Russo |
| 1417 | red-at-the-bone | 2025 | 2019 | 6 | Red at the Bone | Jacqueline Woodson |
| 1424 | you-don-t-know-everything-jilly-p | 2024 | 2018 | 6 | You Don’t Know Everything, Jilly P! | Alex Gino |
| 1434 | the-downstairs-girl | 2025 | 2019 | 6 | The Downstairs Girl | Stacey Lee |
| 1474 | today-tonight-tomorrow | 2025 | 2019 | 6 | Today, Tonight, Tomorrow | Rachel Lynn Solomon |
| 1512 | high-school | 2025 | 2019 | 6 | High School | Sara Quin |
| 1515 | imaginary-friend | 2025 | 2019 | 6 | Imaginary Friend | Stephen Chbosky |
| 1666 | we-contain-multitudes | 2025 | 2019 | 6 | We Contain Multitudes | Sarah Henstra |
| 1864 | love-other-curses | 2025 | 2019 | 6 | Love & Other Curses | Michael Thomas Ford |
| 2071 | lets-talk-about-love | 2024 | 2018 | 6 | Let's Talk About Love | Claire Kann |
| 3221 | privilege-in-america | 2025 | 2019 | 6 | Privilege in America | Gary Wiener |
| 3383 | i-am-billie-jean-king | 2025 | 2019 | 6 | I am Billie Jean King | Brad Meltzer |
| 4597 | losing-the-field | 2024 | 2018 | 6 | Losing the Field | Abbi Glines |
| 5134 | synchro-boy | 2024 | 2018 | 6 | Synchro Boy | Shannon McFerran |
| 5202 | the-spy-with-the-red-balloon | 2024 | 2018 | 6 | The Spy with the Red Balloon | Katherine Locke |
| 6052 | tristan-strong-punches-a-hole-in-the-sky | 2025 | 2019 | 6 | Tristan Strong Punches a Hole in the Sky | Kwame Mbalia |
| 7594 | man-eaters | 2025 | 2019 | 6 | Man-Eaters | Chelsea Cain |
| 7805 | spellbook-of-the-lost-and-found | 2023 | 2017 | 6 | Spellbook of the Lost and Found | Moïra Fowley-Doyle |
| 9228 | scooter-girl | 2023 | 2017 | 6 | Scooter Girl | Chynna Clugston-Flores |
| 10251 | a-semi-definitive-list-of-worst-nightmares | 2023 | 2017 | 6 | A Semi-Definitive List of Worst Nightmares | Krystal Sutherland |
| 14546 | lannee-du-jardinier | 1939 | 1933 | 6 | L’année du jardinier | Karel Čapek |
| 16776 | no-mans-land | 1999 | 2005 | -6 | No Man's Land | Dương Thu Hương |
| 16837 | stone-dreams | 2012 | 2018 | -6 | Stone Dreams | Akram Aylisli |
| 16942 | the-plague-column | 1973 | 1979 | -6 | The Plague Column | Jaroslav Seifert |
| 71 | the-great-gatsby | 1925 | 1920 | 5 | The Great Gatsby | F. Scott Fitzgerald |
| 122 | maus | 1991 | 1986 | 5 | Maus | Art Spiegelman |
| 168 | dream-of-ding-village | 2006 | 2011 | -5 | Dream of Ding Village | Yan Lianke |
| 602 | amar-meyebela | 1999 | 2004 | -5 | Amar Meyebela | Taslima Nasrin |
| 627 | prisoner-of-conscience-ma-thida | 2011 | 2016 | -5 | Prisoner of Conscience | Ma Thida |
| 699 | the-guinea-pigs-vaculik | 1970 | 1975 | -5 | The Guinea Pigs | Ludvík Vaculík |
| 843 | adama-turki-al-hamad | 1998 | 2003 | -5 | Adama | Turki al-Hamad |
| 945 | clandestine-poems-dalton | 1975 | 1980 | -5 | Clandestine Poems | Roque Dalton |
| 1145 | home-body | 2025 | 2020 | 5 | Home Body | Rupi Kaur |
| 1165 | foul-is-fair | 2025 | 2020 | 5 | Foul is Fair | Hannah Capin |
| 1175 | rage-and-ruin | 2025 | 2020 | 5 | Rage and Ruin | Jennifer L. Armentrout |
| 1179 | snapdragon | 2025 | 2020 | 5 | Snapdragon | Kat Leyh |
| 1183 | the-best-laid-plans | 2025 | 2020 | 5 | The Best Laid Plans | Cameron Lund |
| 1286 | fable | 2025 | 2020 | 5 | Fable | Adrienne Young |
| 1301 | if-it-bleeds | 2025 | 2020 | 5 | If It Bleeds | Stephen King |
| 1391 | my-rainbow | 2025 | 2020 | 5 | My Rainbow | DeShanna Neal |
| 1533 | layla | 2025 | 2020 | 5 | Layla | Colleen Hoover |
| 2601 | the-voting-booth | 2025 | 2020 | 5 | The Voting Booth | Brandy Colbert |
| 2731 | el-libro-de-la-familia-the-family-book-spanish-edition | 2024 | 2019 | 5 | El Libro de la Familia/The Family Book | Todd Parr |
| 2762 | tbh-idk-whats-next | 2024 | 2019 | 5 | TBH, IDK What's Next | Lisa Greenwald |
| 2962 | challenges-for-lgbtq-teens | 2025 | 2020 | 5 | Challenges for LGBTQ Teens | Martha Lundin |
| 3197 | my-shadow-is-pink | 2025 | 2020 | 5 | My Shadow is Pink | Scott Stuart |
| 4468 | the-field-guide-to-the-north-american-teenager | 2024 | 2019 | 5 | The Field Guide to the North American Teenager | Ben Philippe |
| 4956 | everything-grows | 2024 | 2019 | 5 | Everything Grows | Aimee Herman |
| 8864 | not-the-girls-youre-looking-for | 2023 | 2018 | 5 | Not the Girls You're Looking For | Aminah Mae Safi |
| 9076 | kim-jiyoung-born-1982 | 2024 | 2019 | 5 | Kim Jiyoung, Born 1982 | Cho Nam-Joo |
| 9595 | code-breaker-and-mathematician-alan-turing | 2023 | 2018 | 5 | Code-Breaker and Mathematician Alan Turing | Heather E. Schwartz |
| 9778 | these-witches-dont-burn | 2024 | 2019 | 5 | These Witches Don't Burn | Isabel Sterling |
| 14314 | his-dark-materials | 1995 | 2000 | -5 | His Dark Materials | Philip Pullman |
| 14677 | comment-je-vois-le-monde | 1939 | 1934 | 5 | Comment je vois le monde | Albert Einstein |
| 16775 | memories-of-a-pure-spring | 1996 | 2001 | -5 | Memories of a Pure Spring | Dương Thu Hương |
| 16920 | kompleks-polski | 1977 | 1982 | -5 | Kompleks polski | Tadeusz Konwicki |
| 101 | shame-taslima-nasrin | 1993 | 1997 | -4 | Shame | Taslima Nasrin |
| 147 | tombstone-yang-jisheng | 2008 | 2012 | -4 | Tombstone | Yang Jisheng |
| 607 | fallen-angels | 1988 | 1984 | 4 | Fallen Angels | Walter Dean Myers |
| 622 | cities-of-salt | 1984 | 1988 | -4 | Cities of Salt | Abdelrahman Munif |
| 680 | opera-wonyosi | 1977 | 1981 | -4 | Opera Wonyosi | Wole Soyinka |
| 708 | a-tomb-for-boris-davidovich | 1976 | 1980 | -4 | A Tomb for Boris Davidovich | Danilo Kiš |
| 808 | memoirs-of-hecate-county | 1946 | 1942 | 4 | Memoirs of Hecate County | Edmund Wilson |
| 876 | looking-on-darkness | 1973 | 1977 | -4 | Looking on Darkness | André Brink |
| 927 | the-winter-queen | 1998 | 2002 | -4 | The Winter Queen | Boris Akunin |
| 941 | the-fat-years | 2009 | 2013 | -4 | The Fat Years | Chan Koonchung |
| 1027 | marijuana-growers-guide | 1974 | 1978 | -4 | Marijuana Grower's Guide | Mel Frank |
| 1122 | both-can-be-true | 2025 | 2021 | 4 | Both Can Be True | Jules Machias |
| 1194 | winterkeep | 2025 | 2021 | 4 | Winterkeep | Kristin Cashore |
| 1213 | how-it-all-blew-up | 2024 | 2020 | 4 | How It All Blew Up | Arvin Ahmadi |
| 1219 | the-crown-of-gilded-bones | 2025 | 2021 | 4 | The Crown of Gilded Bones | Jennifer L. Armentrout |
| 1372 | calvin | 2025 | 2021 | 4 | Calvin | J. R. Ford |
| 1374 | cant-take-that-away | 2025 | 2021 | 4 | Can't Take That Away | Steven Salvatore |
| 1380 | flight-of-the-puffin | 2025 | 2021 | 4 | Flight of the Puffin | Ann Braden |
| 1420 | this-boy | 2024 | 2020 | 4 | This Boy | Lauren Myracle |
| 1429 | my-sister-daisy | 2025 | 2021 | 4 | My Sister Daisy | Adria Karlsson |
| 1430 | a-complicated-love-story-set-in-space | 2025 | 2021 | 4 | A Complicated Love Story Set in Space | Shaun David Hutchinson |
| 1431 | echo-after-echo | 2025 | 2021 | 4 | Echo After Echo | A. R. Capetta |
| 1525 | kate-in-waiting | 2025 | 2021 | 4 | Kate in Waiting | Becky Albertalli |
| 1561 | pumpkin | 2025 | 2021 | 4 | Pumpkin | Julie Murphy |
| 1615 | the-love-hypothesis | 2025 | 2021 | 4 | The Love Hypothesis | Ali Hazelwood |
| 1718 | my-maddy | 2024 | 2020 | 4 | My Maddy | Gayle E. Pitman |
| 1796 | frankie-and-bug | 2025 | 2021 | 4 | Frankie and Bug | Gayle Forman |
| 1840 | just-ash | 2025 | 2021 | 4 | Just Ash | Sol Santana |
| 1964 | understanding-gender-identity | 2025 | 2021 | 4 | Understanding Gender Identity | Don Nardo |
| 2088 | being-lgbtq | 2024 | 2020 | 4 | Being LGBTQ | Don Nardo |
| 3227 | racial-justice-in-america-topics-for-change | 2025 | 2021 | 4 | Racial Justice in America: Topics for Change | Hedreich Nichols |
| 3595 | the-sea-wolf | 1904 | 1900 | 4 | The Sea Wolf | Jack London |
| 4948 | dealing-with-gender-dysphoria | 2024 | 2020 | 4 | Dealing with Gender Dysphoria | Martha Lundin |
| 6070 | unplanned-pregnancies | 2025 | 2021 | 4 | Unplanned Pregnancies | Alexis Burling |
| 9072 | mexican-gothic | 2024 | 2020 | 4 | Mexican Gothic | Silvia Moreno-Garcia |
| 9596 | dont-tell-the-nazis | 2023 | 2019 | 4 | Don't Tell the Nazis | Marsha Forchuk Skrypuch |
| 16548 | cabin-fever | 2011 | 2007 | 4 | Cabin Fever | Jeff Kinney |
| 16681 | mama-hissas-mice | 2015 | 2019 | -4 | Mama Hissa's Mice | Saud Alsanousi |
| 16685 | the-little-mermaid | 1989 | 1993 | -4 | The Little Mermaid | The Walt Disney Company |
| 16688 | the-doves-necklace | 2010 | 2014 | -4 | The Dove's Necklace | Raja Alem |
| 16689 | wolves-of-the-crescent-moon | 2003 | 2007 | -4 | Wolves of the Crescent Moon | Yousef Al-Mohaimeed |
| 16736 | seara-de-vento | 1958 | 1962 | -4 | Seara de Vento | Manuel da Fonseca |
| 16906 | la-mascherata | 1941 | 1945 | -4 | La mascherata | Alberto Moravia |
| 72 | the-tin-drum | 1959 | 1962 | -3 | The Tin Drum | Günter Grass |
| 133 | crank | 2004 | 2001 | 3 | Crank | Ellen Hopkins |
| 557 | mein-kampf | 1925 | 1922 | 3 | Mein Kampf | Adolf Hitler |
| 620 | fractured-destinies | 2015 | 2018 | -3 | Fractured Destinies | Rabai al-Madhoun |
| 624 | the-hidden-face-of-eve | 1977 | 1980 | -3 | The Hidden Face of Eve | Nawal El Saadawi |
| 683 | the-yacoubian-building | 2002 | 2005 | -3 | The Yacoubian Building | Alaa Al Aswany |
| 700 | the-wire-harp-wolf-biermann | 1965 | 1968 | -3 | The Wire Harp | Wolf Biermann |
| 869 | tessa-a-gata | 1965 | 1968 | -3 | Tessa, a Gata | Cassandra Rios |
| 913 | serve-the-people-yan-lianke | 2005 | 2008 | -3 | Serve the People! | Yan Lianke |
| 1144 | things-we-couldnt-say | 2024 | 2021 | 3 | Things We Couldn't Say | Jay Coles |
| 1209 | squad | 2024 | 2021 | 3 | Squad | Maggie Tokuda-Hall |
| 1210 | kiss-and-tell | 2025 | 2022 | 3 | Kiss and Tell | Adib Khorram |
| 1422 | fifteen-hundred-miles-from-the-sun | 2024 | 2021 | 3 | Fifteen Hundred Miles from the Sun | Jonny Garza Villa |
| 1510 | gwendys-final-task | 2025 | 2022 | 3 | Gwendy's Final Task | Stephen King |
| 1724 | a-million-quiet-revolutions | 2025 | 2022 | 3 | A Million Quiet Revolutions | Robin Gow |
| 1898 | rabbit-chase | 2025 | 2022 | 3 | Rabbit Chase | Elizabeth LaPensée |
| 2105 | bodies-are-cool | 2024 | 2021 | 3 | Bodies Are Cool | Tyler Feder |
| 2635 | zia-erases-the-world | 2025 | 2022 | 3 | Zia Erases the World | Bree Barton |
| 3114 | if-youre-a-drag-queen-and-you-know-it | 2025 | 2022 | 3 | If You're A Drag Queen and You Know It | Lil Miss Hot Mess |
| 3333 | whats-your-name | 2025 | 2022 | 3 | What's Your Name? | Bethanie Deeney Murguia |
| 5009 | lilla-the-accidental-witch | 2024 | 2021 | 3 | Lilla the Accidental Witch | Eleanor Crewes |
| 5306 | sam-is-my-sister | 2024 | 2021 | 3 | Sam is My Sister | Ashley Rhodes-Courter |
| 5310 | teos-tutu | 2024 | 2021 | 3 | Téo's Tutu | Maryann Jacob Macias |
| 5320 | the-ultimate-art-museum | 2024 | 2021 | 3 | The Ultimate Art Museum | Ferren Gipson |
| 5412 | amari-and-the-night-brothers | 2024 | 2021 | 3 | Amari and the Night Brothers | Alston B.B. |
| 5769 | meranda-and-the-legend-of-the-lake | 2024 | 2021 | 3 | Meranda and the Legend of the Lake | Meagan Mahoney |
| 6250 | candy-mian-mian | 2000 | 2003 | -3 | Candy | Mian Mian |
| 8050 | youre-next | 2023 | 2020 | 3 | You're Next | Kylie Schachte |
| 14297 | the-crow | 1989 | 1992 | -3 | The Crow | James O'Barr |
| 14421 | les-ardennais-sous-la-botte | 1936 | 1933 | 3 | Les Ardennais sous la botte | Jean Bardanne |
| 15045 | stresemann | 1932 | 1929 | 3 | Stresemann | Rudolf Olden |
| 16435 | the-new-york-weekly-journal | 1733 | 1736 | -3 | The New York Weekly Journal | John Peter Zenger |
| 16529 | the-accusation | 2014 | 2017 | -3 | The Accusation | Bandi |
| 16709 | bangkok-inside-out | 2005 | 2002 | 3 | Bangkok Inside Out | Daniel Ziv |
| 16759 | the-history-and-culture-of-pakistan | 2007 | 2004 | 3 | The History and Culture of Pakistan | Nigel Kelly |
| 16918 | the-katyn-wood-murders | 1948 | 1951 | -3 | The Katyn Wood Murders | Józef Mackiewicz |
| 16943 | the-hangwoman | 1978 | 1981 | -3 | The Hangwoman | Pavel Kohout |
| 17005 | twilight-of-the-eastern-gods | 1978 | 1981 | -3 | Twilight of the Eastern Gods | Ismail Kadare |