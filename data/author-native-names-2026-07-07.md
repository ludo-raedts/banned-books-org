# Author native-name enrichment — 2026-07-07 (consolidated)

Scope: the 50 authors with ≥1 book banned in CN (`--country=CN`), all with
`name_native IS NULL` at start. Three passes, 42/50 filled; the remaining 8 are
Latin-script authors whose `name_native` stays NULL by column doctrine.

Source: Wikidata (CC-0) / cited references. Gates: stored-qid | P569 birth-year |
P800 notable-work | reverse P50 work search | hand-verified (one-off script).

## Pass 1 — `enrich-author-native-names.ts --country=CN --apply` (27 written)

| Author | Native name | Lang | Gate | Source | QID |
|---|---|---|---|---|---|
| Yu Hua | 余华 | zh | birth-year | P1559 | Q379520 |
| Mo Yan | 莫言 | zh | birth-year | P1559 | Q8998 |
| Jung Chang | 张戎 | zh | birth-year | P1559 | Q235291 |
| Gao Xingjian | 高行健 | zh | birth-year | P1559 | Q18143 |
| Yang Jisheng | 杨继绳 | zh | birth-year | label:zh (P103/P1412) | Q553393 |
| Wei Hui | 卫慧 | zh | birth-year | label:zh (P103/P1412) | Q198025 |
| Li Zhisui | 李志綏 | zh | birth-year | label:zh (P103/P1412) | Q492897 |
| Zhao Ziyang | 赵紫阳 | zh | birth-year | P1559 | Q99829 |
| Yan Lianke | 閻連科 | zh | birth-year | label:zh (P103/P1412) | Q348180 |
| Chen Guidi | 陳桂棣 | zh | birth-year | label:zh (book lang) | Q5090769 |
| Li Hongzhi | 李洪志 | zh | notable-work | label:zh (P103/P1412) | Q366373 |
| Ma Jian | 馬建 | zh | notable-work | P1559 | Q389454 |
| Liao Yiwu | 廖亦武 | zh | birth-year | P1559 | Q708187 |
| Tsering Woeser | 唯色 | zh | birth-year | label:zh (P103/P1412) | Q1204117 |
| Ilham Tohti | ئىلھام توختى | ug | birth-year | P1559 | Q1894882 |
| Liu Xiaobo | 刘晓波 | zh | birth-year | P1559 | Q41617 |
| Ai Weiwei | 艾未未 | zh | birth-year | label:zh (P1559 stub "艾") | Q160115 |
| Chan Koonchung | 陳冠中 | zh | birth-year | P1559 | Q8928926 |
| Murong Xuecun | 慕容雪村 | zh | birth-year | label:zh (P103/P1412) | Q1021166 |
| Hajime Isayama | 諫山 創 | ja | birth-year | P1559 | Q3782468 |
| Wang Lixiong | 王力雄 | zh | birth-year | label:zh (book lang) | Q708860 |
| Gao Hua | 高华 | zh | birth-year | label:zh (P103/P1412) | Q12269960 |
| Zhang Yihe | 章诒和 | zh | birth-year | label:zh (P103/P1412) | Q197324 |
| Qin Hui | 秦晖 | zh | birth-year | label:zh (P103/P1412) | Q5950606 |
| Yu Jie | 余杰 | zh | birth-year | P1559 | Q1855794 |
| Daisuke Satō | 佐藤大輔 | ja | birth-year | P1559 | Q2066927 |
| Tsugumi Ohba | 大場 つぐみ | ja | notable-work | P1559 | Q558858 |

## Pass 2 — `--author-ids=147,4463,5765,1286 --lang=zh --apply` (4 written)

Matched entities whose native label needed the sitelink / `--lang` ladder rungs.

| Author | Native name | Lang | Gate | Source | QID |
|---|---|---|---|---|---|
| Nien Cheng | 郑念 | zh | birth-year | label:zh (via --lang) | Q463030 |
| Sui Ishida | 石田スイ | ja | notable-work | label:ja (P103/P1412; P1559 was romaji-junk) | Q11586892 |
| Zhang Zhenglong | 张正隆 | zh | reverse-work | label:zh (via --lang) | Q9091344 |
| Gao Wenqian | 高文謙 | zh | birth-year | label:zh (via --lang) | Q710135 |

## Pass 3 — `_apply_cn_author_native_names.ts --apply` (11 hand-verified)

No automatic gate available (no stored birth_year and no matchable work item).
Each value verified by hand on 2026-07-07; source per row in the script.

| Author | Native name | Lang | Source |
|---|---|---|---|
| Joshua Wong | 黃之鋒 | zh | en.wikipedia langlink |
| Xu Zhiyong | 许志永 | zh | en.wikipedia langlink |
| Fang Fang | 方方 | zh | en.wikipedia langlink |
| Louisa Lim | 林慕蓮 | zh | zh.wikipedia (香港不屈) |
| Zhang Liang | 张良 | zh | zh.wikipedia (天安門文件); pseudonym |
| Mian Mian | 棉棉 | zh | en.wikipedia langlink |
| Tan Hecheng | 谭合成 | zh | zh.wikipedia (血的神话) |
| Gu Zhen Ren | 蛊真人 | zh | en.wikipedia (Reverend Insanity); pen name = novel title |
| Shōji Satō | 佐藤ショウジ | ja | ja.wikipedia (NOT 佐藤翔治 the badminton namesake) |
| Chen Wutong | 陈梧桐 | zh | zh.wikipedia (Ming historian, matches The Chongzhen Emperor) |
| Chen Xiwo | 陈希我 | zh | paper-republic.org |

## Correctly left NULL (Latin-script authors, column doctrine)

George Orwell (5), Justin Richardson (8), Peter Parnell (9), Lewis Carroll
(148), Thomas Piketty (180), Charlotte Brontë (185), Terry Southern (4583),
Mason Hoffenberg (5880).

## Side-writes

- `wikidata_id` filled where NULL on gated matches: CN-author coverage 3 → 30.
- `original_language` set where NULL (needed for the hero `lang=` attribute).
