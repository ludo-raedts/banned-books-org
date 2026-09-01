# OpenLibrary title-mismatch audit

Generated 2026-09-01T13:02:35.178Z.
Population (books bound to an OL work, excl. blanket-works): **1169** — via `openlibrary_work_id`: 0, via `description_source_url` only: 1169
Mode: restricted to binding **desc_url**.
Checked against OpenLibrary: **1169** · fetch errors: 0 · unverifiable book titles: 0
Raw suspects (zero shared title token): **107**
Author-corroborated CONFIRMED: **58** · likely-translation: 49 · unverified: 0
Confirmed rate among checked: **4.96%**

## CONFIRMED — different title AND different author (58)

Linked to a genuinely different book; cover_url / isbn13 / description_book are likely wrong. Prime remediation targets.

Rows with `binding = desc_url` are the class book 3272 belonged to: no `openlibrary_work_id`, so `remediate-ol-contamination.ts` treated their (equally contaminated) `isbn13` as proof of a good binding and spared them.

| id | our title | our author | linked OL work | OL author | binding | desc src | /books/ |
|---|---|---|---|---|---|---|---|
| 252 | Life is Funny | ER Frank | Little Women (OL29983W) | Louisa May Alcott | desc_url | openlibrary | /books/life-is-funny |
| 617 | Taseer of Lahore | Jugnu Mohsin | The Logic of Scientific Discovery (OL1984582W) | Karl Popper | desc_url | openlibrary | /books/taseer-of-lahore |
| 662 | The Sleepless World | Erich Kästner | Ghost in the wires (OL16132451W) | Kevin D. Mitnick | desc_url | openlibrary | /books/the-sleepless-world |
| 721 | Imperialism: The Spectre of the Twentieth Century | Kōtoku Shūsui | A History of Europe (OL109423W) | John Morris Roberts | desc_url | openlibrary | /books/imperialism-kotoku-shusui |
| 776 | The Subversive | Nick Joaquin | Gender Trouble (OL893584W) | Judith Butler | desc_url | openlibrary | /books/the-subversive-philippines |
| 979 | On the Hong Kong City-State | Wan Chin | Les trois Mousquetaires (OL36861W) | Alexandre Dumas | desc_url | openlibrary | /books/on-the-hong-kong-city-state |
| 987 | Big Rivers Going to the East | Szeto Wah | Born to Run (OL1943602W) | Bruce Springsteen; Michael Morpurgo | desc_url | openlibrary | /books/big-rivers-going-to-the-east |
| 989 | There Is a Kind of Happiness Called Forgetting | Roy Kwong | The complete works of Horace (OL15249103W) | Horace | desc_url | openlibrary | /books/there-is-a-kind-of-happiness-called-forgetting |
| 1074 | Politics of a Police State | Pham Doan Trang | Fear no evil (OL1938043W) | Anatoly Shcharansky | desc_url | openlibrary | /books/politics-of-a-police-state |
| 1321 | Rise | Andrea Robertson | Esperanza Rising (OL784051W) | Pam Muñoz Ryan | desc_url | llm_grounded_multi | /books/rise |
| 1479 | Home After Dark | David Small | The Pilgrim's Progress (OL107195W) | John Bunyan | desc_url | openlibrary | /books/home-after-dark |
| 1776 | Chaz Bono | Marty Gitlin | Transition (OL15901582W) | Chaz Bono | desc_url | openlibrary | /books/chaz-bono |
| 1935 | The Beautiful Something Else | Ash Van Otterloo | The God Delusion (OL1966485W) | Richard Dawkins | desc_url | openlibrary | /books/the-beautiful-something-else |
| 1936 | The Dog Knight | Jeremy Whitley | Harry Potter and the Prisoner of Azkaban (OL82536W) | J. K. Rowling | desc_url | openlibrary | /books/the-dog-knight |
| 2072 | Look | Zan Romanoff | Looking for Alaska (OL265426W) | John Green | desc_url | openlibrary | /books/look |
| 2667 | Happily Ever After | Nora Roberts | The unfamiliar Shelley (OL18803451W) | Alan M. Weinberg | desc_url | openlibrary | /books/happily-ever-after |
| 2756 | Sarah Bishop | Scott O'Dell | Confessions (OL137872W) | Augustine of Hippo | desc_url | openlibrary | /books/sarah-bishop |
| 2834 | Totally Joe | James Howe | The Adventures of Tom Sawyer (OL53919W) | Mark Twain | desc_url | openlibrary | /books/totally-joe |
| 2976 | Click, Vol. 2 | Youngran Lee | Myst (OL2015979W) | Rick Barba; Rusel DeMaria; Prima Games | desc_url | openlibrary | /books/click-vol-2 |
| 3240 | Salt the Water | lloh. Candice | Roughing It (OL54059W) | Mark Twain | desc_url | openlibrary | /books/salt-the-water |
| 3266 | The Day Changes Everything | Edward Underhill | The Pickwick Papers (OL8763776W) | Charles Dickens | desc_url | openlibrary | /books/the-day-changes-everything |
| 3273 | The Feminism Book | Georgie Carroll | A Vindication of Rights of Woman (OL849186W) | Mary Wollstonecraft | desc_url | openlibrary | /books/the-feminism-book |
| 3314 | Wandering Son, Vol. 5 | Takako Shimura | Poems (OL26386W) | William Wordsworth | desc_url | llm_grounded_multi | /books/wandering-son-vol-5 |
| 3315 | Wandering Son, Vol. 6 | Takako Shimura | Evelina (OL2252006W) | Fanny Burney; Frances Burney | desc_url | llm_grounded_multi | /books/wandering-son-vol-6 |
| 3580 | Studies in the History of Palestine During the Middle Ages | P.P. Bartholdy | Militarization (OL20982738W) | University Press Duke; Roberto J. Gonzalez; Hugh Gusterson; Gustaaf Houtman | desc_url | openlibrary | /books/studies-in-the-history-of-palestine-during-the-middle-ages |
| 3586 | Afghanistan - The Revolution | Hanna Salah | The World Is Flat -A Brief History OF THE TWENTY-FIRST CENTURY (OL3740416W) | Thomas L. Friedman | desc_url | openlibrary | /books/afghanistan-the-revolution |
| 3598 | The Young Guardia | Alexander Fadeyev | The White Company (OL262553W) | Arthur Conan Doyle | desc_url | openlibrary | /books/the-young-guardia |
| 3648 | European Art Since 1850 | John Scott | Aeneis (OL47087W) | Publius Vergilius Maro | desc_url | openlibrary | /books/european-art-since-1850 |
| 3816 | Life under Occupation | Charles Samuels | Bill (OL12210420W) | Canada. Legislature. Legislative Assembly. | desc_url | openlibrary | /books/life-under-occupation |
| 3853 | Mosque | David Macauley | Visage volé (OL5798945W) | Latifa; Chekeba Hachemi; Mercè Ubach Dorca | desc_url | openlibrary | /books/mosque |
| 3894 | School Violence | Jeffrey P. Jones | Heart of Darkness (OL38663W) | Joseph Conrad | desc_url | openlibrary | /books/school-violence |
| 3905 | Sisters/Hermanas | Gary Paulsen | My Sister's Keeper (OL891923W) | Jodi Picoult | desc_url | openlibrary | /books/sisters-hermanas |
| 3962 | The Holocaust: Survival and Resistance | Pat Levy | I Survived The Nazi Invasion, 1944 (OL17104602W) | Lauren Tarshis; Georgia Ball; Álvaro Sarraseca | desc_url | openlibrary | /books/the-holocaust-survival-and-resistance |
| 3975 | The Legend of Drizzt, Vol. 3: Sojourn | Andrew Dabb | The Dark Elf Trilogy (OL516667W) | R. A. Salvatore | desc_url | openlibrary | /books/the-legend-of-drizzt-vol-3-sojourn |
| 4085 | 19th Century Art | Robert Rosenblum | Edvard Munch (OL136192W) | Edvard Munch; Christoph Asendorf; Marian Bisanz-Prakken; Albrecht Schröder; Albertina Wien; Dieter Buchhart; Antonia Hoerschelmann; Frank Hoifodt; Iris Müller-Westermann; Gerd Woll; Arne Eggum; Reinhold Heller; Carla Lathe | desc_url | openlibrary | /books/19th-century-art |
| 4093 | All You Need is Kill, Book 1 | Takeshi Obata | On Killing (OL2909796W) | Dave Grossman; Dave Grossman; Lt Grossman | desc_url | llm_grounded_multi | /books/all-you-need-is-kill-book-1 |
| 4199 | Greek Legends and Stories | M. V. Seton-Williams | The Legend of Sleepy Hollow (OL63985W) | Washington Irving | desc_url | openlibrary | /books/greek-legends-and-stories |
| 4207 | Henry Taylor: B Side | Bennett Simpson | King Lear (OL259026W) | William Shakespeare | desc_url | openlibrary | /books/henry-taylor-b-side |
| 4227 | In Praise of Black Women: Ancient African Queens | Simone Schwarz-Bart | The Longman Anthology of British Literature (OL19281205W) | David Damrosch; Stuart Sherman; Christopher Baswell; Anne Howland Schotter; Constance Jordan; Clare Carroll; Susan J. Wolfson; Peter J. Manning; Heather Henderson; William Chapman Sharpe; Kevin J. H. Dettmar; Jennifer Wicke | desc_url | openlibrary | /books/in-praise-of-black-women-ancient-african-queens |
| 4247 | Last Man: The Royal Cup | Bastien Vivès | Twelfth Night, or What You Will (OL362694W) | William Shakespeare | desc_url | openlibrary | /books/last-man-the-royal-cup |
| 4335 | Sculpture | Mary-Jane Opie | The artist project (OL19730708W) | Metropolitan Museum of Art (New York, N.Y.) | desc_url | openlibrary | /books/sculpture |
| 4492 | Beginnings - The Long Road Home | Robin Furth | Anne of Avonlea (OL77744W) | Lucy Maud Montgomery | desc_url | openlibrary | /books/beginnings-the-long-road-home |
| 4493 | Beginnings - Treachery | Robin Furth | Metamorphoses (OL15292640W) | Ovid | desc_url | openlibrary | /books/beginnings-treachery |
| 4503 | Capricous | Gabrielle Prendergast | Wicked Caprice (OL3771190W) | Anne Mather | desc_url | openlibrary | /books/capricous |
| 4743 | The Drawing of the Three - Bitter Medicine | Robin Furth | The Dark Tower (OL20045499W) | Peter David | desc_url | openlibrary | /books/the-drawing-of-the-three-bitter-medicine |
| 4781 | The Loners | Lex Thomas | The loner (OL6922104W) | Ester Wier | desc_url | openlibrary | /books/the-loners |
| 4847 | When Villians Rise | Rebecca Schaeffer | Hitchcock (OL3477651W) | François Truffaut; Alfred Hitchcock; Helen G. Scott | desc_url | openlibrary | /books/when-villians-rise |
| 4936 | Caitlyn Jenner | Carl Mooney | The Secrets of My Life (OL19355728W) | Caitlyn Jenner | desc_url | openlibrary | /books/caitlyn-jenner |
| 4954 | El gris | Christine Lynn Herman | White Fang (OL74504W) | Jack London | desc_url | openlibrary | /books/el-gris |
| 5200 | The Space Between | Evan Jacobs | Russia's Golden Age (OL16813609W) | Rachel Stauffer | desc_url | openlibrary | /books/the-space-between |
| 5447 | Attack on Titan: End of the World | Touji Asakura | Revolutionary wealth (OL2869039W) | Alvin Toffler | desc_url | openlibrary | /books/attack-on-titan-end-of-the-world |
| 5909 | Shape | Henry Arthur Pluckrose | Shapes in the Sky (OL742483W) | Josepha Sherman; Omarr Wesley | desc_url | openlibrary | /books/shape |
| 5934 | The 19th Century | Alice Peebles | The Old Curiosity Shop (OL14869167W) | Charles Dickens | desc_url | openlibrary | /books/the-19th-century |
| 5937 | The Art of Breaking Things | Laura Sibson | The Culture Map (OL19982879W) | Erin Meyer | desc_url | openlibrary | /books/the-art-of-breaking-things |
| 6751 | Kang ming shi dai de ri chang | Shining He | The Adventures of Tom Sawyer (OL15728472W) | Margaret Hall; Daniel Strickland | desc_url | openlibrary | /books/kang-ming-shi-dai-de-ri-chang |
| 6780 | Ma ma de hao bang shou | Xianggang Zhong wen da xue shou yu ji long ren yan jiu zhong xin | 12 simple secrets real moms know (OL3935377W) | Michele Borba | desc_url | openlibrary | /books/ma-ma-de-hao-bang-shou |
| 7127 | Er qian ling si shi qi ye | Jialin Ou | Mental Chemistry (OL2041072W) | Charles F. Haanel | desc_url | openlibrary | /books/er-qian-ling-si-shi-qi-ye |
| 11045 | Art Literature and Life | Sung Tan | A new literary history of modern China (OL20055707W) | 王德威 | desc_url | openlibrary | /books/art-literature-and-life |

## UNVERIFIED — title differs, author could not be compared (0)

| id | our title | our author | linked OL work | OL author | binding | desc src | /books/ |
|---|---|---|---|---|---|---|---|

## LIKELY_TRANSLATION — different title but SAME author = same work, different-language title (49)

Almost certainly fine (original/translated title). Listed for completeness.

| id | our title | our author | linked OL work | OL author | binding | desc src | /books/ |
|---|---|---|---|---|---|---|---|
| 1169 | Last Sacrifice | Richelle Mead | Vampire Academy (OL8488892W) | Richelle Mead; Richelle Mead | desc_url | llm_grounded_multi | /books/last-sacrifice |
| 1484 | 1922 | Stephen King | Full Dark, No Stars (OL15374110W) | Stephen King | desc_url | llm_grounded_multi | /books/1922 |
| 1599 | The Dark Tower | Stephen King | The Gunslinger (OL81628W) | Stephen King | desc_url | llm_grounded_multi | /books/the-dark-tower |
| 1932 | Stonewall: Breaking Out in the Fight for Gay Rights | Ann Bausum | Stone wall (OL20002292W) | Ann Bausum | desc_url | openlibrary | /books/stonewall-breaking-out-in-the-fight-for-gay-rights |
| 2221 | Code Name Cassandra | Meg Cabot | 1-800-Where-R-You (OL492806W) | Meg Cabot | desc_url | openlibrary | /books/code-name-cassandra |
| 2381 | Love in the Time of Cholera | Gabriel García Márquez | El amor en los tiempos del cólera (OL274518W) | Gabriel García Márquez | desc_url | openlibrary | /books/love-in-the-time-of-cholera |
| 2489 | Ruby Red | Kerstin Gier | Rubinrot (OL15720268W) | Kerstin Gier; Nelly Lemaire; Luis Miralles de Imperial | desc_url | llm_grounded_multi | /books/ruby-red |
| 2687 | Wings | Danielle Steel | Plein Ciel (OL19616W) | Danielle Steel | desc_url | openlibrary | /books/wings |
| 2792 | Foundations in Personal Finance, 2022, 4th Edition | Ramsey Solutions | The money answer book (OL24172964W) | Dave Ramsey | desc_url | openlibrary | /books/foundations-in-personal-finance-2022-4th-edition |
| 2936 | Beware the Kitten Holy | ND Stevenson | Lumberjanes Vol. 1 (OL17200328W) | N.D. Stevenson; Grace Ellis; Gus Allen; Shannon Watters | desc_url | openlibrary | /books/beware-the-kitten-holy |
| 3046 | Friendship to the Max | ND Stevenson | Lumberjanes Vol. 2 (OL19360692W) | N.D. Stevenson; Grace Ellis; Shannon Watters; Gus Allen; Maarta Laiho | desc_url | openlibrary | /books/friendship-to-the-max |
| 3132 | Jackalope Springs Eternal | Shannon Watters | Lumberjanes Vol. 12 (OL20112392W) | Shannon Watters; Kat Leyh | desc_url | openlibrary | /books/jackalope-springs-eternal |
| 3299 | Time After Crime | Shannon Watters | Lumberjanes Vol. 11 (OL20155675W) | Shannon Watters; Kat Leyh; Ayme Sotuyo; Maarta Laiho | desc_url | openlibrary | /books/time-after-crime |
| 3370 | Blue Is the Warmest Color | Julie Maroh | Le bleu est une couleur chaude (OL17080793W) | Jul' Maroh | desc_url | openlibrary | /books/blue-is-the-warmest-color |
| 3581 | At the End of the Night | Mahmoud Darwish | Why Did You Leave the Horse Alone? (OL1778800W) | Mahmud Darwish; MaḥmÕud DarwÕish; Mahmoud Darwish; Mohammad Shaheen; Muḥammad Ṭāhir Darwīsh | desc_url | openlibrary | /books/at-the-end-of-the-night |
| 3582 | Selected Poems | Mahmoud Darwish | Unfortunately, It Was Paradise (OL8303280W) | Mahmoud Darwish | desc_url | openlibrary | /books/selected-poems-mahmud-darwish |
| 3593 | August, 1914 | Aleksandr Solzhenitsyn | Узел I - Август Четырнадцатого (OL1858616W) | Александр Солженицын | desc_url | openlibrary | /books/august-1914 |
| 3987 | The Nervous System | Nuria Roca | Cells, genes, and chromosomes (OL2926162W) | Núria Roca | desc_url | openlibrary | /books/the-nervous-system |
| 4014 | Then Again, Maybe I Won't | Judy Blume | Tales of a Fourth Grade Nothing (OL1838382W) | Judy Blume | desc_url | openlibrary | /books/then-again-maybe-i-wont |
| 4073 | Witches | Stuart Kallen | The Salem witch trials (OL15802939W) | Stuart A. Kallen | desc_url | openlibrary | /books/witches |
| 4486 | Baptism of Fire | Andrzej Sapkowski | Chrzest ognia (OL2577480W) | Andrzej Sapkowski | desc_url | openlibrary | /books/baptism-of-fire |
| 4499 | Blood of Elves | Andrzej Sapkowski | Krew elfów (OL2577486W) | Andrzej Sapkowski | desc_url | openlibrary | /books/blood-of-elves |
| 4605 | Manga Shakespere: The Tempest | William Shakespeare | A Midsummer Night's Dream (OL259010W) | William Shakespeare | desc_url | openlibrary | /books/manga-shakespere-the-tempest |
| 4623 | My Hero Academia, Vigilantes Vol. 2 | Hideyuki Furuhashi | Vigilante (OL20112450W) | Hideyuki Furuhashi; Betten Court; Kohei Horikoshi; Carlos Alberto Mingo Gómez de Celis; Irene Tellería | desc_url | openlibrary | /books/my-hero-academia-vigilantes-vol-2 |
| 4755 | The Girl Who Kicked the Hornet's Nest | Stieg Larsson | Luftslottet som sprängdes (OL14909364W) | Stieg Larsson | desc_url | openlibrary | /books/the-girl-who-kicked-the-hornets-nest |
| 4757 | The Girl Who Played with Fire | Stieg Larsson | Flickan som lekte med elden (OL5784621W) | Stieg Larsson | desc_url | openlibrary | /books/the-girl-who-played-with-fire |
| 4773 | The Lady of the Lake | Andrzej Sapkowski | Pani Jeziora (OL18132161W) | Andrzej Sapkowski | desc_url | openlibrary | /books/the-lady-of-the-lake |
| 4779 | The Last Wish | Andrzej Sapkowski | Ostatnie Życzenie (OL2577482W) | Andrzej Sapkowski | desc_url | openlibrary | /books/the-last-wish |
| 4805 | The Time of Contempt | Andrzej Sapkowski | Czas pogardy (OL2577481W) | Andrzej Sapkowski | desc_url | openlibrary | /books/the-time-of-contempt |
| 4807 | The Tower of Swallows | Andrzej Sapkowski | Wieża jaskółki (OL2577478W) | Andrzej Sapkowski | desc_url | openlibrary | /books/the-tower-of-swallows |
| 4865 | Blindness | José Saramago | Ensaio Sobre a Cegueira (OL27420W) | José Saramago | desc_url | openlibrary | /books/blindness |
| 4901 | Perfume: The Story of a Murderer | Patrick Süskind | Das Parfum (OL10834W) | Patrick Süskind | desc_url | llm_grounded_multi | /books/perfume-the-story-of-a-murderer |
| 5410 | Amanecer | Stephanie Meyer | Breaking Dawn (OL5720022W) | Stephenie Meyer | desc_url | openlibrary | /books/amanecer |
| 5509 | Death Note: L, Change the WorLd | M | エル　チェンジ　ザ　ワールド (OL3222513W) | M.; Takeshi Obata | desc_url | openlibrary | /books/death-note-l-change-the-world |
| 5549 | Ever After | Olivia Vieweg | Endzeit (OL19917736W) | Olivia Vieweg | desc_url | openlibrary | /books/ever-after |
| 5725 | La silla de Pedro | Ezra Jack Keats | Peter's Chair (OL831062W) | Ezra Jack Keats | desc_url | openlibrary | /books/la-silla-de-pedro |
| 5745 | Luna nueva | Stephanie Meyer | New Moon (OL5720027W) | Stephenie Meyer | desc_url | openlibrary | /books/luna-nueva |
| 5988 | The Melancholy of Haruhi Suzumiya | Nagaru Tanigawa | 涼宮ハルヒの憂鬱 (OL13718081W) | Nagaru Tanigawa | desc_url | openlibrary | /books/the-melancholy-of-haruhi-suzumiya |
| 6003 | The Space Race of 1869 | Alex Alice | Castle in the stars (OL19714033W) | Alex Alice | desc_url | openlibrary | /books/the-space-race-of-1869 |
| 6016 | The Thief Lord | Cornelia Funke | Herr der Diebe (OL941674W) | Cornelia Funke | desc_url | openlibrary | /books/the-thief-lord |
| 6221 | The Sorrow of War | Bảo Ninh | Thân phận của tình yêu (OL2946524W) | Bảo Ninh | desc_url | openlibrary | /books/the-sorrow-of-war |
| 6588 | Summer of betrayal : a novel | Hong Ying | Luo wu dai (OL1929653W) | Hong Ying | desc_url | openlibrary | /books/summer-of-betrayal-a-novel |
| 7099 | Tian'anmen : Zhongguo de zhi shi fen zi yu ge ming | Spence | The Gate of Heavenly Peace (OL1842802W) | Jonathan D. Spence | desc_url | openlibrary | /books/tiananmen-zhongguo-de-zhi-shi-fen-zi-yu-ge-ming |
| 13502 | Lie with Me | Philippe Besson | Arrête avec tes mensonges (OL19742673W) | Philippe Besson; Philippe Besson | desc_url | llm_grounded_multi | /books/lie-with-me |
| 14822 | Jeunesse sans Dieu | Odon De Horvath | Jugend ohne Gott (OL4540213W) | Ödön von Horváth | desc_url | llm_grounded_multi | /books/jeunesse-sans-dieu |
| 14866 | La jeune fille en soie artificielle | Irmgard Keun | Das kunstseidene Mädchen (OL3827332W) | Irmgard Keun | desc_url | openlibrary | /books/la-jeune-fille-en-soie-artificielle |
| 16279 | Our Lady of the Flowers | Jean Genet | The gutter in the sky (OL1281850W) | Jean Genet | desc_url | openlibrary | /books/our-lady-of-the-flowers |
| 16632 | The Truce | Mario Benedetti | La tregua (OL741877W) | Mario Benedetti | desc_url | llm_grounded_multi | /books/the-truce |
| 16922 | A Worker in a Worker's State | Miklós Haraszti | Stücklohn (OL4338793W) | Miklós Haraszti | desc_url | openlibrary | /books/a-worker-in-a-workers-state |
