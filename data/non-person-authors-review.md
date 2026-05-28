# Non-person author audit

_Gegenereerd 2026-05-28 door `scripts/_audit_non_person_authors.ts`._

Totaal authors: 7387. Verdachte rijen: **77**.

| categorie | aantal |
|---|---:|
| `ANON_GROUP` | 12 |
| `ORG_BODY` | 42 |
| `PUBLISHER` | 19 |
| `STAFF_TAIL` | 3 |
| `TITLE_LIKE` | 1 |

Categorieën:

- **PUBLISHER** — uitgeverij ("Editorial X", "Ediciones X", "Penerbit Y")
- **ORG_BODY** — overheid / partij / comité / instituut / kerkelijke orde
- **STAFF_TAIL** — "Editorial Staff, X 1952", "Redaksi Z", redactionele groep
- **ANON_GROUP** — "X et al.", "X and Others", "Y and 12 Others"
- **TITLE_LIKE** — naam begint met reference-work woord (Atlas/Diccionario/Enciclopedia)

Aanbevolen actie per categorie:

- **PUBLISHER / TITLE_LIKE / STAFF_TAIL** → verwijder author-rij, book_authors-link weg. Boeken blijven, géén auteur. Volg `scripts/_fix_argentina_publisher_authors.ts`.
- **ORG_BODY** → meestal verwijderen, maar individueel beoordelen. Sommige overheid/partij-publicaties hebben legitiem de organisatie als author (kerkelijke encyclieken, partijcongres-resoluties).
- **ANON_GROUP** → eerste naam-deel hernoemen + staart wegslopen (zie `scripts/split-ampersand-smush-authors.ts` STRIP_OTHERS-tak).

## PUBLISHER (19)

### id=7318 · `Compiled By Editors of Readers Publishing Co.`

- keyword: **Publishing** · boeken: **4** · bio=N · b.? d.?
- voorbeelden: _How Apes Became Men / Life of Soviet Workers / Life of Soviet Women_

### id=3706 · `Susaeta Publishing`

- keyword: **Publishing** · boeken: **1** · bio=465c · b.? d.?
- voorbeelden: _Arte para niños con 6 grandes artistas_
- bio: _The GasGas EC, also known as Enducross, is a series enduro motorcycles manufactured by GasGas since 1989. It is currently marketed with two …_

### id=3781 · `Braun Publishing`

- keyword: **Publishing** · boeken: **1** · bio=960c · b.1981 d.?
- voorbeelden: _European Architecture in Details_
- bio: _Scott Samuel "Scooter" Braun (BRAWN; born June 18, 1981) is an American businessman, investor, former talent manager, and record executive. …_

### id=4578 · `Jugo-Slav Publishing Company`

- keyword: **Publishing** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Novi Svijet_

### id=4679 · `Associated Press`

- keyword: **Press/Penerbit** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _China : from the Long March to Tiananmen Square_

### id=4783 · `China International Publishing Group (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Beijing Review_

### id=5219 · `Wai shen za zhi she (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Wai shen_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5257 · `Tai wan xing bao gu fen you xian gong si (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Tai wan xing bao_

### id=5280 · `內幕雜誌社 (出版社) / "Nei mu" za zhi she (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Nei mu_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5304 · `Ming jing yue kan za zhi she (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=1134c · b.? d.?
- voorbeelden: _Ming jing yue kan_
- bio: _Yansheng coins (traditional Chinese: 厭勝錢; simplified Chinese: 厌胜钱; pinyin: yàn shèng qián), commonly known as Chinese numismatic charms, ref…_

### id=5331 · `"中國密報"雜誌社 (出版社) / "Zhongguo mi bao" za zhi she (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Zhongguo mi bao_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5354 · `Tian xia za zhi she (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Tian xia za zhi_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5376 · `Zhuo yue quan qiu chuan mei gu fen you xian gong si (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Liang an shang qing_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5392 · `Ping guo ri bao (Publisher)`

- keyword: **Publishing** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Ping guo ri bao_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=6563 · `Saddleback Educational Publishing`

- keyword: **Publishing** · boeken: **1** · bio=1108c · b.? d.?
- voorbeelden: _Drake_
- bio: _Fernand Mondego (later Count de Morcerf;) is a fictional character in the 1844 adventure novel The Count of Monte Cristo by Alexandre Dumas,…_

### id=7252 · `Sun Wah Book Co.`

- keyword: **Books Inc/Ltd** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Sun Wah Monthly_

### id=7557 · `Readers Publishing Co.`

- keyword: **Publishing** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _What Comes First,classes or Exploitation_

### id=8186 · `Panitia Penerbitan Buku Dan 70 Tahun Harun NasutionBekerjasama Dengan Lembaga Studi Agama Dan Filsafat`

- keyword: **Press/Penerbit** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Refleksi Pembaharuan Pemikiran Islam 70 Tahun Harun Nasution_

### id=9206 · `Cucaña Ediciones`

- keyword: **Ediciones** · boeken: **1** · bio=282c · b.1943 d.?
- voorbeelden: _Actas Tupamaras_
- bio: _Andrés Pascal Allende (born 12 July 1943 in Valparaíso, Chile) is a Chilean sociologist and member of the Allende family, known for being th…_

## ORG_BODY (42)

### id=8600 · `Institute’s Department Of Curriculum Studies`

- keyword: **Department/Jabatan** · boeken: **4** · bio=557c · b.? d.?
- voorbeelden: _Mawlana Ali Peace be on him / Mawlana Hazir Imam / Teacher's and Parent's Guide (Pre-School Level)_
- bio: _Curriculum studies or curriculum sciences is a concentration in the different types of curriculum and instruction concerned with understandi…_

### id=7813 · `Jawatankuasa Pusat Liga Belia Islam`

- keyword: **Committee/Panitia** · boeken: **3** · bio=N · b.? d.?
- voorbeelden: _Sokong Dengan Hangat Perjuangan Kemerdekaan Rakyat Pattani / Sokong Dengan Hangat Perjuangan Kemerdekaan Rakyat Pattani - Dated 31/12/75 / Umat Islam Perlu Perhebatkan Lagi Perjuangan untuk Kebenaran dan Keadilan - 6/10/75_

### id=2554 · `National Geographic Society`

- keyword: **Society** · boeken: **2** · bio=N · b.? d.?
- voorbeelden: _Mysteries of Mankind / Human Body Systems_

### id=7560 · `North East Railway Workers Union`

- keyword: **Union/Kesatuan** · boeken: **2** · bio=N · b.? d.?
- voorbeelden: _Who Save Us / Who Is Our Friend_

### id=9192 · `Comité Central de Partido Comunista`

- keyword: **Party/Parti** · boeken: **2** · bio=N · b.? d.?
- voorbeelden: _Revista Nueva Era N° 4. La séptima conferencia nacional del / Partido Comunista_

### id=9475 · `Resoluciones y declaraciones del Partido Comunista de la Argentina`

- keyword: **Party/Parti** · boeken: **2** · bio=690c · b.1916 d.1995
- voorbeelden: _Argentina / Resoluciones y declaraciones del Partido Comunista de la_
- bio: _Fernando Nadra (June 29, 1916 – August 22, 1995) was an Argentine lawyer, journalist and public speaker. He was one of the most important le…_

### id=4423 · `Army Reserve Lt. Col. Anthony Shaffer`

- keyword: **Army/Tentara** · boeken: **1** · bio=698c · b.1962 d.?
- voorbeelden: _Operation Dark Heart_
- bio: _Anthony Shaffer (born 1962) is a former U.S. Army Reserve lieutenant colonel who became known for his claims about mishandled intelligence b…_

### id=4810 · `United States Department of the Army`

- keyword: **Department/Jabatan** · boeken: **1** · bio=950c · b.? d.?
- voorbeelden: _The Improvised Munitions Handbook_
- bio: _The Department of the Army (DA) is one of the three military departments within the United States Department of Defense. The DA is the feder…_

### id=5642 · `the United States Department of Defense`

- keyword: **Department/Jabatan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _United States Vietnam Relations, 1945–1967: A Study Prepared by the Department of Defense_

### id=5666 · `Communist Party of the Soviet Union`

- keyword: **Union/Kesatuan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _The Land of Socialism Today and Tomorrow: Reports and Speeches at the 18th Congress of the Communist Party of the Soviet Union (Bolsheviks), March 10–21, 1939_

### id=5743 · `University Labour Federation`

- keyword: **Federation** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _India's demand for freedom_

### id=7268 · `The General Political Department of the People Liberation Army,China`

- keyword: **Department/Jabatan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Quatations from Chairman Mao_

### id=7271 · `All China Federation of Labour`

- keyword: **Federation** · boeken: **1** · bio=447c · b.? d.?
- voorbeelden: _Chinese Workers Pictorial_
- bio: _The All-China Women's Federation (ACWF) is a women's rights people's organization established during the Chinese Civil War on 24 March 1949.…_

### id=7283 · `Study Comm. of the C.C.P. Tientsin Municipal Council`

- keyword: **Council** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Collection of Theses to Commemorate 32Nd Anniversary of October Revolution_

### id=7294 · `Russian Literary Advisory Committee`

- keyword: **Committee/Panitia** · boeken: **1** · bio=812c · b.1950 d.?
- voorbeelden: _Letter to the Beginner Who Wishes to Write_
- bio: _N. Gopi (Telugu: ఎన్. గోపి; born 25 June 1948) is an eminent Indian poet, and literary critic in Telugu and Sahitya Akademi Award recipient.…_

### id=7313 · `Children Good Friends Society`

- keyword: **Society** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Lin Che Hsu_

### id=7366 · `Youth Study Series Committee`

- keyword: **Committee/Panitia** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Everlasting Friendship_

### id=7386 · `Tientsin General Labour Union`

- keyword: **Union/Kesatuan** · boeken: **1** · bio=1181c · b.1887 d.1962
- voorbeelden: _Heist the Model Flag_
- bio: _Edward Hugh John Neale Dalton, Baron Dalton, (16 August 1887 – 13 February 1962) was a British Labour Party economist and politician who ser…_

### id=7424 · `Central Middle South Propaganda Bureau of the Chinese Communist Party`

- keyword: **Bureau** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Textbook for Members of the Communist Party_

### id=7443 · `New Children Society`

- keyword: **Society** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _New Children_

### id=7447 · `Enlightend Youth Society`

- keyword: **Society** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Enlightened Youth_

### id=7449 · `New Literary Art Society`

- keyword: **Society** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _New Literary Art_

### id=7459 · `Central Film Bureau,Shanghai Film Producers`

- keyword: **Bureau** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _The Woman Driver_

### id=7466 · `New Farming Village Magazine Society`

- keyword: **Society** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _New Farming Village_

### id=7483 · `The Preparatory Commitee of the Tientsin Democratic Youth Federation`

- keyword: **Federation** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Study Series_

### id=7574 · `New China News Agency`

- keyword: **Agency** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _On People's Democratic Dictatorship_

### id=7589 · `Malayan Communist Party Central Committee`

- keyword: **Committee/Panitia** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Open Letter to Compatriots on Realisation of Outline of People's Democratic Republic_

### id=7605 · `Review of the Second Congress of the C.P. of India`

- keyword: **Congress** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Communist Party Calls English for a Fighting Spirit of Toiling Millions Agains Imperialist and Their Collaborators for Freedom and Democracy, 1948._

### id=7624 · `Memorial Service Committee For Former Revolutionary Warriors,Singapore`

- keyword: **Committee/Panitia** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Blood of Vengeance_

### id=7642 · `Propaganda & Education Office, Perak Division, Socialist Front`

- keyword: **Office** · boeken: **1** · bio=904c · b.1921 d.2008
- voorbeelden: _Distortion of Blood Dripping Facts Will Not Be Tolerated_
- bio: _Suharto (8 June 1921 – 27 January 2008) was an Indonesian military officer and politician who served as the second president of Indonesia fr…_

### id=7645 · `Lpm, Prm, Perak State Liaison Committee Secretariat`

- keyword: **Committee/Panitia** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Unite Together in Crushing the Fascist Dictatorial Rule_

### id=7646 · `Labour Education Workers Union of Shanghai`

- keyword: **Union/Kesatuan** · boeken: **1** · bio=1081c · b.? d.?
- voorbeelden: _Readers for Workers_
- bio: _Labour in India refers to employment in the economy of India. In 2020, there were around 476.67 million workers in India, the second largest…_

### id=7648 · `Harbin Railway Workers, Union`

- keyword: **Union/Kesatuan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Red Flower Must Be Adorned with Green Leaves_

### id=7690 · `Cultural Working Cell of the Political Dept. of N.W. Army District`

- keyword: **Department/Jabatan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _To Have an Interview With_

### id=7695 · `Partai Buroh Malaya`

- keyword: **Party/Parti** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Partai Buroh Malaya Tabong Pergerakan Politik_

### id=7704 · `All Cordinating Committee-Progressive Studens`

- keyword: **Committee/Panitia** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Our Call to Students"_

### id=7806 · `Chinese Society, University of Singapore`

- keyword: **Society** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Express Newsletter_

### id=7875 · `Chandran Babu & Party`

- keyword: **Party/Parti** · boeken: **1** · bio=497c · b.1963 d.?
- voorbeelden: _Comedy Drama_
- bio: _Ammanath Babu Chandran (born 11 August 1963), better known by his stage name Edavela Babu, is an Indian actor who appears in the Malayalam c…_

### id=8016 · `The Kensington Ladies` Erotica Society`

- keyword: **Society** · boeken: **1** · bio=843c · b.? d.?
- voorbeelden: _Ladies` Own Erotica_
- bio: _The Kensington Ladies' Erotica Society was an erotica writers' group founded in Kensington, California in 1976 whose aims were to create ero…_

### id=8558 · `Terjemahan Kumpulan Pengajian Islam UIA`

- keyword: **Group/Kumpulan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Akhirnya Ku Temui Kebenaran_

### id=9058 · `Academia de Ciencias de la URSS. Instituto de Filosofía`

- keyword: **Institute** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _El papel de las masas populares y el de la personalidad en la historia_

### id=9430 · `Partido Ba´th`

- keyword: **Party/Parti** · boeken: **1** · bio=65c · b.? d.2026
- voorbeelden: _La región árabe: qué es y adónde va_
- bio: _ Their work has been subject to censorship or banning challenges.…_

## STAFF_TAIL (3)

### id=1244 · `The New York Times Editorial Staff`

- keyword: **Editorial Staff** · boeken: **5** · bio=896c · b.? d.?
- voorbeelden: _Transgender Rights: Striving for Equality / Transgender Activists and Celebrities / Defining Sexual Consent: Where the Law Falls Short_
- bio: _The New York Times (NYT) is a newspaper based in Manhattan, New York City. The New York Times covers domestic, national, and international n…_

### id=7511 · `Editorial Staff, Wa Nam Almanac, 1952`

- keyword: **Editorial Staff** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Chinese Almanac_

### id=7872 · `Sidang Pengarang Knight Publisher`

- keyword: **Sidang Pengarang (MS editorial board)** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Rosita gadis Hartawan_

## ANON_GROUP (12)

### id=4632 · `Hai. et al`

- keyword: **et al.** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _1997.9977_

### id=4902 · `Ziqiang. et al`

- keyword: **et al.** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Tong tu shu gui : qian tu tan pan yi lai de Xianggang xue yun_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5058 · `Guowei et al`

- keyword: **et al.** · boeken: **1** · bio=320c · b.1959 d.?
- voorbeelden: _Ji xu yun dong : ba shi hou zi wo yan jiu qing nian 2012_
- bio: _Zhang Guowei (born 4 January 1959 in Heqing County, Yunnan) is a male Chinese former long-distance runner who competed in the 1988 Summer Ol…_

### id=5176 · `Liangzhu. et al`

- keyword: **et al.** · boeken: **1** · bio=1138c · b.? d.?
- voorbeelden: _Bei zhuang di min yun_
- bio: _The Liangzhu () culture or civilization (3300–2300 BC) was the last Chinese Neolithic jade culture in the Yangtze River Delta. The culture w…_

### id=5355 · `Zunzi. et al`

- keyword: **et al.** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Jiu qi ju chang_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5378 · `Mingxin. et al`

- keyword: **et al.** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Jiao yu yan_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5412 · `et al`

- keyword: **et al.** · boeken: **1** · bio=306c · b.? d.?
- voorbeelden: _Gong min kang ming yu zhan ling zhong huan : xiang gang ji du tu di xin yang xing si_
- bio: _This page is one of a series listing English translations of notable Latin phrases, such as veni, vidi, vici and et cetera. Some of the phra…_

### id=5420 · `Xiaohua. et al`

- keyword: **et al.** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Liu si wei yuan yong mei wan : liu si shi er nian te kan_

### id=5448 · `Haihua. et al`

- keyword: **et al.** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Jiao yin yu zhan jiao : Zhi lian hui "liu si" qi zhou nian ji nian tu pian ji_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5469 · `Yingshi. et al`

- keyword: **et al.** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Tiao zhan yu zai sheng_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=5475 · `Zhenyu. et al`

- keyword: **et al.** · boeken: **1** · bio=705c · b.? d.?
- voorbeelden: _Xianggang ren 2.0 : shi jian shang wei jie shu, jin hua yi jing wan cheng_
- bio: _Since the "Law of the People's Republic of China on Safeguarding National Security in the Hong Kong Special Administrative Region" came into…_

### id=9396 · `Montedron, Jacques et.al.`

- keyword: **et al.** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _C´est le printemps_

## TITLE_LIKE (1)

### id=9520 · `Serie La SS en acción`

- keyword: **reference-work prefix** · boeken: **2** · bio=309c · b.1961 d.?
- voorbeelden: _Cristo no es judío; La mentira de Auschwitz; Hitler o Lenin / Serie La SS en acción: Por qué nos mienten los judíos; Los judíos; La SS europea;_
- bio: _María Alejandra Bravo de la Parra (born 29 April 1961) is a Mexican biochemist who was laureated with the 2010 L'Oréal-UNESCO Award for Wome…_
