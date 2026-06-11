# OpenLibrary title-mismatch audit

Generated 2026-06-04T09:21:22.812Z.
Population (books with openlibrary_work_id, excl. blanket-works): **5725**
Mode: **random sample** of 150.
Checked against OpenLibrary: **150** · fetch errors: 0 · unverifiable book titles: 0
Raw suspects (zero shared title token): **7**
Author-corroborated CONFIRMED: **3** · likely-translation: 4 · unverified: 0
Confirmed rate among checked: **2.00%** → extrapolated ≈ **115** of 5725

## CONFIRMED — different title AND different author (3)

Linked to a genuinely different book; cover_url / isbn13 / description_book are likely wrong. Prime remediation targets.

| id | our title | our author | linked OL work | OL author | desc src | /books/ |
|---|---|---|---|---|---|---|
| 1028 | The Joy of Sex | Alex Comfort | Polymath | Eric Laursen | llm_grounded_multi | /books/the-joy-of-sex |
| 1047 | Islam | Matthew S. Gordon | Slave elites in the Middle East and Africa | John Edward Philips | openlibrary | /books/islam-gordon |
| 7644 | Pandora Hearts | Jun Mochizuki | Jun Mochizuki artworks | 望月淳 | — | /books/pandora-hearts |

## UNVERIFIED — title differs, author could not be compared (0)

| id | our title | our author | linked OL work | OL author | desc src | /books/ |
|---|---|---|---|---|---|---|

## LIKELY_TRANSLATION — different title but SAME author = same work, different-language title (4)

Almost certainly fine (original/translated title). Listed for completeness.

| id | our title | our author | linked OL work | OL author | desc src | /books/ |
|---|---|---|---|---|---|---|
| 64 | All Quiet on the Western Front | Erich Maria Remarque | Im Westen nichts Neues | Erich Maria Remarque | llm_grounded_multi | /books/all-quiet-on-the-western-front |
| 452 | Spy x Family | Tatsuya Endo | スパイファミリー | Tatsuya Endo | llm_grounded_multi | /books/spy-x-family |
| 6913 | Ta men de zheng tu : zhi ji, yu hui yu chong zhuang, Zhongguo nü xing de gong min jue xing zhi lu | Sile Zhao | 她們的征途：直擊、迂迴與衝撞，中國女性的公民覺醒之路 | 趙思樂 | — | /books/ta-men-de-zheng-tu-zhi-ji-yu-hui-yu-chong-zhuang-zhongguo-nu-xing-de-gong-min-jue-xing-zhi-lu |
| 9676 | A Different Season | Anonymous | Descriptive Account of the Island of Jamaica | Anonymous | — | /books/a-different-season |
