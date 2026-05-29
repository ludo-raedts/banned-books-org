# Smushed book titles — audit

_Gegenereerd 2026-05-27 door `scripts/_audit_smushed_book_titles.ts`._

Scanned 12302 books. 76 kandidaten met een period mid-string die mogelijk twee aparte werken zijn gesmushed.

Voorbeeld dat we al manueel gesplit hebben: id=14077 "Canción de gesta. Las piedras de Chile" → twee Neruda-boeken (1960 + 1961). Zie `scripts/_fix_3_enrichment_issues.ts` case 3 voor het split-patroon.

| confidence | aantal |
|---|---:|
| HIGH | 3 |
| MEDIUM | 59 |
| LOW | 14 |

## HIGH (3)

### id=13412 · `Leanid; Romanchuk, Yaraslau. Belarus at the Crossroads`

[/books/leanid-romanchuk-yaraslau-belarus-at-the-crossroads](/books/leanid-romanchuk-yaraslau-belarus-at-the-crossroads)  ·  year=?  ·  lang=?  ·  author=Zaiko

Voorgestelde split:

- **Left:** `Leanid; Romanchuk, Yaraslau`
  - geen bestaande match
- **Right:** `Belarus at the Crossroads`
  - bestaande match: id=13354 [Belarus at the Crossroads](/books/belarus-at-the-crossroads) _(via slug)_

Reden: beide helften ≥2 tokens (3 / 4)

### id=13540 · `Down Among the Sticks and Bones. Every Heart a Doorway`

[/books/down-among-the-sticks-and-bones-every-heart-a-doorway](/books/down-among-the-sticks-and-bones-every-heart-a-doorway)  ·  year=?  ·  lang=?  ·  author=Seanan McGuire

Voorgestelde split:

- **Left:** `Down Among the Sticks and Bones`
  - geen bestaande match
- **Right:** `Every Heart a Doorway`
  - bestaande match: id=1502 [Every Heart a Doorway](/books/every-heart-a-doorway) _(via slug)_

Reden: beide helften ≥2 tokens (6 / 4)

### id=14187 · `Karl Marx. Ensayo de biografía intelectual`

[/books/karl-marx-ensayo-de-biografia-intelectual](/books/karl-marx-ensayo-de-biografia-intelectual)  ·  year=?  ·  lang=?  ·  author=Rubel, Maximilien

Voorgestelde split:

- **Left:** `Karl Marx`
  - bestaande match: id=13952 [Karl Marx](/books/karl-marx) _(via slug)_
- **Right:** `Ensayo de biografía intelectual`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 4)

## MEDIUM (59)

### id=324 · `Real Live Boyfriends: Yes. Boyfriends, Plural. If My Life Weren't Complicated, I Wouldn't Be Ruby Oliver`

[/books/real-live-boyfriends-yes-boyfriends-plural-if-my-life-werent-complicated-i-would](/books/real-live-boyfriends-yes-boyfriends-plural-if-my-life-werent-complicated-i-would)  ·  year=2010  ·  lang=en  ·  author=e lockhart

Voorgestelde split:

- **Left:** `Real Live Boyfriends: Yes`
  - geen bestaande match
- **Right:** `Boyfriends, Plural. If My Life Weren't Complicated, I Wouldn't Be Ruby Oliver`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 12)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=2638 · `I'll Get There. It Better Be Worth the Trip`

[/books/ill-get-there-it-better-be-worth-the-trip](/books/ill-get-there-it-better-be-worth-the-trip)  ·  year=2024  ·  lang=en  ·  author=John Donovan

Voorgestelde split:

- **Left:** `I'll Get There`
  - geen bestaande match
- **Right:** `It Better Be Worth the Trip`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 6)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=6258 · `Azadi: Freedom. Fascism. Fiction.`

[/books/azadi-arundhati-roy](/books/azadi-arundhati-roy)  ·  year=2020  ·  lang=en  ·  author=Arundhati Roy

Voorgestelde split:

- **Left:** `Azadi: Freedom`
  - geen bestaande match
- **Right:** `Fascism. Fiction.`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=6379 · `Safeguard defenders: Crime must be punished. How to use Magnitsky law to punish human rights violators. (Tội ác phải bị trừng phạt. Hướng dẫn dùng luật Magnitsky để trừng phạt kẻ vi phạm nhân quyền.)`

[/books/safeguard-defenders-crime-must-be-punished-how-to-use-magnitsky-law-to-punish-human-rights-violators-toi-ac-phai-bi-trung-phat-huong-dan-dung-luat-magnitsky-de-trung-phat-ke-vi-pham-nhan-quyen](/books/safeguard-defenders-crime-must-be-punished-how-to-use-magnitsky-law-to-punish-human-rights-violators-toi-ac-phai-bi-trung-phat-huong-dan-dung-luat-magnitsky-de-trung-phat-ke-vi-pham-nhan-quyen)  ·  year=?  ·  lang=?  ·  author=Pham Doan Trang

Voorgestelde split:

- **Left:** `Safeguard defenders: Crime must be punished`
  - geen bestaande match
- **Right:** `How to use Magnitsky law to punish human rights violators. (Tội ác phải bị trừng phạt. Hướng dẫn dùng luật Magnitsky để trừng phạt kẻ vi phạm nhân quyền.)`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 29)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=6629 · `Opera philosophica. Donec corrig.`

[/books/opera-philosophica-donec-corrig](/books/opera-philosophica-donec-corrig)  ·  year=?  ·  lang=?  ·  author=René Descartes

Voorgestelde split:

- **Left:** `Opera philosophica`
  - geen bestaande match
- **Right:** `Donec corrig.`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=7040 · `Zou zhu qiao. Er = Snapshots across Hong Kong. II`

[/books/zou-zhu-qiao-er-snapshots-across-hong-kong-ii](/books/zou-zhu-qiao-er-snapshots-across-hong-kong-ii)  ·  year=?  ·  lang=zh  ·  author=Jian Jiang

Voorgestelde split:

- **Left:** `Zou zhu qiao`
  - geen bestaande match
- **Right:** `Er = Snapshots across Hong Kong. II`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 7)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=7045 · `Zhongguo min zhu yun dong shi. Cong Zhongguo zhu chun dao mo li hua ge ming chao`

[/books/zhongguo-min-zhu-yun-dong-shi-cong-zhongguo-zhu-chun-dao-mo-li-hua-ge-ming-chao](/books/zhongguo-min-zhu-yun-dong-shi-cong-zhongguo-zhu-chun-dao-mo-li-hua-ge-ming-chao)  ·  year=?  ·  lang=zh  ·  author=Yanqing Weng

Voorgestelde split:

- **Left:** `Zhongguo min zhu yun dong shi`
  - geen bestaande match
- **Right:** `Cong Zhongguo zhu chun dao mo li hua ge ming chao`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 11)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=7063 · `Zhongguo min zhu yun dong shi. Cong Yan'an Wang Shiwei zheng min zhu dao Xidan min zhu qiang`

[/books/zhongguo-min-zhu-yun-dong-shi-cong-yanan-wang-shiwei-zheng-min-zhu-dao-xidan-min-zhu-qiang](/books/zhongguo-min-zhu-yun-dong-shi-cong-yanan-wang-shiwei-zheng-min-zhu-dao-xidan-min-zhu-qiang)  ·  year=?  ·  lang=zh  ·  author=Yanqing Weng

Voorgestelde split:

- **Left:** `Zhongguo min zhu yun dong shi`
  - geen bestaande match
- **Right:** `Cong Yan'an Wang Shiwei zheng min zhu dao Xidan min zhu qiang`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 12)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=7555 · `Lofladoros. Un plan terrible`

[/books/lofladoros-un-plan-terrible](/books/lofladoros-un-plan-terrible)  ·  year=2025  ·  lang=en  ·  author=Shannon Watters

Voorgestelde split:

- **Left:** `Lofladoros`
  - geen bestaande match
- **Right:** `Un plan terrible`
  - geen bestaande match

Reden: één helft is single-token (1 / 3)

### id=10820 · `Secret Volume. Yer Por Chee`

[/books/secret-volume-yer-por-chee](/books/secret-volume-yer-por-chee)  ·  year=?  ·  lang=zh  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Secret Volume`
  - geen bestaande match
- **Right:** `Yer Por Chee`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 3)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=12089 · `The Kamasutra Of Vatsyayana Special Collector's Edition. Includes Explicit Photographs`

[/books/the-kamasutra-of-vatsyayana-special-collectors-edition-includes-explicit-photographs](/books/the-kamasutra-of-vatsyayana-special-collectors-edition-includes-explicit-photographs)  ·  year=?  ·  lang=en  ·  author=Anonymous

Voorgestelde split:

- **Left:** `The Kamasutra Of Vatsyayana Special Collector's Edition`
  - geen bestaande match
- **Right:** `Includes Explicit Photographs`
  - geen bestaande match

Reden: beide helften ≥2 tokens (7 / 3)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=12299 · `Penawar Racun Fitnah Terhadap Ahmadiah. Tanggapan Dan Penyelarasan Atas Buku Mengapa Saya Keluar Dari Ahmadiyah Qadiani`

[/books/penawar-racun-fitnah-terhadap-ahmadiah-tanggapan-dan-penyelarasan-atas-buku-mengapa-saya-keluar-dari-ahmadiyah-qadiani](/books/penawar-racun-fitnah-terhadap-ahmadiah-tanggapan-dan-penyelarasan-atas-buku-mengapa-saya-keluar-dari-ahmadiyah-qadiani)  ·  year=?  ·  lang=ms  ·  author=Pengurus Besar Jema`at Ahmadiah

Voorgestelde split:

- **Left:** `Penawar Racun Fitnah Terhadap Ahmadiah`
  - geen bestaande match
- **Right:** `Tanggapan Dan Penyelarasan Atas Buku Mengapa Saya Keluar Dari Ahmadiyah Qadiani`
  - geen bestaande match

Reden: beide helften ≥2 tokens (5 / 11)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=12393 · `Pada Hemah & Pandangan Ustaz Hj. Ashaari Muhammad`

[/books/pada-hemah-pandangan-ustaz-hj-ashaari-muhammad](/books/pada-hemah-pandangan-ustaz-hj-ashaari-muhammad)  ·  year=?  ·  lang=ms  ·  author=Ustaz Hj. Tajul Arifin

Voorgestelde split:

- **Left:** `Pada Hemah & Pandangan Ustaz Hj`
  - geen bestaande match
- **Right:** `Ashaari Muhammad`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=12962 · `Introducing Islam. Islam, Christianity, and Judaism`

[/books/introducing-islam-islam-christianity-and-judaism](/books/introducing-islam-islam-christianity-and-judaism)  ·  year=?  ·  lang=en  ·  author=Dorothy Kavanaugh

Voorgestelde split:

- **Left:** `Introducing Islam`
  - geen bestaande match
- **Right:** `Islam, Christianity, and Judaism`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 4)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=12987 · `Introdusing Islam. Islam:the Basics`

[/books/introdusing-islam-islam-the-basics](/books/introdusing-islam-islam-the-basics)  ·  year=?  ·  lang=en  ·  author=Kim Whiteheads

Voorgestelde split:

- **Left:** `Introdusing Islam`
  - geen bestaande match
- **Right:** `Islam:the Basics`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13131 · `Sultan Ismail Petra of Kelantan, Dethroning of a Malay Ruler. An Authorised Biographical Account Narrated by Tengku Muhammad Fakhry to the Author`

[/books/sultan-ismail-petra-of-kelantan-dethroning-of-a-malay-ruler-an-authorised-biographical-account-narrated-by-tengku-muhammad-fakhry-to-the-author](/books/sultan-ismail-petra-of-kelantan-dethroning-of-a-malay-ruler-an-authorised-biographical-account-narrated-by-tengku-muhammad-fakhry-to-the-author)  ·  year=?  ·  lang=en  ·  author=Prof Salleh Buang

Voorgestelde split:

- **Left:** `Sultan Ismail Petra of Kelantan, Dethroning of a Malay Ruler`
  - geen bestaande match
- **Right:** `An Authorised Biographical Account Narrated by Tengku Muhammad Fakhry to the Author`
  - geen bestaande match

Reden: beide helften ≥2 tokens (10 / 12)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13353 · `Military history of Belarus. Heroes. Symbols. Colors`

[/books/military-history-of-belarus-heroes-symbols-colors](/books/military-history-of-belarus-heroes-symbols-colors)  ·  year=?  ·  lang=?  ·  author=Viktar Lachar

Voorgestelde split:

- **Left:** `Military history of Belarus`
  - geen bestaande match
- **Right:** `Heroes. Symbols. Colors`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 3)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13358 · `Agrarian Policy of the Nationalists in Western Belarus: Planning. Transparency. Implementation (1941-1944)`

[/books/agrarian-policy-of-the-nationalists-in-western-belarus-planning-transparency-implementation-1941-1944](/books/agrarian-policy-of-the-nationalists-in-western-belarus-planning-transparency-implementation-1941-1944)  ·  year=?  ·  lang=?  ·  author=Sviatlana Kazlova

Voorgestelde split:

- **Left:** `Agrarian Policy of the Nationalists in Western Belarus: Planning`
  - geen bestaande match
- **Right:** `Transparency. Implementation (1941-1944)`
  - geen bestaande match

Reden: beide helften ≥2 tokens (9 / 3)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13360 · `Belarus. From Rahnieda to Kaściuška. An illustrated history`

[/books/belarus-from-rahnieda-to-kasciuska-an-illustrated-history](/books/belarus-from-rahnieda-to-kasciuska-an-illustrated-history)  ·  year=?  ·  lang=?  ·  author=Uładzimir Arłoŭ; Pavieł Tatarnikaŭ

Voorgestelde split:

- **Left:** `Belarus`
  - geen bestaande match
- **Right:** `From Rahnieda to Kaściuška. An illustrated history`
  - geen bestaande match

Reden: één helft is single-token (1 / 7)

### id=13365 · `Records of the Society of Belarusian History Enthusiasts named after Vacłaŭ Łastoŭski. Challenges of the 'Russian world' and Belarus`

[/books/records-of-the-society-of-belarusian-history-enthusiasts-named-after-vaclau-lastouski-challenges-of-the-russian-world-and-belarus](/books/records-of-the-society-of-belarusian-history-enthusiasts-named-after-vaclau-lastouski-challenges-of-the-russian-world-and-belarus)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Records of the Society of Belarusian History Enthusiasts named after Vacłaŭ Łastoŭski`
  - geen bestaande match
- **Right:** `Challenges of the 'Russian world' and Belarus`
  - geen bestaande match

Reden: beide helften ≥2 tokens (12 / 7)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13366 · `The Big Blood. How the USSR won the war of 1941-1945`

[/books/the-big-blood-how-the-ussr-won-the-war-of-1941-1945](/books/the-big-blood-how-the-ussr-won-the-war-of-1941-1945)  ·  year=?  ·  lang=?  ·  author=Siarhiej Zacharevič

Voorgestelde split:

- **Left:** `The Big Blood`
  - geen bestaande match
- **Right:** `How the USSR won the war of 1941-1945`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 8)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13387 · `Military symbols of Belarusians. Banners and uniforms`

[/books/military-symbols-of-belarusians-banners-and-uniforms](/books/military-symbols-of-belarusians-banners-and-uniforms)  ·  year=?  ·  lang=?  ·  author=Viktar Lachar

Voorgestelde split:

- **Left:** `Military symbols of Belarusians`
  - geen bestaande match
- **Right:** `Banners and uniforms`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 3)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13388 · `Illegal memory. Western Belarus in documents and facts. 1921-1954`

[/books/illegal-memory-western-belarus-in-documents-and-facts-1921-1954](/books/illegal-memory-western-belarus-in-documents-and-facts-1921-1954)  ·  year=?  ·  lang=?  ·  author=Alaksandr Tatarenko.

Voorgestelde split:

- **Left:** `Illegal memory`
  - geen bestaande match
- **Right:** `Western Belarus in documents and facts. 1921-1954`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 7)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13390 · `Icebreaker. Who started World War II?`

[/books/icebreaker-who-started-world-war-ii](/books/icebreaker-who-started-world-war-ii)  ·  year=?  ·  lang=?  ·  author=Viktar Suvoraŭ

Voorgestelde split:

- **Left:** `Icebreaker`
  - bestaande match: id=7679 [Icebreaker](/books/icebreaker) _(via slug)_
- **Right:** `Who started World War II?`
  - geen bestaande match

Reden: één helft is single-token (1 / 5)

### id=13392 · `poetic stories and short stories / Vincent Dunin-Marcinkievič. A collection of works. In 2 volumes, volume 1`

[/books/poetic-stories-and-short-stories-vincent-dunin-marcinkievic-a-collection-of-works-in-2-volumes-volume-1](/books/poetic-stories-and-short-stories-vincent-dunin-marcinkievic-a-collection-of-works-in-2-volumes-volume-1)  ·  year=?  ·  lang=?  ·  author=Foreword by Jazep Januškievič to the book Dramatic works

Voorgestelde split:

- **Left:** `poetic stories and short stories / Vincent Dunin-Marcinkievič`
  - geen bestaande match
- **Right:** `A collection of works. In 2 volumes, volume 1`
  - geen bestaande match

Reden: beide helften ≥2 tokens (8 / 9)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13394 · `Biełarusalim. The Second Book. The Heart of Light`

[/books/bielarusalim-the-second-book-the-heart-of-light](/books/bielarusalim-the-second-book-the-heart-of-light)  ·  year=?  ·  lang=?  ·  author=Pavieł Sieviaryniec

Voorgestelde split:

- **Left:** `Biełarusalim`
  - geen bestaande match
- **Right:** `The Second Book. The Heart of Light`
  - geen bestaande match

Reden: één helft is single-token (1 / 7)

### id=13411 · `Vincuk Viačorka. The Belarusian Journalist's Handbook`

[/books/vincuk-viacorka-the-belarusian-journalists-handbook](/books/vincuk-viacorka-the-belarusian-journalists-handbook)  ·  year=?  ·  lang=?  ·  author=Pšemysłaŭ Fienrych

Voorgestelde split:

- **Left:** `Vincuk Viačorka`
  - geen bestaande match
- **Right:** `The Belarusian Journalist's Handbook`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 4)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13422 · `Verbrannte Dorfer. Nationalsozialistische Verbrechen an der landlichen Bevolkerung in Polen und der Sowjetunion im Zweiten Weltkrieg`

[/books/verbrannte-dorfer-nationalsozialistische-verbrechen-an-der-landlichen-bevolkerung-in-polen-und-der-sowjetunion-im-zweiten-weltkrieg](/books/verbrannte-dorfer-nationalsozialistische-verbrechen-an-der-landlichen-bevolkerung-in-polen-und-der-sowjetunion-im-zweiten-weltkrieg)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Verbrannte Dorfer`
  - geen bestaande match
- **Right:** `Nationalsozialistische Verbrechen an der landlichen Bevolkerung in Polen und der Sowjetunion im Zweiten Weltkrieg`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 14)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13430 · `Valer Hapiejeŭ, Volniery. The Harbinger (Januškievič, 2023)`

[/books/valer-hapiejeu-volniery-the-harbinger-januskievic-2023](/books/valer-hapiejeu-volniery-the-harbinger-januskievic-2023)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Valer Hapiejeŭ, Volniery`
  - geen bestaande match
- **Right:** `The Harbinger (Januškievič, 2023)`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 4)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13431 · `Valer Hapiejeŭ, Volniery. The Endless Day (Januškievič, 2024)`

[/books/valer-hapiejeu-volniery-the-endless-day-januskievic-2024](/books/valer-hapiejeu-volniery-the-endless-day-januskievic-2024)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Valer Hapiejeŭ, Volniery`
  - geen bestaande match
- **Right:** `The Endless Day (Januškievič, 2024)`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13433 · `There They Are, and Here We Are: Belarusian Poetry and Poems of Solidarity, Edited and compiled by V. Korkunov. Afterword by U. Verina (Moscow: Nedovolny, 2021) 3.11.2025`

[/books/there-they-are-and-here-we-are-belarusian-poetry-and-poems-of-solidarity-edited-and-compiled-by-v-korkunov-afterword-by-u-verina-moscow-nedovolny-2021-3-11-2025](/books/there-they-are-and-here-we-are-belarusian-poetry-and-poems-of-solidarity-edited-and-compiled-by-v-korkunov-afterword-by-u-verina-moscow-nedovolny-2021-3-11-2025)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `There They Are, and Here We Are: Belarusian Poetry and Poems of Solidarity, Edited and compiled by V. Korkunov`
  - geen bestaande match
- **Right:** `Afterword by U. Verina (Moscow: Nedovolny, 2021) 3.11.2025`
  - geen bestaande match

Reden: beide helften ≥2 tokens (19 / 8)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13439 · `Yuri Felshtinsky, Natalia Radina's Belarus. A Journalist Against the Dictator (ISIA Media Verlag, 2025)`

[/books/yuri-felshtinsky-natalia-radinas-belarus-a-journalist-against-the-dictator-isia-media-verlag-2025](/books/yuri-felshtinsky-natalia-radinas-belarus-a-journalist-against-the-dictator-isia-media-verlag-2025)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Yuri Felshtinsky, Natalia Radina's Belarus`
  - geen bestaande match
- **Right:** `A Journalist Against the Dictator (ISIA Media Verlag, 2025)`
  - geen bestaande match

Reden: beide helften ≥2 tokens (5 / 9)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13468 · `Gangsta. Gangsta`

[/books/gangsta-gangsta](/books/gangsta-gangsta)  ·  year=?  ·  lang=?  ·  author=Kohske

Voorgestelde split:

- **Left:** `Gangsta`
  - geen bestaande match
- **Right:** `Gangsta`
  - geen bestaande match

Reden: één helft is single-token (1 / 1)

### id=13518 · `Faces and Masks of Same-Sex Love. Moonlight at Dawn`

[/books/faces-and-masks-of-same-sex-love-moonlight-at-dawn](/books/faces-and-masks-of-same-sex-love-moonlight-at-dawn)  ·  year=?  ·  lang=?  ·  author=Igor Kon

Voorgestelde split:

- **Left:** `Faces and Masks of Same-Sex Love`
  - geen bestaande match
- **Right:** `Moonlight at Dawn`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 3)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13520 · `A Frank Conversation about Homosexuality. The Other Side of Tolerance`

[/books/a-frank-conversation-about-homosexuality-the-other-side-of-tolerance](/books/a-frank-conversation-about-homosexuality-the-other-side-of-tolerance)  ·  year=?  ·  lang=?  ·  author=Richard Cohen

Voorgestelde split:

- **Left:** `A Frank Conversation about Homosexuality`
  - geen bestaande match
- **Right:** `The Other Side of Tolerance`
  - geen bestaande match

Reden: beide helften ≥2 tokens (5 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13523 · `The Rise of the Dark Moon. Pagan BDSM and the Path of Trials`

[/books/the-rise-of-the-dark-moon-pagan-bdsm-and-the-path-of-trials](/books/the-rise-of-the-dark-moon-pagan-bdsm-and-the-path-of-trials)  ·  year=?  ·  lang=?  ·  author=Raven Kaldera

Voorgestelde split:

- **Left:** `The Rise of the Dark Moon`
  - geen bestaande match
- **Right:** `Pagan BDSM and the Path of Trials`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 7)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13527 · `Whip for the Innocent. BDSM Stories for Adults`

[/books/whip-for-the-innocent-bdsm-stories-for-adults](/books/whip-for-the-innocent-bdsm-stories-for-adults)  ·  year=?  ·  lang=?  ·  author=Samantha Jones

Voorgestelde split:

- **Left:** `Whip for the Innocent`
  - geen bestaande match
- **Right:** `BDSM Stories for Adults`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 4)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13528 · `Passions and Intrigues. Confession of the Innocent. Threesome Sex. BDSM and the Sex Shop. Adult Toys`

[/books/passions-and-intrigues-confession-of-the-innocent-threesome-sex-bdsm-and-the-sex-shop-adult-toys](/books/passions-and-intrigues-confession-of-the-innocent-threesome-sex-bdsm-and-the-sex-shop-adult-toys)  ·  year=?  ·  lang=?  ·  author=Samantha Jones

Voorgestelde split:

- **Left:** `Passions and Intrigues`
  - geen bestaande match
- **Right:** `Confession of the Innocent. Threesome Sex. BDSM and the Sex Shop. Adult Toys`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 13)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13532 · `The Color of Pain. Silk`

[/books/the-color-of-pain-silk](/books/the-color-of-pain-silk)  ·  year=?  ·  lang=?  ·  author=Eva Hansen

Voorgestelde split:

- **Left:** `The Color of Pain`
  - geen bestaande match
- **Right:** `Silk`
  - geen bestaande match

Reden: één helft is single-token (4 / 1)

### id=13535 · `Buttons and Rage: Her Heart. His Revenge`

[/books/buttons-and-rage-her-heart-his-revenge](/books/buttons-and-rage-her-heart-his-revenge)  ·  year=?  ·  lang=?  ·  author=Penelope Sky

Voorgestelde split:

- **Left:** `Buttons and Rage: Her Heart`
  - geen bestaande match
- **Right:** `His Revenge`
  - geen bestaande match

Reden: beide helften ≥2 tokens (5 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13536 · `Buttons and Lace: Her Debt. His Desire`

[/books/buttons-and-lace-her-debt-his-desire](/books/buttons-and-lace-her-debt-his-desire)  ·  year=?  ·  lang=?  ·  author=Penelope Sky

Voorgestelde split:

- **Left:** `Buttons and Lace: Her Debt`
  - geen bestaande match
- **Right:** `His Desire`
  - geen bestaande match

Reden: beide helften ≥2 tokens (5 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13562 · `Day of the Dead. A Book with Fascinating Tasks`

[/books/day-of-the-dead-a-book-with-fascinating-tasks](/books/day-of-the-dead-a-book-with-fascinating-tasks)  ·  year=?  ·  lang=?  ·  author=comp. S.A. Stankevich

Voorgestelde split:

- **Left:** `Day of the Dead`
  - geen bestaande match
- **Right:** `A Book with Fascinating Tasks`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13583 · `Unjustified Cruelty. The Impressionable Should NOT Read`

[/books/unjustified-cruelty-the-impressionable-should-not-read](/books/unjustified-cruelty-the-impressionable-should-not-read)  ·  year=?  ·  lang=?  ·  author=Vl.Yak. Morshenyuk

Voorgestelde split:

- **Left:** `Unjustified Cruelty`
  - geen bestaande match
- **Right:** `The Impressionable Should NOT Read`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13687 · `Argentina. Congreso de la Nación. Homenaje Póstumo.`

[/books/argentina-congreso-de-la-nacion-homenaje-postumo](/books/argentina-congreso-de-la-nacion-homenaje-postumo)  ·  year=?  ·  lang=?  ·  author=Argentina. Congreso de la Nación. Homenaje Póstumo.

Voorgestelde split:

- **Left:** `Argentina`
  - bestaande match: id=14169 [Argentina](/books/argentina) _(via slug)_
- **Right:** `Congreso de la Nación. Homenaje Póstumo.`
  - geen bestaande match

Reden: één helft is single-token (1 / 6)

### id=13689 · `Por qué el convenio nacional democrático. Escritos 1975-1980`

[/books/por-que-el-convenio-nacional-democratico-escritos-1975-1980](/books/por-que-el-convenio-nacional-democratico-escritos-1975-1980)  ·  year=?  ·  lang=?  ·  author=Arnedo Álvarez, Gerónimo

Voorgestelde split:

- **Left:** `Por qué el convenio nacional democrático`
  - geen bestaande match
- **Right:** `Escritos 1975-1980`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13721 · `Severino Di Giovanni. El idealista de la violencia.`

[/books/severino-di-giovanni-el-idealista-de-la-violencia](/books/severino-di-giovanni-el-idealista-de-la-violencia)  ·  year=?  ·  lang=?  ·  author=Bayer, Osvaldo

Voorgestelde split:

- **Left:** `Severino Di Giovanni`
  - geen bestaande match
- **Right:** `El idealista de la violencia.`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13801 · `Trabajos escogidos. Tomo I.`

[/books/trabajos-escogidos-tomo-i](/books/trabajos-escogidos-tomo-i)  ·  year=?  ·  lang=?  ·  author=Codovilla, Víctor

Voorgestelde split:

- **Left:** `Trabajos escogidos`
  - geen bestaande match
- **Right:** `Tomo I.`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13810 · `Correspondencia Perón –Cooke. Dos volúmenes`

[/books/correspondencia-peron-cooke-dos-volumenes](/books/correspondencia-peron-cooke-dos-volumenes)  ·  year=?  ·  lang=?  ·  author=Cooke, John W.

Voorgestelde split:

- **Left:** `Correspondencia Perón –Cooke`
  - geen bestaande match
- **Right:** `Dos volúmenes`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13856 · `Unir a las mujeres en la lucha por sus derechos. Selección de trabajos de Victorio Codovilla sobre los problemas y las luchas de las mujeres`

[/books/unir-a-las-mujeres-en-la-lucha-por-sus-derechos-seleccion-de-trabajos-de-victorio-codovilla-sobre-los-problemas-y-las-luchas-de-las-mujeres](/books/unir-a-las-mujeres-en-la-lucha-por-sus-derechos-seleccion-de-trabajos-de-victorio-codovilla-sobre-los-problemas-y-las-luchas-de-las-mujeres)  ·  year=?  ·  lang=?  ·  author=Editorial Anteo

Voorgestelde split:

- **Left:** `Unir a las mujeres en la lucha por sus derechos`
  - geen bestaande match
- **Right:** `Selección de trabajos de Victorio Codovilla sobre los problemas y las luchas de las mujeres`
  - geen bestaande match

Reden: beide helften ≥2 tokens (10 / 15)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13877 · `Historia del pensamiento político. El socialismo`

[/books/historia-del-pensamiento-politico-el-socialismo](/books/historia-del-pensamiento-politico-el-socialismo)  ·  year=?  ·  lang=?  ·  author=Fayt, Carlos S.

Voorgestelde split:

- **Left:** `Historia del pensamiento político`
  - geen bestaande match
- **Right:** `El socialismo`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13896 · `La lucha antiimperialista. Etapa fundamental del proceso democrático`

[/books/la-lucha-antiimperialista-etapa-fundamental-del-proceso-democratico](/books/la-lucha-antiimperialista-etapa-fundamental-del-proceso-democratico)  ·  year=?  ·  lang=?  ·  author=Frondizi, Arturo

Voorgestelde split:

- **Left:** `La lucha antiimperialista`
  - geen bestaande match
- **Right:** `Etapa fundamental del proceso democrático`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=13928 · `La calle del agujero en la media. Todos bailan`

[/books/la-calle-del-agujero-en-la-media-todos-bailan](/books/la-calle-del-agujero-en-la-media-todos-bailan)  ·  year=?  ·  lang=?  ·  author=González Tuñón, Raúl

Voorgestelde split:

- **Left:** `La calle del agujero en la media`
  - geen bestaande match
- **Right:** `Todos bailan`
  - geen bestaande match

Reden: beide helften ≥2 tokens (7 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14012 · `Enrique del Valle Iberlucea. Una honesta conducta frente a la revolución rusa`

[/books/enrique-del-valle-iberlucea-una-honesta-conducta-frente-a-la-revolucion-rusa](/books/enrique-del-valle-iberlucea-una-honesta-conducta-frente-a-la-revolucion-rusa)  ·  year=?  ·  lang=?  ·  author=Marianetti, Benito

Voorgestelde split:

- **Left:** `Enrique del Valle Iberlucea`
  - geen bestaande match
- **Right:** `Una honesta conducta frente a la revolución rusa`
  - geen bestaande match

Reden: beide helften ≥2 tokens (4 / 8)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14028 · `Sobre el sistema colonial del capitalismo. Trabajo asalariado y capital. Salario, precio y ganancia.`

[/books/sobre-el-sistema-colonial-del-capitalismo-trabajo-asalariado-y-capital-salario-precio-y-ganancia](/books/sobre-el-sistema-colonial-del-capitalismo-trabajo-asalariado-y-capital-salario-precio-y-ganancia)  ·  year=?  ·  lang=?  ·  author=Marx, Carlos; Engels, F.

Voorgestelde split:

- **Left:** `Sobre el sistema colonial del capitalismo`
  - geen bestaande match
- **Right:** `Trabajo asalariado y capital. Salario, precio y ganancia.`
  - geen bestaande match

Reden: beide helften ≥2 tokens (6 / 8)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14046 · `El duke. Memorias y antimemorias de un partícipe de la represión`

[/books/el-duke-memorias-y-antimemorias-de-un-participe-de-la-represion](/books/el-duke-memorias-y-antimemorias-de-un-participe-de-la-represion)  ·  year=?  ·  lang=?  ·  author=Medina, Enrique

Voorgestelde split:

- **Left:** `El duke`
  - geen bestaande match
- **Right:** `Memorias y antimemorias de un partícipe de la represión`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 9)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14105 · `Antes de Mayo. Formas sociales del trasplante español al`

[/books/antes-de-mayo-formas-sociales-del-trasplante-espanol-al](/books/antes-de-mayo-formas-sociales-del-trasplante-espanol-al)  ·  year=?  ·  lang=?  ·  author=Peña, Milcíades

Voorgestelde split:

- **Left:** `Antes de Mayo`
  - geen bestaande match
- **Right:** `Formas sociales del trasplante español al`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 6)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14144 · `Psicología recreativa. Volumen II`

[/books/psicologia-recreativa-volumen-ii](/books/psicologia-recreativa-volumen-ii)  ·  year=?  ·  lang=?  ·  author=Platanov, Konstantin

Voorgestelde split:

- **Left:** `Psicología recreativa`
  - geen bestaande match
- **Right:** `Volumen II`
  - geen bestaande match

Reden: beide helften ≥2 tokens (2 / 2)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14152 · `Apuntes de viaje. Diario íntimo de un adolescente`

[/books/apuntes-de-viaje-diario-intimo-de-un-adolescente](/books/apuntes-de-viaje-diario-intimo-de-un-adolescente)  ·  year=?  ·  lang=?  ·  author=Ponce, Aníbal

Voorgestelde split:

- **Left:** `Apuntes de viaje`
  - geen bestaande match
- **Right:** `Diario íntimo de un adolescente`
  - geen bestaande match

Reden: beide helften ≥2 tokens (3 / 5)
Flags: ⚠ geen corpus-corroboratie (beide helften niet elders in DB)

### id=14255 · `Abono inagotable. Poema`

[/books/abono-inagotable-poema](/books/abono-inagotable-poema)  ·  year=?  ·  lang=?  ·  author=Varela, Alfredo

Voorgestelde split:

- **Left:** `Abono inagotable`
  - geen bestaande match
- **Right:** `Poema`
  - geen bestaande match

Reden: één helft is single-token (2 / 1)

## LOW (14)

### id=6703 · `Mu ji tian an men. Di si juan`

[/books/mu-ji-tian-an-men-di-si-juan](/books/mu-ji-tian-an-men-di-si-juan)  ·  year=?  ·  lang=zh  ·  author=Han; Tailun. (Editor)

Voorgestelde split:

- **Left:** `Mu ji tian an men`
  - geen bestaande match
- **Right:** `Di si juan`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=6711 · `Zhonghua Renmin Gongheguo shi. Di 5 juan, Li shi de bian ju : cong wan jiu wei ji dao fan xiu fang xiu, 1962-1965`

[/books/zhonghua-renmin-gongheguo-shi-di-5-juan-li-shi-de-bian-ju-cong-wan-jiu-wei-ji-dao-fan-xiu-fang-xiu-1962-1965](/books/zhonghua-renmin-gongheguo-shi-di-5-juan-li-shi-de-bian-ju-cong-wan-jiu-wei-ji-dao-fan-xiu-fang-xiu-1962-1965)  ·  year=?  ·  lang=zh  ·  author=Xiangli Qian

Voorgestelde split:

- **Left:** `Zhonghua Renmin Gongheguo shi`
  - geen bestaande match
- **Right:** `Di 5 juan, Li shi de bian ju : cong wan jiu wei ji dao fan xiu fang xiu, 1962-1965`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=6727 · `Zhonghua Renmin Gongheguo shi. Di 8 juan, Nan yi ji xu de "ji xu ge ming" : cong pi Lin dao pi Deng, 1972-1976`

[/books/zhonghua-renmin-gongheguo-shi-di-8-juan-nan-yi-ji-xu-de-ji-xu-ge-ming-cong-pi-lin-dao-pi-deng-1972-1976](/books/zhonghua-renmin-gongheguo-shi-di-8-juan-nan-yi-ji-xu-de-ji-xu-ge-ming-cong-pi-lin-dao-pi-deng-1972-1976)  ·  year=?  ·  lang=zh  ·  author=Yun Shi; Lim Danhui

Voorgestelde split:

- **Left:** `Zhonghua Renmin Gongheguo shi`
  - geen bestaande match
- **Right:** `Di 8 juan, Nan yi ji xu de "ji xu ge ming" : cong pi Lin dao pi Deng, 1972-1976`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=6752 · `Jin dai shi de duo luo : Liu zhong jing dian ping jin xian dai ren wu. Guo Gong juan`

[/books/jin-dai-shi-de-duo-luo-liu-zhong-jing-dian-ping-jin-xian-dai-ren-wu-guo-gong-juan](/books/jin-dai-shi-de-duo-luo-liu-zhong-jing-dian-ping-jin-xian-dai-ren-wu-guo-gong-juan)  ·  year=?  ·  lang=zh  ·  author=Zhiyuan Xu

Voorgestelde split:

- **Left:** `Jin dai shi de duo luo : Liu zhong jing dian ping jin xian dai ren wu`
  - geen bestaande match
- **Right:** `Guo Gong juan`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=6790 · `Xianggang cheng bang lun. II, Guang fu ben tu`

[/books/xianggang-cheng-bang-lun-ii-guang-fu-ben-tu](/books/xianggang-cheng-bang-lun-ii-guang-fu-ben-tu)  ·  year=?  ·  lang=zh  ·  author=Yun Chen

Voorgestelde split:

- **Left:** `Xianggang cheng bang lun`
  - geen bestaande match
- **Right:** `II, Guang fu ben tu`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=6828 · `Ti bao guo qing. II, tian xiawei cheng`

[/books/ti-bao-guo-qing-ii-tian-xiawei-cheng](/books/ti-bao-guo-qing-ii-tian-xiawei-cheng)  ·  year=?  ·  lang=zh  ·  author=Bingquan Lü

Voorgestelde split:

- **Left:** `Ti bao guo qing`
  - bestaande match: id=6811 [Ti bao guo qing](/books/ti-bao-guo-qing) _(via slug)_
- **Right:** `II, tian xiawei cheng`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7010 · `Zhi fu huo zhe. II, Dui chong ce lüe wang : shun shi er xing, wu liang jing jie : fei fan de du men shi zhan bao dian`

[/books/zhi-fu-huo-zhe-ii-dui-chong-ce-lue-wang-shun-shi-er-xing-wu-liang-jing-jie-fei-fan-de-du-men-shi-zhan-bao-dian](/books/zhi-fu-huo-zhe-ii-dui-chong-ce-lue-wang-shun-shi-er-xing-wu-liang-jing-jie-fei-fan-de-du-men-shi-zhan-bao-dian)  ·  year=?  ·  lang=zh  ·  author=Zhijian Qian

Voorgestelde split:

- **Left:** `Zhi fu huo zhe`
  - geen bestaande match
- **Right:** `II, Dui chong ce lüe wang : shun shi er xing, wu liang jing jie : fei fan de du men shi zhan bao dian`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7026 · `Zhi fu huo zhe. II, cong shi wan dao guo yi, hao gu piao shi wang dao`

[/books/zhi-fu-huo-zhe-ii-cong-shi-wan-dao-guo-yi-hao-gu-piao-shi-wang-dao](/books/zhi-fu-huo-zhe-ii-cong-shi-wan-dao-guo-yi-hao-gu-piao-shi-wang-dao)  ·  year=?  ·  lang=zh  ·  author=Guangcheng Liu

Voorgestelde split:

- **Left:** `Zhi fu huo zhe`
  - geen bestaande match
- **Right:** `II, cong shi wan dao guo yi, hao gu piao shi wang dao`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7183 · `Mu ji tian an men. Di yi juan`

[/books/mu-ji-tian-an-men-di-yi-juan](/books/mu-ji-tian-an-men-di-yi-juan)  ·  year=?  ·  lang=zh  ·  author=Han; Tailun. (Editor)

Voorgestelde split:

- **Left:** `Mu ji tian an men`
  - geen bestaande match
- **Right:** `Di yi juan`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7199 · `Mu ji tian an men. Di er juan`

[/books/mu-ji-tian-an-men-di-er-juan](/books/mu-ji-tian-an-men-di-er-juan)  ·  year=?  ·  lang=zh  ·  author=Han; Tailun. (Editor)

Voorgestelde split:

- **Left:** `Mu ji tian an men`
  - geen bestaande match
- **Right:** `Di er juan`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7215 · `Mu ji tian an men. Di san juan`

[/books/mu-ji-tian-an-men-di-san-juan](/books/mu-ji-tian-an-men-di-san-juan)  ·  year=?  ·  lang=zh  ·  author=Han; Tailun. (Editor)

Voorgestelde split:

- **Left:** `Mu ji tian an men`
  - geen bestaande match
- **Right:** `Di san juan`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7222 · `Zhonghua Renmin Gongheguo shi. Di 4 juan, Wutuobang yun dong : cong da yue jin dao da ji huang, 1958-1961`

[/books/zhonghua-renmin-gongheguo-shi-di-4-juan-wutuobang-yun-dong-cong-da-yue-jin-dao-da-ji-huang-1958-1961](/books/zhonghua-renmin-gongheguo-shi-di-4-juan-wutuobang-yun-dong-cong-da-yue-jin-dao-da-ji-huang-1958-1961)  ·  year=?  ·  lang=zh  ·  author=Yunhui Lin

Voorgestelde split:

- **Left:** `Zhonghua Renmin Gongheguo shi`
  - geen bestaande match
- **Right:** `Di 4 juan, Wutuobang yun dong : cong da yue jin dao da ji huang, 1958-1961`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=7369 · `廣東雅言 : Liu zhong jing dian ping jin xian dai ren wu. Guo Gong juan`

[/books/liu-zhong-jing-dian-ping-jin-xian-dai-ren-wu-guo-gong-juan](/books/liu-zhong-jing-dian-ping-jin-xian-dai-ren-wu-guo-gong-juan)  ·  year=?  ·  lang=zh  ·  author=Yun Chen

Voorgestelde split:

- **Left:** `廣東雅言 : Liu zhong jing dian ping jin xian dai ren wu`
  - geen bestaande match
- **Right:** `Guo Gong juan`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)

### id=13443 · `Alaksandr Cvikievič, Historical Works. Volume 1`

[/books/alaksandr-cvikievic-historical-works-volume-1](/books/alaksandr-cvikievic-historical-works-volume-1)  ·  year=?  ·  lang=?  ·  author=Anonymous

Voorgestelde split:

- **Left:** `Alaksandr Cvikievič, Historical Works`
  - geen bestaande match
- **Right:** `Volume 1`
  - geen bestaande match

Reden: volume-marker pattern
Flags: ⚠ rechterhelft is volume-aanduiding (vermoedelijk één multi-volume werk)
