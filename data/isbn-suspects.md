# ISBN enrichment — suspect list

Derived from the 2026-05-18 `enrich-all` run output. Each row below is a
book whose `isbn13` was *already in the database when the run started*, and
the run then attempted to assign the **same** ISBN to a clearly unrelated
title. Two interpretations are possible per case:

1. The ISBN on the suspect row was assigned by an earlier enrich-isbn run
   that hit the same OL/GB false positive — i.e. the suspect row's ISBN is
   wrong and was just lucky enough to be written first.
2. The ISBN on the suspect row is correct, but it shares the 9798 POD prefix
   space or a popular-doc-ranking quirk with whatever the new query asked.

Either way, these rows deserve a manual ISBN check before the
title-similarity guard (added 2026-05-18) silently locks them in place.

## High priority — 2+ unrelated titles tried to claim the same ISBN

Strong signal that the ISBN is incorrectly attached to the listed book.

| Book # | Title | ISBN-13 | Tried to claim same ISBN |
|---|---|---|---|
| 1014 | Over Life's Edge | 9780310437178 | The Atlas Six · The Greek News · Six Chapters in a Man's Life |
| 6756 | Jie dao shang, zhang peng ren | 9787546303857 | Jin sheng bu zuo Zhongguo ren · Shen tu bu er · Si jiao yu hui xiang · Xianggang yue yu cheng dao di |
| 2255 | Don't Ask Me Where I'm From | 9798593908988 | Flowers in the Attic · Night Blood · The Drowning Summer |
| 781 | Devil on the Cross | 9798404017427 | Ladies on Call · Taming the Star Runner |
| 2118 | Into the Garden | 9798532003682 | Mu ji tian an men. Di si juan · Mu ji tian an men. Di yi juan |
| 6820 | Huang si dai yu san, ji xiao ji dan | 9780887271786 | Xianggang wu de jiu · Xing jiao yu shi han de |
| 3265 | The Broken Halo | 9781454949015 | The Divine Order · The Watcher's Test |
| 6989 | Fei lao Li shi bian tian xia | 9789578288195 | Shi dao ren sheng zhi wang shi jin shi · Wang Dan yu zhong hui yi lu |

## Medium priority — 1 unrelated title tried to claim the same ISBN

The skip-guard caught these. Worth a spot check — could be either the
existing row or the new candidate that's wrong.

| Book # | Title | ISBN-13 | Tried to claim same ISBN |
|---|---|---|---|
| 4863 | Blade (Series, Title Not Specified) | 9780192763617 | Flight |
| 7021 | Ko xue ying yang xue | 9780231081641 | Min zhu shi wen |
| 6941 | Zhongguo yu min zhu | 9787208042896 | Shi yu Zhongguo wen hua |
| 3670 | Far Eastern Art | 9781433600340 | The Bible |
| 3219 | Pride: Celebrating Diversity and Community | 9781459809932 | Pride: The Celebration and the Struggle |
| 2775 | The Magical Misfits: The Minor Third | 9780316426244 | The Magical Misfits: The Second Story |
| 7159 | Beijing feng bo ji shi | 9787530206478 | Xue xi Jing hua shi lu |

## Low priority — likely legit (translation / same work)

The skip caught these but they look like genuine same-work edition matches.
Decision is whether to *split* into separate rows (preserving each edition's
ISBN) or accept the merge.

| Book # | Title | ISBN-13 | Claimed by | Note |
|---|---|---|---|---|
| 341 | Gabi, a Girl in Pieces | 9781484443798 | Gabi, fragmentos de una adolescente | Spanish edition |
| 1400 | Tomboy: A Graphic Memoir | 9781936976553 | Tomboy: una chica ruda | Spanish edition |
| 5498 | Crepúsculo: un amor peligroso | 9780606264693 | Twilight | English original collided with Spanish edition's ISBN — likely a metadata mix-up; the *English* row should have a different ISBN |
| 309 | I'll Give You the Sun | 9788375153545 | Te daría el sol | Spanish edition |
| 368 | Simon vs. the Homo Sapiens Agenda | 9780062839701 | Yo, Simon, homo sapiens | Spanish edition |
| 5016 | Love, Creekwood | 9780241492246 | Simonverse | Simonverse is a series umbrella; collision is structural |
| 7336 | Little Black Sambo | 9780916410582 | Little Black Sambo (1899) | Same work, dup row should probably be merged |
| 1088 | Respect: Everything a Guy Needs to Know | 9780143134251 | Respect: Everything a Guy Needs to Know About Sex | Same work |
| 6241 | Kritik der reinen Vernunft | 9780312450106 | Critique of Pure Reason | Same work; English ISBN on German title row is wrong direction |
| 6248 | How the Red Sun Rose | 9789629968229 | How the Red Sun Rose: The Origins and Development | Same work |
| 6249 | The Tiananmen Papers | 9781586481223 | Zhongguo "Liu si" zhen xiang | Same work |
| 7112 | Gong min kang ming | 9789888249473 | Gong min kang ming san ju ren | Same work |
| 7063 | Zhongguo min zhu yun dong shi. Cong Yan' | 9789869225755 | Zhongguo min zhu yun dong shi. Cong Zhongguo zhu c | Same series, different volume — should probably get separate ISBNs |
| 4615 | Monument 14 | 9781444914726 | Monument 14: Savage Drift · Monument 14: Sky On Fire | Series volumes — separate ISBNs warranted |
| 4647 | Plague Land | 9781492660231 | Plague Land No Escape · Plague Land Reborn | Series volumes — separate ISBNs warranted |
| 514 | Soul Eater | 9780759530010 | Soul Eater, Vol. 1 · Soul Eater, Vol. 11 | Vol. 1 → same as canonical; Vol. 11 needs its own |
| 1981 | Soul Eater, Vol. 10 | 9783551792297 | Soul Eater, Vol. 19 | Wrong volume mapping |
| 1985 | Soul Eater, Vol. 14 | 9780759530485 | Soul Eater, Vol. 2 | Wrong volume mapping |
| 1232 | Clockwork Angel | 9781406393743 | The Infernal Devices | Series-vs-volume |
| 1169 | Last Sacrifice | 9780141960371 | Vampire Academy (A Graphic Novel) | Different format/work |
| 587 | Far from the Tree (parent suspect) | — | — | Standalone — included for completeness |

## How to verify a row

1. Open `https://www.banned-books.org/admin/books/<id>` and compare its ISBN to a canonical source (OpenLibrary, Library of Congress, Goodreads, publisher site).
2. If wrong: clear the ISBN via `UPDATE books SET isbn13 = NULL WHERE id = <id>;` so the next enrich run can re-attempt (now protected by the similarity guard).
3. If right: leave it. The collisions just mean OL/GB returned a popular-doc false positive against other queries — that's now blocked at the guard layer.

## Notes

- The two **accepted writes from the 2026-05-18 run** that bypassed both
  guard and dup-skip and may also be wrong (low-confidence):
  - `Les Mœurs (Toussaint, 1748)` → 9780576121002 — plausible 1980s reprint, verify
  - `The Other Boy` → 9798855056198 — 9798 POD prefix, verify against title
  - `Little Bill` → 9780439693042 — series umbrella; if not the specific vol, clear
  - `Përbindëshi` → 9789994332168 — Albanian ISBN prefix, plausible
  - `The Adventures of Super Diaper Baby` → 9788467557138 — Spanish edition ISBN on English row?
