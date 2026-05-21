# HK split-authors — editorial review queue

38 clusters need editorial review after the 2026-05-18 auto-cleanup of clean 2-pairs. See chat 2026-05-18 + parser-fix at src/lib/wikipedia/parser.ts:567 for context.

- 2 2-pairs with a slug collision (need merge with existing author, not rename)
- 7 ambiguous 2-pairs (no/both trailing-period → mix of bug-victims and legitimate co-authors)
- 29 multi-author groups (mostly clear 2-pair-per-cell patterns, but auto-merge was too risky)

For each cluster: the book page link, the current bogus author records, and (when the pattern is clear) a suggested merged-name list.

**2026-05-19 follow-up:** re-running `scripts/_audit_split_authors.ts` surfaced 7 extra clusters that the original sweep missed (6 smoking-gun + 1 ambiguous). Listed at the bottom under "2026-05-19 follow-up sweep".

---

## Book 6522 — Tiananmen Square, spring 1989 : a chronology of the Chinese democracy movement

[https://www.banned-books.org/books/tiananmen-square-spring-1989-a-chronology-of-the-chinese-democracy-movement](https://www.banned-books.org/books/tiananmen-square-spring-1989-a-chronology-of-the-chinese-democracy-movement)  · cluster created 2026-05-14T21:36:53

Current author records:

- **`Han`** (id=4605, slug=`han`, 7 book(s)) — bio: "Han may refer to:…"
- **`Theodore.`** (id=4606, slug=`theodore`, 1 book(s)) — bio: "Theodore may refer to:…"
- **`Li`** (id=4607, slug=`li`, 5 book(s)) — bio: "Li, li, or LI may refer to:…"
- **`John.`** (id=4608, slug=`john`, 1 book(s)) — bio: "John Sterling (né Sloss; July 4, 1938 – May 4, 2026) was an American sportscaster, best known as the…"

**Suggested merge:** `Theodore Han` + `John Li`

## Book 6527 — Almost a revolution

[https://www.banned-books.org/books/almost-a-revolution](https://www.banned-books.org/books/almost-a-revolution)  · cluster created 2026-05-14T21:36:55

Current author records:

- **`Shen`** (id=4614, slug=`shen`, 1 book(s)) — bio: "Shen may refer to:…"
- **`Tong.`** (id=4615, slug=`tong`, 1 book(s)) — bio: "Tong may refer to:…"
- **`Yen`** (id=4616, slug=`yen`, 1 book(s)) — bio: "The yen (Japanese: 円; symbol: ¥; code: JPY) is the official currency of Japan. It is the third-most …"
- **`Marianne.`** (id=4617, slug=`marianne`, 1 book(s)) — bio: "Marianne (French pronunciation: [maʁjan]) has been the national personification of the French Republ…"

**Suggested merge:** `Tong Shen` + `Marianne Yen`

## Book 6582 — Chinese society on the eve of Tiananmen : the impact of reform

[https://www.banned-books.org/books/chinese-society-on-the-eve-of-tiananmen-the-impact-of-reform](https://www.banned-books.org/books/chinese-society-on-the-eve-of-tiananmen-the-impact-of-reform)  · cluster created 2026-05-14T21:37:23

Current author records:

- **`Davis`** (id=4691, slug=`davis`, 1 book(s)) — bio: "Davis may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Deborah.`** (id=4692, slug=`deborah`, 1 book(s)) — bio: "According to the Book of Judges, Deborah (Hebrew: דְּבוֹרָה, Dəḇōrā) was a prophetess of Judaism, th…"
- **`Vogel`** (id=4693, slug=`vogel`, 1 book(s)) — bio: "Vogel may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6588 — Summer of betrayal : a novel

[https://www.banned-books.org/books/summer-of-betrayal-a-novel](https://www.banned-books.org/books/summer-of-betrayal-a-novel)  · cluster created 2026-05-14T21:37:26

Current author records:

- **`Hong`** (id=4702, slug=`hong`, 1 book(s)) — bio: "Hong may refer to:…"
- **`Ying.`** (id=4703, slug=`ying`, 1 book(s)) — bio: "Ying may refer to:…"
- **`Avery`** (id=4704, slug=`avery`, 1 book(s)) — bio: "Avery may refer to:…"
- **`Martha.`** (id=4705, slug=`martha`, 1 book(s)) — bio: "Martha (Aramaic: מָרְתָא‎) is a biblical figure described in the Gospels of Luke and John. Together …"

**Suggested merge:** `Ying Hong` + `Martha Avery`

## Book 6589 — Zola — All works

[https://www.banned-books.org/books/zola-all-works](https://www.banned-books.org/books/zola-all-works)  · cluster created 2026-05-14T21:37:26

Current author records:

- **`Zola`** (id=4706, slug=`zola`, 1 book(s)) — bio: "Émile Édouard Charles Antoine Zola (, also US: ; French: [emil zɔla]; 2 April 1840&#160;– 29 Septemb…"
- **`Émile`** (id=4707, slug=`emile`, 1 book(s)) — bio: "The name Emil, Emile, or Émile is a male given name of Indo-European origin. This name has multiple …"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6600 — The Broken mirror : China after Tiananmen

[https://www.banned-books.org/books/the-broken-mirror-china-after-tiananmen](https://www.banned-books.org/books/the-broken-mirror-china-after-tiananmen)  · cluster created 2026-05-14T21:37:31

Current author records:

- **`Hicks`** (id=4722, slug=`hicks`, 1 book(s)) — bio: "Hicks, also spelled Hickes, is a surname.…"
- **`Asai`** (id=4724, slug=`asai`, 1 book(s)) — bio: "Asai or ASAI may refer to:…"
- **`Motofumi.`** (id=4725, slug=`motofumi`, 1 book(s)) — bio: "Eevee ( ), known in Japan as Eievui (Japanese: イーブイ, Hepburn: Ībui), is a Pokémon species in the Pok…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6603 — Beijing spring

[https://www.banned-books.org/books/beijing-spring](https://www.banned-books.org/books/beijing-spring)  · cluster created 2026-05-14T21:37:32

Current author records:

- **`Turnley`** (id=4728, slug=`turnley`, 1 book(s)) — bio: "Dean Turnley is an Australian DJ and record producer from Geelong, Victoria and now based in Melbour…"
- **`Peter.`** (id=4731, slug=`peter`, 1 book(s)) — bio: "Peter may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Liu`** (id=4732, slug=`liu`, 2 book(s)) — bio: "Liu (simplified Chinese: 刘; traditional Chinese: 劉; or ) is an East Asian surname. pinyin: Liú in Ma…"
- **`Melinda.`** (id=4733, slug=`melinda`, 1 book(s)) — bio: "Melinda and Melinda is a 2004 American comedy-drama film written and directed by Woody Allen. The fi…"

**Suggested merge:** `Peter Turnley` + `Melinda Liu`

## Book 6610 — Crisis at Tiananmen : reform and reality in modern China

[https://www.banned-books.org/books/crisis-at-tiananmen-reform-and-reality-in-modern-china](https://www.banned-books.org/books/crisis-at-tiananmen-reform-and-reality-in-modern-china)  · cluster created 2026-05-14T21:37:35

Current author records:

- **`Yi`** (id=4740, slug=`yi`, 3 book(s)) — bio: "Yi or YI may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Mu.`** (id=4741, slug=`mu`, 1 book(s)) — bio: "MU, Mu or μ may refer to:…"
- **`Thompson`** (id=4742, slug=`thompson`, 1 book(s)) — bio: "Thompson may refer to: Their work has been subject to censorship or banning challenges.…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6631 — Tiananmen : the rape of Peking

[https://www.banned-books.org/books/tiananmen-the-rape-of-peking](https://www.banned-books.org/books/tiananmen-the-rape-of-peking)  · cluster created 2026-05-14T21:37:43

Current author records:

- **`Fathers`** (id=4771, slug=`fathers`, 1 book(s)) — bio: "A father, dad, or daddy is the male parent of a child. Besides the paternal bonds of a father to his…"
- **`Michael.`** (id=4772, slug=`michael`, 1 book(s)) — bio: "Michael may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Higgins`** (id=4773, slug=`higgins`, 1 book(s)) — bio: "Higgins may refer to:…"
- **`Andrew.`** (id=4774, slug=`andrew`, 2 book(s)) — bio: "Andrew is the English form from the Old French name Andreu / Andrieu (now French surnames), themselv…"
- **`Cottrell`** (id=4775, slug=`cottrell`, 1 book(s)) — bio: "Cottrell may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6632 — Wild Lily, Prairie Fire : China's Road to Democracy, Yan'an to Tian'anmen, 1942-1989

[https://www.banned-books.org/books/wild-lily-prairie-fire-chinas-road-to-democracy-yanan-to-tiananmen-1942-1989](https://www.banned-books.org/books/wild-lily-prairie-fire-chinas-road-to-democracy-yanan-to-tiananmen-1942-1989)  · cluster created 2026-05-14T21:37:44

Current author records:

- **`Benton`** (id=4777, slug=`benton`, 1 book(s)) — bio: "Benton may refer to:…"
- **`Gregor.`** (id=4778, slug=`gregor`, 1 book(s)) — bio: "Gregor is a masculine given name. Notable people and fictional characters with the name include: Gre…"
- **`Hunter`** (id=4779, slug=`hunter`, 1 book(s)) — bio: "Hunter × Hunter (pronounced "hunter hunter") is a Japanese manga series written and illustrated by Y…"
- **`Alan.`** (id=4780, slug=`alan`, 1 book(s)) — bio: "Alan may refer to:…"

**Suggested merge:** `Gregor Benton` + `Alan Hunter`

## Book 6641 — De dignitate et augmentis scientiarum libri IX. Donec corrig.

[https://www.banned-books.org/books/de-dignitate-et-augmentis-scientiarum-libri-ix-donec-corrig](https://www.banned-books.org/books/de-dignitate-et-augmentis-scientiarum-libri-ix-donec-corrig)  · cluster created 2026-05-14T21:37:47

Current author records:

- **`Bacon`** (id=4789, slug=`bacon`, 1 book(s)) — bio: "Bacon is a type of salt-cured pork made from various cuts, typically the belly or less fatty parts o…"
- **`Franciscus)`** (id=4791, slug=`franciscus`, 1 book(s)) — bio: "James Grover Franciscus (January 31, 1934 – July 8, 1991) was an American actor, known for his roles…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6642 — Tiananmen Square = Tʻien-an-men

[https://www.banned-books.org/books/tiananmen-square-t-ien-an-men](https://www.banned-books.org/books/tiananmen-square-t-ien-an-men)  · cluster created 2026-05-14T21:37:48

Current author records:

- **`Simmie`** (id=4792, slug=`simmie`, 1 book(s)) — bio: "Simmie or Simmy is a given name and a place name.…"
- **`Scott.`** (id=4793, slug=`scott`, 1 book(s)) — bio: "Scott may refer to:…"
- **`Nixon`** (id=4794, slug=`nixon`, 1 book(s)) — bio: "Richard Milhous Nixon (January 9, 1913&#160;– April 22, 1994) was the 37th president of the United S…"
- **`Bob.`** (id=4795, slug=`bob`, 1 book(s)) — bio: " Their work has been subject to censorship or banning challenges.…"

**Suggested merge:** `Scott Simmie` + `Bob Nixon`

## Book 6660 — Popular protest and political culture in modern China

[https://www.banned-books.org/books/popular-protest-and-political-culture-in-modern-china](https://www.banned-books.org/books/popular-protest-and-political-culture-in-modern-china)  · cluster created 2026-05-14T21:37:56

Current author records:

- **`Wasserstrom`** (id=4816, slug=`wasserstrom`, 1 book(s)) — bio: "Wasserstrom is an Ashkenazi Jewish surname composed out of the German words Wasser for "water" and S…"
- **`Perry`** (id=4818, slug=`perry`, 1 book(s)) — bio: "Perry or pear cider is an alcoholic beverage made from fermented pears, traditionally in England (pa…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6670 — Black hands of Beijing : lives of defiance in China's democracy movement

[https://www.banned-books.org/books/black-hands-of-beijing-lives-of-defiance-in-chinas-democracy-movement](https://www.banned-books.org/books/black-hands-of-beijing-lives-of-defiance-in-chinas-democracy-movement)  · cluster created 2026-05-14T21:38:00

Current author records:

- **`Black`** (id=4831, slug=`black`, 1 book(s)) — bio: "Black is a color that results from the absence or complete absorption of visible light. It is an ach…"
- **`Munro`** (id=4833, slug=`munro`, 1 book(s)) — bio: "A Munro (; Scottish Gaelic: Rothach) is defined as a mountain in Scotland with a height over 3,000 f…"
- **`Robin.`** (id=4834, slug=`robin`, 1 book(s)) — bio: "Robin most commonly refers to several species of passerine birds.…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6677 — Chinese democracy and the crisis of 1989 : Chinese and American reflections

[https://www.banned-books.org/books/chinese-democracy-and-the-crisis-of-1989-chinese-and-american-reflections](https://www.banned-books.org/books/chinese-democracy-and-the-crisis-of-1989-chinese-and-american-reflections)  · cluster created 2026-05-14T21:38:02

Current author records:

- **`Luo`** (id=4843, slug=`luo`, 2 book(s)) — bio: "Luo or LUO may refer to:…"
- **`Ning.`** (id=4844, slug=`ning`, 1 book(s)) — bio: "Ning may refer to:…"
- **`Wu`** (id=4845, slug=`wu`, 2 book(s)) — bio: "Wu may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Yen-bo.`** (id=4846, slug=`yen-bo`, 1 book(s)) — bio: "Quảng Yên is a county-level town of Quảng Ninh Province in the north-east region of Vietnam. The Bạc…"

**Suggested merge:** `Ning Luo` + `Yen-bo Wu`

## Book 6753 — Youtai ren 3000 nian

[https://www.banned-books.org/books/youtai-ren-3000-nian](https://www.banned-books.org/books/youtai-ren-3000-nian)  · cluster created 2026-05-14T21:43:54

Current author records:

- **`Zhang`** (id=4932, slug=`zhang`, 2 book(s)) — bio: "Zhang may refer to:…"
- **`Qianhong.`** (id=4933, slug=`qianhong`, 1 book(s)) — bio: "Qianhong Gotsch, born He Qianhong, is a female table tennis player from Germany. She won two medals …"
- **`Shaohua`** (id=4935, slug=`shaohua`, 1 book(s)) — bio: "Xu Shaohua may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6761 — Tian'anmen shang kan Zhongguo

[https://www.banned-books.org/books/tiananmen-shang-kan-zhongguo](https://www.banned-books.org/books/tiananmen-shang-kan-zhongguo)  · cluster created 2026-05-14T21:43:58

Current author records:

- **`An`** (id=4943, slug=`an`, 2 book(s)) — bio: "An, AN, aN, or an may refer to:…"
- **`Huang`** (id=4945, slug=`huang`, 2 book(s)) — bio: "Huang or Hwang may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6773 — Xing jiao yu shi han de

[https://www.banned-books.org/books/xing-jiao-yu-shi-han-de](https://www.banned-books.org/books/xing-jiao-yu-shi-han-de)  · cluster created 2026-05-14T21:44:03

Current author records:

- **`Shao`** (id=4959, slug=`shao`, 1 book(s)) — bio: "Shao Kahn is a character and one of the main antagonists of the Mortal Kombat fighting game franchis…"
- **`Jiazhen.`** (id=4960, slug=`jiazhen`, 1 book(s)) — bio: "Nora Lum (born June 2, 1988), known professionally as Awkwafina ( AW-kwə-FEE-nə), is an American act…"
- **`Wen`** (id=4962, slug=`wen`, 1 book(s)) — bio: "Wen, wen, or WEN may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6786 — Yu san zheng zhi si zhong zou

[https://www.banned-books.org/books/yu-san-zheng-zhi-si-zhong-zou](https://www.banned-books.org/books/yu-san-zheng-zhi-si-zhong-zou)  · cluster created 2026-05-14T21:44:08

Current author records:

- **`Chen`** (id=4976, slug=`chen`, 7 book(s)) — bio: "Chen or Ch'en may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Jinghui.`** (id=4977, slug=`jinghui`, 1 book(s)) — bio: "Zhang Jinghui (traditional Chinese: 張景惠; simplified Chinese: 张景惠; pinyin: Zhāng Jǐnghuì; Wade–Giles:…"
- **`Ho`** (id=4978, slug=`ho`, 1 book(s)) — bio: "Ho (or the transliterations He or Heo) may refer to:…"
- **`Xiaoxiao.`** (id=4980, slug=`xiaoxiao`, 1 book(s)) — bio: "Su Xiaoxiao (Chinese: 蘇小小) (c.479 – c.501), also known by the appellations "Little Su" and "Su Xiao,…"
- **`Anthony`** (id=4981, slug=`anthony`, 1 book(s)) — bio: "Anthony, also spelled Antony, is a masculine given name derived from the Antonii, a gens (Roman fami…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6896 — Zhongguo, kui er bu being

[https://www.banned-books.org/books/zhongguo-kui-er-bu-being](https://www.banned-books.org/books/zhongguo-kui-er-bu-being)  · cluster created 2026-05-14T21:44:53

Current author records:

- **`Qinglian.`** (id=5104, slug=`qinglian`, 1 book(s)) — bio: "Li Bai (c. 701&#160;– 762), also known by his courtesy name of Taibai, was a Chinese poet acclaimed …"
- **`Cheng`** (id=5105, slug=`cheng`, 1 book(s)) — bio: "Cheng may refer to:…"
- **`Xiaonong`** (id=5106, slug=`xiaonong`, 1 book(s)) — bio: "Xiaonong Yishi (simplified Chinese: 小农意识; traditional Chinese: 小農意識; pinyin: Xiǎonóng yìshí; lit. 'p…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 6957 — Dui hua x zhan ling

[https://www.banned-books.org/books/dui-hua-x-zhan-ling](https://www.banned-books.org/books/dui-hua-x-zhan-ling)  · cluster created 2026-05-14T21:45:18

Current author records:

- **`Dai`** (id=5171, slug=`dai`, 2 book(s)) — bio: "Dai may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Yaoting.`** (id=5172, slug=`yaoting`, 2 book(s)) — bio: "Sun Yaoting (simplified Chinese: 孙耀庭; traditional Chinese: 孫耀庭, 29 September 1903 – 17 December 1996…"
- **`Tan`** (id=5173, slug=`tan`, 1 book(s)) — bio: "Tan or TAN may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Huiyun`** (id=5174, slug=`huiyun`, 1 book(s)) — bio: "The Huiyun Center is a super-tall skyscraper in Shenzhen, Guangdong, China. The building is 359.2 me…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7016 — Zhongguo wu fa wei da de 50 ge li you

[https://www.banned-books.org/books/zhongguo-wu-fa-wei-da-de-50-ge-li-you](https://www.banned-books.org/books/zhongguo-wu-fa-wei-da-de-50-ge-li-you)  · cluster created 2026-05-14T21:45:41

Current author records:

- **`Marriott`** (id=5239, slug=`marriott`, 1 book(s)) — bio: "Marriott may refer to:…"
- **`Lacroix`** (id=5241, slug=`lacroix`, 1 book(s)) — bio: "Maxence Guy Lacroix (French pronunciation: [maksɑ̃s lakʁwa]; born 6 April 2000) is a French professi…"
- **`Karl.`** (id=5242, slug=`karl`, 1 book(s)) — bio: "Karl Marx (German: [ˈkaʁl ˈmaʁks]; 5 May 1818 – 14 March 1883) was a German philosopher, social and …"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7046 — He Tiananmen mu qin yi qi

[https://www.banned-books.org/books/he-tiananmen-mu-qin-yi-qi](https://www.banned-books.org/books/he-tiananmen-mu-qin-yi-qi)  · cluster created 2026-05-14T21:45:54

Current author records:

- **`Xu`** (id=5273, slug=`xu`, 1 book(s)) — bio: "Xu or XU may refer to:…"
- **`Langyang.`** (id=5274, slug=`langyang`, 1 book(s)) — bio: "Langyang is a village in Chipwi Township in Myitkyina District in the Kachin State of north-eastern …"
- **`Ou`** (id=5275, slug=`ou`, 1 book(s)) — bio: "OU or Ou or ou may stand for:…"
- **`Meibao.`** (id=5276, slug=`meibao`, 1 book(s)) — bio: "The Tibetan Plateau, also known as the Qinghai–Tibet Plateau, Qingzang Plateau, or as the Himalayan …"
- **`Shiyun`** (id=5278, slug=`shiyun`, 1 book(s)) — bio: "Shiyun may refer to: Their work has been subject to censorship or banning challenges.…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7053 — Xianggang yue yu ding ying shang

[https://www.banned-books.org/books/xianggang-yue-yu-ding-ying-shang](https://www.banned-books.org/books/xianggang-yue-yu-ding-ying-shang)  · cluster created 2026-05-14T21:45:57

Current author records:

- **`Peng`** (id=5285, slug=`peng`, 2 book(s)) — bio: "Peng may refer to:…"
- **`Zhiming.`** (id=5286, slug=`zhiming`, 2 book(s)) — bio: "Wang Zhiming may refer to:…"
- **`Zhengheng`** (id=5288, slug=`zhengheng`, 2 book(s)) — bio: "The Later Jin, officially known as Jin or the Great Jin, was a Jurchen-led royal dynasty of China an…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7056 — Dui ji ben fa de ji ben kan fa

[https://www.banned-books.org/books/dui-ji-ben-fa-de-ji-ben-kan-fa](https://www.banned-books.org/books/dui-ji-ben-fa-de-ji-ben-kan-fa)  · cluster created 2026-05-14T21:45:58

Current author records:

- **`Situ`** (id=5291, slug=`situ`, 1 book(s)) — bio: "Situ or situs may refer to:…"
- **`Hua.`** (id=5292, slug=`hua`, 1 book(s)) — bio: "Hua or HUA may refer to:…"
- **`Juming`** (id=5294, slug=`juming`, 1 book(s)) — bio: "The Juming Museum (traditional Chinese: 朱銘美術館; simplified Chinese: 朱铭美术馆; pinyin: Zhū Míng Měishùguǎ…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7067 — Zhi min di mei xue

[https://www.banned-books.org/books/zhi-min-di-mei-xue](https://www.banned-books.org/books/zhi-min-di-mei-xue)  · cluster created 2026-05-14T21:46:03

Current author records:

- **`Zhen`** (id=5307, slug=`zhen`, 1 book(s)) — bio: "Zhen may refer to:…"
- **`Xiaohui`** (id=5308, slug=`xiaohui`, 1 book(s)) — bio: "Li Xiaohui may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7070 — Zhongguo qiao qiao zhan ling quan shi jie

[https://www.banned-books.org/books/zhongguo-qiao-qiao-zhan-ling-quan-shi-jie](https://www.banned-books.org/books/zhongguo-qiao-qiao-zhan-ling-quan-shi-jie)  · cluster created 2026-05-14T21:46:04

Current author records:

- **`Cardenal`** (id=5311, slug=`cardenal`, 1 book(s)) — bio: "Cardenal is a surname of Spanish origin. Their work has been subject to censorship or banning challe…"
- **`Araújo`** (id=5313, slug=`araujo`, 1 book(s)) — bio: "Araújo or Araujo or Araúxo, and various other spellings, (Portuguese pronunciation: [ɐɾɐˈuʒu], Spani…"
- **`Heriberto.`** (id=5314, slug=`heriberto`, 1 book(s)) — bio: "Heriberto is the Spanish and Portuguese form of the masculine given name Herbert. Their work has bee…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7071 — Xianggang yue yu cheng dao di

[https://www.banned-books.org/books/xianggang-yue-yu-cheng-dao-di](https://www.banned-books.org/books/xianggang-yue-yu-cheng-dao-di)  · cluster created 2026-05-14T21:45:57

Current author records:

- **`Peng`** (id=5285, slug=`peng`, 2 book(s)) — bio: "Peng may refer to:…"
- **`Zhiming.`** (id=5286, slug=`zhiming`, 2 book(s)) — bio: "Wang Zhiming may refer to:…"
- **`Zhengheng`** (id=5288, slug=`zhengheng`, 2 book(s)) — bio: "The Later Jin, officially known as Jin or the Great Jin, was a Jurchen-led royal dynasty of China an…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7110 — Yi guo liang zhi zhi duo shao

[https://www.banned-books.org/books/yi-guo-liang-zhi-zhi-duo-shao](https://www.banned-books.org/books/yi-guo-liang-zhi-zhi-duo-shao)  · cluster created 2026-05-14T21:46:21

Current author records:

- **`Qingquan.`** (id=5365, slug=`qingquan`, 1 book(s)) — bio: "Shu Qingquan (born 30 March 1967) is a Chinese sport shooter who competed in the 1992 Summer Olympic…"
- **`Lai`** (id=5366, slug=`lai`, 1 book(s)) — bio: "Lai or LAI may refer to:…"
- **`Qizhi`** (id=5367, slug=`qizhi`, 1 book(s)) — bio: "Andrew Chi-Chih Yao (Chinese: 姚期智; pinyin: Yáo Qīzhì; born December 24, 1946) is a Chinese computer …"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7143 — Gong min kang ming yu zhan ling zhong huan : xiang gang ji du tu di xin yang xing si

[https://www.banned-books.org/books/gong-min-kang-ming-yu-zhan-ling-zhong-huan-xiang-gang-ji-du-tu-di-xin-yang-xing-si](https://www.banned-books.org/books/gong-min-kang-ming-yu-zhan-ling-zhong-huan-xiang-gang-ji-du-tu-di-xin-yang-xing-si)  · cluster created 2026-05-14T21:45:18

Current author records:

- **`Dai`** (id=5171, slug=`dai`, 2 book(s)) — bio: "Dai may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Yaoting.`** (id=5172, slug=`yaoting`, 2 book(s)) — bio: "Sun Yaoting (simplified Chinese: 孙耀庭; traditional Chinese: 孫耀庭, 29 September 1903 – 17 December 1996…"

**Suggested merge:** `Yaoting Dai`

## Book 7143 — Gong min kang ming yu zhan ling zhong huan : xiang gang ji du tu di xin yang xing si

[https://www.banned-books.org/books/gong-min-kang-ming-yu-zhan-ling-zhong-huan-xiang-gang-ji-du-tu-di-xin-yang-xing-si](https://www.banned-books.org/books/gong-min-kang-ming-yu-zhan-ling-zhong-huan-xiang-gang-ji-du-tu-di-xin-yang-xing-si)  · cluster created 2026-05-14T21:46:34

Current author records:

- **`Zhu`** (id=5408, slug=`zhu`, 1 book(s)) — bio: "Zhu Zhu (Chinese: 朱珠; pinyin: Zhū Zhū; born 19 July 1984) is a Chinese actress and singer. She rose …"
- **`Yaoming.`** (id=5409, slug=`yaoming`, 1 book(s)) — bio: "Yao Ming (Chinese: 姚明; born September 12, 1980) is a Chinese basketball executive and former profess…"
- **`Gong`** (id=5410, slug=`gong`, 2 book(s)) — bio: "A gong is a percussion instrument originating from Southeast Asia, and used widely in Southeast Asia…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7173 — Xuan ju zhi du de zheng zhi xiao guo : Gang shi bi li dai biao zhi de jing yan

[https://www.banned-books.org/books/xuan-ju-zhi-du-de-zheng-zhi-xiao-guo-gang-shi-bi-li-dai-biao-zhi-de-jing-yan](https://www.banned-books.org/books/xuan-ju-zhi-du-de-zheng-zhi-xiao-guo-gang-shi-bi-li-dai-biao-zhi-de-jing-yan)  · cluster created 2026-05-14T21:46:46

Current author records:

- **`Ma`** (id=5449, slug=`ma`, 2 book(s)) — bio: "Ma, MA, or mA may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Yue.`** (id=5450, slug=`yue`, 1 book(s)) — bio: "Yue or Yueh ( yweh) may refer to:…"

**Suggested merge:** `Yue Ma`

## Book 7188 — Xianggang ren 2.0 : shi jian shang wei jie shu, jin hua yi jing wan cheng

[https://www.banned-books.org/books/xianggang-ren-2-0-shi-jian-shang-wei-jie-shu-jin-hua-yi-jing-wan-cheng](https://www.banned-books.org/books/xianggang-ren-2-0-shi-jian-shang-wei-jie-shu-jin-hua-yi-jing-wan-cheng)  · cluster created 2026-05-14T21:46:52

Current author records:

- **`Yu`** (id=5468, slug=`yu`, 2 book(s)) — bio: "Yu or YU may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Fuzeng.`** (id=5471, slug=`fuzeng`, 1 book(s)) — bio: "Established in 1917, the China Association of Agricultural Science Societies (CAASS, Chinese: 中国农学会)…"
- **`Bingxiang.`** (id=5473, slug=`bingxiang`, 1 book(s)) — bio: "Walter Kwok Ping-sheung JP (Chinese: 郭炳湘; Cantonese pronunciation: [kʷɔk̚˧&#160;pɪŋ˧˥.sœŋ˥]; 1950 – …"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7201 — Guo du qi '91 - '92 man hua ji

[https://www.banned-books.org/books/guo-du-qi-91-92-man-hua-ji](https://www.banned-books.org/books/guo-du-qi-91-92-man-hua-ji)  · cluster created 2026-05-14T21:46:57

Current author records:

- **`Yimu`** (id=5491, slug=`yimu`, 1 book(s)) — bio: "Pretty Li Huizhen (Chinese: 漂亮的李慧珍; pinyin: Piāo liàng de lǐ huì zhēn) is a 2017 Chinese television …"
- **`Long`** (id=5493, slug=`long`, 1 book(s)) — bio: "Long may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7214 — Zhou Yongkang nei bu an juan

[https://www.banned-books.org/books/zhou-yongkang-nei-bu-an-juan](https://www.banned-books.org/books/zhou-yongkang-nei-bu-an-juan)  · cluster created 2026-05-14T21:47:03

Current author records:

- **`Guangjian.`** (id=5510, slug=`guangjian`, 1 book(s)) — bio: "Zhang Guangjian (Chinese: 張廣建) (1864/1867 – 1938) was a Chinese politician of the late Qing Dynasty …"
- **`Ji`** (id=5511, slug=`ji`, 1 book(s)) — bio: "Ji may refer to:…"
- **`Weiren`** (id=5512, slug=`weiren`, 1 book(s)) — bio: "Wu Weiren (Chinese: 吴伟仁; born October 1953) is a Chinese physicist who is the chief designer of the …"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7224 — Yi du jiu dong : hai zi bi xu zhi de fa lu chang shi

[https://www.banned-books.org/books/yi-du-jiu-dong-hai-zi-bi-xu-zhi-de-fa-lu-chang-shi](https://www.banned-books.org/books/yi-du-jiu-dong-hai-zi-bi-xu-zhi-de-fa-lu-chang-shi)  · cluster created 2026-05-14T21:47:07

Current author records:

- **`Mei`** (id=5524, slug=`mei`, 1 book(s)) — bio: "Mei or mei may refer to:…"
- **`Bisi.`** (id=5525, slug=`bisi`, 1 book(s)) — bio: "Bisi may refer to: Their work has been subject to censorship or banning challenges.…"
- **`Weng`** (id=5526, slug=`weng`, 1 book(s)) — bio: "Ernesto de Guzman de la Cruz (September 7, 1957 – August 29, 1992), known by the stage name Weng Wen…"
- **`Dayang`** (id=5527, slug=`dayang`, 1 book(s)) — bio: "Dayang may refer to:…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7305 — Si jiao yu hui xiang

[https://www.banned-books.org/books/si-jiao-yu-hui-xiang](https://www.banned-books.org/books/si-jiao-yu-hui-xiang)  · cluster created 2026-05-14T22:25:32

Current author records:

- **`Feng`** (id=5612, slug=`feng`, 1 book(s)) — bio: "Feng may refer to:…"
- **`Yulian`** (id=5613, slug=`yulian`, 1 book(s)) — bio: "Nobody is a 2021 American action thriller film directed by Ilya Naishuller and written by Derek Kols…"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7363 — 德蘭修女來作我的光 : 加爾各答聖人的私人書札 = Mother Teresa : come be my light : the private writings of the Saint of Calcutta

[https://www.banned-books.org/books/mother-teresa-come-be-my-light-the-private-writings-of-the-saint-of-calcutta](https://www.banned-books.org/books/mother-teresa-come-be-my-light-the-private-writings-of-the-saint-of-calcutta)  · cluster created 2026-05-15T11:45:56

Current author records:

- **`Teresa.`** (id=5676, slug=`teresa`, 1 book(s)) — bio: "Anjezë Gonxhe Bojaxhiu (Albanian: [aˈɲɛzə ˈɡɔndʒɛ bɔjaˈdʒi.u]; 26 August 1910&#160;– 5 September 199…"
- **`Kolodiejchuk`** (id=5677, slug=`kolodiejchuk`, 1 book(s)) — bio: "Brian Kolodiejchuk, MC is a Canadian Catholic priest who served as the advocate for Mother Teresa of…"
- **`Brian.`** (id=5678, slug=`brian`, 1 book(s)) — bio: "Brian is a masculine given name of Irish and Breton origin, as well as a surname of Occitan origin. …"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

---

## 2026-05-19 follow-up sweep — 7 additional clusters

Surfaced by `scripts/_audit_split_authors.ts` after the import queue dried up. All 7 books were in the DB already (committed in earlier HK batches) but escaped the original auto-cleanup pass.

- 6 smoking-gun: trailing "." on one of the two names → unambiguous "Lastname, Firstname." parser-bug victim (safe to merge per Suggested merge below)
- 1 ambiguous: book #6892 (Jin + An) — no trailing period; could be a legitimate Chinese-romanisation pair, needs Wikipedia source verification

---

## Book 6550 — Lili : a novel of Tiananmen

[https://www.banned-books.org/books/lili-a-novel-of-tiananmen](https://www.banned-books.org/books/lili-a-novel-of-tiananmen)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Wang`** (id=4631, slug=`wang`, 3 book(s)) — bio: "Wang may refer to:"
- **`Ban.`** (id=4649, slug=`ban`, 1 book(s)) — bio: "Ban, or BAN, may refer to:"

**Suggested merge:** `Ban Wang`

## Book 6581 — The factual account of a search for the June 4 victims

[https://www.banned-books.org/books/the-factual-account-of-a-search-for-the-june-4-victims](https://www.banned-books.org/books/the-factual-account-of-a-search-for-the-june-4-victims)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Ding`** (id=4625, slug=`ding`, 1 book(s)) — bio: "Ding may refer to: Their work has been subject to censorship or banning challenges."
- **`Zilin.`** (id=4690, slug=`zilin`, 1 book(s)) — bio: "Zhang Zilin (simplified Chinese: 张梓琳; traditional Chinese: 張梓琳; pinyin: Zhāng Zǐlín, born 22 March 1…"

**Suggested merge:** `Zilin Ding`

## Book 6587 — Cries For Democracy : Writings and Speeches from the Chinese Democracy Movement

[https://www.banned-books.org/books/cries-for-democracy-writings-and-speeches-from-the-chinese-democracy-movement](https://www.banned-books.org/books/cries-for-democracy-writings-and-speeches-from-the-chinese-democracy-movement)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Han`** (id=4605, slug=`han`, 7 book(s)) — bio: "Han may refer to:"
- **`Minzhu.`** (id=4701, slug=`minzhu`, 1 book(s)) — bio: "The Democratic Progressive Party (DPP) is a Taiwanese nationalist political party in Taiwan. As the …"

**Suggested merge:** `Minzhu Han`

## Book 6594 — Moving the mountain : my life in China from the cultural revolution to Tiananmen Square

[https://www.banned-books.org/books/moving-the-mountain-my-life-in-china-from-the-cultural-revolution-to-tiananmen-square](https://www.banned-books.org/books/moving-the-mountain-my-life-in-china-from-the-cultural-revolution-to-tiananmen-square)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Li`** (id=4607, slug=`li`, 6 book(s)) — bio: "Li, li, or LI may refer to:"
- **`Lu.`** (id=4715, slug=`lu`, 1 book(s)) — bio: "Lu, Lü, or LU may refer to: Their work has been subject to censorship or banning challenges."

**Suggested merge:** `Lu Li`

## Book 6700 — The struggle for Tiananmen : anatomy of the 1989 mass movement

[https://www.banned-books.org/books/the-struggle-for-tiananmen-anatomy-of-the-1989-mass-movement](https://www.banned-books.org/books/the-struggle-for-tiananmen-anatomy-of-the-1989-mass-movement)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Lin`** (id=4860, slug=`lin`, 2 book(s)) — bio: "LIN or LIN may refer to: Their work has been subject to censorship or banning challenges."
- **`Nan.`** (id=4874, slug=`nan`, 1 book(s)) — bio: "Nan or NAN may refer to: Their work has been subject to censorship or banning challenges."

**Suggested merge:** `Nan Lin`

## Book 6892 — Tian an men guang chang feng yun lu

[https://www.banned-books.org/books/tian-an-men-guang-chang-feng-yun-lu](https://www.banned-books.org/books/tian-an-men-guang-chang-feng-yun-lu)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Jin`** (id=5098, slug=`jin`, 1 book(s)) — bio: "Jin may refer to: Their work has been subject to censorship or banning challenges."
- **`An`** (id=4943, slug=`an`, 2 book(s)) — bio: "An, AN, aN, or an may refer to:"

**Suggested merge:** _(no clean pattern — needs manual inspection of the Wikipedia source row)_

## Book 7112 — Gong min kang ming

[https://www.banned-books.org/books/gong-min-kang-ming](https://www.banned-books.org/books/gong-min-kang-ming)  · cluster created 2026-05-19T12:25:24

Current author records:

- **`Kirk`** (id=5369, slug=`kirk`, 1 book(s)) — bio: "Kirk commonly refers to: Their work has been subject to censorship or banning challenges."
- **`Andrew.`** (id=4774, slug=`andrew`, 2 book(s)) — bio: "Andrew is the English form from the Old French name Andreu / Andrieu (now French surnames), themselv…"

**Suggested merge:** `Andrew Kirk`

