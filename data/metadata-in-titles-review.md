# Metadata-in-titles audit

_Gegenereerd 2026-05-28 door `scripts/_audit_metadata_in_titles.ts`._

Totaal boeken met titel-metadata-signaal: **40**.

## Per categorie

| Categorie | Aantal | Wat te doen |
|---|---:|---|
| `QUOTED_OPEN` | 1 | opent of sluit met losse quote — vrijwel altijd fout. Strip de quote. |
| `QUOTED_FULL` | 0 | volledig tussen quotes — kan correct zijn (titel-binnen-titel) maar typisch source-artefact. Inspecteer. |
| `EMBEDDED_QUOTES` | 29 | quotes binnen de titel (≥2 instanties). Typisch transliteratie-marker (Chinese pinyin) of source-paste artefact. |
| `BY_AUTHOR_TAIL` | 2 | auteur staat aan het einde van de titel + matcht book_author. Strip "by …" naar het einde. |
| `PAREN_AUTHOR` | 0 | auteur in haakjes. Strip de haakjes, zet author in book_authors. |
| `DASH_AUTHOR` | 0 | em-dash + naam aan het einde. Inspecteer of het echt een auteur is. |
| `COLON_AUTHOR` | 0 | "Title: Author" — auteur staat al in book_authors. Strip alles na de colon. |
| `PAREN_EDITION` | 3 | editie-info in haakjes (2nd ed., Revised). Strip de haakjes-staart. |
| `EDITION_SUFFIX` | 2 | editie-suffix zonder haakjes. Strip. |
| `PAREN_PUBLISHER` | 0 | uitgever in haakjes (Penguin Classics, Oxford). Strip. |
| `PAREN_YEAR` | 3 | jaartal in haakjes. Soms legitieme disambiguator (twee boeken met dezelfde titel) — anders strip. |
| `ALL_CAPS_RUN` | 0 | ≥3 woorden in ALL CAPS — typisch KDN-Maleisië source-convention. Title-case herstellen. |
| `ANGLE_BRACKETS` | 0 | titel bevat haken die niet hoorden — scraper-artefact. |
| `SOURCE_TAG_PREFIX` | 0 | titel begint met bron-codering (KDN L.N. ###). Strip prefix. |

## QUOTED_OPEN (1)

> opent of sluit met losse quote — vrijwel altijd fout. Strip de quote.

- **13940** · `saggi-sulla-teoria-della-crisi-dialettica-e-metodica-nel-capitale` · y=? · lang=?
  - title: "Saggi sulla teoría della crisi: dialettica e metodica nel “Capitale”"
  - capture: `si: dialettica e metodica nel “Capitale”`
  - author(s): _Grossman, Henryk_

## EMBEDDED_QUOTES (29)

> quotes binnen de titel (≥2 instanties). Typisch transliteratie-marker (Chinese pinyin) of source-paste artefact.

- **3486** · `bloody-jack-being-an-account-of-the-curious-adventures-of-mary-jacky-faber-ships-boy` · y=2025 · lang=en
  - title: "Bloody Jack: Being an Account of the Curious Adventures of Mary "Jacky" Faber, Ship's Boy"
  - capture: `Bloody Jack: Being an Account of the Curious Adventures of M`
  - author(s): _L. A. Meyer_

- **4315** · `ready-set-grow-a-whats-happening-to-my-body-book-for-younger-girls` · y=2025 · lang=en
  - title: "Ready, Set, Grow!: A "What's Happening to My Body?" Book for Younger Girls"
  - capture: `Ready, Set, Grow!: A "What's Happening to My Body?" Book for`
  - author(s): _Lynda Madaras_

- **4691** · `shirley-jacksons-the-lottery-the-authorized-graphic-adaptation` · y=2024 · lang=en
  - title: "Shirley Jackson's "The Lottery": The Authorized Graphic Adaptation"
  - capture: `Shirley Jackson's "The Lottery": The Authorized Graphic Adap`
  - author(s): _Miles Hyman_

- **5470** · `breakthrough-how-three-people-saved-blue-babies-and-changed-medicine-forever` · y=2024 · lang=en
  - title: "Breakthrough! How Three People Saved "Blue Babies" and Changed Medicine Forever"
  - capture: `Breakthrough! How Three People Saved "Blue Babies" and Chang`
  - author(s): _Jim Murphy_

- **9040** · `a-stylistic-analysis-of-selected-stories-in-achebes-girls-at-war-and-other-stories-a-comparative-study` · y=2024 · lang=en
  - title: "A Stylistic Analysis of Selected Stories in Achebe's "Girls At War And Other Stories": A Comparative Study"
  - capture: `A Stylistic Analysis of Selected Stories in Achebe's "Girls `
  - author(s): _Chidinma Dike_

- **6338** · `uitgeverij-guggenheimer-guggenheimer-publishers-1999` · y=1999 · lang=?
  - title: "Uitgeverij Guggenheimer ("Guggenheimer Publishers")"
  - capture: `Uitgeverij Guggenheimer ("Guggenheimer Publishers")`
  - author(s): _Herman Brusselmans_

- **9383** · `jackie-the-joke-man-martlings-disgustingly-dirty-joke-book` · y=1997 · lang=en
  - title: "Jackie "The Joke Man" Martling's Disgustingly Dirty Joke Book"
  - capture: `Jackie "The Joke Man" Martling's Disgustingly Dirty Joke Boo`
  - author(s): _Jackie Martling_

- **394** · `a-child-called-it-one-childs-courage-to-survive` · y=1987 · lang=en
  - title: "A Child Called "It": One Child's Courage to Survive"
  - capture: `A Child Called "It": One Child's Courage to Survive`
  - author(s): _Dave Pelzer_

- **6727** · `zhonghua-renmin-gongheguo-shi-di-8-juan-nan-yi-ji-xu-de-ji-xu-ge-ming-cong-pi-lin-dao-pi-deng-1972-1976` · y=? · lang=zh
  - title: "Zhonghua Renmin Gongheguo shi. Di 8 juan, Nan yi ji xu de "ji xu ge ming" : cong pi Lin dao pi Deng, 1972-1976"
  - capture: `Zhonghua Renmin Gongheguo shi. Di 8 juan, Nan yi ji xu de "j`
  - author(s): _Yun Shi; Lim Danhui_

- **6784** · `6-4-da-tu-sha-ping-xi` · y=? · lang=zh
  - title: ""6.4 da tu sha" ping xi"
  - capture: `"6.4 da tu sha" ping xi`
  - author(s): _Wengui Liang_

- **6837** · `liang-zhi-yu-yi-guo-de-wei-lai` · y=? · lang=zh
  - title: ""Liang zhi" yu "yi guo" de wei lai"
  - capture: `"Liang zhi" yu "yi guo" de wei lai`
  - author(s): _Yaoting Dai_

- **6860** · `meiguo-zhi-jie-zhongguo-jie-fang-jun-di-yi-ying-pai-meng-yi-yu-qiang-guo-bo-li-xin-de-meng-yan` · y=? · lang=zh
  - title: ""Meiguo zhi jie Zhongguo?" : jie fang jun di yi ying pai meng yi yu qiang guo bo li xin de meng yan"
  - capture: `"Meiguo zhi jie Zhongguo?" : jie fang jun di yi ying pai men`
  - author(s): _Hongbing Yuan_

- **6928** · `liu-si-shou-nan-zhe-ming-ce` · y=? · lang=zh
  - title: ""Liu si" shou nan zhe ming ce"
  - capture: `"Liu si" shou nan zhe ming ce`
  - author(s): _Zilin Ding_

- **6963** · `xin-si-ren-bang-he-tai-shang-huang-mei-you-jie-su-de-quan-dou` · y=? · lang=zh
  - title: "Xin "si ren bang" he "tai shang huang" : mei you jie su de quan dou"
  - capture: `Xin "si ren bang" he "tai shang huang" : mei you jie su de q`
  - author(s): _Zichang Xie_

- **7055** · `wen-ge-zhong-de-zhou-enlai` · y=? · lang=zh
  - title: ""Wen ge" zhong de Zhou Enlai"
  - capture: `"Wen ge" zhong de Zhou Enlai`
  - author(s): _Wusheng Liu_

- **7072** · `zhongguo-liu-si-zhen-xiang` · y=? · lang=zh
  - title: "Zhongguo "Liu si" zhen xiang"
  - capture: `Zhongguo "Liu si" zhen xiang`
  - author(s): _Liang Zhang_

- **7082** · `li-shi-de-da-bao-zha-liu-si-shi-jian-quan-jing-shi-lu` · y=? · lang=zh
  - title: "Li shi de da bao zha : " Liu si " shi jian quan jing shi lu"
  - capture: `Li shi de da bao zha : " Liu si " shi jian quan jing shi lu`
  - author(s): _Wanshu Zhang_

- **7093** · `dang-jue-qi-zhongguo-yu-shang-tai-yang-san-tou-shi-nian-yi-shi-ji-liang-an-san-di-xin-guan-xi` · y=? · lang=zh
  - title: "Dang "Jue qi Zhongguo" yu shang "Tai yang san" : tou shi nian yi shi ji liang an san di xin guan xi"
  - capture: `Dang "Jue qi Zhongguo" yu shang "Tai yang san" : tou shi nia`
  - author(s): _Quanzhong Lin_

- **7172** · `jiao-yin-yu-zhan-jiao-zhi-lian-hui-liu-si-qi-zhou-nian-ji-nian-tu-pian-ji` · y=? · lang=zh
  - title: "Jiao yin yu zhan jiao : Zhi lian hui "liu si" qi zhou nian ji nian tu pian ji"
  - capture: `Jiao yin yu zhan jiao : Zhi lian hui "liu si" qi zhou nian j`
  - author(s): _Mai; Haihua_

- **7185** · `mo-ri-xing-cun-zhe-de-du-bai-liu-xiaobo-de-liu-si-hui-yi-lu` · y=? · lang=zh
  - title: "Mo ri xing cun zhe de du bai : Liu Xiaobo de "liu si" hui yi lu"
  - capture: `Mo ri xing cun zhe de du bai : Liu Xiaobo de "liu si" hui yi`
  - author(s): _Liu Xiaobo_

- **7332** · `mourning-headband-for-hue-an-account-of-the-battle-for-hue-vietnam-1968-mot-lan-nhan-vat-mau-than-trong-giai-khan-so-cho-hue` · y=? · lang=vi
  - title: "Mourning Headband for Hue: An Account of the Battle for Hue, Vietnam 1968 (Một lần nhân vật Mậu Thân trong "Giải Khăn Sô Cho Huế")"
  - capture: `Mourning Headband for Hue: An Account of the Battle for Hue,`
  - author(s): _Nhã Ca_

- **7530** · `chang-shi-ge-ming-fou-xiang-yu-san-yun-dong-de-san-zong-zui` · y=? · lang=zh
  - title: "Chang shi ge ming : fou xiang "Yu san yun dong" de san zong zui"
  - capture: `Chang shi ge ming : fou xiang "Yu san yun dong" de san zong `
  - author(s): _Baoqiang Xu_

- **11323** · `spark-yang-di-mulai-dengan-perkataan2-spark-is-the-courageous-voice-of-the-oppressed-majority-dan-di-akhiri-dengan-perkataan2-and-oppressors-is-lighter-than-a-feather` · y=? · lang=en
  - title: "Spark" yang Di-mulai Dengan Perkataan2 "spark Is the Courageous Voice of the Oppressed Majority...."dan Di-akhiri Dengan Perkataan2 "....and Oppressors Is Lighter Than a Feather"."
  - capture: `Spark" yang Di-mulai Dengan Perkataan2 "spark Is the Courage`
  - author(s): _Anonymous*_

- **11615** · `a-document-the-text-where-of-commences-with-the-words-kami-sekumpulan-rakyat-malaysia-dated-2nd-sept-1975-printed-in-bahasa-msia-with-certified-copies-of-five-extracts-of-title-from-the-land-re` · y=? · lang=ms
  - title: "A Document the Text Where of Commences with the Words "kami Sekumpulan Rakyat Malaysia"dated 2Nd Sept 1975, Printed in Bahasa M'sia with Certified Copies of Five Extracts of Title from the Land Re"
  - capture: `A Document the Text Where of Commences with the Words "kami `
  - author(s): _Anonymous*_

- **11619** · `suatu-suratan-bertajuk-untuk-bacaan-semua-orang-kaya-miskin-tua-muda-bertarikh-6hb-november-1975` · y=? · lang=ms
  - title: "Suatu suratan bertajuk "Untuk Bacaan Semua Orang Kaya Miskin Tua Muda" bertarikh 6hb November 1975"
  - capture: `Suatu suratan bertajuk "Untuk Bacaan Semua Orang Kaya Miskin`
  - author(s): _Rakyat Jujur_

- **11636** · `suratan-bertajuk-umat-islam-perlu-perhebatkan-lagi-perjuangan-untuk-kebenaran-dan-keadilan-bertarikh-6-oktober-1975` · y=? · lang=ms
  - title: "Suratan Bertajuk "Umat Islam Perlu Perhebatkan Lagi Perjuangan untuk Kebenaran dan Keadilan" Bertarikh 6 Oktober 1975"
  - capture: `Suratan Bertajuk "Umat Islam Perlu Perhebatkan Lagi Perjuang`
  - author(s): _Anonymous*_

- **12319** · `cakera-padat-bertajuk-the-east-is-red-selected-songs-1-the-east-is-red-2-the-october-wind-from-the-north-3-peasants1-song-4-workers-peasants-and-soldiers-unite-5-autumn-harvest-uprising-6-chingka` · y=? · lang=zh
  - title: "Cakera Padat Bertajuk "the East Is Red Selected Songs" 1.the East Is Red 2.the October Wind from the North 3.Peasants1 Song 4.Workers, Peasants and Soldiers, Unite! 5.Autumn Harvest Uprising 6.Chingka"
  - capture: `Cakera Padat Bertajuk "the East Is Red Selected Songs" 1.the`
  - author(s): _Anonymous*_

- **12909** · `artikel-bertajuk-media-eropah-siarkan-semula-karikatur-meningkatkan-kontroversi-akhbar-denmark-hina-agama-islam-mohom-maaf-yang-disiarkan-dalam-akhbar-guan-ming-daily-edisi-petang-pada-3-februari-2` · y=? · lang=zh
  - title: "Artikel bertajuk "Media Eropah siarkan semula karikatur meningkatkan kontroversi Akhbar Denmark hina agama Islam, mohom maaf" Yang disiarkan dalam akhbar Guan Ming Daily Edisi Petang pada 3 Februari 2"
  - capture: `Artikel bertajuk "Media Eropah siarkan semula karikatur meni`
  - author(s): _Anonymous*_

- **13166** · `apa-apa-pakaian-berwarna-kuning-dan-yang-mengandungi-perkataan-bersih-4-dan-apa-apa-bahan-bercetak-lain-dan-risalah-yang-mendorong-kepada-perhimpunan-bersih-4` · y=? · lang=?
  - title: "Apa-Apa pakaian berwarna kuning dan yang mengandungi perkataan "Bersih 4" dan apa-apa bahan bercetak lain dan risalah yang mendorong kepada perhimpunan Bersih 4"
  - capture: `Apa-Apa pakaian berwarna kuning dan yang mengandungi perkata`
  - author(s): _Anonymous*_

## BY_AUTHOR_TAIL (2)

> auteur staat aan het einde van de titel + matcht book_author. Strip "by …" naar het einde.

- **1294** · `gossip-girl-a-novel-by-cecily-von-ziegesar` · y=2025 · lang=en
  - title: "Gossip Girl: A Novel by Cecily von Ziegesar"
  - capture: ` by Cecily von Ziegesar`
  - author(s): _Cecily von Ziegesar_

- **7337** · `united-states-vietnam-relations-1945-1967-a-study-prepared-by-the-department-of-defense` · y=? · lang=?
  - title: "United States Vietnam Relations, 1945–1967: A Study Prepared by the Department of Defense"
  - capture: ` by the Department of Defense`
  - author(s): _Robert McNamara; the United States Department of Defense_

## PAREN_EDITION (3)

> editie-info in haakjes (2nd ed., Revised). Strip de haakjes-staart.

- **2731** · `el-libro-de-la-familia-the-family-book-spanish-edition` · y=2024 · lang=en
  - title: "El Libro de la Familia/The Family Book (Spanish Edition)"
  - capture: `(Spanish Edition)`
  - author(s): _Todd Parr_

- **5290** · `heartstopper-1-spanish-edition` · y=2024 · lang=en
  - title: "Heartstopper 1 (Spanish Edition)"
  - capture: `(Spanish Edition)`
  - author(s): _Alice Oseman_

- **10394** · `passion-of-fire-unknown-vol-1` · y=? · lang=?
  - title: "Passion of Fire Unknown (Vol.1)"
  - capture: `(Vol.1)`
  - author(s): _Anonymous*_

## EDITION_SUFFIX (2)

> editie-suffix zonder haakjes. Strip.

- **2792** · `foundations-in-personal-finance-2022-4th-edition` · y=2025 · lang=en
  - title: "Foundations in Personal Finance, 2022, 4th Edition"
  - capture: `4th Edition`
  - author(s): _Ramsey Solutions_

- **10064** · `the-encyclopedia-of-unsolved-crimes-2nd-edition` · y=2023 · lang=en
  - title: "The Encyclopedia of Unsolved Crimes, 2nd Edition"
  - capture: `2nd Edition`
  - author(s): _Michael Newton_

## PAREN_YEAR (3)

> jaartal in haakjes. Soms legitieme disambiguator (twee boeken met dezelfde titel) — anders strip.

- **6350** · `howl-1955` · y=? · lang=?
  - title: "Howl (1955)"
  - capture: `(1955)`
  - author(s): _Allen Ginsberg_

- **7427** · `perbindeshi-the-monster-1965` · y=? · lang=?
  - title: "Përbindëshi (The Monster) (1965)"
  - capture: `(1965)`
  - author(s): _Ismail Kadare_

- **13872** · `cuadernos-nacionales-n-1-1974` · y=? · lang=?
  - title: "Cuadernos Nacionales N° 1 (1974)"
  - capture: `(1974)`
  - author(s): _Facultad de Derecho_
