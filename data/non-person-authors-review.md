# Non-person author audit

_Gegenereerd 2026-06-08 door `scripts/_audit_non_person_authors.ts`._

Totaal authors: 8739. Verdachte rijen: **40**.

| categorie | aantal |
|---|---:|
| `ORG_BODY` | 38 |
| `PUBLISHER` | 1 |
| `STAFF_TAIL` | 1 |

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

## PUBLISHER (1)

### id=12323 · `Oxford University Press`

- keyword: **Press/Penerbit** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Spotlight on Britain_

## ORG_BODY (38)

### id=12270 · `Jehovah's Witnesses (Watch Tower Society)`

- keyword: **Society** · boeken: **5** · bio=N · b.? d.?
- voorbeelden: _What Does the Bible Really Teach? / Keep Yourselves in God's Love / Who Are Doing Jehovah's Will Today?_

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

### id=7268 · `The General Political Department of the People's Liberation Army`

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

### id=7624 · `Memorial Service Committee For Former Revolutionary Warriors`

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

### id=7648 · `Harbin Railway Workers' Union`

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

### id=8016 · `The Kensington Ladies` Erotica Society`

- keyword: **Society** · boeken: **1** · bio=843c · b.? d.?
- voorbeelden: _Ladies` Own Erotica_
- bio: _The Kensington Ladies' Erotica Society was an erotica writers' group founded in Kensington, California in 1976 whose aims were to create ero…_

### id=8558 · `Terjemahan Kumpulan Pengajian Islam UIA`

- keyword: **Group/Kumpulan** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Akhirnya Ku Temui Kebenaran_

### id=9645 · `Central Film Bureau`

- keyword: **Bureau** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _The Woman Driver_

### id=12047 · `Institut Studi Arus Informasi (ISAI)`

- keyword: **Institute** · boeken: **1** · bio=N · b.? d.?
- voorbeelden: _Bayang-Bayang PKI_

## STAFF_TAIL (1)

### id=1244 · `The New York Times Editorial Staff`

- keyword: **Editorial Staff** · boeken: **5** · bio=896c · b.? d.?
- voorbeelden: _Transgender Rights: Striving for Equality / Transgender Activists and Celebrities / Defining Sexual Consent: Where the Law Falls Short_
- bio: _The New York Times (NYT) is a newspaper based in Manhattan, New York City. The New York Times covers domestic, national, and international n…_
