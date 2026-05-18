# ISBN enrichment — suspect list

Derived from the 2026-05-18 `enrich-all` run output and verified against
Open Library's `/isbn/<isbn>.json` endpoint via a one-shot script.

Verdict legend:
- `✗ WRONG` — OL record clearly belongs to a different book. Clear the ISBN.
- `? CHECK` — partial overlap; needs human eye (same author / same series / different volume).
- `✓ MATCH` — OL record matches the DB row. Leave alone.

## ✗ WRONG (19) — recommend clearing the ISBN

| Book # | DB title | DB author | Bad ISBN | OL says it points to |
|---|---|---|---|---|
| 1014 | Over Life's Edge | Victoria Cross | `9780310437178` | NIV Student Bible |
| 6756 | Jie dao shang, zhang peng ren | Zhan ling qu de kang zheng zhe | `9787546303857` | Xi you ji (Journey to the West) |
| 2255 | Don't Ask Me Where I'm From | Jennifer De Leon | `9798593908988` | SuperSummary Study Guide |
| 781 | Devil on the Cross | Ngũgĩ wa Thiong'o | `9798404017427` | SuperSummary Study Guide |
| 2118 | Into the Garden | V.C. Andrews | `9798532003682` | Hamlet by William Shakespeare Illustrated |
| 6820 | Huang si dai yu san, ji xiao ji dan | Qiongzhu Jiang | `9780887271786` | A Dream of Red Mansions |
| 3265 | The Broken Halo | Hamish Steele | `9781454949015` | DeadEndia *(same author, different work)* |
| 4863 | Blade (Series, Title Not Specified) | Tim Bowler | `9780192763617` | Flight *(by same author — but #4863 is the series stub, not Flight)* |
| 7021 | Ko xue ying yang xue | Guo | `9780231081641` | Records of the Grand Historian: Han Dynasty I |
| 3670 | Far Eastern Art | John Scott | `9781433600340` | KJV Study Bible, Jacketed Hardcover |
| 5498 | Crepúsculo: un amor peligroso | Stephanie Meyer | `9780606264693` | Twilight *(English edition's ISBN on Spanish row)* |
| 309 | I'll Give You the Sun | Jandy Nelson | `9788375153545` | Oddam ci słońce *(Polish translation ISBN on English row)* |
| 6241 | Kritik der reinen Vernunft | Immanuel Kant | `9780312450106` | Immanuel Kant's Critique of Pure Reason *(English ISBN on German row)* |
| 1169 | Last Sacrifice | Richelle Mead | `9780141960371` | Vampire Academy *(book 1 ISBN on book 6 row)* |
| 1981 | Soul Eater, Vol. 10 | Atsushi Ohkubo | `9783551792297` | Soul Eater 19 *(wrong volume)* |
| 7382 | Les Mœurs | François-Vincent Toussaint | `9780576121002` | Les Moeurs *(OL record is duplicate ghost; verify and merge upstream)* |
| 7371 | Little Bill | Bill Cosby | `9780439693042` | The Best Way To Play *(specific Little Bill volume — generic row should not pin to one vol)* |
| 7373 | The Adventures of Super Diaper Baby | Dav Pilkey | `9788467557138` | El Capitán Calzoncillos y las aventuras de Superpañal *(Spanish ISBN)* |
| 7372 | Guess What? | Mem Fox | `9781862911345` | Que Crees *(Spanish ISBN on English row)* |
| 7377 | The Death of Lorca | Ian Gibson | `9788450534252` | Antología poética *(Lorca's own poetry, not the biography)* |

## ? CHECK (5) — partial overlap, needs human eye

| Book # | DB title | DB author | ISBN | OL says it points to | Note |
|---|---|---|---|---|---|
| 6989 | Fei lao Li shi bian tian xia | Zhiying Li | `9789578288195` | Lao Fuzi (老夫子) by Ze Wang | Different author entirely — almost certainly wrong |
| 6941 | Zhongguo yu min zhu | Yingshi Yu | `9787208042896` | Shi yu Zhongguo wen hua | Same author, different book — wrong |
| 2775 | The Magical Misfits: The Minor Third | Neil Patrick Harris | `9780316426244` | Magic Misfits | Series-level ISBN on volume row — clear or accept |
| 7159 | Beijing feng bo ji shi | (北京風波紀實 編委會) | `9787530206478` | Xi you ji | Clearly wrong |

## ✓ MATCH (23) — verified correct, no action needed

`341`, `1400`, `368`, `5016`, `7336`, `1088`, `6248`, `6249`, `7112`, `7063`, `4615`, `4647`, `514`, `1985`, `1232`, `3219`, `2103`, `7374`, `7379`, `3929`, `7376`, `7370`, `7378`

## How to apply

```sql
-- Clears all 19 WRONG rows in one statement (audit-friendly).
UPDATE books SET isbn13 = NULL WHERE id IN (
  1014, 6756, 2255, 781, 2118, 6820, 3265, 4863, 7021, 3670,
  5498, 309, 6241, 1169, 1981, 7382, 7371, 7373, 7372, 7377
);
-- Optionally also clear the CHECK rows after manual review:
-- UPDATE books SET isbn13 = NULL WHERE id IN (6989, 6941, 7159);
```

After clearing, the next `enrich-isbn --apply` run will re-attempt those
rows. The 2026-05-18 prefilter + similarity guard ([src/lib/enrich/isbn.ts](../src/lib/enrich/isbn.ts))
should now prevent the same false positives from being re-written.
