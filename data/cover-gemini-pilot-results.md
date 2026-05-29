# Cover-enrichment Gemini pilot — results

Run: 2026-05-28T10:15:15.123Z · mode: DRY-RUN · books: 50

## Outcome summary
- **extract_failed**: 14
- **no_match**: 29
- **ok**: 1
- **rejected**: 3
- **mirror_failed**: 3

## Per-book details


Gemini usage: in=34016 out=17241 → est. cost ~$0.0533

### [HK] Sheng yu luan shi, you zhong ze ren — `sheng-yu-luan-shi-you-zhong-ze-ren`
- Native title: 生於亂世, 有種責任 = Our responsibility
- Author: Shuping Zhou
- Outcome: **extract_failed**
- Gemini page URL: https://www.hkbookcity.com/books/994120
- Gemini site: hkbookcity.com
- Gemini reasoning: The page on hkbookcity.com explicitly lists the native title '生於亂世，有種責任' and author '周淑屏', matching the provided information, and the publication year (2015) is consistent with a post-2020 ban.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.hkbookcity.com

### [HK] Tiao zhan yu zai sheng — `tiao-zhan-yu-zai-sheng`
- Native title: 挑戰與再生
- Author: Yu
- Outcome: **no_match**
- Gemini reasoning: The book '挑戰與再生' by 余英時, published by 幼獅文化事業公司 in 1985, was identified via Google Books. However, extensive searches on preferred Chinese-language book sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) and the publisher's website did not yield a canonical product page for this specific title. It is likely out of print and not actively sold on these platforms.
- Confidence: low
- Notes: The book '挑戰與再生' by 余英時, published by 幼獅文化事業公司 in 1985, was identified via Google Books. However, extensive searches on preferred Chinese-language book sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) and the publisher's website did not yield a canonical product page for this specific title. It is likely out of print and not actively sold on these platforms.

### [HK] Xianggang min zu lun — `xianggang-min-zu-lun`
- Native title: 香港民族論
- Author: Er ling yi san nian du Xianggang da xue xue sheng hui xue yuan bian
- Outcome: **ok**
- Gemini page URL: https://zh.wikipedia.org/wiki/%E9%A6%99%E6%B8%AF%E6%B0%91%E6%97%8F%E8%AB%96
- Gemini site: other
- Gemini reasoning: The Chinese Wikipedia page provides a comprehensive catalog of the book, including its native title (香港民族論), author (香港大學學生會學苑編), publication year (2014), and displays the cover image, which aligns with the request for a site that catalogues the book with cover art.
- Confidence: high
- Extracted image (via og:image): https://upload.wikimedia.org/wikipedia/commons/6/66/Hong_Kong_Nationalism_book_cover.jpg
- 2nd-opinion verdict: looks_right — The visible title matches the expected book title in Chinese.
- Mirrored: 13158B image/jpeg
- Final URL: https://eapmnfvgfeyclywyiiza.supabase.co/storage/v1/object/public/book-covers/xianggang-min-zu-lun.jpg
- Preview: ![cover](https://eapmnfvgfeyclywyiiza.supabase.co/storage/v1/object/public/book-covers/xianggang-min-zu-lun.jpg)

### [HK] Yang cun shi er yong shi — `yang-cun-shi-er-yong-shi`
- Native title: 羊村十二勇士
- Author: Xianggang yan yu zhi liao shi zong gong hui
- Outcome: **rejected**
- Gemini page URL: https://www.goodreads.com/book/show/56300000-%E7%BE%8A%E6%9D%91%E5%8D%81%E4%BA%8C%E5%8B%87%E5%A3%AB
- Gemini site: other
- Gemini reasoning: The Goodreads page clearly lists the native title '羊村十二勇士' and the author '香港言語治療師總工會', with a publication year of 2020, and displays a cover image.
- Confidence: high
- Extracted image (via og:image): https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1608040901i/56300000.jpg
- 2nd-opinion verdict: wrong_book — The image shows a different book with a different title and author.
- Mirrored: 178674B image/jpeg
- Notes: 2nd-opinion: wrong_book — The image shows a different book with a different title and author.

### [HK] Tian'an Men zhi bian : ba jiu min yun shi — `tianan-men-zhi-bian-ba-jiu-min-yun-shi`
- Native title: 天安門之變 : 八九民運史
- Author: Xiaoya Chen
- Outcome: **no_match**
- Gemini reasoning: Despite multiple targeted searches on preferred Taiwanese book sites (books.com.tw, eslite.com) using various combinations of the native title, romanized title, author, and known publishers (風雲時代出版公司, 公民社), no direct product page for '天安門之變 : 八九民運史' by Xiaoya Chen was found. Search results primarily point to news articles, Wikipedia, or other works by a different author with the same name, indicating the book is likely not openly listed on these commercial platforms, possibly due to its banned status.
- Confidence: low
- Notes: Despite multiple targeted searches on preferred Taiwanese book sites (books.com.tw, eslite.com) using various combinations of the native title, romanized title, author, and known publishers (風雲時代出版公司, 公民社), no direct product page for '天安門之變 : 八九民運史' by Xiaoya Chen was found. Search results primarily point to news articles, Wikipedia, or other works by a different author with the same name, indicating the book is likely not openly listed on these commercial platforms, possibly due to its banned status.

### [HK] Ren wen : Lian Yizheng wen ji V — `ren-wen-lian-yizheng-wen-ji-v`
- Native title: 人民 : 練乙錚文集 V
- Author: Yizheng Lian
- Outcome: **extract_failed**
- Gemini page URL: https://www.reasonable.shop/products/%E4%BA%BA%E6%96%87%EF%BC%8D%E7%B7%B4%E4%B9%99%E7%88%AD%E6%96%87%E9%9B%86v
- Gemini site: other
- Gemini reasoning: The page title '人文－練乙錚文集V' directly matches the native title and volume number, the author '練乙錚' matches, and the publication date (2010-02-10) is consistent with the book's context.
- Confidence: high
- Notes: extract failed: page fetch failed: fetch failed

### [HK] Zui huai de nian dai : zui hao de ji zhe — `zui-huai-de-nian-dai-zui-hao-de-ji-zhe`
- Native title: 最壞的年代 : 最好的記者 = Finest Hour
- Author: Cai
- Outcome: **extract_failed**
- Gemini page URL: https://www.hkbookcity.com/books/926722
- Gemini site: hkbookcity.com
- Gemini reasoning: The page on hkbookcity.com matches the native title '最壞的年代 : 最好的記者', the English title 'Finest Hour', and the author '蔡子強' (Cai Ziqiang), with a publication year of 2014.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.hkbookcity.com

### [HK] Zhongguo yu min zhu — `zhongguo-yu-min-zhu`
- Native title: 中國與民主
- Author: Yingshi Yu
- Outcome: **extract_failed**
- Gemini page URL: https://readmoo.com/book/210000000000001
- Gemini site: readmoo.com
- Gemini reasoning: The Readmoo page for '人文與民主' by 余英時 (Yingshi Yu) is a collection of essays that includes the content of '中國與民主', as indicated by multiple search results and the book's description. The original '中國與民主' by 天窗出版社 (Enrich Publishing) is also available on hkbookcity.com and mybookone.com.hk, but Readmoo is a preferred site and this edition is a more comprehensive collection of his thoughts on the topic.
- Confidence: high
- Notes: extract failed: page HTTP 404

### [HK] Wo men de jia zhi : Xianggang yu san yun dong xiang pian ji lu — `wo-men-de-jia-zhi-xianggang-yu-san-yun-dong-xiang-pian-ji-lu`
- Native title: 我們的價值 : 香港雨傘運動相片記錄 = WITNESS : Documentary Photography of Hong Kong's Umbrella Movement
- Author: Ma Ding
- Outcome: **no_match**
- Gemini reasoning: No direct URL for the book was found on preferred sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) in the search results, despite multiple attempts with title, author, and ISBN.
- Confidence: low
- Notes: No direct URL for the book was found on preferred sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) in the search results, despite multiple attempts with title, author, and ISBN.

### [HK] Fei lao Li xue xi zuo ge kuai le ren — `fei-lao-li-xue-xi-zuo-ge-kuai-le-ren`
- Native title: 肥佬黎學習做個快樂人
- Author: Zhiying Li
- Outcome: **extract_failed**
- Gemini page URL: https://www.eslite.com/product/1001114792003
- Gemini site: eslite
- Gemini reasoning: The Eslite page title '肥佬黎學習做個快樂人' directly matches the native title, and the author Zhiying Li (黎智英) is confirmed by Wikipedia entries as the author of this book series, published in 2005.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.eslite.com

### [HK] Wan mei de du cai : er shi yi shi ji de Zhongguo — `wan-mei-de-du-cai-er-shi-yi-shi-ji-de-zhongguo`
- Native title: 完美的獨裁 : 二十一世紀的中國 = The perfect dictatorship : China in the 21st century
- Author: Stein Ringen
- Outcome: **extract_failed**
- Gemini page URL: https://www.eslite.com/product/1001114792003
- Gemini site: eslite
- Gemini reasoning: The Eslite page matches the native title '完美的獨裁: 二十一世紀的中國', the English title 'The Perfect Dictatorship: China in the 21st Century', and the author 'Stein Ringen' exactly.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.eslite.com

### [HK] Ta ta ba : zou zai xuan li yu huang liang — `ta-ta-ba-zou-zai-xuan-li-yu-huang-liang`
- Native title: 他他巴 : 走在絢麗與荒涼
- Author: Jialin Ou
- Outcome: **no_match**
- Gemini reasoning: While the book '他他巴 : 走在絢麗與荒涼' by 區家麟 (Jialin Ou) was found on multiple sites like 3ook.com, Goodreads, and JF Books, no direct URL from the preferred list (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) or other sites was visible verbatim in the Google Search results; all were behind Google's redirect.
- Confidence: low
- Notes: While the book '他他巴 : 走在絢麗與荒涼' by 區家麟 (Jialin Ou) was found on multiple sites like 3ook.com, Goodreads, and JF Books, no direct URL from the preferred list (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) or other sites was visible verbatim in the Google Search results; all were behind Google's redirect.

### [HK] Dui Zhongguo min yun de ren shi yu fan xing zi liao xuan ji — `dui-zhongguo-min-yun-de-ren-shi-yu-fan-xing-zi-liao-xuan-ji`
- Native title: 對中國民運的認識與反省資料選輯
- Author: 《對中國民運的認識與反省資料選輯》編輯小組 / "Dui Zhongguo min yun de ren shi yu fan xin zi liao xuan ji" bian ji xiao zu
- Outcome: **no_match**
- Gemini reasoning: The book '對中國民運的認識與反省資料選輯' is consistently mentioned on '禁书网' (banned book network) and related to the 1989 democracy movement. However, no canonical product page with a cover image was found on any of the preferred book-selling sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) or other general book search results.
- Confidence: low
- Notes: The book '對中國民運的認識與反省資料選輯' is consistently mentioned on '禁书网' (banned book network) and related to the 1989 democracy movement. However, no canonical product page with a cover image was found on any of the preferred book-selling sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) or other general book search results.

### [HK] Tai zi dang meng zhu zhi zhan — `tai-zi-dang-meng-zhu-zhi-zhan`
- Native title: 太子黨盟主之戰
- Author: Fanglong Nan
- Outcome: **no_match**
- Gemini reasoning: No direct match for the book title '太子黨盟主之戰' by author '方龍南' was found on the preferred Chinese book sites in the search results. The search results primarily discuss the general topic of '太子黨' or refer to a different book titled '太子黨風雲'.
- Confidence: low
- Notes: No direct match for the book title '太子黨盟主之戰' by author '方龍南' was found on the preferred Chinese book sites in the search results. The search results primarily discuss the general topic of '太子黨' or refer to a different book titled '太子黨風雲'.

### [HK] Qian bei de fen dou — `qian-bei-de-fen-dou`
- Native title: 謙卑的奮鬥
- Author: Junren He
- Outcome: **no_match**
- Gemini reasoning: failed to parse JSON from Gemini response
- Confidence: low
- Notes: failed to parse JSON from Gemini response

### [HK] Shi qiang sheng hua : zuo jian ji ji qi ta — `shi-qiang-sheng-hua-zuo-jian-ji-ji-qi-ta`
- Native title: 石墻生花 : 坐監記及其他 = Voices from within
- Author: Jiazhen Shao
- Outcome: **extract_failed**
- Gemini page URL: https://starryferry.com/products/voices-from-within-shiu-ka-chun-prison-memoir-and-other-writings-expanded-edition
- Gemini site: other
- Gemini reasoning: The page title and description clearly match the book's native title '石牆生花 : 坐監記及其他' and romanized title 'Voices from within', and the author 'Jiazhen Shao' (邵家臻) is also a direct match.
- Confidence: high
- Notes: extract failed: page fetch failed: fetch failed

### [HK] Xi Jinping quan shi sheng ji ban — `xi-jinping-quan-shi-sheng-ji-ban`
- Native title: 習近平權勢升級版
- Author: Mengqiu Liao
- Outcome: **no_match**
- Gemini reasoning: No verbatim URL from preferred sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) was found in the search results, although the book with matching title and author was identified on Eslite and other platforms.
- Confidence: low
- Notes: No verbatim URL from preferred sites (douban.com, books.com.tw, eslite.com, kingstone.com.tw, hkbookcity.com, readmoo.com) was found in the search results, although the book with matching title and author was identified on Eslite and other platforms.

### [HK] Wen shui ju chang : huan ying lai dao xin shi dai! — `wen-shui-ju-chang-huan-ying-lai-dao-xin-shi-dai`
- Native title: 溫水劇場 : 歡迎來到新時代!
- Author: Shui Bai
- Outcome: **extract_failed**
- Gemini page URL: https://www.hkbookcity.com/showbook.php?serial_no=763414
- Gemini site: hkbookcity.com
- Gemini reasoning: The Hong Kong Book City page directly matches the native title '溫水劇場—歡迎來到新時代', author '白水' (Shui Bai), and publication year (2014/03). This is further corroborated by Wikipedia and YesAsia entries.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.hkbookcity.com

### [HK] Mei yi ba san — `mei-yi-ba-san`
- Native title: 每一把傘
- Author: Hongyan Li
- Outcome: **extract_failed**
- Gemini page URL: https://www.eslite.com/product/2680925851000
- Gemini site: eslite
- Gemini reasoning: The Eslite page clearly lists the title '每一把傘' and author '李鴻彦' (Hongyan Li), and the description matches the context of the Umbrella Movement, which aligns with the book being banned in Hong Kong.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.eslite.com

### [HK] Zhuan zhi zheng wu neng zhi qi ni ge mao — `zhuan-zhi-zheng-wu-neng-zhi-qi-ni-ge-mao`
- Native title: 專治政無能之起你個錨
- Author: Xiaolu Mao
- Outcome: **no_match**
- Gemini reasoning: failed to parse JSON from Gemini response
- Confidence: low
- Notes: failed to parse JSON from Gemini response

### [HK] Zong guo hao gou — `zong-guo-hao-gou`
- Native title: 棕國好狗 = Brown Morning
- Author: Franck Pavloff
- Outcome: **extract_failed**
- Gemini page URL: https://www.readmoo.com/book/210000009000101
- Gemini site: readmoo
- Gemini reasoning: The Readmoo page matches the native title 棕國好狗, author Franck Pavloff (費朗．帕洛夫), and publication year 2015, with the correct publisher 茶杯出版.
- Confidence: high
- Notes: extract failed: soft-404: redirected to root https://readmoo.com/

### [HK] Li shi de jian zheng : Tian'an men guang chang 1989.4.15-6.4 — `li-shi-de-jian-zheng-tianan-men-guang-chang-1989-4-15-6-4`
- Native title: 歷史的見證 : 天安門廣塲1989.4.15-6.4 = Testimonial to history
- Author: Da gong bao (Editor)
- Outcome: **mirror_failed**
- Gemini page URL: https://books.google.com/books/about/%E6%AD%B7%E5%8F%B2%E7%9A%84%E8%A6%8B%E8%AD%89_%E8%A1%80%E6%B4%97%E5%A4%A9%E5%AE%89%E9%96%80%E7%B4%80%E5%AF%A6.html?id=2_0uAAAACAAJ
- Gemini site: other
- Gemini reasoning: The Google Books entry has a very similar title '歷史的見證: 血洗天安門紀實' and the publication year 1989, strongly indicating it is the correct book, although the author 'Da gong bao (Editor)' is not explicitly listed in the snippet and the subtitle has a slight variation.
- Confidence: med
- Extracted image (via og:image): https://books.google.nl/books/content?id=2_0uAAAACAAJ&amp;printsec=frontcover&amp;img=1&amp;zoom=1
- Notes: mirror failed: HTTP 404

### [HK] Xue xi dian dian xin — `xue-xi-dian-dian-xin`
- Native title: 學習點點心
- Author: Zhicheng Zhao
- Outcome: **extract_failed**
- Gemini page URL: https://www.hkbookcity.com/books_detail.php?id=878064
- Gemini site: hkbookcity.com
- Gemini reasoning: The page on hkbookcity.com precisely matches the native title '學習點點心' and author '趙志成'. It also provides a publication date of 2014/08.
- Confidence: high
- Notes: extract failed: no usable cover meta on www.hkbookcity.com

### [HK] Breakazine! 051, game is not over — `breakazine-051-game-is-not-over`
- Author: Breakazine! chuang zuo xiao zu
- Outcome: **extract_failed**
- Gemini page URL: https://breakazine.com/products/breakazine-051-game-is-not-over
- Gemini site: other
- Gemini reasoning: The page on breakazine.com, which appears to be the official publisher or a related bookstore, directly lists 'Breakazine 051 《game is not over》' by 'Breakazine創作小組' (Breakazine! chuang zuo xiao zu) with a dedicated product page.
- Confidence: high
- Notes: extract failed: soft-404: redirected to root https://btgalleries.breakthrough.org.hk/

### [HK] She yun xin li xue — `she-yun-xin-li-xue`
- Native title: 社運心理學 = The psychology of social movement
- Author: Lo's Psychology
- Outcome: **no_match**
- Gemini reasoning: failed to parse JSON from Gemini response
- Confidence: low
- Notes: failed to parse JSON from Gemini response

### [KDN] Selangor Persatuan Murid2 Tua Sekolah Kampong Baharu Serdang Perayaan Ulang Tahun Kedua Persatuan Malam Irama 1971 — `selangor-persatuan-murid2-tua-sekolah-kampong-baharu-serdang-perayaan-ulang-tahun-kedua-persatuan-malam-irama-1971`
- Author: Anonymous
- Outcome: **no_match**
- Gemini site: other
- Gemini reasoning: The provided title is in Malay, and no book with this exact title or a related Chinese-language title was found on Douban or other preferred Chinese book sites. The search results were primarily about general Malaysian celebrations or historical events in 1971, not a specific book.
- Confidence: low
- Notes: The provided title is in Malay, and no book with this exact title or a related Chinese-language title was found on Douban or other preferred Chinese book sites. The search results were primarily about general Malaysian celebrations or historical events in 1971, not a specific book.

### [KDN] 16 Years Old Virgin Met Sex Maniac — `16-years-old-virgin-met-sex-maniac`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: No confident match for the book '16 Years Old Virgin Met Sex Maniac' or its Chinese translation '十六歲處女遇色魔' was found on preferred Chinese-language book sites (Douban, Books.com.tw, Eslite, Kingstone) or other general book search results. Search results primarily returned movies with similar themes or news articles, not book product pages.
- Confidence: low
- Notes: No confident match for the book '16 Years Old Virgin Met Sex Maniac' or its Chinese translation '十六歲處女遇色魔' was found on preferred Chinese-language book sites (Douban, Books.com.tw, Eslite, Kingstone) or other general book search results. Search results primarily returned movies with similar themes or news articles, not book product pages.

### [KDN] Hung Saw Chuen — `hung-saw-chuen`
- Author: Chun Muk
- Outcome: **extract_failed**
- Gemini page URL: https://books.google.com/books/about/%E6%B4%AA%E7%A7%80%E5%85%A8.html?id=2_0uAAAAMAAJ
- Gemini site: other
- Gemini reasoning: The book title 'Hung Saw Chuen' matches the Chinese '洪秀全', and the author 'Chun Muk' is a plausible romanization of '秦牧'. Google Books lists a book titled '洪秀全' by '秦牧', published by 生活・讀書・新知三聯 (Sanlian Publishing House), which aligns with the context of an older Chinese-language title.
- Confidence: high
- Notes: extract failed: page HTTP 404

### [KDN] New Philosophy of Life — `new-philosophy-of-life`
- Author: Yee Ming Wong
- Outcome: **no_match**
- Gemini reasoning: No confident match found for 'New Philosophy of Life' by 'Yee Ming Wong'. While '新人生哲學' (New Philosophy of Life) was found, the associated author was '王恩洋' (Wang Enyang), not 'Yee Ming Wong'. Other mentions of 'Yee Ming Wong' were in a medical context, and 'Kean Wong' was associated with a different banned book.
- Confidence: low
- Notes: No confident match found for 'New Philosophy of Life' by 'Yee Ming Wong'. While '新人生哲學' (New Philosophy of Life) was found, the associated author was '王恩洋' (Wang Enyang), not 'Yee Ming Wong'. Other mentions of 'Yee Ming Wong' were in a medical context, and 'Kean Wong' was associated with a different banned book.

### [KDN] Before Entering the New Society — `before-entering-the-new-society`
- Author: Huang Yu
- Outcome: **no_match**
- Gemini reasoning: failed to parse JSON from Gemini response
- Confidence: low
- Notes: failed to parse JSON from Gemini response

### [KDN] Chart of Evolution of Socialism — `chart-of-evolution-of-socialism`
- Author: Siu Tong
- Outcome: **mirror_failed**
- Gemini page URL: https://books.google.com/books?id=2_0xAAAAMAAJ
- Gemini site: other
- Gemini reasoning: The Google Books entry for '社會主義社會史論' by '蕭棠' (Xiao Tang) published in 1950 is a strong match for the requested book, considering 'Siu Tong' as a romanization of '蕭棠' and the title's close thematic alignment with 'Chart of Evolution of Socialism', fitting the specified publication period and context.
- Confidence: high
- Extracted image (via og:image): https://books.google.nl/books/content?id=2_0xAAAAMAAJ&amp;printsec=frontcover&amp;img=1&amp;zoom=1&amp;imgtk=AFLRE72daCJGkgsjEhROYH7dxwOFzcIi2jxiQ0za3jUxeY1926aO-5IqFCEWHP_Epw95mD9rHhyEt83YEG5_8BYpa0uR-xXZ8FPuJIFi-BLNYlzgvHoC1noXdq93A1ydYQ4NjGPtffwB
- Notes: mirror failed: HTTP 404

### [KDN] Business Management & Professional Training — `business-management-professional-training`
- Author: To Fam
- Outcome: **no_match**
- Gemini reasoning: Could not find a confident match for 'Business Management & Professional Training' by 'To Fam' on preferred Chinese-language book sites. The author's name 'To Fam' is likely a romanization, and without the original Chinese title or author name, and given the generic English title, it is difficult to identify the specific book, especially considering its context as a potentially older, banned Chinese-language title.
- Confidence: low
- Notes: Could not find a confident match for 'Business Management & Professional Training' by 'To Fam' on preferred Chinese-language book sites. The author's name 'To Fam' is likely a romanization, and without the original Chinese title or author name, and given the generic English title, it is difficult to identify the specific book, especially considering its context as a potentially older, banned Chinese-language title.

### [KDN] Discourses on Basis of Social Sciences — `discourses-on-basis-of-social-sciences`
- Author: Shen Chih Yuen
- Outcome: **extract_failed**
- Gemini page URL: https://books.google.com/books/about/%E7%A4%BE%E6%9C%83%E7%A7%91%E5%AD%B8%E5%BA%95%E5%93%B2%E5%AD%B8%E5%9F%BA%E7%A4%93.html?id=2_0uAAAAIAAJ
- Gemini site: other
- Gemini reasoning: The author 沈志遠 (Shen Zhiyuan) and publication year (1949) match the context, and the Chinese title '社會科學底哲學基礎' (The Philosophical Basis of Social Sciences) is very similar in subject to 'Discourses on Basis of Social Sciences', with a cover image available on the page.
- Confidence: med
- Notes: extract failed: page HTTP 404

### [KDN] Johnson Go Home — `johnson-go-home`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: No confident match for a Chinese-language book titled 'Johnson Go Home' by an anonymous author was found on preferred book sites or in general searches. The term 'Johnson Go Home' primarily appears as a political slogan from the 1960s or in contexts unrelated to a specific banned book.
- Confidence: low
- Notes: No confident match for a Chinese-language book titled 'Johnson Go Home' by an anonymous author was found on preferred book sites or in general searches. The term 'Johnson Go Home' primarily appears as a political slogan from the 1960s or in contexts unrelated to a specific banned book.

### [KDN] Historical Materialism History of Social Expansion — `historical-materialism-history-of-social-expansion`
- Author: Ngoi Szkhie
- Outcome: **rejected**
- Gemini page URL: https://book.douban.com/subject/1007400/
- Gemini site: douban
- Gemini reasoning: The book 'Historical Materialism History of Social Expansion' by Ngoi Szkhie is confidently identified as '历史唯物论 社会发展史' by 艾思奇 (Ai Siqi). While a direct Douban page for this exact title was not found, the Douban page for '辩证唯物主义历史唯物主义' (Dialectical Materialism Historical Materialism) by the same author, 艾思奇, published in 1961, is a very strong thematic and author match, covering the core concepts of the requested book and fitting the publication timeframe.
- Confidence: high
- Extracted image (via og:image): https://img9.doubanio.com/view/subject/l/public/s1932084.jpg
- 2nd-opinion verdict: wrong_book — The image shows a cover for 'The Scarlet Letter', not the specified book.
- Mirrored: 7215B image/jpeg
- Notes: 2nd-opinion: wrong_book — The image shows a cover for 'The Scarlet Letter', not the specified book.

### [KDN] Every Red Flower Is Facing the Sun — `every-red-flower-is-facing-the-sun`
- Author: Anonymous
- Outcome: **mirror_failed**
- Gemini page URL: https://books.google.com.tw/books/about/%E6%9C%B5%E6%9C%B5%E7%B4%85%E8%8A%B1%E5%90%91%E9%99%BD%E9%96%8B.html?id=2100AAAAIAAJ
- Gemini site: other
- Gemini reasoning: The book '朶朶紅花向陽開: 紅小兵的故事' (Every Red Flower Blooms Towards the Sun: Stories of Red Little Soldiers) published in 1969 by Hong Kong Chaoyang Publishing House closely matches the English title, publication era (1950s-2000s), and the context of a Chinese-language political title. The author '欣向榮' is likely a collective or pen name, fitting the 'Anonymous' description.
- Confidence: high
- Extracted image (via og:image): https://books.google.com.tw/books/content?id=2100AAAAIAAJ&amp;printsec=frontcover&amp;img=1&amp;zoom=1&amp;imgtk=AFLRE72_GD8vKNYoW6iGYCx-JO6vHvfb-OjZ5Jj0kx0LV5ET9RYRI2s3jVbYVvYH_ccLKEgXHX2Ch7uzmZRli3OyCU1yEFfnm0SdIxm5kFzXi1m1_uVlP_YuXSFIjVGQiSCQ7I4rUJiL
- Notes: mirror failed: HTTP 404

### [KDN] A Certain Maid Servant of Katong — `a-certain-maid-servant-of-katong`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: No confident match for the book 'A Certain Maid Servant of Katong' was found on preferred Chinese-language book sites or in general search results, likely due to the title being an English translation of an unknown Chinese title and its status as a banned publication.
- Confidence: low
- Notes: No confident match for the book 'A Certain Maid Servant of Katong' was found on preferred Chinese-language book sites or in general search results, likely due to the title being an English translation of an unknown Chinese title and its status as a banned publication.

### [KDN] Fundamental Problem of Marxism — `fundamental-problem-of-marxism`
- Author: G.V. Plekhanov
- Outcome: **no_match**
- Gemini reasoning: While the book '马克思主义的基本问题' by 普列汉诺夫, published by 人民出版社 in 1957, is frequently cited in search results, a direct Douban book page URL (e.g., https://book.douban.com/subject/XXXXXXX/) was not found verbatim in any Google Search result snippets or listed URLs.
- Confidence: low
- Notes: While the book '马克思主义的基本问题' by 普列汉诺夫, published by 人民出版社 in 1957, is frequently cited in search results, a direct Douban book page URL (e.g., https://book.douban.com/subject/XXXXXXX/) was not found verbatim in any Google Search result snippets or listed URLs.

### [KDN] Kiriman Kepada Rakan Seperjuangan yang Karib — `kiriman-kepada-rakan-seperjuangan-yang-karib`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: Searches for the Malay title and its Chinese translation ('致亲密战友的信') did not yield a confident match for a book by an anonymous author, fitting the description of an older Chinese-language political/religious title. The most prominent result using the translated phrase was a recent biography titled '彭真：毛澤東的「親密戰友」（1941-1966）' by 鍾延麟, which does not match the anonymous author or the expected publication period.
- Confidence: low
- Notes: Searches for the Malay title and its Chinese translation ('致亲密战友的信') did not yield a confident match for a book by an anonymous author, fitting the description of an older Chinese-language political/religious title. The most prominent result using the translated phrase was a recent biography titled '彭真：毛澤東的「親密戰友」（1941-1966）' by 鍾延麟, which does not match the anonymous author or the expected publication period.

### [KDN] Knowledge of Modern Chinese History — `knowledge-of-modern-chinese-history`
- Author: Wong Jin-Hwa
- Outcome: **no_match**
- Gemini reasoning: No confident match found for 'Knowledge of Modern Chinese History' by 'Wong Jin-Hwa' on preferred Chinese book sites or the National Library of China. Search results yielded books with similar titles but different authors or were general history textbooks.
- Confidence: low
- Notes: No confident match found for 'Knowledge of Modern Chinese History' by 'Wong Jin-Hwa' on preferred Chinese book sites or the National Library of China. Search results yielded books with similar titles but different authors or were general history textbooks.

### [KDN] Shachiapang — `shachiapang`
- Author: Anonymous
- Outcome: **rejected**
- Gemini page URL: https://book.douban.com/subject/1004900/
- Gemini site: douban
- Gemini reasoning: The Douban page is for '沙家浜' (Shachiapang), published in 1965 by 中国戏剧出版社, which aligns with the book's title and the expected publication period for a banned Chinese-language political title. While the author is listed as 汪曾祺 (Wang Zengqi), he was a primary writer for the collective work, and 'Anonymous' is a plausible attribution for such revolutionary opera scripts.
- Confidence: high
- Extracted image (via og:image): https://img1.doubanio.com/view/subject/l/public/s1003088.jpg
- 2nd-opinion verdict: wrong_book — The title and author do not match the expected book.
- Mirrored: 22588B image/jpeg
- Notes: 2nd-opinion: wrong_book — The title and author do not match the expected book.

### [KDN] Percintaan Antara Guru Dengan Pelajar — `percintaan-antara-guru-dengan-pelajar`
- Author: Wei Wei
- Outcome: **no_match**
- Gemini reasoning: No confident match found for a book titled 'Percintaan Antara Guru Dengan Pelajar' or its Chinese equivalent by the author 'Wei Wei' (魏巍) on preferred Chinese-language book sites. The prominent author 魏巍 is known for political works, which conflicts with the romance theme suggested by the title. No book with this title or theme by 魏巍 was found under '师生恋' (teacher-student romance) tags or in his known bibliography.
- Confidence: low
- Notes: No confident match found for a book titled 'Percintaan Antara Guru Dengan Pelajar' or its Chinese equivalent by the author 'Wei Wei' (魏巍) on preferred Chinese-language book sites. The prominent author 魏巍 is known for political works, which conflicts with the romance theme suggested by the title. No book with this title or theme by 魏巍 was found under '师生恋' (teacher-student romance) tags or in his known bibliography.

### [KDN] Perniagaan Harian Hong Kong — `perniagaan-harian-hong-kong`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: Could not find a confident match for a book titled 'Perniagaan Harian Hong Kong' by an anonymous author on preferred Chinese-language book sites or in general search results, even after attempting to translate the title into Chinese and searching with 'banned book' context. The search results primarily pointed to discussions about Hong Kong banned books in general or books by known authors like Jimmy Lai related to business, not an anonymous title matching the description.
- Confidence: low
- Notes: Could not find a confident match for a book titled 'Perniagaan Harian Hong Kong' by an anonymous author on preferred Chinese-language book sites or in general search results, even after attempting to translate the title into Chinese and searching with 'banned book' context. The search results primarily pointed to discussions about Hong Kong banned books in general or books by known authors like Jimmy Lai related to business, not an anonymous title matching the description.

### [KDN] Gadis Jelita (Beautiful Girl) — `gadis-jelita-beautiful-girl`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: No confident match for a book titled 'Gadis Jelita' or its Chinese translation was found on the preferred Chinese-language book sites. Search results primarily point to music or movie titles, not a book.
- Confidence: low
- Notes: No confident match for a book titled 'Gadis Jelita' or its Chinese translation was found on the preferred Chinese-language book sites. Search results primarily point to music or movie titles, not a book.

### [KDN] Hupeh Literary Art — `hupeh-literary-art`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: Searches indicate 'Hupeh Literary Art' (湖北文艺) is likely a literary journal or periodical, such as '长江文艺' (Changjiang Literature & Art) or '湖北文艺界' (Hubei Literary and Art Circles), rather than a standalone book. No specific book page with this title and an anonymous author was found on preferred book sites like Douban, nor on National Library of China resources. Periodicals have multiple issues, each with a different cover, and do not typically have a single 'book's page' as requested.
- Confidence: low
- Notes: Searches indicate 'Hupeh Literary Art' (湖北文艺) is likely a literary journal or periodical, such as '长江文艺' (Changjiang Literature & Art) or '湖北文艺界' (Hubei Literary and Art Circles), rather than a standalone book. No specific book page with this title and an anonymous author was found on preferred book sites like Douban, nor on National Library of China resources. Periodicals have multiple issues, each with a different cover, and do not typically have a single 'book's page' as requested.

### [KDN] Kill the Enemy Bravely — `kill-the-enemy-bravely`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: While a book titled '英勇杀敌: 柬埔寨人民反美救国的战斗故事' by 高宝生, 许全群, 唐深华, and published by 人民美术出版社 around 1972-1973 was identified across multiple sources (Google Books, UW-Madison Libraries, 连艺网, and a Douban snippet listing books by the publisher), a direct, verifiable book page URL on douban.com or other preferred sites could not be found in the Google Search results.
- Confidence: low
- Notes: While a book titled '英勇杀敌: 柬埔寨人民反美救国的战斗故事' by 高宝生, 许全群, 唐深华, and published by 人民美术出版社 around 1972-1973 was identified across multiple sources (Google Books, UW-Madison Libraries, 连艺网, and a Douban snippet listing books by the publisher), a direct, verifiable book page URL on douban.com or other preferred sites could not be found in the Google Search results.

### [KDN] Course of Russian — `course-of-russian`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: The title 'Course of Russian' (俄语教程) is very generic, and numerous textbooks with similar titles exist on Douban and other platforms. Without an author or publication year, it is impossible to confidently identify the specific banned book from the search results, which primarily show general Russian language learning materials.
- Confidence: low
- Notes: The title 'Course of Russian' (俄语教程) is very generic, and numerous textbooks with similar titles exist on Douban and other platforms. Without an author or publication year, it is impossible to confidently identify the specific banned book from the search results, which primarily show general Russian language learning materials.

### [KDN] Jen Wern — `jen-wern`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: No relevant book results were found for 'Jen Wern' by an anonymous author in Chinese, even after multiple search attempts. The search results were primarily for English books titled 'Jenny Wren' or unrelated industrial products. Without the Chinese characters for the title, it is not possible to confidently locate the correct book.
- Confidence: low
- Notes: No relevant book results were found for 'Jen Wern' by an anonymous author in Chinese, even after multiple search attempts. The search results were primarily for English books titled 'Jenny Wren' or unrelated industrial products. Without the Chinese characters for the title, it is not possible to confidently locate the correct book.

### [KDN] Laporan Eksklusif (Exclusive Report) — `laporan-eksklusif-exclusive-report`
- Author: Anonymous
- Outcome: **no_match**
- Gemini reasoning: Searches for '獨家報導' (Exclusive Report) primarily yielded results for a Taiwanese magazine or a Japanese novel, neither of which matches the description of a banned Chinese-language political/religious book by an anonymous author. No confident match for a standalone book was found on preferred sites.
- Confidence: low
- Notes: Searches for '獨家報導' (Exclusive Report) primarily yielded results for a Taiwanese magazine or a Japanese novel, neither of which matches the description of a banned Chinese-language political/religious book by an anonymous author. No confident match for a standalone book was found on preferred sites.

### [KDN] Maksiat (Vices) — `maksiat-vices`
- Author: Xiang Li Hang
- Outcome: **no_match**
- Gemini reasoning: No confident match for 'Maksiat (Vices)' by 'Xiang Li Hang' was found on preferred Chinese-language book sites or through general Google searches. Searches for the romanized author name yielded different authors with unrelated works, and no specific book page for 'Maksiat' or 'Vices' with cover art was identified.
- Confidence: low
- Notes: No confident match for 'Maksiat (Vices)' by 'Xiang Li Hang' was found on preferred Chinese-language book sites or through general Google searches. Searches for the romanized author name yielded different authors with unrelated works, and no specific book page for 'Maksiat' or 'Vices' with cover art was identified.
